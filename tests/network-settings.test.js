'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./helpers/http-app');
test('failed persistence of a LAN interface never changes the active selection',async t=>{
  const interfaces=()=>['192.168.60.2','192.168.70.2'].map((address,i)=>({name:'Fixture '+i,address,netmask:'255.255.255.0'}));
  const {request,cookie}=await fixture(t,{getInterfaces:interfaces});
  const before=(await request('/api/network',{cookie})).json().selectedAddress;
  const other=interfaces().find(i=>i.address!==before).address;
  const mock=t.mock.method(fs,'renameSync',()=>{throw Error('Synthetic disk failure');});
  assert.equal((await request('/api/network',{cookie,method:'POST',body:{address:other}})).status,400);
  mock.mock.restore();assert.equal((await request('/api/network',{cookie})).json().selectedAddress,before);
});
