'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/http-app');
const from='1'.repeat(24),to='2'.repeat(24);
function target(count=8){return {id:to,name:'Current fixture',ledCount:count,status:'online',spatialCapable:true,effects:['static','wave'],modes:[]};}
test('reconnect rejects prototype-related and malformed property names before reviewing any settings',async t=>{
  const {app,request,cookie}=await fixture(t);app.hardware.snapshot=()=>({connected:true,devices:[target()]});
  app.store.device(from,{color:'#ff0066'},[from]);const before=JSON.stringify(app.store.data);
  for(const invalid of ['__proto__','constructor','prototype','a'.repeat(25),null,{},[]]){
    for(const body of [{from:invalid,to},{from,to:invalid}])assert.equal((await request('/api/devices/reconnect/review',{cookie,method:'POST',body})).status,400);
  }
  assert.equal(JSON.stringify(app.store.data),before);assert.equal(Object.prototype.color,undefined);
});
test('reconnect reviews an offline identity then moves lighting, map and profile references atomically',async t=>{
  const {app,request,cookie,directory}=await fixture(t);
  app.hardware.snapshot=()=>({connected:true,devices:[target()]});
  app.store.device(from,{color:'#ff0066',power:false},[from]);
  app.store.data.studio={...app.studio.config,enabled:false,layout:require('../public/spatial').defaults([{...target(),id:from}]),excluded:[from]};
  app.store.profile('Saved before reconnect');
  const post=(route,body)=>request('/api/devices/reconnect'+route,{method:'POST',cookie,body});
  const listed=await request('/api/devices/reconnect',{cookie});assert.equal(listed.status,200);
  assert.equal(listed.json().sources[0].id,from);
  const review=await post('/review',{from,to});assert.equal(review.status,200,review.text);
  assert.equal(app.store.data.devices[to],undefined,'Review never applies settings.');
  assert.equal(review.json().layoutItems,1);
  const oldRevision=(await request('/api/studio',{cookie})).json().layoutRevision;
  const applied=await post('/apply',{token:review.json().token});assert.equal(applied.status,200,applied.text);
  assert.equal(app.store.data.devices[to].power,false);
  assert.equal(app.store.data.devices[from],undefined);
  assert.equal(app.store.data.studio.layout[0].deviceId,to);
  assert.deepEqual(app.store.data.studio.excluded,[to]);
  assert.equal(app.store.data.profiles[0].devices[to].color,'#ff0066');
  assert.ok(require('node:fs').readdirSync(directory).some(name=>name.startsWith('before-reconnect-')));
  const stale=await request('/api/studio',{cookie,method:'POST',body:{layout:[],baseLayoutRevision:oldRevision}});
  assert.equal(stale.status,409,'Old map clients cannot silently undo the identity migration.');
  assert.equal((await post('/apply',{token:review.json().token})).status,409,'A review can only be applied once.');
});

test('reconnect refuses incompatible geometry, target conflicts and edits made after review',async t=>{
  const {app,request,cookie}=await fixture(t);let count=4;
  app.hardware.snapshot=()=>({connected:true,devices:[target(count)]});
  app.store.device(from,{color:'#ff0066'},[from]);
  app.store.data.studio={...app.studio.config,layout:require('../public/spatial').defaults([{...target(8),id:from}])};app.store.save();
  const post=(route,body)=>request('/api/devices/reconnect'+route,{method:'POST',cookie,body});
  assert.equal((await post('/review',{from,to})).status,409);
  count=8;const review=await post('/review',{from,to});assert.equal(review.status,200);
  app.store.power(false);
  assert.equal((await post('/apply',{token:review.json().token})).status,409);
  assert.ok(app.store.data.devices[from]);
  app.hardware.snapshot=()=>({connected:true,devices:[target(count),{...target(8),id:from,status:'error'}]});
  assert.equal((await request('/api/devices/reconnect',{cookie})).json().sources.length,0,'A present device with an error must not be mistaken for a disconnected identity.');
  app.hardware.snapshot=()=>({connected:true,devices:[target(count)]});
  app.store.device(to,{brightness:45},[to]);
  assert.equal((await post('/review',{from,to})).status,409);
});

test('native mode omission requires acknowledgement and failed disk write preserves original settings',async t=>{
  const {app,request,cookie}=await fixture(t);
  app.hardware.snapshot=()=>({connected:true,devices:[target()]});
  app.store.device(from,{nativeMode:20,color:'#ffaa00'},[from]);
  const post=(route,body)=>request('/api/devices/reconnect'+route,{method:'POST',cookie,body});
  const review=await post('/review',{from,to});assert.equal(review.status,200);
  assert.deepEqual(review.json().omitted,['nativeMode']);
  assert.equal((await post('/apply',{token:review.json().token})).status,409);
  const fs=require('node:fs'),rename=fs.renameSync;
  const mock=t.mock.method(fs,'renameSync',()=>{throw Error('Synthetic write refusal');});
  assert.equal((await post('/apply',{token:review.json().token,acceptOmissions:true})).status,400);
  mock.mock.restore();assert.equal(fs.renameSync,rename);
  assert.equal(app.store.data.devices[from].nativeMode,20);
  assert.equal(app.store.data.devices[to],undefined);
  assert.equal((await post('/apply',{token:review.json().token,acceptOmissions:true})).status,200);
  assert.equal(app.store.data.devices[to].nativeMode,undefined);
});
