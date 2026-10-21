'use strict';
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const {CoolingBridge}=require('../server/cooling-bridge');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const bridge=new CoolingBridge({simulated:true});
  try{
    const a=await bridge.request({action:'open'});assert.equal(a.simulated,true);assert.equal(a.controls.length,6);assert.equal(a.sensors.length,2);
    await bridge.request({action:'apply',values:[{id:'fan-1',percent:100}]});
    assert.equal((await bridge.request({action:'sample'})).fans[0].value,2000);
    await assert.rejects(bridge.request({action:'apply',values:[{id:'fan-1',percent:50},{id:'not-a-channel',percent:0}]}));
    assert.equal((await bridge.request({action:'sample'})).fans[0].value,1200,'A rejected batch releases owned channels');
    await bridge.request({action:'apply',values:[{id:'fan-2',percent:60}]});await bridge.request({action:'release'});
    assert.equal((await bridge.request({action:'sample'})).fans[1].value,1200);
  }finally{await bridge.close();}
  const watchdog=new CoolingBridge({simulated:true});await watchdog.request({action:'open'});await watchdog.request({action:'apply',values:[{id:'fan-1',percent:60}]});
  await sleep(6500);assert.equal(watchdog.closed,true,'Missing heartbeats must terminate the fixture helper');await watchdog.close();
  // Exercise the same named-pipe framing and client-PID restriction as real mode, without elevation or hardware.
  for(const authorized of [true,false]){
    const pipe='NexusRGB.Cooling.Dev.'+crypto.randomBytes(16).toString('hex');
    const child=spawn(path.resolve('dist/cooling/nexus-cooling.exe'),['--fixture','--parent',String(authorized?process.pid:process.ppid),'--pipe',pipe],{windowsHide:true,stdio:'ignore'});
    const exit=new Promise(resolve=>child.once('exit',resolve));
    let socket;
    for(let i=0;i<50;i++){
      socket=await new Promise(resolve=>{const s=net.connect('\\\\.\\pipe\\'+pipe);s.once('connect',()=>resolve(s));s.once('error',()=>{s.destroy();resolve(null);});});
      if(socket)break;await sleep(100);
    }
    assert.ok(socket,'Pipe must start');
    let received='';socket.setEncoding('utf8');socket.on('data',data=>{received+=data;});socket.on('error',()=>{});
    if(authorized){for(let i=0;i<40&&!received.includes('ready');i++)await sleep(50);assert.match(received,/ready/);socket.end(JSON.stringify({id:1,action:'shutdown'})+'\n');}
    else {await sleep(200);assert.equal(received,'','Other PID cannot obtain the handshake');socket.destroy();}
    assert.equal(await exit,authorized?0:3);
  }
  console.log('Cooling native fixture: framing, read-only detection, apply/release, invalid batch, watchdog and pipe identity passed. No hardware accessed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
