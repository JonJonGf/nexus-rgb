'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/http-app');
const interfaces=()=>[{name:'Fixture LAN',address:'192.168.60.2',netmask:'255.255.255.0'}];
const lan=cookie=>({socket:{remoteAddress:'192.168.60.7'},headers:{cookie:cookie||''}});

test('LAN access mode persists, authorized links can be renewed/revoked and never grant admin',async t=>{
  const {app,request,cookie,directory}=await fixture(t,{getInterfaces:interfaces});
  assert.equal((await request('/api/access',{cookie})).json().mode,'open');
  assert.equal(app.security.session(lan()).admin,false);
  const set=body=>request('/api/access',{cookie,method:'POST',body});
  assert.equal((await set({mode:'authorized'})).status,200);
  assert.equal((await request('/api/health')).json().lanAccess,'authorized','Tray can distinguish a plain URL from an authorized link without receiving its secret.');
  assert.equal(app.security.session(lan()),null);
  const link=(await request('/api/link',{cookie,method:'POST',body:{}})).json();
  const token=new URL(link.link).hash.slice('#nexus-link='.length);
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(app.security.session(lan('nexus_access='+token)).admin,false);
  assert.equal(app.security.session(lan('nexus_access='+'a'.repeat(43))),null);
  assert.equal(JSON.stringify((await request('/api/access',{cookie})).json()).includes(token),false);
  const saved=require('node:fs').readFileSync(require('node:path').join(directory,'access.json'),'utf8');
  assert.equal(saved.includes(token),false);
  assert.equal((await set({revoke:true})).status,200);
  assert.equal(app.security.session(lan('nexus_access='+token)),null);
  assert.equal((await set({mode:'local'})).status,200);
  assert.equal(app.security.session(lan()),null);
  assert.equal((await request('/api/link',{cookie,method:'POST',body:{}})).status,409);
  assert.equal((await set({mode:'open'})).status,200);
  assert.equal(app.security.session(lan()).admin,false);
  assert.equal((await set({mode:'invalid'})).status,400);
});

test('authorized access survives service restart and renewing a link rejects the old cookie immediately',async t=>{
  const {app,request,cookie,directory}=await fixture(t,{getInterfaces:interfaces});
  await request('/api/access',{cookie,method:'POST',body:{mode:'authorized'}});
  const first=(await request('/api/link',{cookie,method:'POST',body:{}})).json().link.split('#nexus-link=')[1];
  const second=(await request('/api/link',{cookie,method:'POST',body:{}})).json().link.split('#nexus-link=')[1];
  assert.notEqual(first,second);
  assert.equal(app.security.session(lan('nexus_access='+first)),null);
  await app.stop();
  const other=await require('../server').createApp({directory,localPort:0,disableHardware:true,disableAlexa:true,getInterfaces:interfaces});
  t.after(()=>other.stop());await other.start();
  assert.equal(other.security.session(lan('nexus_access='+second)).admin,false);
  assert.equal(other.security.session(lan('nexus_access='+first)),null);
});

test('real LAN HTTP exchanges fragment secret for an HttpOnly guest cookie and revocation closes streams',async t=>{
  const adapter=require('../server/network').adapters()[0];if(!adapter)return t.skip('No private LAN interface on this host.');
  const {app,request,cookie,localPort}=await fixture(t);
  await request('/api/access',{cookie,method:'POST',body:{mode:'authorized'}});
  const link=(await request('/api/link',{cookie,method:'POST',body:{address:adapter.address}})).json().link;
  const remote='http://'+adapter.address+':'+localPort,token=new URL(link).hash.slice(12);
  assert.equal((await request('/api/state',{host:remote})).status,401);
  const paired=await request('/api/session/lan',{host:remote,method:'POST',body:{token}});
  assert.equal(paired.status,200,paired.text);assert.match(paired.headers['set-cookie'][0],/HttpOnly/);
  const guest=paired.headers['set-cookie'][0].split(';')[0];
  assert.equal((await request('/api/state',{host:remote,cookie:guest})).status,200);
  assert.equal((await request('/api/access',{host:remote,cookie:guest})).status,403);
  const http=require('node:http');let stream;
  const closed=new Promise((resolve,reject)=>{stream=http.get(remote+'/api/events',{headers:{Cookie:guest}},res=>{res.on('data',()=>{});res.on('end',resolve);res.on('error',reject);});stream.on('error',reject);});
  t.after(()=>stream.destroy());
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal((await request('/api/access',{cookie,method:'POST',body:{revoke:true}})).status,200);
  await Promise.race([closed,new Promise((_,reject)=>{const timeout=setTimeout(()=>reject(Error('Revoked SSE did not close')),1000);timeout.unref();})]);
  assert.equal((await request('/api/state',{host:remote,cookie:guest})).status,401);
  assert.equal(app.security.access.snapshot().linkReady,false);
});
