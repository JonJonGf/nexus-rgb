'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),dgram=require('node:dgram');
const {fixture}=require('./helpers/http-app');
test('Room verifies WLED before registering and sends correctly addressed DDP pixels',async t=>{
  const calls=[],bodies=[],server=http.createServer((req,res)=>{calls.push(req.url);const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{if(chunks.length)bodies.push(JSON.parse(Buffer.concat(chunks).toString()));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/json/info'?{brand:'WLED',ver:'0.15.0',leds:{count:2}}:{success:true}));});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const receiver=dgram.createSocket('udp4');await new Promise(r=>receiver.bind(0,'127.0.0.1',r));t.after(()=>receiver.close());
  const {request,cookie,app}=await fixture(t,{room:{resolveTarget:()=>({address:'127.0.0.1',port:server.address().port,ddpPort:receiver.address().port})}});
  const result=await request('/api/room',{cookie,method:'POST',body:{name:'Desk',address:'192.168.50.2',mode:'map',enabled:true}});
  assert.equal(result.status,200,result.text);const id=result.json().id;
  assert.ok(app.hardware.snapshot().devices.some(d=>d.id===id&&d.ledCount===2&&d.spatialCapable));
  const packet=new Promise(r=>receiver.once('message',r));
  app.store.data.master={power:true,effect:'wave',color:'#ff0000',brightness:100,speed:40};
  await app.room.flush();const data=await packet;
  assert.equal(data[0],0x41);assert.equal(data[2],1);assert.equal(data[3],1);assert.equal(data.readUInt32BE(4),0);assert.equal(data.readUInt16BE(8),6);assert.equal(data.length,16);
  assert.equal(calls[0],'/json/info');
  assert.equal(app.hardware.outputFor(id).colors.length,2);
  const disabled=await request('/api/room',{cookie,method:'POST',body:{id,name:'Desk',address:'192.168.50.2',mode:'map',enabled:false}});assert.equal(disabled.status,200,disabled.text);
  assert.equal(app.hardware.snapshot().connected,false,'disabled optional controllers must not keep the renderer active');
  assert.equal(app.room.devices()[0].settings.power,false);assert.equal(bodies.at(-1).live,false);
  const removed=await request('/api/room/'+id,{method:'DELETE',cookie,body:{}});assert.equal(removed.status,200,removed.text);
  assert.equal(bodies.at(-1).live,false,'removing WLED must release its persistent realtime lock');
  assert.ok(!app.hardware.snapshot().devices.some(d=>d.id===id));
});

test('Room rejects public, local, broadcast and hostname targets before any HTTP connection',async t=>{
  const {target}=require('../server/room'),interfaces=()=>[{address:'192.168.50.3',netmask:'255.255.255.0'}];
  for(const address of ['8.8.8.8','127.0.0.1','localhost','192.168.50.0','192.168.50.255','10.0.0.1','192.168.50.2/evil'])assert.throws(()=>target({address},interfaces));
  assert.deepEqual(target({address:'192.168.50.2'},interfaces),{address:'192.168.50.2',port:80,ddpPort:4048});
  const {request,cookie}=await fixture(t);assert.equal((await request('/api/room',{method:'POST',cookie,body:{name:'External',address:'8.8.8.8',mode:'map',enabled:true}})).status,400);
});

test('DDP fragments at MTU boundaries and only pushes the completed frame',()=>{
  const {packets}=require('../server/room'),rgb=Array.from({length:481},()=>({red:1,green:2,blue:3})),p=packets(rgb,7);
  assert.equal(p.length,2);assert.equal(p[0].length,1450);assert.equal(p[0][0],0x40);assert.equal(p[1][0],0x41);assert.equal(p[1][1],7);assert.equal(p[1].readUInt32BE(4),1440);assert.equal(p[1].readUInt16BE(8),3);assert.deepEqual([...p[1].subarray(10)],[1,2,3]);
});
