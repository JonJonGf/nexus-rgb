'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/http-app');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fs=require('node:fs'),path=require('node:path');
function backend(){
 const state={commands:[],temperature:60,board:'BOARD A',available:true,openFailures:0,invalidReads:0,applyFailures:0};
 return {state,factory:()=>({async request(body){state.commands.push(structuredClone(body));
  if(body.action==='open'&&state.openFailures-->0)throw Error('Fixture: service is not ready');
  if(body.action==='open'||body.action==='sample')return {at:Date.now(),board:{manufacturer:'Vendor',model:state.board},sensors:state.available?[{id:'cpu',name:'CPU package',value:state.invalidReads-->0?null:state.temperature}]:[],controls:[{id:'fan-a',name:'CPU fan',min:0,max:100}],fans:[{id:'rpm-a',name:'CPU fan',value:1200}]};
  if(body.action==='apply'){if(state.applyFailures-->0)throw Error('Fixture: rejected apply');return {applied:body.values};}if(body.action==='release')return {released:true};throw Error('Unexpected fixture command');
 },async close(){}})};
}
const assignment={controlId:'fan-a',sensorId:'cpu',rpmId:'rpm-a',minPercent:30,critical:85,points:[[20,30],[60,55],[100,100]],interpolation:'smooth'};
async function settled(app){let result;for(let i=0;i<150;i++){result=(await app.request('/api/cooling',{cookie:app.cookie})).json();if(result.enabled||result.mode==='fault')return result;await wait(10);}return result;}
test('saved active fan associations and manual curve resume automatically after a full server restart',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false};
 const first=await fixture(t,{cooling:options});
 const saved=await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,profile:'silent',assignments:[assignment]}});assert.equal(saved.status,200,saved.text);assert.equal(saved.json().outputs[0].percent,55);
 await first.app.stop();
 const second=await fixture(t,{directory:first.directory,cooling:options});
 const restored=await settled(second);
 assert.equal(restored.enabled,true,'The previously enabled fan control must resume without another detect/configure/apply sequence');
 assert.equal(restored.profile,'silent');assert.deepEqual(restored.assignments,[assignment]);assert.equal(restored.outputs[0].percent,55);
});
test('closing read-only monitoring after a failed resume preserves the saved startup choice',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false,resumeRetryDelays:[]},first=await fixture(t,{cooling:options});await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}});await first.app.stop();fake.state.openFailures=1;
 const second=await fixture(t,{directory:first.directory,cooling:options});assert.equal((await settled(second)).mode,'fault');
 assert.equal((await second.request('/api/cooling/monitor',{cookie:second.cookie,method:'POST',body:{}})).status,200);
 const closed=await second.request('/api/cooling/monitor',{cookie:second.cookie,method:'POST',body:{enabled:false}});assert.equal(closed.status,200,closed.text);assert.equal(closed.json().mode,'off');assert.equal(closed.json().resumeOnStartup,true);
 await second.app.stop();const third=await fixture(t,{directory:first.directory,cooling:options});assert.equal((await settled(third)).enabled,true);
});
test('a startup sample finishing after the user stops cooling cannot submit the old curve',async t=>{
 const fake=backend();let release,arrived;const reached=new Promise(r=>arrived=r);let hold=false;
 const factory=()=>{const bridge=fake.factory(),read=bridge.request;bridge.request=async body=>{if(hold&&body.action==='sample'){hold=false;arrived();await new Promise(r=>release=r);}return read(body);};return bridge;};
 const options={bridgeFactory:factory,autoPoll:false},first=await fixture(t,{cooling:options});await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}});await first.app.stop();fake.state.commands=[];hold=true;
 const second=await fixture(t,{directory:first.directory,cooling:options});await reached;
 try{
 assert.equal((await second.request('/api/cooling',{cookie:second.cookie})).json().mode,'starting','A startup sample must not look like disposable user monitoring');
 const stopping=second.request('/api/cooling',{cookie:second.cookie,method:'POST',body:{enabled:false}});let cancelled=false;for(let i=0;i<100;i++){if(!(await second.request('/api/cooling',{cookie:second.cookie})).json().resumePending){cancelled=true;break;}await wait(5);}release();assert.equal(cancelled,true);assert.equal((await stopping).status,200);
 assert.equal(fake.state.commands.some(c=>c.action==='apply'),false);assert.equal((await second.request('/api/cooling',{cookie:second.cookie})).json().resumeOnStartup,false);
 }finally{release?.();}
});
test('damaged startup metadata does not discard valid saved curves or start a helper',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false},first=await fixture(t,{cooling:options});await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}});await first.app.stop();
 const file=path.join(first.directory,'cooling.json'),config=JSON.parse(fs.readFileSync(file,'utf8'));config.resumeProfile.points=[[0,-20]];fs.writeFileSync(file,JSON.stringify(config));fake.state.commands=[];
 const second=await fixture(t,{directory:first.directory,cooling:options}),state=(await second.request('/api/cooling',{cookie:second.cookie})).json();
 assert.equal(state.enabled,false);assert.deepEqual(state.assignments,[assignment]);assert.equal(state.resumeOnStartup,false);assert.ok(state.error);assert.equal(fake.state.commands.length,0);
});
test('turning cooling off persists that choice and a later start does not even open the helper',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false},first=await fixture(t,{cooling:options});
 const post=body=>first.request('/api/cooling',{cookie:first.cookie,method:'POST',body});
 await post({enabled:true,assignments:[assignment]});assert.equal((await post({enabled:false})).status,200);await first.app.stop();fake.state.commands=[];
 const second=await fixture(t,{directory:first.directory,cooling:options}),state=(await second.request('/api/cooling',{cookie:second.cookie})).json();
 assert.equal(state.enabled,false);assert.equal(state.resumeOnStartup,false);assert.deepEqual(state.assignments,[assignment]);assert.equal(fake.state.commands.length,0);
});
test('startup retries are bounded and stopping while waiting cancels retry and future boot activation',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false,resumeRetryDelays:[5,5]},first=await fixture(t,{cooling:options});
 await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}});await first.app.stop();fake.state.openFailures=99;
 const second=await fixture(t,{directory:first.directory,cooling:options});let state;
 for(let i=0;i<100;i++){state=(await second.request('/api/cooling',{cookie:second.cookie})).json();if(state.mode==='fault')break;await wait(10);}
 assert.equal(state.mode,'fault');assert.equal(state.enabled,false);assert.equal(state.resumeAttempts,3);assert.equal(state.resumePending,false);assert.deepEqual(state.assignments,[assignment]);
 await second.app.stop();
 const third=await fixture(t,{directory:first.directory,cooling:{...options,resumeRetryDelays:[100,100]}});
 for(let i=0;i<100;i++){state=(await third.request('/api/cooling',{cookie:third.cookie})).json();if(state.mode==='waiting')break;await wait(5);}
 assert.equal(state.resumePending,true);assert.equal((await third.request('/api/cooling',{cookie:third.cookie,method:'POST',body:{enabled:false}})).status,200);
 const attempts=(await third.request('/api/cooling',{cookie:third.cookie})).json().resumeAttempts;await wait(130);state=(await third.request('/api/cooling',{cookie:third.cookie})).json();assert.equal(state.mode,'off');assert.equal(state.resumeOnStartup,false);assert.equal(state.resumeAttempts,attempts);
});
test('a rejected activation never arms automatic control for the next boot',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false},first=await fixture(t,{cooling:options});fake.state.applyFailures=1;
 assert.equal((await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}})).status,400);
 await first.app.stop();fake.state.commands=[];fake.state.applyFailures=0;
 const second=await fixture(t,{directory:first.directory,cooling:options}),state=(await second.request('/api/cooling',{cookie:second.cookie})).json();
 assert.equal(state.enabled,false);assert.equal(state.resumeOnStartup,false);assert.equal(fake.state.commands.length,0);
});
test('restart restores the applied custom preset rather than un-applied edits to its saved library entry',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false},first=await fixture(t,{cooling:options});
 const profile={id:'custom-'+'a'.repeat(32),name:'Minha curva',points:[[20,30],[60,55],[100,100]],interpolation:'linear'};
 const post=body=>first.request('/api/cooling',{cookie:first.cookie,method:'POST',body});
 await post({customProfiles:[profile]});await post({enabled:true,profile:profile.id,assignments:[{controlId:'fan-a',sensorId:'cpu',rpmId:'rpm-a',minPercent:30,critical:85}]});
 await post({customProfiles:[{...profile,points:[[20,30],[60,80],[100,100]]}]});await first.app.stop();
 const second=await fixture(t,{directory:first.directory,cooling:options}),state=await settled(second);
 assert.equal(state.enabled,true);assert.equal(state.outputs[0].percent,55);assert.equal(state.profilePending,true);
});
test('resume waits for valid temperatures and does not take over with a temporary invalid startup reading',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false,resumeRetryDelays:[5,10]};
 const first=await fixture(t,{cooling:options});await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}});await first.app.stop();fake.state.commands=[];fake.state.invalidReads=2;
 const second=await fixture(t,{directory:first.directory,cooling:options});let state;
 for(let i=0;i<150;i++){state=(await second.request('/api/cooling',{cookie:second.cookie})).json();if(state.enabled)break;await wait(10);}
 assert.equal(state.enabled,true);assert.equal(state.outputs[0].percent,55);assert.ok(fake.state.commands.filter(c=>c.action==='apply').every(c=>c.values[0].percent===55));
});
test('startup waits for a late helper and resumes without blocking the panel or losing saved curves',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false,resumeRetryDelays:[5,10]};
 const first=await fixture(t,{cooling:options});await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}});await first.app.stop();fake.state.openFailures=2;
 const second=await fixture(t,{directory:first.directory,cooling:options});
 assert.equal((await second.request('/api/health')).status,200);
 let state;for(let i=0;i<150;i++){state=(await second.request('/api/cooling',{cookie:second.cookie})).json();if(state.enabled)break;await wait(10);}
 assert.equal(state.enabled,true);assert.deepEqual(state.assignments,[assignment]);assert.equal(state.outputs[0].percent,55);
});
test('startup does not write a curve to a different board reusing the same channel and sensor ids',async t=>{
 const fake=backend(),options={bridgeFactory:fake.factory,autoPoll:false};
 const first=await fixture(t,{cooling:options});assert.equal((await first.request('/api/cooling',{cookie:first.cookie,method:'POST',body:{enabled:true,assignments:[assignment]}})).status,200);
 await first.app.stop();fake.state.board='BOARD B';fake.state.commands=[];
 const second=await fixture(t,{directory:first.directory,cooling:options}),state=await settled(second);
 assert.equal(state.enabled,false);assert.equal(state.mode,'fault');assert.deepEqual(state.assignments,[assignment]);assert.equal(fake.state.commands.some(c=>c.action==='apply'),false,'Saved ids must not authorize writes to replacement hardware');
});
