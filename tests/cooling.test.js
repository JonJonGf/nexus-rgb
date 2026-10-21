'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/http-app');
function controller(){
  const state={temperature:60,at:null,online:true,open:false,commands:[]};
  const sample=()=>({simulated:true,at:state.at??Date.now(),sensors:[{id:'cpu',name:'CPU',value:state.temperature}],
    controls:state.online?[{id:'fan-a',name:'CPU fan',min:0,max:100}]:[],fans:[{id:'rpm-a',name:'CPU fan RPM',value:1200}]});
  return {state,factory:()=>({async request(body){state.commands.push(structuredClone(body));
    if(body.action==='open'){state.open=true;return sample();}
    if(body.action==='sample')return sample();
    if(body.action==='apply')return {applied:body.values};
    if(body.action==='release')return {released:true};
    throw Error('unexpected command');
  },async close(){state.open=false;}})};
}
const assignment={controlId:'fan-a',sensorId:'cpu',rpmId:'rpm-a',minPercent:40,critical:85};

test('cooling starts disabled with five profiles and never opens hardware just to view settings',async t=>{
  let opened=0;
  const {request,cookie}=await fixture(t,{cooling:{bridgeFactory:()=>{opened++;throw Error('must stay off');}}});
  const response=await request('/api/cooling',{cookie});
  assert.equal(response.status,200,response.text);
  const value=response.json();assert.equal(value.enabled,false);assert.equal(value.mode,'off');
  assert.deepEqual(value.profiles.map(p=>p.id),['silent','balanced','performance','aggressive','turbo']);
  assert.equal(opened,0);
});

test('monitoring is read-only, a selected curve controls its channel, TURBO means 100 and disabling releases it',async t=>{
  const fake=controller(),{request,cookie,app}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  const post=body=>request('/api/cooling',{cookie,method:'POST',body});
  assert.equal((await request('/api/cooling/monitor',{cookie,method:'POST',body:{}})).status,200);
  assert.equal(fake.state.commands.some(c=>c.action==='apply'),false);
  const master=structuredClone(app.store.data.master);
  const active=await post({enabled:true,assignments:[assignment]});assert.equal(active.status,200,active.text);
  assert.equal(active.json().enabled,true);
  assert.deepEqual(fake.state.commands.filter(c=>c.action==='apply').at(-1).values,[{id:'fan-a',percent:58}]);
  assert.deepEqual(app.store.data.master,master,'Cooling must not rewrite RGB');
  assert.equal((await post({profile:'turbo'})).status,200);
  assert.deepEqual(fake.state.commands.filter(c=>c.action==='apply').at(-1).values,[{id:'fan-a',percent:100}]);
  const off=await post({enabled:false});assert.equal(off.status,200,off.text);assert.equal(off.json().mode,'off');
  assert.ok(fake.state.commands.some(c=>c.action==='release'));assert.equal(fake.state.open,false);
});

test('cooling recovers from slow temperature decreases instead of remaining stuck at the old speed',async t=>{
  const fake=controller();let now=Date.now();fake.state.at=now;fake.state.temperature=70;
  const {app,request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false,now:()=>now}});
  assert.equal((await request('/api/cooling',{cookie,method:'POST',body:{enabled:true,assignments:[assignment]}})).status,200);
  const initial=app.cooling.snapshot().outputs[0].percent;
  for(let i=1;i<=6;i++){now+=1000;fake.state.at=now;fake.state.temperature=70-i;await app.cooling.tick();}
  assert.ok(app.cooling.snapshot().outputs[0].percent<initial,'A slowly falling temperature must eventually lower the target');
});

test('an assignment cannot request a minimum above the hardware maximum',async t=>{
  const fake=controller();const original=fake.factory;
  fake.factory=()=>{const bridge=original(),request=bridge.request;bridge.request=async body=>{const value=await request(body);if(value.controls)value.controls[0].max=60;return value;};return bridge;};
  const {request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  const response=await request('/api/cooling',{cookie,method:'POST',body:{enabled:true,assignments:[{...assignment,minPercent:80}]}});
  assert.equal(response.status,400,response.text);assert.equal(fake.state.commands.some(c=>c.action==='apply'),false);
});

test('a live channel whose limit shrinks below its minimum releases control instead of exceeding the new limit',async t=>{
  const fake=controller();let max=100;const original=fake.factory;
  fake.factory=()=>{const bridge=original(),read=bridge.request;bridge.request=async body=>{const value=await read(body);if(value.controls)value.controls[0].max=max;return value;};return bridge;};
  const {app,request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  assert.equal((await request('/api/cooling',{cookie,method:'POST',body:{enabled:true,assignments:[assignment]}})).status,200);
  max=30;await assert.rejects(app.cooling.tick());
  const result=(await request('/api/cooling',{cookie})).json();assert.equal(result.enabled,false);assert.equal(result.mode,'fault');
  assert.ok(fake.state.commands.some(c=>c.action==='release'));assert.equal(fake.state.open,false);
});

test('invalid temperatures request protection, stale samples release and never reopen automatically',async t=>{
  const fake=controller(),{app,request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  const post=body=>request('/api/cooling',{cookie,method:'POST',body});
  assert.equal((await post({enabled:true,assignments:[assignment]})).status,200);
  fake.state.temperature=null;await app.cooling.tick();
  assert.equal(app.cooling.snapshot().outputs[0].percent,100);assert.equal(app.cooling.snapshot().outputs[0].failsafe,true);
  fake.state.at=Date.now()-10000;await assert.rejects(app.cooling.tick(),/atrasada/);
  assert.equal(app.cooling.snapshot().mode,'fault');assert.equal(fake.state.open,false);
  const count=fake.state.commands.length;await app.cooling.tick();assert.equal(fake.state.commands.length,count);
});

test('custom curves deduplicate output, invalid curves are rejected and a restart remains disabled',async t=>{
  const fake=controller(),first=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  const post=body=>first.request('/api/cooling',{cookie:first.cookie,method:'POST',body});
  const custom={...assignment,points:[[30,30],[60,75],[85,100]]};
  assert.equal((await post({enabled:true,assignments:[custom]})).status,200);
  assert.equal(first.app.cooling.snapshot().outputs[0].percent,75);
  const count=fake.state.commands.filter(c=>c.action==='apply').length;await first.app.cooling.tick();
  assert.equal(fake.state.commands.filter(c=>c.action==='apply').length,count);
  assert.equal((await post({assignments:[{...custom,points:[[30,75],[60,20]]}]})).status,400);
  assert.equal((await post({profile:'silent'})).status,200);assert.equal(first.app.cooling.snapshot().assignments[0].points,undefined);
  await first.app.cooling.close();
  const second=await fixture(t,{directory:first.directory,cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  const saved=(await second.request('/api/cooling',{cookie:second.cookie})).json();assert.equal(saved.enabled,false);assert.equal(saved.mode,'off');assert.equal(saved.assignments.length,1);assert.equal(fake.state.open,false);
});

test('cooling endpoints require the local admin session',async t=>{
  const fake=controller(),{request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  assert.equal((await request('/api/cooling')).status,401);
  assert.equal((await request('/api/cooling/monitor',{method:'POST',body:{}})).status,401);
  assert.equal((await request('/api/cooling',{cookie,method:'POST',body:{enabled:true,assignments:[assignment,assignment]}})).status,400);
  assert.equal(fake.state.commands.length,0);
});
