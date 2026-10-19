'use strict';
const http=require('node:http'),dgram=require('node:dgram'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const network=require('./network'),{readJson,writeJson,effects}=require('./store'),{fields,name,number}=require('./experiences');
function target(input,getInterfaces) {
  if(typeof input.address!=='string'||!network.privateIp(input.address)||!network.sameSubnet(input.address,getInterfaces())||Object.values(os.networkInterfaces()).flat().some(a=>a?.address===input.address))throw Error('WLED: use um IPv4 de outra controladora na mesma rede privada.');
  const ip=network.ipv4(input.address);
  for(const a of getInterfaces()){const mask=network.ipv4(a.netmask),host=(ip&~mask)>>>0;if(mask!==null&&network.sameSubnet(input.address,[a])&&(host===0||host===(~mask>>>0)))throw Error('WLED: endereço de rede ou broadcast inválido.');}
  return {address:input.address,port:number(input.port??80,1,65535),ddpPort:4048};
}
function packets(rgb,sequence=0) {
  const data=Buffer.from(rgb.flatMap(c=>[c.red,c.green,c.blue])),result=[];
  for(let offset=0;offset<data.length;offset+=1440){const part=data.subarray(offset,offset+1440),header=Buffer.alloc(10);header[0]=0x40|(offset+part.length===data.length?1:0);header[1]=sequence&15;header[2]=1;header[3]=1;header.writeUInt32BE(offset,4);header.writeUInt16BE(part.length,8);result.push(Buffer.concat([header,part]));}return result;
}
function jsonRequest(destination,route,body,requests) {
  return new Promise((resolve,reject)=>{
    const payload=body?JSON.stringify(body):null;
    const req=http.request({host:destination.address,port:destination.port,path:route,method:payload?'POST':'GET',agent:false,headers:payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}},res=>{
      let size=0;const chunks=[];res.on('data',c=>{size+=c.length;if(size>65536)req.destroy(Error('WLED: resposta muito grande.'));else chunks.push(c);});res.on('error',reject);res.on('end',()=>{if(res.statusCode!==200)return reject(Error('WLED: resposta HTTP inválida.'));try{resolve(JSON.parse(Buffer.concat(chunks).toString()));}catch{reject(Error('WLED: resposta JSON inválida.'));}});
    });requests.add(req);req.once('close',()=>requests.delete(req));req.on('error',reject);req.setTimeout(2000,()=>req.destroy(Error('WLED: tempo de resposta excedido.')));req.end(payload);
  });
}
class Room {
  constructor(hardware,studio,directory,changed,options={}) {
    this.hardware=hardware;this.studio=studio;this.changed=changed;this.getInterfaces=options.getInterfaces||network.adapters;this.resolveTarget=options.resolveTarget||(v=>target(v,this.getInterfaces));this.file=path.join(directory,'room.json');this.entries=[];this.runtime=new Map();this.revision=0;this.requests=new Set();this.busy=false;this.socket=null;this.timer=null;this.stopped=false;this.error=null;
    try{const saved=readJson(this.file,{version:1,devices:[]});fields(saved,['version','devices']);if(saved.version!==1||!Array.isArray(saved.devices)||saved.devices.length>8)throw Error();this.entries=saved.devices.map(d=>this.validate(d));}catch{this.error='Configuração WLED inválida; arquivo original preservado.';}
    this.schedule();
  }
  validate(d) {fields(d,['id','name','address','port','mode','enabled','ledCount','effectId','preset']);if(!network.privateIp(d.address)||!['map','native'].includes(d.mode)||typeof d.enabled!=='boolean')throw Error('WLED: configuração inválida.');return {id:d.id&&/^[a-f0-9]{24}$/.test(d.id)?d.id:crypto.randomBytes(12).toString('hex'),name:name(d.name),address:d.address,port:number(d.port??80,1,65535),mode:d.mode,enabled:d.enabled,ledCount:number(d.ledCount,1,4096),effectId:number(d.effectId??0,0,255),preset:number(d.preset??0,0,250)};}
  snapshot() {return {devices:this.entries.map(d=>({...d,status:!d.enabled?'disabled':this.runtime.get(d.id)?.online?'online':'unconfirmed',error:this.runtime.get(d.id)?.error||null})),error:this.error};}
  devices() {return this.entries.map(d=>{const settings=this.hardware.settings(d.id),online=Boolean(d.enabled&&this.runtime.get(d.id)?.online);return {id:d.id,name:d.name,vendor:'WLED',type:4,kind:'network',ledCount:d.ledCount,status:online?'online':'offline',stale:!online,spatialCapable:d.mode==='map',effects,modes:[],zones:[],settings:{...settings,power:d.enabled&&settings.power},mapExcluded:(this.studio.config.excluded||[]).includes(d.id),customized:Object.hasOwn(this.hardware.store.data.devices,d.id)};});}
  async put(input) {
    if(this.error)throw Error(this.error);fields(input,['id','name','address','port','mode','enabled','effectId','preset']);
    if(input.id!==undefined&&(typeof input.id!=='string'||!/^[a-f0-9]{24}$/.test(input.id)))throw Error('Identificador WLED inválido.');
    if(this.entries.some(d=>d.address===input.address&&d.id!==input.id))throw Error('Essa controladora WLED já está cadastrada. Use Editar.');
    const destination=this.resolveTarget(input),info=await jsonRequest(destination,'/json/info',null,this.requests);
    if(info.brand!=='WLED'||typeof info.ver!=='string')throw Error('O endereço não confirmou uma controladora WLED.');
    const d=this.validate({...input,ledCount:info.leds?.count}),next=[...this.entries],at=next.findIndex(i=>i.id===d.id),previous=at<0?null:next[at],previousState=previous&&this.runtime.get(previous.id);
    if(at<0){if(next.length>=8)throw Error('Limite de 8 controladoras WLED.');next.push(d);}else next[at]=d;
    if(this.stopped)throw Error('O aplicativo está encerrando.');writeJson(this.file,{version:1,devices:next});this.entries=next;this.runtime.set(d.id,{online:true,verified:true,last:null,failures:0,nextAt:0});this.revision++;this.schedule();this.changed();
    let warning;
    if(previousState?.last==='ddp'&&previousState.destination&&(!d.enabled||d.mode!=='map'||previous.address!==d.address||previous.port!==d.port))try{await jsonRequest(previousState.destination,'/json/state',{live:false,on:Boolean(this.hardware.settings(d.id).power&&this.hardware.settings(d.id).brightness>0)},this.requests);}catch{warning='Não foi possível liberar o modo ao vivo da WLED. Confira a controladora.';}
    return {id:d.id,...this.snapshot(),...(warning?{warning}:{})};
  }
  async remove(id) {
    if(this.error)throw Error(this.error);const state=this.runtime.get(id),entry=this.entries.find(d=>d.id===id),next=this.entries.filter(d=>d.id!==id);
    writeJson(this.file,{version:1,devices:next});this.entries=next;this.runtime.delete(id);this.revision++;this.schedule();this.changed();
    if(entry&&state?.last==='ddp'&&state.destination)try{await jsonRequest(state.destination,'/json/state',{live:false,on:Boolean(this.hardware.settings(id).power&&this.hardware.settings(id).brightness>0)},this.requests);}catch{return {warning:'Não foi possível liberar o modo ao vivo da WLED. Confira a controladora.'};}
    return {};
  }
  schedule() {clearTimeout(this.timer);this.timer=null;if(this.stopped||!this.entries.some(d=>d.enabled))return;this.timer=setTimeout(async()=>{await this.flush();this.schedule();},1000/(this.hardware.store.data.performance?.fps||20));this.timer.unref?.();}
  async flush() {
    if(this.busy||this.stopped)return;this.busy=true;
    try {for(const d of this.entries){
      if(!d.enabled)continue;const state=this.runtime.get(d.id)||{online:false,verified:false,last:null,failures:0,nextAt:0};this.runtime.set(d.id,state);if(Date.now()<state.nextAt)continue;
      try {
        if(!state.destination||Date.now()>state.targetUntil){state.destination=this.resolveTarget(d);state.targetUntil=Date.now()+5000;}
        const destination=state.destination;
        if(!state.verified){const info=await jsonRequest(destination,'/json/info',null,this.requests);if(info.brand!=='WLED'||info.leds?.count!==d.ledCount)throw Error('WLED: confira a quantidade de LEDs e salve novamente.');state.verified=true;}
        const settings=this.hardware.settings(d.id),on=Boolean(settings.power&&settings.brightness>0);
        const streamed=d.mode==='map'&&on&&(this.studio.hasDevice(d.id)||this.hardware.experiences?.isAnimating()||settings.effect!=='static');
        if(!streamed){
          const body={on,bri:Math.max(1,Math.round(settings.brightness*2.55)),live:false,tt:0,seg:[{id:0,col:[[...settings.color.slice(1).match(/../g).map(v=>parseInt(v,16))]],fx:d.mode==='native'?d.effectId:0,sx:Math.round(settings.speed*2.55)}],...(d.mode==='native'&&d.preset?{ps:d.preset}:{})};
          const signature=JSON.stringify(body);if(state.last!==signature){
            await jsonRequest(destination,'/json/state',body,this.requests);state.last=signature;
            if(!on)this.hardware.output.set(d.id,{colors:Array.from({length:d.ledCount},()=>({red:0,green:0,blue:0})),at:Date.now(),source:'off'});
            else if(d.mode==='map')this.hardware.rememberOutput(d.id,this.hardware.renderFrame(d.id,settings,d.ledCount,this.hardware.now()/1000),settings);
          }
        }else{
          // Brightness lives in pixel values. WLED's global multiplier must not
          // attenuate them again. No HTTP request per frame.
          if(state.last!=='ddp'){await jsonRequest(destination,'/json/state',{on:true,bri:255,live:true,tt:0},this.requests);state.last='ddp';}
          if(this.stopped||this.runtime.get(d.id)!==state||!this.hardware.settings(d.id).power)continue;
          if(!this.socket){this.socket=dgram.createSocket('udp4');this.socket.on('error',()=>{});}
          if(this.socket.getSendQueueSize()>65536)continue;
          const colors=this.hardware.renderFrame(d.id,settings,d.ledCount,this.hardware.now()/1000),rgb=Buffer.from(colors.flatMap(c=>[c.red,c.green,c.blue]));
          if(!state.rgb?.equals(rgb)||Date.now()-(state.sentAt||0)>500){for(const packet of packets(colors,state.sequence=(state.sequence||0)%15+1))await new Promise((resolve,reject)=>this.socket.send(packet,destination.ddpPort,destination.address,e=>e?reject(e):resolve()));state.rgb=rgb;state.sentAt=Date.now();this.hardware.rememberOutput(d.id,colors,settings);}
        }
        if(!state.online){state.online=true;this.revision++;this.changed();}state.failures=0;state.error=null;
      }catch{if(this.stopped)continue;state.online=false;state.verified=false;state.last=null;state.error='WLED indisponível. Confira rede e controladora.';state.nextAt=Date.now()+Math.min(60000,2000*2**Math.min(5,state.failures++));this.revision++;this.changed();}
    }}finally{this.busy=false;}
  }
  close() {
    if(this.closing)return this.closing;
    const release=this.entries.filter(d=>this.runtime.get(d.id)?.last==='ddp').map(d=>({destination:this.runtime.get(d.id).destination,body:{live:false,on:Boolean(this.hardware.settings(d.id).power&&this.hardware.settings(d.id).brightness>0)}})).filter(d=>d.destination);
    this.stopped=true;clearTimeout(this.timer);for(const request of this.requests)request.destroy();this.requests.clear();if(this.socket){try{this.socket.close();}catch{}this.socket=null;}
    this.closing=Promise.allSettled(release.map(d=>jsonRequest(d.destination,'/json/state',d.body,this.requests)));return this.closing;
  }
}
module.exports={Room,packets,target};
