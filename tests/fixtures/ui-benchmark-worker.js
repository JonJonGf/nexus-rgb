'use strict';
const { EventEmitter } = require('node:events');
const { Store } = require('../../server/store');
const { Hardware } = require('../../server/hardware');
const { createApp } = require('../../server');
const store = new Store(process.env.NEXUS_BENCH_DATA);
const controller = (name, count, zones = []) => ({ name, location:name, vendor:'Nexus benchmark', type:2, serial:'', colors:Array(count).fill({red:0,green:0,blue:0}), zones, modes:[{id:0,name:'Direct',flagList:['perLedColor']}] });
const devices = [controller('RAM 1',8),controller('RAM 2',8),controller('Board',76,[4,36,36].map((n,id)=>({id,name:id?'ARGB '+id:'Board LEDs',ledsCount:n,ledsMin:n,ledsMax:n,resizable:false})))];
class Mock extends EventEmitter { async connect() {} async getControllerCount(){return devices.length;} async getControllerData(i){return devices[i];} async updateMode() {} updateLeds() {} disconnect() {} }
const hardware = new Hardware(store,{makeClient:()=>new Mock()});
let app;
createApp({directory:process.env.NEXUS_BENCH_DATA,store,hardware,localPort:0,disableAlexa:true,getInterfaces:()=>[]}).then(async value=>{
  app=value; const {localPort}=await app.start(); process.send({port:localPort});
});
process.on('message',async message=>{if(message==='sample')process.send({pid:process.pid,worker:app.studio.worker?.pid,metrics:app.studio.metrics,error:app.studio.error});if(message==='stop'){await app.stop();process.exit(0);}});
process.on('disconnect',async()=>{if(app)await app.stop();process.exit(0);});
