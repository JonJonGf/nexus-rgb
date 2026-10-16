'use strict';
const {about}=require('./about');
function diagnostics(hardware,studio,store,resources) {
  const hw=hardware.snapshot(),devices=hw.devices,config=studio.config;
  return {format:'nexus-diagnostics/1',createdAt:new Date().toISOString(),build:about(),runtime:{node:process.versions.node,platform:process.platform,architecture:process.arch},health:{state:!hw.connected?'connecting':!devices.length?'detecting':devices.some(d=>d.error)?'partial':'ready',connected:hw.connected,controllers:hw.controllerCount,components:devices.length,totalLEDs:devices.reduce((n,d)=>n+d.ledCount,0),discoveryMs:typeof hardware.discoveryMs==='number'?hardware.discoveryMs:null,hardwareError:Boolean(hw.error),componentErrors:devices.filter(d=>d.error).length},render:{requestedFps:store.data.performance?.fps||20,spatial:Boolean(config.enabled),error:Boolean(studio.error),...studio.metrics},alexa:{enabled:store.data.alexaEnabled},resources:resources?.cache?{partial:resources.cache.partial,cpuPercent:resources.cache.cpuPercent,memoryMB:resources.cache.memoryMB,measurementMs:resources.cache.measurementMs,processes:resources.cache.processes.map(({role,memoryMB,cpuPercent})=>({role,memoryMB,cpuPercent}))}:null};
}
module.exports={diagnostics};
