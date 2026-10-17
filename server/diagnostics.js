'use strict';
const {about}=require('./about');
function diagnostics(hardware,studio,store,resources) {
  const hw=hardware.snapshot(),devices=hw.devices||[],config=studio.config||{},rec=studio.recoverySnapshot?.()||null,b=about();
  const hardwareErrorCode=!hw.error?null:hw.error==='Aguardando o controlador RGB.'?'waiting-controller':String(hw.error).includes('tempo')||String(hw.error).includes('demorando')?'timeout':!hw.connected?'disconnected':'controller-error';
  return {
    format:'nexus-diagnostics/1',
    createdAt:new Date().toISOString(),
    build:{version:String(b.version||''),tag:b.tag||null,commit:b.commit||null,development:Boolean(b.development)},
    runtime:{node:String(process.versions.node),platform:String(process.platform),architecture:String(process.arch)},
    health:{state:!hw.connected?'connecting':!devices.length?'detecting':devices.some(d=>d.error)?'partial':'ready',connected:Boolean(hw.connected),controllers:Number(hw.controllerCount)||0,components:devices.length,totalLEDs:devices.reduce((n,d)=>n+(Number(d.ledCount)||0),0),discoveryMs:typeof hardware.discoveryMs==='number'?hardware.discoveryMs:null,hardwareError:Boolean(hw.error),componentErrors:devices.filter(d=>d.error).length},
    components:devices.slice(0,64).map((d,index)=>({id:'device-'+(index+1),kind:['argb','device','zone'].includes(d.kind)?d.kind:'device',type:Number.isInteger(d.type)?d.type:0,ledCount:Number.isInteger(d.ledCount)?d.ledCount:0,status:d.error||d.status==='error'?'error':'online',mapExcluded:Boolean(d.mapExcluded),hasError:Boolean(d.error)})),
    render:{requestedFps:Number(store.data?.performance?.fps)||20,powerTransitionMs:Number(store.data?.performance?.powerTransitionMs)||0,spatial:Boolean(config.enabled),error:Boolean(studio.error),fps:Number(studio.metrics?.fps)||0,renderMs:Number(studio.metrics?.renderMs)||0,memoryMB:Number(studio.metrics?.memoryMB)||0,dropped:Number(studio.metrics?.dropped)||0},
    alexa:{enabled:Boolean(store.data?.alexaEnabled)},
    resources:resources?.cache?{partial:Boolean(resources.cache.partial),cpuPercent:resources.cache.cpuPercent??null,memoryMB:Number(resources.cache.memoryMB)||0,measurementMs:Number(resources.cache.measurementMs)||0,processes:(resources.cache.processes||[]).map(({role,memoryMB,cpuPercent})=>({role:String(role),memoryMB:Number(memoryMB)||0,cpuPercent:cpuPercent??null}))}:null,
    errors:{studioKind:['effect','worker','config','controller'].includes(rec?.kind)?rec.kind:(studio.error?'effect':null),studioQuarantined:Boolean(rec?.quarantined),controllerLost:Boolean(!hw.connected&&(studio.hadController||hardware.lostAt)),hardwareErrorCode,componentErrorCount:devices.filter(d=>d.error).length}
  };
}
module.exports={diagnostics};
