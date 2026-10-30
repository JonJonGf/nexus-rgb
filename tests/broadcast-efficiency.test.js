'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/http-app');
test('control HTTP without subscribers builds only its response snapshot, not a discarded event',async t=>{
  const {app,request,cookie}=await fixture(t);let snapshots=0;
  app.hardware.snapshot=()=>{snapshots++;return {connected:false,devices:[]};};
  await request('/api/state',{cookie});const responseCost=snapshots;snapshots=0;
  const result=await request('/api/control',{cookie,method:'POST',body:{color:'#ff0055'}});
  assert.equal(result.status,200);assert.equal(result.json().master.color,'#ff0055');
  assert.equal(snapshots,responseCost,'Only the JSON response needs a hardware snapshot when no event client exists.');
});
