'use strict';

// Configuration validation has no file, timer, sensor or hardware side effects.
const profiles = [
  {id:'silent',name:'Silencioso',points:[[30,25],[50,35],[65,55],[75,75],[85,100]]},
  {id:'balanced',name:'Equilibrado',points:[[30,35],[50,45],[65,65],[75,85],[85,100]]},
  {id:'performance',name:'Desempenho',points:[[30,45],[50,60],[65,80],[75,100],[85,100]]},
  {id:'aggressive',name:'Agressivo',points:[[30,60],[45,75],[60,90],[70,100],[85,100]]},
  {id:'turbo',name:'TURBO',points:[[20,100],[100,100]]}
];

function validate(value){
  if(!value||typeof value!=='object'||!Array.isArray(value.assignments)||value.assignments.length>32)throw Error('Configuração de ventilação inválida.');
  if(value.resumeOnStartup!==undefined&&typeof value.resumeOnStartup!=='boolean')throw Error('Retomada de ventilação inválida.');
  const resumeProfile=value.resumeProfile??null;
  if(resumeProfile!==null){if(typeof resumeProfile!=='object'||Array.isArray(resumeProfile)||Object.keys(resumeProfile).some(k=>!['id','name','points','interpolation','custom'].includes(k))||resumeProfile.id!==value.profile||typeof resumeProfile.name!=='string'||!resumeProfile.name||resumeProfile.name.length>40||!['linear','smooth'].includes(resumeProfile.interpolation))throw Error('Curva de retomada inválida.');validatePoints(resumeProfile.points);}
  const bindings=value.bindings??[];
  if(!Array.isArray(bindings)||bindings.length>32||bindings.some(b=>!b||Object.keys(b).some(k=>!['controlId','controlKey','sensorKey'].includes(k))||typeof b.controlId!=='string'||!b.controlId||b.controlId.length>180||![b.controlKey,b.sensorKey].every(k=>typeof k==='string'&&/^[a-f0-9]{64}$/.test(k)))||new Set(bindings.map(b=>b.controlId)).size!==bindings.length)throw Error('Identidade de ventilação inválida.');
  const channelPreferences=value.channelPreferences??[];
  if(!Array.isArray(channelPreferences)||channelPreferences.length>128||channelPreferences.some(p=>!p||Object.keys(p).some(k=>!['key','name','hidden'].includes(k))||typeof p.key!=='string'||!/^[a-f0-9]{64}$/.test(p.key)||typeof p.name!=='string'||p.name.length>48||/[\u0000-\u001f]/.test(p.name)||typeof p.hidden!=='boolean')||new Set(channelPreferences.map(p=>p.key)).size!==channelPreferences.length)throw Error('Identificação de canal inválida.');
  const customProfiles=value.customProfiles??[];
  if(!Array.isArray(customProfiles)||customProfiles.length>3)throw Error('Você pode salvar até três perfis personalizados.');
  for(const p of customProfiles){if(!p||Object.keys(p).some(k=>!['id','name','points','interpolation'].includes(k))||p.interpolation!==undefined&&!['linear','smooth'].includes(p.interpolation)||typeof p.id!=='string'||!/^custom-[a-f0-9]{32}$/.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||/[\u0000-\u001f]/.test(p.name))throw Error('Perfil personalizado inválido.');validatePoints(p.points);}
  if(new Set(customProfiles.map(p=>p.id)).size!==customProfiles.length)throw Error('Perfil personalizado repetido.');
  if(![...profiles,...customProfiles].some(p=>p.id===value.profile))throw Error('Selecione outro perfil antes de excluir o atual.');
  const assignments=value.assignments.map(a=>{
    if(!a||Object.keys(a).some(k=>!['controlId','sensorId','rpmId','minPercent','critical','points','interpolation'].includes(k))||a.interpolation!==undefined&&(!a.points||!['linear','smooth'].includes(a.interpolation))||
      ![a.controlId,a.sensorId].every(id=>typeof id==='string'&&id.length>0&&id.length<=180)||
      a.rpmId!=null&&(typeof a.rpmId!=='string'||a.rpmId.length>180)||
      !Number.isInteger(a.minPercent)||a.minPercent<20||a.minPercent>100||!Number.isInteger(a.critical)||a.critical<60||a.critical>100)throw Error('Associação de ventilação inválida.');
    if(a.points!==undefined){
      validatePoints(a.points);
    }
    return structuredClone(a);
  });
  if(new Set(assignments.map(a=>a.controlId)).size!==assignments.length)throw Error('Canal de ventilação repetido.');
  return {profile:value.profile,assignments,bindings:structuredClone(bindings),resumeProfile:resumeProfile?{id:resumeProfile.id,name:resumeProfile.name,points:structuredClone(resumeProfile.points),interpolation:resumeProfile.interpolation}:null,resumeOnStartup:value.resumeOnStartup===true,channelPreferences:channelPreferences.map(p=>({key:p.key,name:p.name.trim(),hidden:p.hidden})),customProfiles:customProfiles.map(p=>({id:p.id,name:p.name.trim(),points:structuredClone(p.points),interpolation:p.interpolation||'linear'}))};
}
function validatePoints(points){if(!Array.isArray(points)||points.length<2||points.length>8||points.some((p,i)=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<20||p[0]>100||p[1]<20||p[1]>100||i>0&&(p[0]<=points[i-1][0]||p[1]<points[i-1][1])))throw Error('A curva deve subir com a temperatura, entre 20 e 100%.');}

module.exports = {profiles, validate};
