'use strict';
const path=require('node:path');
const {createHash}=require('node:crypto');
const {readJson,writeJson}=require('./store');
const {identify}=require('./cooling-identification');
const {profiles,validate}=require('./cooling-config');
const {valueAt:curve}=require('../public/cooling-model');
class Cooling {
  constructor(directory,options={}){
    this.options=options;this.now=options.now||Date.now;this.file=path.join(directory,'cooling.json');
    this.config={profile:'balanced',assignments:[],customProfiles:[],channelPreferences:[],resumeOnStartup:false};this.enabled=false;this.mode='off';this.bridge=null;this.activeProfile=null;
    this.data={sensors:[],controls:[],fans:[],simulated:false};this.outputs=[];this.previous=new Map();
    this.queue=Promise.resolve();this.pending=0;this.error=null;this.lastSent='';this.timer=null;
    this.resumePending=false;this.resumeAttempts=0;this.resumeGeneration=0;this.resumeTimer=null;
    let saved;
    try{saved=readJson(this.file,this.config);this.config=validate(saved);}
    catch(error){
      this.error=error.message;this.mode='fault';
      // Keep valid curves visible if only the startup record is damaged.
      // Never rewrite the original file or infer an enabled state on load.
      if(saved)try{this.config=validate({...saved,resumeOnStartup:false,resumeProfile:null,bindings:[]});}catch{}
    }
  }
  serial(run,shutdown=false){
    if(!shutdown&&(this.closing||this.pending>=4))return Promise.reject(Error('A ventilação está ocupada. Aguarde a operação atual.'));
    this.pending++;const result=this.queue.then(()=>{if(this.closing&&!shutdown)throw Error('Ventilação encerrada.');return run();});this.queue=result.catch(()=>{}).finally(()=>{this.pending--;});return result;
  }
  allProfiles(){return [...profiles.map(p=>({...p,interpolation:'linear'})),...(this.config.customProfiles||[]).map(p=>({...p,custom:true}))];}
  start(){
    if(this.startupStarted||this.closing||!this.config.resumeOnStartup)return;
    this.startupStarted=true;this.resumePending=true;
    this.tryResume(this.resumeGeneration);
  }
  cancelResume(){
    this.resumeGeneration++;clearTimeout(this.resumeTimer);this.resumeTimer=null;this.resumePending=false;
  }
  tryResume(generation){
    if(this.closing||generation!==this.resumeGeneration||!this.config.resumeOnStartup)return;
    this.resumeAttempts++;this.mode='starting';
    this.startup=this.configure({enabled:true},true).then(()=>{
      if(generation===this.resumeGeneration)this.resumePending=false;
    }).catch(error=>{
      if(this.closing||generation!==this.resumeGeneration)return;
      this.error=error.message;
      const delays=this.options.resumeRetryDelays||[1000,2000,4000,8000,15000,30000,30000];
      if(error.code==='ECOOLING_IDENTITY'||this.resumeAttempts>delays.length){this.resumePending=false;this.mode='fault';return;}
      this.mode='waiting';this.resumeTimer=setTimeout(()=>{this.resumeTimer=null;this.tryResume(generation);},delays[this.resumeAttempts-1]);this.resumeTimer.unref?.();
    });
  }
  bindings(assignments){
    const key=row=>createHash('sha256').update(JSON.stringify([this.data.board?.manufacturer?.trim().toUpperCase()||'',this.data.board?.model?.trim().toUpperCase()||'',row.id,row.originalName||row.name])).digest('hex');
    return assignments.map(a=>{
      const control=this.data.controls.find(c=>c.id===a.controlId),sensor=this.data.sensors.find(s=>s.id===a.sensorId);
      if(!control||!sensor)throw Error('Canal ou sensor indisponível. Confira a associação.');
      return {controlId:a.controlId,controlKey:key(control),sensorKey:key(sensor)};
    });
  }
  checkBindings(config){
    if(JSON.stringify(this.bindings(config.assignments))!==JSON.stringify(config.bindings)){const error=Error('O equipamento ou o sensor mudou. Confira a associação antes de retomar o controle.');error.code='ECOOLING_IDENTITY';throw error;}
  }
  checkResume(generation){
    if(this.closing||generation!==this.resumeGeneration){const error=Error('Inicialização de ventilação cancelada.');error.code='ECANCELLED';throw error;}
  }
  snapshot(){const selected=this.allProfiles().find(p=>p.id===this.config.profile);return {enabled:this.enabled,mode:this.mode,...structuredClone(this.config),resumePending:this.resumePending,resumeAttempts:this.resumeAttempts,profiles:structuredClone(this.allProfiles()),profilePending:Boolean(this.enabled&&this.config.assignments.some(a=>!a.points)&&(JSON.stringify(this.activeProfile?.points)!==JSON.stringify(selected?.points)||this.activeProfile?.interpolation!==selected?.interpolation)),
    ...structuredClone(this.data),outputs:structuredClone(this.outputs),error:this.error,
    available:Boolean(this.options.bridgeFactory||this.options.allowHardware||this.options.simulated),development:true};}
  schedule(){clearTimeout(this.timer);if(this.options.autoPoll!==false&&this.bridge)this.timer=setTimeout(()=>this.tick().catch(()=>{if(this.bridge)this.schedule();}),1000);this.timer?.unref?.();}
  async open(){
    if(this.bridge)return;
    this.error=null;this.mode='starting';
    try{
      const {CoolingBridge}=require('./cooling-bridge');
      this.bridge=this.options.bridgeFactory?this.options.bridgeFactory():new CoolingBridge(this.options);
      this.accept(await this.bridge.request({action:'open'}));this.mode='monitoring';this.schedule();
    }catch(error){await this.off();this.error=error.message;throw error;}
  }
  accept(value){
    if(!value||!Number.isFinite(value.at)||Math.abs(this.now()-value.at)>4000)throw Error('A leitura de ventilação está atrasada.');
    const rows=(key,max)=>{if(!Array.isArray(value[key])||value[key].length>max)throw Error('Lista de sensores inválida.');return value[key].map(row=>{
      if(!row||typeof row.id!=='string'||row.id.length>180||!row.id||typeof row.name!=='string'||row.name.length>160)throw Error('Sensor inválido.');
      return key==='controls'?{id:row.id,name:row.name,min:row.min,max:row.max}:
        {id:row.id,name:row.name,value:Number.isFinite(row.value)?row.value:null};
    });};
    const next={at:value.at,simulated:value.simulated===true,sensors:rows('sensors',128),controls:rows('controls',64),fans:rows('fans',128)};
    if(next.controls.some(c=>!Number.isFinite(c.min)||!Number.isFinite(c.max)||c.min<0||c.max>100||c.min>=c.max))throw Error('Limites do canal de ventilação inválidos.');
    for(const key of ['sensors','controls','fans'])if(new Set(next[key].map(r=>r.id)).size!==next[key].length)throw Error('Identificadores de ventilação repetidos.');
    const r=value.resources;
    if(r&&r.pid===this.bridge?.pid&&Number.isInteger(r.pid)&&/^\d+$/.test(String(r.start))&&/^\d+$/.test(String(r.cpuTicks))&&Number.isSafeInteger(r.memoryBytes)&&r.memoryBytes>=0)
      next.resources={pid:r.pid,role:'cooling-helper',start:String(r.start),cpuTicks:String(r.cpuTicks),memoryBytes:r.memoryBytes};
    if(value.board&&typeof value.board.manufacturer==='string'&&typeof value.board.model==='string')next.board={manufacturer:value.board.manufacturer.slice(0,160),model:value.board.model.slice(0,160)};
    this.data=identify(next,this.config.channelPreferences);
  }
  monitor(){return this.serial(async()=>{await this.open();return this.snapshot();});}
  unmonitor(){return this.serial(async()=>{if(this.mode==='monitoring'&&!this.enabled&&!this.resumePending)await this.off();return this.snapshot();});}
  configure(body,restoring=false){
    const generation=this.resumeGeneration;
    if(!restoring&&body?.enabled===false&&Object.keys(body).length===1){const pending=this.resumePending;this.cancelResume();if(pending||this.mode==='starting')this.bridge?.cancel?.();}
    return this.serial(async()=>{try{return await this.update(body,restoring,generation);}catch(error){if(restoring)await this.off();throw error;}});
  }
  async update(body,restoring,generation){
    if(restoring)this.checkResume(generation);
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['enabled','profile','assignments','customProfiles','channelPreferences'].includes(k)))throw Error('Configuração de ventilação inválida.');
    if(body.channelPreferences!==undefined){
      if(Object.keys(body).length!==1)throw Error('Salve a identificação separadamente da ativação.');
      const config=validate({...this.config,channelPreferences:body.channelPreferences});
      writeJson(this.file,config);this.config=config;this.data=identify(this.data,config.channelPreferences);return this.snapshot();
    }
    if(body.customProfiles!==undefined){
      if(Object.keys(body).length!==1)throw Error('Salve os perfis separadamente da ativação.');
      const config=validate({...this.config,customProfiles:body.customProfiles});
      writeJson(this.file,config);this.config=config;return this.snapshot();
    }
    if(body.enabled!==undefined&&typeof body.enabled!=='boolean')throw Error('Ativação de ventilação inválida.');
    const next={...this.config,...body};
    if(body.profile&&!body.assignments)next.assignments=next.assignments.map(({points,interpolation,...a})=>a);
    const enabled=body.enabled??this.enabled;next.resumeOnStartup=restoring&&this.config.resumeOnStartup;
    if(!restoring)next.resumeProfile=null;
    const config=validate(next);
    config.resumeProfile=enabled?structuredClone(restoring?config.resumeProfile:this.allProfiles().find(p=>p.id===config.profile)):null;
    if(restoring&&!config.resumeProfile){const error=Error('Confira e aplique uma curva antes de ativar a retomada.');error.code='ECOOLING_IDENTITY';throw error;}
    if(enabled&&!config.assignments.length)throw Error('Selecione ao menos um canal e seu sensor.');
    if(enabled){
      await this.open();
      if(restoring){this.checkResume(generation);this.mode='starting';}
      if(restoring)this.accept(await this.bridge.request({action:'sample'}));
      if(restoring)this.checkResume(generation);
      for(const a of config.assignments){
        const channel=this.data.controls.find(c=>c.id===a.controlId),sensor=this.data.sensors.find(s=>s.id===a.sensorId);
        if(!channel||!sensor)throw Error('Canal ou sensor indisponível. Confira a associação.');
        if(!channel.controllable)throw Error('Este canal não oferece uma faixa segura de controle.');
        if(a.minPercent>channel.limits.maximum)throw Error('O mínimo escolhido excede o limite do canal.');
        if(restoring&&(!Number.isFinite(sensor.value)||sensor.value< -20||sensor.value>150))throw Error('Aguardando uma temperatura válida para retomar a ventilação.');
      }
      if(restoring)this.checkBindings(config);else config.bindings=this.bindings(config.assignments);
    }
    try{
      if(body.assignments&&this.enabled)await this.bridge.request({action:'release'});
      if(!restoring)writeJson(this.file,config);
    }catch(error){if(this.enabled){await this.off();this.mode='fault';this.error=error.message;}throw error;}
    this.config=config;this.previous.clear();this.lastSent='';
    if(!restoring)this.cancelResume();
    if(!enabled){if(body.enabled===false)await this.off();return this.snapshot();}
    this.activeProfile=structuredClone(config.resumeProfile);this.enabled=true;this.mode='controlling';await this.step(!restoring);
    if(!restoring){
      try{const armed={...this.config,resumeOnStartup:true};writeJson(this.file,armed);this.config=armed;}
      catch(error){await this.off();this.mode='fault';this.error=error.message;throw error;}
    }
    return this.snapshot();
  }
  async step(sample=true){
    if(!this.bridge)return;
    try{
      if(sample)this.accept(await this.bridge.request({action:'sample'}));
      if(this.enabled){
        this.checkBindings(this.config);
        const now=this.now(),preset=this.activeProfile;
        const outputs=this.config.assignments.map(a=>{
          const control=this.data.controls.find(c=>c.id===a.controlId);
          if(!control)throw Error('Um canal de ventilação foi desconectado.');
          if(!control.controllable||a.minPercent>control.limits.maximum)throw Error('O limite do canal mudou. Revise a velocidade mínima antes de reativar.');
          const temperature=this.data.sensors.find(s=>s.id===a.sensorId)?.value;
          const failsafe=!Number.isFinite(temperature)||temperature< -20||temperature>150;
          const emergency=failsafe||temperature>=a.critical||preset.id==='turbo'&&!a.points;
          const points=a.points||preset.points;
          let percent=emergency?100:curve(points,temperature,a.points?a.interpolation||'linear':preset.interpolation||'linear');
          const old=this.previous.get(a.controlId);
          let referenceTemperature=temperature;
          if(old&&!emergency){
            if(percent<old.percent&&Math.abs(temperature-old.temperature)<2){percent=old.percent;referenceTemperature=old.temperature;}
            percent=Math.max(percent,old.percent-Math.max(0,now-old.at)/1000*12);
          }
          percent=Math.max(a.minPercent,control.limits.minimum,Math.min(control.limits.maximum,Math.round(percent)));
          this.previous.set(a.controlId,{percent,temperature:referenceTemperature,at:now});
          return {id:a.controlId,percent,temperature,failsafe,emergency,rpm:this.data.fans.find(f=>f.id===a.rpmId)?.value??null};
        });
        const values=outputs.map(({id,percent})=>({id,percent})),signature=JSON.stringify(values);
        if(signature!==this.lastSent){await this.bridge.request({action:'apply',values});this.lastSent=signature;}
        this.outputs=outputs;
      }
      this.schedule();
    }catch(error){await this.off();this.error=error.message;this.mode='fault';throw error;}
  }
  tick(){return this.serial(()=>this.step());}
  async off(){
    clearTimeout(this.timer);this.timer=null;this.enabled=false;this.mode='off';
    const bridge=this.bridge;this.bridge=null;
    try{if(bridge)await bridge.request({action:'release'});}catch(error){this.error='Não foi possível confirmar a liberação do controle automático.';}
    finally{try{await bridge?.close();}catch{this.error='Não foi possível confirmar a liberação do controle automático.';}}
    this.data={sensors:[],controls:[],fans:[],simulated:false};this.outputs=[];this.previous.clear();this.lastSent='';this.activeProfile=null;
  }
  resourceRows(){return this.bridge&&this.data.resources?[structuredClone(this.data.resources)]:[];}
  close(){this.closing=true;const pending=this.resumePending;this.cancelResume();if(pending||this.mode==='starting')this.bridge?.cancel?.();return this.serial(()=>this.off(),true);}
}
module.exports={Cooling};
