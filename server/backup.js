'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {validatePatch,validateLibrary,defaults,writeJson,readEffectJson}=require('./store'),schema=require('./studio-schema'),{builtin}=require('./studio');
const MAX=16*1024*1024,id=/^[a-f0-9]{24}$/,object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function fields(v,allowed) {if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('Backup: campos inválidos.');}
function devices(value) {if(!object(value)||Object.keys(value).length>256)throw Error('Backup: componentes inválidos.');const result={};for(const [key,v] of Object.entries(value)){if(!id.test(key))throw Error('Backup: identificador inválido.');result[key]=validatePatch(v,true);}return result;}
function normalize(value,effects) {
  fields(value,['version','master','devices','profiles','alexaEnabled','zones','studio','performance','library']);
  if(value.version!==1||typeof value.alexaEnabled!=='boolean'||!Array.isArray(value.profiles)||value.profiles.length>32)throw Error('Backup: configuração incompatível.');
  const studio=(v,withLayout)=>{
    fields(v,withLayout?['enabled','activeId','values','excluded','layout']:['enabled','activeId','values','excluded']);
    if(typeof v.enabled!=='boolean'||!id.test(v.activeId||'')||!effects.has(v.activeId)||!Array.isArray(v.excluded||[])||(v.excluded||[]).length>256||(v.excluded||[]).some(n=>typeof n!=='string'||!id.test(n)))throw Error('Backup: referência de efeito inválida.');
    return {enabled:v.enabled,activeId:v.activeId,values:schema.parameters(effects.get(v.activeId),v.values||{}),excluded:[...new Set(v.excluded||[])],...(withLayout?{layout:schema.layout(v.layout||[])}:{})};
  };
  const result={version:1,master:{...defaults,...validatePatch(value.master)},devices:devices(value.devices||{}),alexaEnabled:value.alexaEnabled,profiles:[]},seen=new Set();
  for(const p of value.profiles){fields(p,['id','name','master','devices','studio']);if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(p.id||'')||seen.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>48)throw Error('Backup: perfil inválido.');seen.add(p.id);result.profiles.push({id:p.id,name:p.name.trim(),master:{...defaults,...validatePatch(p.master)},devices:devices(p.devices||{}),...(p.studio?{studio:studio(p.studio,false)}:{})});}
  if(value.studio)result.studio=studio(value.studio,true);
  if(value.performance){fields(value.performance,['fps']);if(!Number.isInteger(value.performance.fps)||value.performance.fps<5||value.performance.fps>60)throw Error('Backup: FPS inválido.');result.performance={fps:value.performance.fps};}
  result.zones={};if(value.zones!==undefined){if(!object(value.zones)||Object.keys(value.zones).length>128)throw Error('Backup: zonas inválidas.');for(const [controller,zones]of Object.entries(value.zones)){if(!id.test(controller)||!object(zones)||Object.keys(zones).length>256)throw Error('Backup: zonas inválidas.');result.zones[controller]={};for(const [zone,count]of Object.entries(zones)){if(!/^\d{1,5}$/.test(zone)||!Number.isInteger(count)||count<1||count>4096)throw Error('Backup: quantidade de zona inválida.');result.zones[controller][zone]=count;}}}
  if(value.library!==undefined)result.library=validateLibrary(value.library);
  return result;
}
class Backups {
  constructor(store,studio,directory){this.store=store;this.studio=studio;this.directory=directory;}
  files(){const values=[];for(const [key,effect]of this.studio.effects){if(effect.builtin)continue;const {original}=readEffectJson(path.join(this.studio.directory,key+'.json'));if(this.studio.parse(original).id!==key)throw Error('Backup: efeito divergente.');values.push({id:key,original});}return values.sort((a,b)=>a.id.localeCompare(b.id));}
  export(){const result={format:'nexus-backup/1',version:require('../package.json').version,createdAt:new Date().toISOString(),settings:structuredClone(this.store.data),effects:this.files()};if(Buffer.byteLength(JSON.stringify(result))>MAX)throw Error('Backup: limite de 16 MiB.');return result;}
  digest(){return crypto.createHash('sha256').update(JSON.stringify({settings:this.store.data,effects:this.files()})).digest('hex');}
  async review(input){
    if(this.busy||this.studio.importing)throw Error('Aguarde a operação da biblioteca em andamento.');this.busy=true;this.studio.importing=true;this.pending=null;
    try{
      fields(input,['format','version','createdAt','settings','effects']);if(input.format!=='nexus-backup/1'||!Array.isArray(input.effects)||input.effects.length>67||Buffer.byteLength(JSON.stringify(input))>MAX)throw Error('Backup: formato ou tamanho inválido.');
      const digest=this.digest(),effects=new Map(builtin.map(e=>[e.id,{...e,builtin:true}])),files=[];
      const seen=new Set();for(const item of input.effects){fields(item,['id','original']);const effect=this.studio.parse(item.original);if(effect.id!==item.id||seen.has(effect.id))throw Error('Backup: efeito duplicado ou divergente.');seen.add(effect.id);if(effects.get(effect.id)?.builtin)continue;effects.set(effect.id,effect);files.push({id:effect.id,original:item.original});}
      const settings=normalize(input.settings,effects),deadline=Date.now()+20000;
      for(const file of files){if(Date.now()>deadline)throw Error('Backup: validação excedeu o tempo.');await this.studio.probe(effects.get(file.id));}
      if(this.studio.stopped)throw Error('O aplicativo está encerrando.');if(digest!==this.digest())throw Error('As configurações mudaram. Revise o backup novamente.');
      const merged=new Map(this.studio.effects);for(const [key,value]of effects)merged.set(key,value);if(merged.size>67)throw Error('Limite de 64 efeitos importados.');
      const token=crypto.randomBytes(24).toString('hex'),expiresAt=Date.now()+5*60000;this.pending={token,expiresAt,digest,settings,files,effects:merged};
      return {token,expiresAt,summary:{profiles:settings.profiles.length,positions:settings.studio?.layout.length||0,imports:files.length,availableImports:merged.size-builtin.length,alexaEnabled:settings.alexaEnabled,fps:settings.performance?.fps||20}};
    }finally{this.busy=false;this.studio.importing=false;}
  }
  apply(token){
    const pending=this.pending;if(this.busy||this.studio.importing||!pending||typeof token!=='string'||token!==pending.token||Date.now()>pending.expiresAt)throw Error('Revisão do backup inválida ou expirada.');
    if(pending.digest!==this.digest()){this.pending=null;throw Error('As configurações mudaram. Revise o backup novamente.');}
    this.pending=null;const before=this.export(),folder=path.join(this.directory,'backups');fs.mkdirSync(folder,{recursive:true});if(fs.lstatSync(folder).isSymbolicLink())throw Error('Pasta de backup inválida.');
    const name='before-restore-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.json';writeJson(path.join(folder,name),before);
    const created=[];try{
      fs.mkdirSync(this.studio.directory,{recursive:true});if(fs.lstatSync(this.studio.directory).isSymbolicLink())throw Error('Pasta de efeitos inválida.');
      for(const item of pending.files){const file=path.join(this.studio.directory,item.id+'.json');if(fs.existsSync(file)){if(this.studio.parse(readEffectJson(file).original).id!==item.id)throw Error('Backup: arquivo de efeito inválido.');continue;}writeJson(file,{original:item.original});created.push(file);}
      this.store.data=pending.settings;this.store.save();
    }catch(error){for(const file of created)try{fs.unlinkSync(file);}catch{}throw error;}
    // Imported files are immutable content-addressed additions. Existing library
    // entries are retained, so a crash before the atomic settings commit cannot
    // remove the user's effects or require a multi-file rollback journal.
    this.studio.effects=pending.effects;this.studio.reset();this.studio.hardware.cancelIdentification?.();this.studio.hardware.setFps?.();this.studio.hardware.changed();this.studio.changed();return {backup:name};
  }
}
module.exports={Backups,normalize,MAX};
