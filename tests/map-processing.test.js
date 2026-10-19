'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {Store}=require('../server/store'),{Hardware}=require('../server/hardware'),{Studio,builtin}=require('../server/studio'),spatial=require('../public/spatial');

test('a large mapped setup does not rebuild a hardware snapshot for every membership check',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-map-processing-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const raws=Array.from({length:64},(_,i)=>({name:'Synthetic '+i,vendor:'Test',serial:'',location:'synthetic:'+i,type:0,colors:Array(4).fill({red:0,green:0,blue:0}),zones:[],modes:[{id:0,name:'Direct',flagList:['perLedColor']}]}));
  class SDK extends EventEmitter{constructor(){super();this.socket={writableLength:0,on(){},destroy(){}};}async connect(){}async getControllerCount(){return raws.length;}async getControllerData(i){return raws[i];}async updateMode(){}updateLeds(){}disconnect(){}}
  const store=new Store(directory),hardware=new Hardware(store,{makeClient:()=>new SDK()});t.after(()=>hardware.stop());hardware.stopped=false;await hardware.connect();hardware.nextDiscovery=Infinity;
  store.data.studio={enabled:true,activeId:builtin[0].id,values:{},layout:spatial.defaults(hardware.snapshot().devices),excluded:[]};
  const studio=new Studio(store,hardware,directory,()=>{});hardware.studio=studio;t.after(()=>studio.stop());clearInterval(studio.timer);
  let reads=0;const snapshot=hardware.snapshot.bind(hardware);hardware.snapshot=()=>{reads++;return snapshot();};
  await hardware.tick(true);assert.ok(reads<=3,'One tick rebuilt '+reads+' complete snapshots');
  for(const d of hardware.devices)store.data.devices[d.id]={power:false};
  reads=0;for(let i=0;i<5;i++)studio.pump();
  assert.ok(reads<=6,'Idle map rebuilt '+reads+' complete snapshots');assert.equal(studio.worker,null);
  const first=studio.layout()[0],changed={...first,x:.72};studio.configure({layout:studio.layout().map(item=>item.key===first.key?changed:item)});
  assert.equal(studio.layout()[0].x,.72);
  raws[0].colors=Array(8).fill({red:0,green:0,blue:0});await hardware.discover();
  studio.configure({layout:[]});assert.equal(studio.layout().find(item=>item.deviceId===first.deviceId).count,8);
});
