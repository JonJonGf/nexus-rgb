'use strict';
// Optional experiences never modify saved lighting. A manual command relinquishes
// ownership immediately; stopping/restarting cannot restore over a later edit.
const path = require('node:path'), crypto = require('node:crypto');
const {readJson, validatePatch} = require('./store');
const spatial=require('../public/spatial'), live=require('../public/live-model');
const object = v => v && typeof v === 'object' && !Array.isArray(v);
function fields(v, allowed) { if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) throw Error('Experiência: campos inválidos.'); }
function number(v, min, max) { if (!Number.isInteger(v) || v < min || v > max) throw Error('Experiência: número fora do limite.'); return v; }
function name(v) { if (typeof v !== 'string' || !v.trim() || v.trim().length > 48) throw Error('Nome: 1 a 48 caracteres.'); return v.trim(); }
function gesture(e,recorded=false) {
  fields(e,['x','y','color','kind','durationMs','radius',...(recorded?['atMs']:[])]);
  for(const k of ['x','y'])if(typeof e[k]!=='number'||!Number.isFinite(e[k])||e[k]<0||e[k]>1)throw Error('Gesto fora do mapa.');
  if(!/^#[a-f0-9]{6}$/i.test(e.color)||!['ripple','trail','sweep'].includes(e.kind))throw Error('Gesto inválido.');
  const radius=e.radius??.18;if(typeof radius!=='number'||!Number.isFinite(radius)||radius<.02||radius>1)throw Error('Raio inválido.');
  return {x:e.x,y:e.y,color:e.color.toLowerCase(),kind:e.kind,radius,durationMs:number(e.durationMs??1200,100,4000),...(recorded?{atMs:number(e.atMs,0,30000)}:{})};
}
function settings(input) {
  fields(input,['audio','context']);const result={};
  if(input.audio!==undefined){const a=input.audio;fields(a,['enabled','gain','palette','axis']);if(typeof a.enabled!=='boolean'||typeof a.gain!=='number'||!Number.isFinite(a.gain)||a.gain<.1||a.gain>8||!['x','y'].includes(a.axis)||!Array.isArray(a.palette)||a.palette.length!==3||a.palette.some(c=>typeof c!=='string'||!/^#[a-f0-9]{6}$/i.test(c)))throw Error('Áudio: configuração inválida.');result.audio={enabled:a.enabled,gain:a.gain,palette:a.palette,axis:a.axis};}
  if(input.context!==undefined){const c=input.context;fields(c,['enabled','rules']);if(typeof c.enabled!=='boolean'||!Array.isArray(c.rules)||c.rules.length>32)throw Error('Contexto: configuração inválida.');result.context={enabled:c.enabled,rules:c.rules.map(r=>{fields(r,['application','profileId']);if(typeof r.application!=='string'||!/^[a-z0-9][a-z0-9 ._-]{0,95}\.exe$/i.test(r.application)||typeof r.profileId!=='string'||!/^[a-f0-9-]{36}$/.test(r.profileId))throw Error('Regra de aplicativo inválida.');return {application:r.application.toLowerCase(),profileId:r.profileId};})};if(new Set(result.context.rules.map(r=>r.application)).size!==c.rules.length)throw Error('Aplicativo duplicado nas regras.');}
  return result;
}
function recording(r) {
  fields(r,['id','name','events']);
  if(r.id!==undefined&&(typeof r.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.id)))throw Error('Identificador de gravação inválido.');
  if(!Array.isArray(r.events)||!r.events.length||r.events.length>256)throw Error('Gravação: use de 1 a 256 gestos.');
  return {id:r.id||crypto.randomUUID(),name:name(r.name),events:r.events.map(e=>gesture(e,true)).sort((a,b)=>a.atMs-b.atMs)};
}
function configuration(saved,profiles) {
  fields(saved,['version','scenes','recordings','audio','context']);if(saved.version!==1||!Array.isArray(saved.scenes)||saved.scenes.length>32||!Array.isArray(saved.recordings||[])||(saved.recordings||[]).length>16)throw Error('Experiências: configuração inválida.');
  if([...saved.scenes,...(saved.recordings||[])].some(i=>!i?.id))throw Error('Identificador de experiência ausente.');
  const value={version:1,scenes:saved.scenes.map(scene),recordings:(saved.recordings||[]).map(recording),...settings({audio:saved.audio||{enabled:false,gain:1,palette:['#ff0055','#00ff99','#0099ff'],axis:'y'},context:saved.context||{enabled:false,rules:[]}})};
  if(new Set(value.scenes.map(s=>s.id)).size!==value.scenes.length||new Set(value.recordings.map(r=>r.id)).size!==value.recordings.length)throw Error('Identificador de experiência duplicado.');
  if(profiles){const ids=new Set(profiles.map(p=>p.id));if(value.context.rules.some(r=>!ids.has(r.profileId))||value.scenes.some(s=>s.steps.some(e=>e.profileId&&!ids.has(e.profileId)||e.recordingId&&!value.recordings.some(r=>r.id===e.recordingId))))throw Error('Referência de experiência ausente.');}
  if(Buffer.byteLength(JSON.stringify(value))>512*1024)throw Error('Experiências: limite de 512 KiB.');return value;
}
function scene(input) {
  fields(input, ['id','name','steps','repeat','alexa']);
  if(input.id!==undefined&&(typeof input.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input.id)))throw Error('Identificador de cena inválido.');
  if (!Array.isArray(input.steps) || !input.steps.length || input.steps.length > 64) throw Error('Cena: use de 1 a 64 etapas.');
  const steps = input.steps.map(s => {
    fields(s, ['durationMs','transitionMs','lighting','profileId','recordingId']);
    const durationMs = number(s.durationMs, 100, 3600000), transitionMs = number(s.transitionMs ?? 0, 0, 3000);
    if (Boolean(s.lighting) === Boolean(s.profileId)) throw Error('Escolha iluminação ou perfil por etapa.');
    if (s.profileId && (typeof s.profileId !== 'string' || !/^[a-f0-9-]{36}$/.test(s.profileId))) throw Error('Perfil inválido.');
    if(s.recordingId!==undefined&&(typeof s.recordingId!=='string'||!/^[a-f0-9-]{36}$/.test(s.recordingId)))throw Error('Gravação inválida.');
    return {durationMs, transitionMs, ...(s.profileId ? {profileId:s.profileId} : {lighting:validatePatch(s.lighting)}),...(s.recordingId?{recordingId:s.recordingId}:{})};
  });
  const repeat = number(input.repeat ?? 1, 1, 99);
  if (steps.reduce((n,s) => n+s.durationMs,0)*repeat > 86400000) throw Error('Cena: duração máxima de 24 horas.');
  if (input.alexa !== undefined && typeof input.alexa !== 'boolean') throw Error('Ativação Alexa inválida.');
  return {id:input.id && /^[a-f0-9-]{36}$/.test(input.id) ? input.id : crypto.randomUUID(), name:name(input.name), steps, repeat, alexa:input.alexa === true};
}
class Experiences {
  constructor(store, hardware, studio, directory, changed) {
    this.store=store; this.hardware=hardware; this.studio=studio; this.changed=changed;
    this.file=path.join(directory,'experiences.json');
    this.data=configuration({version:1,scenes:[]}); this.error=null;
    try { this.data=configuration(store.data.experiences||readJson(this.file,this.data)); }
    catch { this.error='Configuração de experiências inválida; arquivo original preservado.'; }
    this.active=null; this.override=null; this.timer=null;
    this.events=[];this.replay=null;this.geometry=null;
    this.bands=[0,0,0];this.signalAt=0;this.capture='stopped';this.contextOverride=null;this.application=null;this.contextTimer=null;this.blockedApplication=null;
  }
  save(next) { if(this.error)throw Error(this.error);const valid=configuration(next,this.store.data.profiles);this.store.data.experiences=valid;this.store.save();this.data=valid; }
  reload() {this.stop();this.data=configuration(this.store.data.experiences||{version:1,scenes:[]});this.error=null;this.bands=[0,0,0];this.bandAt=null;}
  usesProfile(id) {return this.data.context.rules.some(r=>r.profileId===id)||this.data.scenes.some(s=>s.steps.some(e=>e.profileId===id));}
  snapshot(admin=false) { return {scenes:this.data.scenes,recordings:this.data.recordings,audio:this.data.audio,context:admin?this.data.context:{enabled:this.data.context.enabled},capture:Date.now()-this.signalAt<12000?this.capture:'unavailable',contextActive:Boolean(this.contextOverride),active:this.active?{id:this.active.scene.id,name:this.active.scene.name,step:this.active.index+1,repeat:this.active.cycle+1,endsAt:this.active.endsAt}:null,error:this.error}; }
  configure(input) {const valid=settings(input);for(const r of valid.context?.rules||[])if(!this.store.data.profiles.some(p=>p.id===r.profileId))throw Error('Perfil não encontrado.');this.save({...this.data,...valid});this.bands=[0,0,0];this.contextOverride=null;this.blockedApplication=null;clearTimeout(this.contextTimer);this.hardware.changed();this.changed();return this.snapshot(true);}
  stop() {this.events=[];this.replay=null;this.cancel();this.hardware.changed();}
  agentConfig() {return {audio:this.data.audio.enabled,context:this.data.context.enabled&&this.data.context.rules.length>0};}
  signal(input) {
    fields(input,['bands','application','capture']);
    if(input.bands!==undefined&&(!Array.isArray(input.bands)||input.bands.length!==3||input.bands.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)))throw Error('Bandas de áudio inválidas.');
    if(input.capture!==undefined&&!['active','stopped','error'].includes(input.capture))throw Error('Estado de captura inválido.');
    if(input.application!==undefined&&(typeof input.application!=='string'||input.application.length>100||input.application&&!/^[a-z0-9][a-z0-9 ._-]{0,95}\.exe$/i.test(input.application)))throw Error('Aplicativo inválido.');
    this.signalAt=Date.now();if(input.capture)this.capture=input.capture;
    if(input.bands&&this.data.audio.enabled){this.bands=input.bands;this.bandAt=performance.now();this.hardware.changed();}
    if(input.application!==undefined&&this.data.context.enabled){
      const application=input.application.toLowerCase();if(application!==this.application)this.blockedApplication=null;this.application=application;
      const rule=this.data.context.rules.find(r=>r.application===application),profile=rule&&this.store.data.profiles.find(p=>p.id===rule.profileId);
      const next=application!==this.blockedApplication&&profile?profile:null;
      if(this.contextOverride?.id!==next?.id){this.contextOverride=next?structuredClone(next):null;this.hardware.changed();this.changed();}
      clearTimeout(this.contextTimer);this.contextTimer=setTimeout(()=>{this.contextOverride=null;this.hardware.changed();this.changed();},12000);this.contextTimer.unref?.();
    }
    return {accepted:true};
  }
  record(input) {const item=recording(input),next=structuredClone(this.data);if(next.recordings.length>=16)throw Error('Limite de 16 gravações.');next.recordings.push(item);this.save(next);this.changed();return {id:item.id,...this.snapshot()};}
  removeRecording(id) {if(this.data.scenes.some(s=>s.steps.some(e=>e.recordingId===id)))throw Object.assign(Error('Gravação em uso por uma cena.'),{status:409});const next=structuredClone(this.data);next.recordings=next.recordings.filter(r=>r.id!==id);this.save(next);if(this.replay?.id===id)this.replay=null;this.hardware.changed();this.changed();}
  replayRecording(id) {const r=this.data.recordings.find(r=>r.id===id);if(!r)throw Error('Gravação não encontrada.');const at=performance.now();this.replay={id,events:r.events.map(e=>({...e,rgb:[1,3,5].map(i=>parseInt(e.color.slice(i,i+2),16)),at:at+e.atMs})),until:at+Math.max(...r.events.map(e=>e.atMs+e.durationMs))+1000};this.hardware.changed();return {playing:true};}
  touch(body) {fields(body,['events']);if(!Array.isArray(body.events)||!body.events.length||body.events.length>16)throw Error('Gesto: lote inválido.');const events=body.events.map(e=>({...gesture(e),rgb:[1,3,5].map(i=>parseInt(e.color.slice(i,i+2),16)),at:performance.now()}));this.events=[...this.events.filter(e=>performance.now()<e.at+e.durationMs+1000),...events].slice(-32);this.hardware.changed();return {accepted:events.length};}
  isAnimating() {const now=performance.now();this.events=this.events.filter(e=>now<e.at+e.durationMs+1000);if(this.replay&&now>this.replay.until)this.replay=null;return Boolean(this.events.length||this.replay||this.data.audio.enabled&&now-(this.bandAt||-Infinity)<2000);}
  compose(id,colors,settings) {
    if(!settings.power||settings.brightness<=0||(this.studio.config.excluded||[]).includes(id)||!this.isAnimating())return colors;
    const layout=this.studio.layout();if(this.geometry?.layout!==layout){const points=new Map();for(const item of layout)for(const p of spatial.points(item)){if(!points.has(p.deviceId))points.set(p.deviceId,[]);points.get(p.deviceId)[p.index]={x:p.x/320,y:p.y/200};}this.geometry={layout,points};}
    const points=this.geometry.points.get(id);if(!points)return colors;
    const at=performance.now(),events=[...this.events,...(this.replay?.events||[])].filter(e=>at>=e.at&&at<e.at+e.durationMs).slice(-32),brightness=settings.brightness/100,audio=this.data.audio,age=at-(this.bandAt||-Infinity),palette=audio.palette.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
    const maximum=Math.round(255*brightness);
    return colors.map((c,i)=>{
      const p=points[i];if(!p)return c;const v=live.sample(p.x,p.y,events,at);
      if(audio.enabled&&age<1000){const band=Math.min(2,Math.max(0,Math.floor(p[audio.axis]*3))),level=Math.min(1,this.bands[band]*audio.gain)*Math.max(0,1-Math.max(0,age-250)/750),color=palette[band];v.red=Math.min(255,v.red+color[0]*level);v.green=Math.min(255,v.green+color[1]*level);v.blue=Math.min(255,v.blue+color[2]*level);v.alpha=Math.max(v.alpha,level);}
      // Gestures accumulate additively; their alpha is the strongest gesture.
      // Saturate the complete mix, not just the overlay, before SDK byte encoding.
      const mix=(base,overlay)=>Math.max(0,Math.min(maximum,Math.round(base*(1-v.alpha)+overlay*brightness)));
      return {red:mix(c.red,v.red),green:mix(c.green,v.green),blue:mix(c.blue,v.blue)};
    });
  }
  put(input) {
    const item=scene(input), next=structuredClone(this.data), index=next.scenes.findIndex(s=>s.id===item.id);
    for(const step of item.steps) if(step.profileId&&!this.store.data.profiles.some(p=>p.id===step.profileId))throw Error('Perfil não encontrado.');
    for(const step of item.steps) if(step.recordingId&&!this.data.recordings.some(r=>r.id===step.recordingId))throw Error('Gravação não encontrada.');
    if(index<0) { if(next.scenes.length>=32)throw Error('Limite de 32 cenas.'); next.scenes.push(item); } else next.scenes[index]=item;
    this.save(next); this.changed(); return {id:item.id,...this.snapshot()};
  }
  remove(id) { if(!this.data.scenes.some(s=>s.id===id))throw Error('Cena não encontrada.'); const next=structuredClone(this.data); next.scenes=next.scenes.filter(s=>s.id!==id); this.save(next); if(this.active?.scene.id===id)this.cancel(); this.changed(); }
  play(id) {
    const item=this.data.scenes.find(s=>s.id===id); if(!item)throw Error('Cena não encontrada.');
    // Resolve references before taking ownership. Profiles may have been removed.
    const resolved=item.steps.map(s=>s.profileId ? structuredClone(this.store.data.profiles.find(p=>p.id===s.profileId) || null) : {master:s.lighting,devices:{},studio:{enabled:false}});
    if(resolved.some(p=>!p))throw Error('Perfil da cena não encontrado.');
    if(item.steps.some(s=>s.recordingId&&!this.data.recordings.some(r=>r.id===s.recordingId)))throw Error('Gravação da cena não encontrada.');
    this.cancel(false); this.active={scene:structuredClone(item),resolved,index:0,cycle:0}; this.advance(); return this.snapshot();
  }
  advance() {
    const a=this.active; if(!a)return;
    const step=a.scene.steps[a.index]; this.override=a.resolved[a.index]; a.endsAt=Date.now()+step.durationMs;
    if(this.replay?.ownerScene)this.replay=null;
    if(step.recordingId){this.replayRecording(step.recordingId);this.replay.ownerScene=a.scene.id;}
    this.hardware.transition?.(step.transitionMs); this.hardware.changed(); this.changed();
    this.timer=setTimeout(()=>{ if(this.active!==a)return; if(++a.index>=a.scene.steps.length){a.index=0;if(++a.cycle>=a.scene.repeat){this.cancel(false);this.changed();return;}} this.advance(); },step.durationMs); this.timer.unref?.();
  }
  cancel(notify=true) { clearTimeout(this.timer); this.timer=null; const had=Boolean(this.active||this.contextOverride); this.active=null; this.override=null;if(this.replay?.ownerScene)this.replay=null;if(notify){this.blockedApplication=this.application;this.contextOverride=null;} if(had){this.hardware.changed(); if(notify)this.changed();} }
  settings(id, base) {
    const override=this.override||this.contextOverride;if(!override)return base;
    if((this.store.data.studio?.excluded||[]).includes(id))return base;
    const value={...base,...override.master,...override.devices?.[id]};
    // Temporary effects cannot wake pieces the user switched off or at zero brightness.
    value.power=Boolean(base.power && value.power); if(base.brightness===0)value.brightness=0;
    return value;
  }
  config(base) {const override=this.override||this.contextOverride;return override ? {...base,...(override.studio || {enabled:false}),layout:base.layout,excluded:[...new Set([...(base.excluded||[]),...(override.studio?.excluded||[])])]} : base; }
  close() { this.cancel(false);clearTimeout(this.contextTimer);this.events=[];this.replay=null;this.contextOverride=null; }
}
module.exports={Experiences,scene,fields,number,name,configuration};
