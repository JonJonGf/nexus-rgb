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
  const build=JSON.parse(fs.readFileSync(path.join(root,'server/build-info.json'),'utf8'));
  const expected=(build.development===true&&build.tag===null)||(build.development===false&&/^v\d+\.\d+\.\d+-alpha\.[1-9]\d*$/.test(build.tag));
  const state=app.cooling.snapshot();assert.equal(state.available,expected);assert.equal(state.enabled,false);assert.equal(state.mode,'off');assert.equal(app.cooling.bridge,null);assert.equal(app.cooling.timer,null);
  if(!expected){assert.equal(app.cooling.options.allowHardware,undefined);console.log('Packaged stable app keeps experimental cooling disabled.');return;}
  assert.equal(app.cooling.options.binaryPath,path.join(root,'cooling/nexus-cooling.exe'));assert.equal(app.cooling.options.brokered,true);
  assert.equal(app.cooling.options.serviceBroker,'NexusRGB.Cooling.Launch.v1');
  for(const file of ['scripts/start-cooling-helper.ps1','cooling/LibreHardwareMonitorLib.dll','cooling/LICENSE','cooling/THIRD-PARTY-NOTICES.txt','cooling/LibreHardwareMonitor-0.9.6-source.zip'])assert.ok(fs.existsSync(path.join(root,file)),file);
  console.log('Packaged alpha/development app: optional cooling available, off with no helper or polling; fixed helper path, source and notices included.');
 }finally{await app?.stop();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
