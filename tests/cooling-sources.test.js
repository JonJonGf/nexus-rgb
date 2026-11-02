'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/http-app');
function backend(){
  const state={cpu:40,gpu:75,gpuPresent:true,gpuName:'GPU core',commands:[]};
  return {state,factory:()=>({async request(body){
    state.commands.push(structuredClone(body));
    if(body.action==='open'||body.action==='sample')return {at:Date.now(),simulated:true,
      sensors:[{id:'cpu',name:'CPU package',value:state.cpu},...(state.gpuPresent?[{id:'gpu',name:state.gpuName,value:state.gpu}]:[])],
      controls:[{id:'case-a',name:'Case A',min:0,max:100},{id:'case-b',name:'Case B',min:30,max:100}],fans:[]};
    return {};
  },async close(){}})};
}
const assignment={controlId:'case-a',sensorId:'cpu',sensorIds:['cpu','gpu'],rpmId:null,minPercent:20,critical:90,points:[[20,20],[100,100]],interpolation:'linear'};

test('a fan follows the hottest selected source and preserves both sensors on restart',async t=>{
  const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false},first=await fixture(t,{cooling:options});
  const saved=await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}});
  assert.equal(saved.status,200,saved.text);assert.equal(saved.json().outputs[0].temperature,75);assert.equal(saved.json().outputs[0].percent,75);
  fake.state.cpu=82;await first.app.cooling.tick();assert.equal(first.app.cooling.snapshot().outputs[0].percent,82);
  await first.app.stop();const second=await fixture(t,{directory:first.directory,cooling:options});
  for(let i=0;i<100&&!second.app.cooling.snapshot().enabled;i++)await new Promise(r=>setTimeout(r,5));
  const restored=second.app.cooling.snapshot();assert.equal(restored.enabled,true);assert.deepEqual(restored.assignments[0].sensorIds,['cpu','gpu']);assert.equal(restored.outputs[0].temperature,82);
});

test('an optional shared curve links only selected channels and keeps their independent settings',async t=>{
  const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false},first=await fixture(t,{cooling:options});
  const group={sensorId:'cpu',sensorIds:['cpu','gpu'],minPercent:20,critical:90,points:[[20,20],[100,100]],interpolation:'linear'};
  const assignments=[{...assignment,sensorIds:undefined,points:[[20,30],[100,30]]},{...assignment,controlId:'case-b',sensorIds:undefined,points:[[20,45],[100,45]]}];
  const post=body=>first.request('/api/cooling',{cookie:first.cookie,method:'POST',body});
  const saved=await post({enabled:true,group,assignments});assert.equal(saved.status,200,saved.text);
  assert.deepEqual(saved.json().outputs.map(o=>o.percent),[75,75]);assert.deepEqual(saved.json().assignments[0].points,assignments[0].points);
  fake.state.gpu=92;await first.app.cooling.tick();assert.deepEqual(first.app.cooling.snapshot().outputs.map(o=>o.percent),[100,100]);
  await first.app.stop();const second=await fixture(t,{directory:first.directory,cooling:options});
  for(let i=0;i<100&&!second.app.cooling.snapshot().enabled;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(second.app.cooling.snapshot().enabled,true);assert.deepEqual(second.app.cooling.snapshot().group,group);
  const separate=await second.request('/api/cooling',{cookie:second.cookie,method:'POST',body:{group:null}});
  assert.equal(separate.status,200,separate.text);assert.deepEqual(separate.json().outputs.map(o=>o.percent),[30,45]);
});

test('an invalid selected source triggers protection and a missing source releases control',async t=>{
  const fake=backend(),{app,request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  assert.equal((await request('/api/cooling',{cookie,method:'POST',body:{enabled:true,assignments:[assignment]}})).status,200);
  fake.state.gpu=null;await app.cooling.tick();let snapshot=app.cooling.snapshot();
  assert.equal(snapshot.outputs[0].percent,100);assert.equal(snapshot.outputs[0].failsafe,true);assert.equal(snapshot.outputs[0].temperature,null);
  fake.state.gpuPresent=false;await assert.rejects(app.cooling.tick(),/Canal ou sensor/);snapshot=app.cooling.snapshot();
  assert.equal(snapshot.enabled,false);assert.equal(snapshot.mode,'fault');assert.ok(fake.state.commands.some(c=>c.action==='release'));
});

test('startup verifies the identity of every selected source, including the secondary GPU',async t=>{
  const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false,resumeRetryDelays:[]},first=await fixture(t,{cooling:options});
  await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}});await first.app.stop();
  fake.state.gpuName='A different GPU sensor';fake.state.commands=[];const second=await fixture(t,{directory:first.directory,cooling:options});
  for(let i=0;i<100&&second.app.cooling.snapshot().mode!=='fault';i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(second.app.cooling.snapshot().enabled,false);assert.equal(second.app.cooling.snapshot().mode,'fault');assert.equal(fake.state.commands.some(c=>c.action==='apply'),false);
});

test('invalid or duplicate sensor lists and unsupported group keys are rejected before hardware access',async t=>{
  const fake=backend(),{request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  for(const sensorIds of [[],['cpu','cpu'],['gpu','cpu'],['cpu',null],['cpu',{}],Array.from({length:9},(_,i)=>'s'+i)]){
    const response=await request('/api/cooling',{cookie,method:'POST',body:{enabled:true,assignments:[{...assignment,sensorIds}]}});assert.equal(response.status,400,response.text);
  }
  const {controlId,rpmId,...template}=assignment;
  for(const group of [{...template,unknown:true},{...template,controlId:'case-b'},false,[],{...template,minPercent:0}]){
    assert.equal((await request('/api/cooling',{cookie,method:'POST',body:{enabled:true,group,assignments:[assignment]}})).status,400);
  }
  assert.equal(fake.state.commands.length,0);
});

test('linking preserves each channel minimum and does not write to an unselected channel',async t=>{
  const fake=backend();fake.state.cpu=20;fake.state.gpu=20;
  const {request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}}),{controlId,rpmId,...group}=assignment;
  const post=assignments=>request('/api/cooling',{cookie,method:'POST',body:{enabled:true,group,assignments}});
  const all=await post([assignment,{...assignment,controlId:'case-b'}]);assert.equal(all.status,200,all.text);assert.deepEqual(all.json().outputs.map(o=>o.percent),[20,30]);
  const selected=await post([assignment]);assert.equal(selected.status,200,selected.text);assert.deepEqual(fake.state.commands.filter(c=>c.action==='apply').at(-1).values,[{id:'case-a',percent:20}]);
});
