'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('LAN selection serves cached adapters immediately and refreshes Windows routes asynchronously',async()=>{
  let sync=0,async=0;
  const routes='0.0.0.0 0.0.0.0 192.168.60.1 192.168.60.2 10';
  const mod={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/network.js'),'utf8'),{module:mod,process:{platform:'win32'},Date,require(name){
    if(name==='node:child_process')return {execFileSync:()=>{sync++;return routes;},execFile:(_file,_args,_options,callback)=>{async++;setImmediate(()=>callback(null,routes));}};
    if(name==='node:os')return {networkInterfaces:()=>({First:[{family:'IPv4',internal:false,address:'192.168.50.2',netmask:'255.255.255.0'}],Second:[{family:'IPv4',internal:false,address:'192.168.60.2',netmask:'255.255.255.0'}]})};
    return require(name);
  }});
  mod.exports.adapters();assert.equal(sync,0);assert.equal(async,1);
  await new Promise(setImmediate);
  assert.equal(mod.exports.adapters()[0].name,'Second');assert.equal(async,1);
});
