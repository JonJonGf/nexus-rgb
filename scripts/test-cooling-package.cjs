'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist/app');
const {createApp}=require(path.join(root,'server'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-cooling-package-'));
(async()=>{
 let app;
 try{
  app=await createApp({directory:temp,localPort:0,listenHost:'127.0.0.1',disableHardware:true,disableAlexa:true,disableWelcome:true});
  await app.start();
  const state=app.cooling.snapshot();assert.equal(state.available,true);assert.equal(state.enabled,false);assert.equal(state.mode,'off');assert.equal(app.cooling.bridge,null);assert.equal(app.cooling.timer,null);
  assert.equal(app.cooling.options.binaryPath,path.join(root,'cooling/nexus-cooling.exe'));assert.equal(app.cooling.options.brokered,true);
  for(const file of ['scripts/start-cooling-helper.ps1','cooling/LibreHardwareMonitorLib.dll','cooling/LICENSE','cooling/THIRD-PARTY-NOTICES.txt','cooling/LibreHardwareMonitor-0.9.6-source.zip'])assert.ok(fs.existsSync(path.join(root,file)),file);
  console.log('Packaged development app: optional cooling available, off with no helper or polling; fixed helper path, source and notices included.');
 }finally{await app?.stop();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
