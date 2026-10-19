'use strict';
// Each browser test owns its server, data, sessions and rate-limit window.
// Keep the production limiter unchanged; rapid suites must not share its quota.
const {test:base,expect}=require('@playwright/test'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../../server');
const test=base.extend({welcome:[false,{option:true}],hardwareSnapshot:[null,{option:true}],roomOptions:[null,{option:true}],baseURL:async({welcome,hardwareSnapshot,roomOptions},use)=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-ui-test-')),app=await createApp({directory,localPort:0,disableHardware:true,disableAlexa:true,disableWelcome:!welcome,...(roomOptions?{room:roomOptions}:{})});
  // Keep the real event stream open. A finite mocked SSE response correctly
  // disconnects the app and makes startup assertions depend on browser timing.
  if(hardwareSnapshot)app.hardware.snapshot=()=>structuredClone(hardwareSnapshot);
  try{const {localPort}=await app.start();await use('http://127.0.0.1:'+localPort);}finally{await app.stop();const target=path.resolve(directory);if(path.dirname(target)!==path.resolve(os.tmpdir())||!path.basename(target).startsWith('nexus-ui-test-'))throw Error('Invalid UI fixture directory');fs.rmSync(target,{recursive:true,force:true});}
}});
module.exports={test,expect};
