'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fixture} = require('./helpers/http-app');

test('temporary scene changes the effective output and restores without rewriting saved lighting', async t => {
  const {request, cookie, app} = await fixture(t);
  const saved = await request('/api/experiences/scenes', {method:'POST', cookie, body:{name:'Focus', steps:[{durationMs:200, lighting:{color:'#ff0000',effect:'static'}}], repeat:1}});
  assert.equal(saved.status, 200, saved.text);
  const original = structuredClone(app.store.data);
  const id = saved.json().id;
  assert.equal((await request('/api/experiences/play', {method:'POST',cookie,body:{id}})).status,200);
  assert.equal(app.hardware.settings('a'.repeat(24)).color, '#ff0000');
  assert.deepEqual(app.store.data, original);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(app.hardware.settings('a'.repeat(24)).color, original.master.color);
  assert.deepEqual(app.store.data, original);
});

test('phone LAN session can save bounded gesture recordings while audio and WLED configuration stay local',async t=>{
  const adapter=require('../server/network').adapters()[0];if(!adapter)return t.skip('No private LAN interface available');
  const {request,localPort}=await fixture(t,{getInterfaces:()=>[adapter]}),host='http://'+adapter.address+':'+localPort;
  const saved=await request('/api/experiences/recordings',{host,method:'POST',body:{name:'Phone gesture',events:[{x:.5,y:.5,kind:'trail',color:'#00ffff',atMs:0,durationMs:200}]}});
  assert.equal(saved.status,200,saved.text);
  assert.equal((await request('/api/experiences/settings',{host,method:'POST',body:{}})).status,403);
  assert.equal((await request('/api/room',{host,method:'POST',body:{}})).status,403);
});

test('reviewed backups include experiences and reject broken references before restore',async t=>{
  const {request,cookie,app}=await fixture(t);
  const p=app.store.profile('Work',{palette:['#ff8800'],effect:'static'});
  await request('/api/experiences/scenes',{method:'POST',cookie,body:{name:'Work timer',steps:[{profileId:p.id,durationMs:1000}]}});
  const backup=(await request('/api/backups',{cookie})).json();assert.equal(backup.settings.experiences.scenes.length,1);
  assert.equal((await request('/api/profiles/'+p.id,{method:'DELETE',cookie,body:{}})).status,409);
  const invalid=structuredClone(backup);invalid.settings.profiles=[];assert.equal((await request('/api/backups/review',{method:'POST',cookie,body:invalid})).status,400);
  await request('/api/experiences/scenes/'+backup.settings.experiences.scenes[0].id,{method:'DELETE',cookie,body:{}});
  const review=await request('/api/backups/review',{method:'POST',cookie,body:backup});assert.equal(review.status,200,review.text);
  const result=await request('/api/backups/restore',{method:'POST',cookie,body:{token:review.json().token}});assert.equal(result.status,200,result.text);
  assert.equal((await request('/api/experiences',{cookie})).json().scenes[0].name,'Work timer');
});

test('optional Hue scene starts and cancels through the protocol while the main light keeps its identity',async t=>{
  const {app,request,cookie}=await fixture(t);
  const item=(await request('/api/experiences/scenes',{method:'POST',cookie,body:{name:'Break',alexa:true,steps:[{durationMs:1000,lighting:{color:'#ff0000'}}]}})).json();
  const alexa=app.alexa;alexa.getInterfaces=()=>[{address:'192.168.50.3',netmask:'255.255.255.0'}];alexa.data.peers=['192.168.50.4'];
  const lights=alexa.lights(),light=Object.keys(lights).find(id=>id!=='1');assert.ok(light);assert.equal(lights[1].name,'Iluminação Nexus');
  const command=async on=>{const {Readable}=require('node:stream'),{EventEmitter}=require('node:events');const req=Readable.from([Buffer.from(JSON.stringify({on,bri:254}))]);Object.assign(req,{socket:{remoteAddress:'192.168.50.4',localAddress:'192.168.50.3'},headers:{host:'192.168.50.3'},url:'/api/nexus/lights/'+light+'/state',method:'PUT'});const res=new EventEmitter();res.writeHead=status=>res.status=status;res.end=value=>{res.body=JSON.parse(value);res.emit('finish');};await alexa.request(req,res);return res;};
  const on=await command(true);assert.equal(on.status,200);assert.deepEqual(on.body,[{success:{['/lights/'+light+'/state/on']:true}},{success:{['/lights/'+light+'/state/bri']:254}}]);assert.equal(app.experiences.active.scene.id,item.id);
  await command(false);assert.equal(app.experiences.active,null);assert.equal(Object.keys(alexa.lights()).find(id=>id!=='1'),light);
});

test('live recordings and experience settings survive restart, while runtime effects do not resume',async t=>{
  const {request,cookie,app,directory}=await fixture(t);
  await request('/api/experiences/recordings',{method:'POST',cookie,body:{name:'Touch',events:[{x:.5,y:.5,color:'#00ff00',kind:'ripple',atMs:0,durationMs:300}]}});
  const {Experiences}=require('../server/experiences');
  const reloaded=new Experiences(app.store,app.hardware,app.studio,directory,()=>{});t.after(()=>reloaded.close());
  assert.equal(reloaded.snapshot().recordings[0].name,'Touch');assert.equal(reloaded.snapshot().active,null);assert.equal(reloaded.agentConfig().audio,false);
  for(const body of [{events:Array(17).fill({})},{events:[{x:1.1,y:0,color:'#ffffff',kind:'trail'}]},{events:[{x:0,y:0,color:'#ffffff',kind:'trail',durationMs:100000}]}])assert.equal((await request('/api/experiences/live',{method:'POST',cookie,body})).status,400);
});

test('applying a saved profile cancels a scene instead of leaving its transient color over the profile',async t=>{
  const {request,cookie,app}=await fixture(t);
  const p=app.store.profile('Blue',{palette:['#0000ff'],effect:'static'});
  const s=(await request('/api/experiences/scenes',{method:'POST',cookie,body:{name:'Red',steps:[{durationMs:1000,lighting:{color:'#ff0000'}}]}})).json();
  await request('/api/experiences/play',{method:'POST',cookie,body:{id:s.id}});
  await request('/api/profiles/'+p.id,{method:'POST',cookie,body:{}});
  assert.equal(app.hardware.settings('a'.repeat(24)).color,'#0000ff');
});

test('opt-in audio and foreground profiles expire safely without recording sound or rewriting profiles',async t=>{
  const {request,cookie,app}=await fixture(t);const id='a'.repeat(24);
  const profile=app.store.profile('Editor',{color:'#0000ff',palette:['#0000ff'],effect:'static',brightness:70});
  const configured=await request('/api/experiences/settings',{method:'POST',cookie,body:{audio:{enabled:true,gain:1,palette:['#ff0000','#00ff00','#0000ff'],axis:'y'},context:{enabled:true,rules:[{application:'editor.exe',profileId:profile.id}]}}});
  assert.equal(configured.status,200,configured.text);
  const before=structuredClone(app.store.data);
  const signal=await request('/api/experiences/signal',{method:'POST',cookie,body:{bands:[1,0,0],application:'editor.exe',capture:'active'}});
  assert.equal(signal.status,200,signal.text);assert.equal(app.hardware.settings(id).color,'#0000ff');
  assert.deepEqual(app.store.data,before);
  await request('/api/experiences/signal',{method:'POST',cookie,body:{application:'other.exe',capture:'stopped'}});
  assert.equal(app.hardware.settings(id).color,before.master.color);
  assert.equal((await request('/api/experiences/agent',{cookie})).json().context,true);
});

test('manual edits and lights-off take precedence over a running scene', async t => {
  const {request,cookie,app}=await fixture(t);
  app.store.data.devices['a'.repeat(24)]={power:false};
  const scene=(await request('/api/experiences/scenes',{method:'POST',cookie,body:{name:'Temporary',steps:[{durationMs:200,lighting:{power:true,color:'#ff0000'}}]}})).json();
  await request('/api/experiences/play',{method:'POST',cookie,body:{id:scene.id}});
  assert.equal(app.hardware.settings('a'.repeat(24)).power,false);
  await request('/api/control',{method:'POST',cookie,body:{color:'#0000ff'}});
  await new Promise(r=>setTimeout(r,260));
  assert.equal(app.hardware.settings('a'.repeat(24)).color,'#0000ff');
  assert.equal((await request('/api/experiences',{cookie})).json().active,null);
});

test('live touches affect mapped LEDs, expire, and cannot illuminate excluded or off pieces', async t => {
  const {request,cookie,app}=await fixture(t);
  const id='a'.repeat(24);
  app.store.data.master={power:true,color:'#000000',brightness:100,effect:'static',speed:40};
  app.store.data.studio={enabled:false,layout:[{key:id,deviceId:id,start:0,count:1,x:.5,y:.5,width:.1,height:.1,rotation:0,shape:'strip',columns:1}],excluded:[]};
  const event={x:.5,y:.5,color:'#ff0000',kind:'trail',durationMs:150};
  const response=await request('/api/experiences/live',{method:'POST',cookie,body:{events:[event]}});
  assert.equal(response.status,200,response.text);
  const render=()=>app.hardware.renderFrame(id,app.hardware.settings(id),1,0)[0];
  assert.ok(render().red>100);
  app.store.data.studio.excluded=[id]; assert.equal(render().red,0);
  app.store.data.studio.excluded=[];app.store.data.devices[id]={power:false};assert.equal(render().red,0);
  delete app.store.data.devices[id]; await new Promise(r=>setTimeout(r,190));assert.equal(render().red,0);
});

test('turning audio off restores the static frame through the SDK instead of retaining the last music color',async t=>{
  const {app,request,cookie}=await fixture(t),{EventEmitter}=require('node:events'),writes=[];
  class SDK extends EventEmitter {
    async connect(){} async getControllerCount(){return 1;}
    async getControllerData(){return {name:'Output fixture',vendor:'Fixture',location:'USB:experiences',type:2,serial:'',zones:[],colors:[{red:0,green:0,blue:0}],modes:[{id:2,name:'Direct',flagList:['perLedColor']}]};}
    async updateMode(){} updateLeds(id,colors){writes.push(structuredClone(colors));} disconnect(){}
  }
  app.hardware.makeClient=()=>new SDK();app.hardware.stopped=false;await app.hardware.connect();
  const id=app.hardware.snapshot().devices[0].id;
  assert.equal((await request('/api/control',{method:'POST',cookie,body:{power:true,brightness:100,effect:'static',color:'#000000'}})).status,200);
  assert.equal((await request('/api/studio',{method:'POST',cookie,body:{enabled:false,layout:[{key:id,deviceId:id,name:'Fixture',reverse:false,start:0,count:1,x:.5,y:.5,width:.1,height:.1,rotation:0,shape:'strip',columns:1}]}})).status,200);
  await app.hardware.tick();
  const audio={enabled:true,gain:1,palette:['#ff0000','#00ff00','#0000ff'],axis:'y'};
  assert.equal((await request('/api/experiences/settings',{method:'POST',cookie,body:{audio}})).status,200);
  await request('/api/experiences/signal',{method:'POST',cookie,body:{bands:[0,1,0],capture:'active'}});await app.hardware.tick();
  assert.deepEqual(writes.at(-1),[{red:0,green:255,blue:0}]);
  assert.equal((await request('/api/experiences/settings',{method:'POST',cookie,body:{audio:{...audio,enabled:false}}})).status,200);
  await app.hardware.tick();assert.deepEqual(writes.at(-1),[{red:0,green:0,blue:0}]);
  const count=writes.length;await app.hardware.tick();assert.equal(writes.length,count,'Static output must return to idle without repeated bus writes.');
  for(const termination of ['stop','expiry']){
    const gesture={x:.5,y:.5,color:'#ff0000',kind:'trail',durationMs:termination==='stop'?4000:100};
    assert.equal((await request('/api/experiences/live',{method:'POST',cookie,body:{events:[gesture]}})).status,200);
    await app.hardware.tick();assert.ok(writes.at(-1)[0].red>0,'Gesture must reach the SDK before testing its end.');
    if(termination==='stop')await request('/api/experiences/stop',{method:'POST',cookie,body:{}});
    else await new Promise(r=>setTimeout(r,1200)); // No ticks during expiry: simulates suspension/delay.
    await app.hardware.tick();assert.deepEqual(writes.at(-1),[{red:0,green:0,blue:0}],termination+' must send the base frame.');
    const sent=writes.length;await app.hardware.tick();assert.equal(writes.length,sent,'The terminal frame must not create an idle write loop.');
  }
});

test('overlapping Live gestures stay valid RGB bytes and keep the real SDK encoder connected',async t=>{
  const {app,request,cookie}=await fixture(t),{Client}=require('openrgb-sdk'),packets=[];
  class SDK extends Client {
    constructor(){super('Fixture',6742,'127.0.0.1');}
    async connect(){} async getControllerCount(){return 1;}
    async getControllerData(){return {name:'Live output fixture',vendor:'Fixture',location:'USB:live',type:2,serial:'',zones:[],colors:[{red:0,green:0,blue:0}],modes:[{id:2,name:'Direct',flagList:['perLedColor']}]};}
    async updateMode(){} sendMessage(command,buffer){packets.push({command,buffer:Buffer.from(buffer)});} disconnect(){}
  }
  app.hardware.makeClient=()=>new SDK();app.hardware.stopped=false;await app.hardware.connect();
  const id=app.hardware.snapshot().devices[0].id;
  assert.equal((await request('/api/control',{method:'POST',cookie,body:{power:true,brightness:100,effect:'static',color:'#ffffff'}})).status,200);
  assert.equal((await request('/api/studio',{method:'POST',cookie,body:{enabled:false,layout:[{key:id,deviceId:id,name:'Fixture',reverse:false,start:0,count:1,x:.5,y:.5,width:.1,height:.1,rotation:0,shape:'strip',columns:1}]}})).status,200);
  await app.hardware.tick();
  // Each gesture contributes roughly half intensity here. Two add to a full
  // cyan overlay while half the white base remains: previously >255 at encoding.
  const gesture={x:.25,y:.5,color:'#00ffff',kind:'trail',radius:.8,durationMs:4000};
  assert.equal((await request('/api/experiences/live',{method:'POST',cookie,body:{events:[gesture,gesture]}})).status,200);
  await app.hardware.tick();const status=app.hardware.snapshot();assert.equal(status.connected,true,status.error);
  const encoded=packets.filter(p=>p.command===1050).at(-1).buffer;
  assert.ok(encoded.readUInt8(6)<255,'The cyan gesture must visibly mix with the white base.');
  assert.equal(encoded.readUInt8(7),255);assert.equal(encoded.readUInt8(8),255);
  const recording=(await request('/api/experiences/recordings',{method:'POST',cookie,body:{name:'Overlapping replay',events:Array.from({length:32},()=>({...gesture,atMs:0}))}})).json();
  for(const brightness of [20,50,100]){
    await request('/api/experiences/stop',{method:'POST',cookie,body:{}});
    await request('/api/control',{method:'POST',cookie,body:{brightness}});
    assert.equal((await request('/api/experiences/recordings/'+recording.id+'/play',{method:'POST',cookie,body:{}})).status,200);
    const audio={enabled:true,gain:8,palette:['#ffffff','#ffffff','#ffffff'],axis:'y'};
    await request('/api/experiences/settings',{method:'POST',cookie,body:{audio}});
    await request('/api/experiences/signal',{method:'POST',cookie,body:{bands:[1,1,1],capture:'active'}});
    for(let n=0;n<3;n++){
      assert.equal((await request('/api/experiences/live',{method:'POST',cookie,body:{events:Array(16).fill(gesture)}})).status,200);
      await app.hardware.tick();const status=app.hardware.snapshot();assert.equal(status.connected,true,status.error);
      const bytes=packets.filter(p=>p.command===1050).at(-1).buffer;
      for(const offset of [6,7,8])assert.equal(bytes.readUInt8(offset),Math.round(255*brightness/100),'Live, replay and audio must respect the configured brightness ceiling.');
    }
  }
});
