'use strict';
// Installed development contract: LocalService delegates only a fixed launch to hardware service.
const assert=require('node:assert/strict'),net=require('node:net'),path=require('node:path');
const {CoolingBridge}=require('../server/cooling-bridge');
(async()=>{
 const pipe='NexusRGB.Cooling.Broker.Fixture.'+process.pid;
 let received;
 const server=net.createServer(socket=>{socket.once('data',chunk=>{received=JSON.parse(chunk);socket.end(JSON.stringify({status:'error',message:'fixture-broker-reached'})+'\n');});});
 await new Promise(r=>server.listen('\\\\.\\pipe\\'+pipe,r));
 const bridge=new CoolingBridge({allowHardware:true,brokered:true,serviceBroker:pipe,binaryPath:path.resolve('dist/cooling/nexus-cooling.exe')});
 try{
  await assert.rejects(bridge.start(),/fixture-broker-reached/);
  assert.equal(received.parent,process.pid);assert.match(received.pipe,/^NexusRGB\.Cooling\.Dev\.[a-f0-9]{32}$/);
  assert.deepEqual(Object.keys(received).sort(),['parent','pipe']);
  console.log('Reduced-privilege launch delegates only parent PID and random pipe; broker rejection is surfaced.');
 }finally{await bridge.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
