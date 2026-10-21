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

test('manual curves support linear and monotone smooth interpolation with the same endpoints',async t=>{
 const fake=controller();fake.state.temperature=40;const {request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
 const post=interpolation=>request('/api/cooling',{cookie,method:'POST',body:{enabled:true,assignments:[{...assignment,minPercent:20,points:[[20,20],[100,100]],interpolation}]}});
 const linear=await post('linear');assert.equal(linear.status,200,linear.text);assert.equal(linear.json().outputs[0].percent,40);const smooth=await post('smooth');assert.equal(smooth.status,200,smooth.text);assert.equal(smooth.json().outputs[0].percent,33);assert.equal((await post('invalid')).status,400);
});

test('three named custom profiles persist without fan commands, reject a fourth and can be applied independently',async t=>{
 const fake=controller(),{request,cookie,app,directory}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
 const customProfiles=[0,1,2].map(i=>({id:'custom-'+String(i).repeat(32),name:'Minha curva '+i,points:[[20,30],[60,55+i],[100,100]]}));
 const post=body=>request('/api/cooling',{cookie,method:'POST',body});
 const saved=await post({customProfiles});assert.equal(saved.status,200,saved.text);assert.equal(saved.json().customProfiles.length,3);assert.equal(fake.state.commands.length,0);
 const overflow=await post({customProfiles:[...customProfiles,{...customProfiles[0],id:'custom-'+'f'.repeat(32)}]});assert.equal(overflow.status,400);assert.equal((await request('/api/cooling',{cookie})).json().customProfiles.length,3);
 const active=await post({enabled:true,profile:customProfiles[1].id,assignments:[assignment]});assert.equal(active.status,200,active.text);assert.equal(active.json().outputs[0].percent,56);
 const count=fake.state.commands.length;const renamed=await post({customProfiles:customProfiles.map((p,i)=>i===1?{...p,points:[[20,30],[60,80],[100,100]]}:i===2?{...p,name:'Curva editada'}:p)});assert.equal(renamed.status,200,renamed.text);assert.equal(fake.state.commands.length,count,'Saving library must not send fan commands');
 await app.cooling.tick();assert.equal(app.cooling.snapshot().outputs[0].percent,56,'Editing a running preset must not apply it on the next sample');assert.equal(app.cooling.snapshot().profilePending,true);
 assert.equal((await post({profile:customProfiles[1].id})).json().outputs[0].percent,80);
 assert.equal((await post({customProfiles:[]})).status,400,'Active profile must not disappear');
 await app.cooling.close();const restarted=await fixture(t,{directory,cooling:{bridgeFactory:fake.factory,autoPoll:false}});const restored=(await restarted.request('/api/cooling',{cookie:restarted.cookie})).json();assert.equal(restored.enabled,false);assert.equal(restored.customProfiles.length,3);assert.equal(restored.customProfiles[2].name,'Curva editada');
});

test('a manual curve overrides the previous TURBO preset instead of silently staying at 100%',async t=>{
  const fake=controller(),{request,cookie}=await fixture(t,{cooling:{bridgeFactory:fake.factory,autoPoll:false}});
  const response=await request('/api/cooling',{cookie,method:'POST',body:{enabled:true,profile:'turbo',assignments:[{...assignment,points:[[20,30],[60,55],[100,100]]}]}});
  assert.equal(response.status,200,response.text);assert.equal(response.json().outputs[0].percent,55);
});

test('an exact board and SuperIO profile identifies connector labels without changing hardware IDs or enabling control',async t=>{
  let model='TUF GAMING A520M-PLUS II';const prefix='/lpc/nct6798d/0',factory=()=>({async request(){return {at:Date.now(),board:{manufacturer:'ASUSTeK COMPUTER INC.',model},sensors:[],controls:[0,1,2,3].map(i=>({id:prefix+'/control/'+i+'/control',name:'Nuvoton NCT6798D · Fan #'+(i+1),min:0,max:100})),fans:[0,1,2,3].map(i=>({id:prefix+'/fan/'+i,name:'Nuvoton NCT6798D · Fan #'+(i+1),value:i<3?700:0}))};},async close(){}});
  const {request,cookie,app}=await fixture(t,{cooling:{bridgeFactory:factory,autoPoll:false}});
  const response=await request('/api/cooling/monitor',{cookie,method:'POST',body:{}});assert.equal(response.status,200,response.text);
  const v=response.json();assert.equal(v.enabled,false);assert.equal(v.controls[1].name,'CPU · CPU_FAN');assert.equal(v.controls[1].id,prefix+'/control/1/control');assert.equal(v.controls[1].suggestedRpmId,prefix+'/fan/1');assert.equal(v.controls[1].identitySource,'board-suggestion');assert.equal(v.controls[3].useful,false);
  model='OTHER BOARD';await app.cooling.tick();const other=(await request('/api/cooling',{cookie})).json();assert.equal(other.controls[1].name,'Nuvoton NCT6798D · Fan #2');assert.equal(other.controls[1].identitySource,'generic');
});

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
