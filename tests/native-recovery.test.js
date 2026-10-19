'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ControllerRegistry}=require('../server/controllers');
const {defaults}=require('../server/store');
const {Hardware}=require('../server/hardware');
const {EventEmitter}=require('node:events');
const spatial=require('../public/spatial');
const {diagnostics}=require('../server/diagnostics');

test('rainbow uses the keyboard Neon color cycle while wave retains the traveling wave',async()=>{
  const packets=[],store={data:{master:{...defaults,effect:'rainbow'},devices:{}}};
  const registry=new ControllerRegistry({store,hidBridge:{sendFeatureReport:async(_p,packet)=>{packets.push(Buffer.from(packet));return true;},stop(){}}});
  const kb=registry.addKeyboardController({hidPath:'synthetic-only'});
  try {
    await registry.sendLeds(kb.id,[]);
    assert.equal(packets[0][5],0x13);assert.equal(packets[0][12],0);
    store.data.master.effect='wave';await registry.sendLeds(kb.id,[]);
    assert.equal(packets[1][5],0x01);assert.equal(packets[1][12],1);
    await registry.sendLeds(kb.id,[]);assert.equal(packets.length,2);
  } finally {registry.destroy();}
});

test('USB acknowledgement remains independent of an SDK reconnect and delivers the next keyboard change',async t=>{
  let release,writes=0;const store={data:{master:{...defaults,effect:'static'},devices:{}}};
  const registry=new ControllerRegistry({store,hidBridge:{sendFeatureReport:async()=>{if(++writes===1)await new Promise(resolve=>{release=resolve;});return true;},stop(){release?.();}}});
  registry.addKeyboardController({hidPath:'synthetic-only'});
  class SDK extends EventEmitter{constructor(){super();this.socket={on(){},destroy(){},writableLength:0};}async connect(){}async getControllerCount(){return 0;}disconnect(){}}
  const hardware=new Hardware(store,{controllerRegistry:registry,makeClient:()=>new SDK()});t.after(()=>hardware.stop());hardware.stopped=false;
  await hardware.connect();hardware.nextDiscovery=Infinity;await hardware.tick();
  await hardware.connect();hardware.nextDiscovery=Infinity;release();await new Promise(setImmediate);
  store.data.master.color='#0000ff';hardware.changed();await hardware.tick();await new Promise(setImmediate);
  assert.equal(writes,2);assert.equal(hardware.snapshot().devices[0].status,'online');
});

test('keyboard controls work while SDK connection is waiting and after SDK failure',async t=>{
  let release,writes=0;const store={data:{master:{...defaults,effect:'static'},devices:{}}};
  const registry=new ControllerRegistry({store,hidBridge:{sendFeatureReport:async()=>{writes++;return true;},stop(){}}});registry.addKeyboardController({hidPath:'synthetic-only'});
  class SDK extends EventEmitter{constructor(){super();this.socket={destroy(){}};}connect(){return new Promise((resolve,reject)=>{release=()=>reject(Error('Synthetic SDK unavailable'));});}disconnect(){}}
  const hardware=new Hardware(store,{controllerRegistry:registry,makeClient:()=>new SDK()});t.after(()=>hardware.stop());hardware.stopped=false;
  const connecting=hardware.connect();await new Promise(setImmediate);
  await hardware.tick();await new Promise(setImmediate);const during=writes;
  release();await connecting;
  store.data.master.color='#0000ff';hardware.changed();await hardware.tick();await new Promise(setImmediate);
  assert.equal(during,1);assert.equal(writes,2);assert.equal(hardware.connected,false);assert.equal(hardware.snapshot().devices[0].status,'online');
});

test('individual keyboard color and software mode override the master without continuous USB streaming',async t=>{
  const packets=[],store={data:{master:{...defaults,effect:'wave',color:'#ff0000'},devices:{}}};
  const registry=new ControllerRegistry({store,hidBridge:{sendFeatureReport:async(_p,packet)=>{packets.push(Buffer.from(packet));return true;},stop(){}}});const kb=registry.addKeyboardController({hidPath:'synthetic-only'});
  const hardware=new Hardware(store,{controllerRegistry:registry});t.after(()=>hardware.stop());hardware.stopped=false;hardware.nextDiscovery=Infinity;
  await hardware.tick();await new Promise(setImmediate);
  store.data.devices[kb.id]={color:'#0000ff',effect:'static'};hardware.changed();await hardware.tick();await new Promise(setImmediate);
  assert.equal(packets.length,2);assert.equal(packets[1][5],0x11);assert.deepEqual([...packets[1].subarray(9,12)],[0,0,255]);
  for(let i=0;i<10;i++)await hardware.tick();assert.equal(packets.length,2);
});
test('a native peripheral does not make an offline OpenRGB component appear online in diagnostics',async t=>{
  const store={data:{master:{...defaults},devices:{}}},registry=new ControllerRegistry({store});registry.addKeyboardController();
  const hardware=new Hardware(store,{controllerRegistry:registry});t.after(()=>hardware.stop());
  hardware.devices.unshift({id:'a'.repeat(24),name:'Synthetic board',type:0,ledCount:1,effects:['wave'],raw:{},error:null});
  const report=diagnostics(hardware,{config:{},metrics:{},recoverySnapshot:()=>({})},store,null);
  assert.equal(report.health.state,'partial');assert.equal(report.components[0].status,'offline');
});
test('a generic 61 LED matrix respects columns, while a marked ANSI keyboard retains its geometry',()=>{
  const item={shape:'matrix',count:61,columns:1,width:1,height:1,start:0};
  assert.equal(new Set(spatial.leds(item).map(p=>p.x)).size,1);
  assert.equal(new Set(spatial.leds({...item,geometry:'ansi-60'}).map(p=>p.y)).size,5);
});
test('keyboard retries an unacknowledged change and reports success only after the HID acknowledgement',async()=>{
  let accepted=false,writes=0,clock=0;
  const bridge={sendFeatureReport:async()=>{writes++;return accepted;},stop(){}};
  const store={data:{master:{...defaults,power:true,effect:'static'},devices:{}}};
  const registry=new ControllerRegistry({store,hidBridge:bridge,now:()=>clock});
  const keyboard=registry.addKeyboardController({hidPath:'synthetic-device'});
  assert.equal(await registry.sendLeds(keyboard.id,[]),false);
  assert.equal(registry.getLastPacket(keyboard.id),null);
  accepted=true;clock=501;
  assert.equal(await registry.sendLeds(keyboard.id,[]),true);
  assert.equal(writes,2);
  assert.equal(await registry.sendLeds(keyboard.id,[]),true);
  assert.equal(writes,2,'unchanged acknowledged state does not stream to the keyboard');
});
test('a repeatedly failing USB device is retried with backoff instead of at the animation rate',async()=>{
  let writes=0;
  const registry=new ControllerRegistry({store:{data:{master:{...defaults},devices:{}}},hidBridge:{sendFeatureReport:async()=>{writes++;return false;},stop(){}},now:()=>0});
  const keyboard=registry.addKeyboardController({hidPath:'synthetic-device'});
  for(let i=0;i<60;i++)await registry.sendLeds(keyboard.id,[]);
  assert.equal(writes,1);
});
test('hardware retains a failed native command for retry without counting it as a sent frame',async t=>{
  let accepted=false;
  const store={data:{master:{...defaults,power:true,effect:'static'},devices:{}}};
  const registry=new ControllerRegistry({store,hidBridge:{sendFeatureReport:async()=>accepted,stop(){}}});
  registry.addKeyboardController({hidPath:'synthetic-device'});
  const hardware=new Hardware(store,{controllerRegistry:registry});t.after(()=>hardware.stop());hardware.stopped=false;hardware.nextDiscovery=Infinity;
  await hardware.tick();
  await new Promise(setImmediate);
  assert.equal(hardware.snapshot().metrics.framesSent,0);
  assert(hardware.snapshot().devices[0].error);
  accepted=true;store.data.master.color='#123456';hardware.changed();await hardware.tick();
  await new Promise(setImmediate);
  assert.equal(hardware.snapshot().metrics.framesSent,1);
  assert.equal(hardware.snapshot().devices[0].error,null);
});
test('a waiting USB acknowledgement does not stop OpenRGB frames',async t=>{
  let release;
  const registry=new ControllerRegistry({hidBridge:{sendFeatureReport:()=>new Promise(resolve=>{release=resolve;}),stop(){release?.(false);}}});
  registry.addKeyboardController({hidPath:'synthetic-device'});
  const store={data:{master:{...defaults,effect:'static'},devices:{}}};registry.store=store;
  const hardware=new Hardware(store,{controllerRegistry:registry});hardware.stopped=false;hardware.nextDiscovery=Infinity;
  t.after(()=>{release?.(true);hardware.stop();});
  const tick=hardware.tick();
  assert.equal(await Promise.race([tick.then(()=>true),new Promise(r=>setTimeout(()=>r(false),30))]),true);
});
test('discovery preserves separate identical keyboards, removes unplugged devices and ignores unverified models',async()=>{
  let devices=[{path:'synthetic-one',vid:'0x258a',pid:'0x00ec',featLen:65,usagePage:65280},{path:'synthetic-two',vid:'0x258a',pid:'0x00ec',featLen:65,usagePage:65280},{path:'unsupported',vid:'0x1b1c',pid:'0xffff',outLen:64},{path:'keyboard-input-not-lighting',vid:'0x258a',pid:'0x00ec',featLen:65,usagePage:1}];
  const registry=new ControllerRegistry({hidBridge:{enumerate:async()=>devices,stop(){}}});
  await registry.autoDetectHardware({force:true});
  assert.equal(registry.getDevices().length,2);
  assert(registry.getDevices().every(d=>d.controllerType==='keyboard'));
  assert.equal(new Set(registry.getDevices().map(d=>d.id)).size,2);
  devices=devices.slice(0,1);await registry.autoDetectHardware({force:true});
  assert.equal(registry.getDevices().length,1);
});
test('keyboard UI percentages and native mode changes reach the transport through Hardware',async t=>{
  const packets=[],store={data:{master:{...defaults,effect:'static'},devices:{}}};
  const registry=new ControllerRegistry({store,hidBridge:{sendFeatureReport:async(_path,packet)=>{packets.push(packet);return true;},stop(){}}});
  const kb=registry.addKeyboardController({hidPath:'synthetic-device'});
  const hardware=new Hardware(store,{controllerRegistry:registry});t.after(()=>hardware.stop());hardware.stopped=false;hardware.nextDiscovery=Infinity;
  store.data.devices[kb.id]={brightness:5};await hardware.tick();await new Promise(setImmediate);
  assert.equal(packets.at(-1)[8],0,'5 percent must not turn into maximum hardware brightness');
  store.data.devices[kb.id]={brightness:100,nativeMode:3};hardware.changed();await hardware.tick();await new Promise(setImmediate);
  assert.equal(packets.at(-1)[5],3);
  assert.equal(hardware.snapshot().devices[0].settings.nativeMode,3);
});
test('hardware rediscovers hotplugged native devices after the scan cache expires and closes the bridge',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.now()});let scans=0,closed=0;
  const registry=new ControllerRegistry({hidBridge:{enumerate:async()=>++scans===1?[]:[{path:'synthetic-hotplug',vid:'0x258a',pid:'0x00ec',featLen:65,usagePage:65280}],stop(){closed++;}}});
  class SDK extends EventEmitter{async connect(){}async getControllerCount(){return 0;}disconnect(){}}
  const hardware=new Hardware({data:{master:{...defaults},devices:{}}},{controllerRegistry:registry,makeClient:()=>new SDK()});t.after(()=>hardware.stop());hardware.stopped=false;
  await hardware.connect();t.mock.timers.tick(31000);await hardware.connect();
  assert.equal(hardware.snapshot().devices.length,1);hardware.stop();assert.equal(closed,1);
});
test('unverified native encoders cannot claim a successful physical controller write',async()=>{
  let writes=0;
  const registry=new ControllerRegistry({hidBridge:{writeOutputReport:async()=>{writes++;return true;},stop(){}}});
  const controller=registry.addCorsairController({hidPath:'synthetic-controller'});
  assert.equal(await registry.sendLeds(controller.id,Array(48).fill({red:255,green:0,blue:0})),false);
  assert.equal(writes,0);assert.match(controller.error,/OpenRGB/);
});
test('a keyboard running an internal animation does not render or count software frames every tick',async t=>{
  let writes=0;const store={data:{master:{...defaults,effect:'wave'},devices:{}}};
  const registry=new ControllerRegistry({store,hidBridge:{sendFeatureReport:async()=>{writes++;return true;},stop(){}}});registry.addKeyboardController({hidPath:'synthetic-device'});
  const hardware=new Hardware(store,{controllerRegistry:registry});t.after(()=>hardware.stop());hardware.stopped=false;hardware.nextDiscovery=Infinity;
  for(let i=0;i<60;i++){await hardware.tick();await new Promise(setImmediate);}
  assert.equal(writes,1);assert.equal(hardware.snapshot().metrics.framesSent,1);
});
