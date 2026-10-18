'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),childProcess=require('node:child_process');
test('LAN selection serves cached adapters immediately and refreshes Windows routes asynchronously',{skip:process.platform!=='win32'},async t=>{
  let sync=0,async=0;
  const routes='0.0.0.0 0.0.0.0 192.168.60.1 192.168.60.2 10';
  t.mock.method(childProcess,'execFileSync',()=>{sync++;return routes;});
  t.mock.method(childProcess,'execFile',(_file,_args,_options,callback)=>{async++;setImmediate(()=>callback(null,routes));});
  t.mock.method(os,'networkInterfaces',()=>({First:[{family:'IPv4',internal:false,address:'192.168.50.2',netmask:'255.255.255.0'}],Second:[{family:'IPv4',internal:false,address:'192.168.60.2',netmask:'255.255.255.0'}]}));
  const network=require('../server/network');
  network.adapters();assert.equal(sync,0);assert.equal(async,1);
  await new Promise(setImmediate);
  assert.equal(network.adapters()[0].name,'Second');assert.equal(async,1);
});
