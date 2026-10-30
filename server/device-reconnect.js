'use strict';
const crypto=require('node:crypto');
const {preserveJson,validatePatch}=require('./store');
const schema=require('./studio-schema');
const idPattern=/^[a-f0-9]{24}$/;
const conflict=message=>Object.assign(Error(message),{status:409});

class DeviceReconnect {
  constructor(store,hardware,directory){this.store=store;this.hardware=hardware;this.directory=directory;this.pending=null;}
  contexts(data=this.store.data){return [data,...(data.profiles||[])];}
  references(value,id){return Boolean(value.devices?.[id]||value.studio?.excluded?.includes(id)||value.studio?.layout?.some(item=>item.deviceId===id));}
  catalog(){
    const devices=this.hardware.snapshot().devices,present=new Set(devices.filter(d=>d.status!=='offline').map(d=>d.id));
    const saved=new Set(),names=new Map();
    for(const value of this.contexts()){
      for(const id of Object.keys(value.devices||{}))saved.add(id);
      for(const id of value.studio?.excluded||[])saved.add(id);
      for(const item of value.studio?.layout||[]){saved.add(item.deviceId);names.set(item.deviceId,item.name);}
    }
    return {
      sources:[...saved].filter(id=>idPattern.test(id)&&!present.has(id)).map(id=>({id,name:names.get(id)||null})),
      targets:devices.filter(d=>d.status==='online'&&d.effects?.length).map(d=>({id:d.id,name:d.name,ledCount:d.ledCount}))
    };
  }
  digest(){
    const devices=this.hardware.snapshot().devices.map(d=>({id:d.id,status:d.status,ledCount:d.ledCount,effects:d.effects,spatialCapable:d.spatialCapable,type:d.type}));
    return crypto.createHash('sha256').update(JSON.stringify([this.store.data,devices])).digest('hex');
  }
  prepare(body){
    if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['from','to'].includes(k)))throw Error('Escolha a origem e o destino da reconexão.');
    const {from,to}=body;
    if(typeof from!=='string'||!idPattern.test(from))throw Error('Escolha a origem e o destino da reconexão.');
    if(typeof to!=='string'||!idPattern.test(to)||from===to)throw Error('Escolha a origem e o destino da reconexão.');
    const catalog=this.catalog();
    const source=catalog.sources.find(s=>s.id===from);
    if(!source)throw conflict('A origem não está desconectada ou não possui ajustes salvos.');
    const target=this.hardware.snapshot().devices.find(d=>d.id===to&&d.status==='online');
    if(!target||!target.effects?.length)throw conflict('Destino indisponível ou sem controle de iluminação.');
    if(this.contexts().some(value=>this.references(value,to)))throw conflict('O destino já tem ajustes salvos. Revise-os antes de reconectar.');
    const next=structuredClone(this.store.data),omitted=new Set();let layoutItems=0,profileCount=0;
    if(next.zones?.[from])omitted.add('zones');
    for(const [index,value]of this.contexts(next).entries()){
      if(index&&this.references(value,from))profileCount++;
      if(value.devices?.[source.id]){
        const patch={...value.devices[source.id]};
        if('nativeMode'in patch){delete patch.nativeMode;omitted.add('nativeMode');}
        if('syncWithPc'in patch&&target.type!==5){delete patch.syncWithPc;omitted.add('syncWithPc');}
        if(patch.effect&&!target.effects.includes(patch.effect))throw conflict('O destino não suporta um dos movimentos salvos.');
        value.devices[target.id]=validatePatch(patch,true);delete value.devices[source.id];
      }
      if(value.studio?.excluded)value.studio.excluded=value.studio.excluded.map(id=>id===from?to:id);
      if(value.studio?.layout){
        value.studio.layout=value.studio.layout.map(item=>{
          if(item.deviceId!==from)return item;
          if(target.spatialCapable===false||item.start+item.count>target.ledCount)throw conflict('O mapa salvo não cabe nos LEDs disponíveis do destino. Confira a quantidade antes de reconectar.');
          layoutItems++;return {...item,deviceId:to};
        });
        schema.layout(value.studio.layout);
      }
    }
    return {next,summary:{from,to,source:source.name,target:target.name,layoutItems,profileCount,omitted:[...omitted],lighting:next.devices?.[target.id]||null}};
  }
  review(body){
    const {summary}=this.prepare(body),token=crypto.randomBytes(24).toString('hex');
    // Keep only a digest and IDs while the dialog is open, not a full copy of
    // personal profiles/layout. Apply rebuilds after checking the digest.
    this.pending={token,from:body.from,to:body.to,digest:this.digest(),expires:Date.now()+3*60000,hasOmissions:Boolean(summary.omitted.length)};
    return {token,...summary};
  }
  apply(body){
    if(!body||Object.keys(body).some(k=>!['token','acceptOmissions'].includes(k))||body.acceptOmissions!==undefined&&typeof body.acceptOmissions!=='boolean')throw Error('Confirmação de reconexão inválida.');
    const pending=this.pending;
    if(!pending||body.token!==pending.token||Date.now()>pending.expires||this.digest()!==pending.digest)throw conflict('A revisão expirou ou a configuração mudou. Revise novamente.');
    if(pending.hasOmissions&&!body.acceptOmissions)throw conflict('Confirme os ajustes que não serão transferidos.');
    const {next}=this.prepare({from:pending.from,to:pending.to});
    if(!preserveJson(this.directory,'before-reconnect-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.json',this.store.data))throw conflict('Não foi possível preservar os ajustes antes da transferência. Revise novamente.');
    this.store.data=next;this.store.save();this.pending=null;
    return {applied:true};
  }
}
module.exports={DeviceReconnect};
