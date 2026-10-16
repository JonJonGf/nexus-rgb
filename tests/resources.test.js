'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Resources}=require('../server/resources'),{diagnostics}=require('../server/diagnostics');
test('medição calcula delta, preserva PID novo, cache e indica acesso parcial',async()=>{
  let now=0,ticks=100000,calls=0,start='123';const monitor=new Resources({now:()=>now,read:async()=>{calls++;return {partial:false,processes:[{pid:2,role:'openrgb',start,cpuTicks:String(ticks),memoryBytes:10485760}]};}});
  const a=await monitor.sample();assert.equal(a.processes[0].cpuPercent,null);assert.equal(a.processes[0].memoryMB,10);now=1000;await monitor.sample();assert.equal(calls,1);now=10000;ticks+=10000000;const b=await monitor.sample();assert.ok(b.processes[0].cpuPercent>=0);assert.ok(b.processes[0].cpuPercent<=100);start='456';now=20000;assert.equal((await monitor.sample()).processes[0].cpuPercent,null);
  monitor.read=async()=>{throw Error('access denied C:\\private');};now=30000;const c=await monitor.sample();assert.equal(c.partial,true);assert.equal(c.processes.some(r=>r.pid===process.pid),true);
});
test('diagnóstico permite só resumo, sem IP, perfil, fonte, serial ou mensagem crua',()=>{
  const secret='PRIVATE-192.168.1.2-C:\\Users\\person';const hardware={snapshot:()=>({connected:true,controllerCount:1,error:secret,devices:[{ledCount:12,error:secret,name:secret,id:secret,serial:secret}]})},studio={config:{enabled:true,activeId:secret,values:{x:secret}},error:secret,metrics:{fps:20,renderMs:1,memoryMB:50,dropped:0}},store={data:{alexaEnabled:true,profiles:[{name:secret}]}};
  const report=diagnostics(hardware,studio,store);assert.equal(JSON.stringify(report).includes(secret),false);assert.equal(report.health.state,'partial');assert.equal(report.health.totalLEDs,12);
});
