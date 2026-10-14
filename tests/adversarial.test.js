'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http');
const { EventEmitter } = require('node:events');
const { setTimeout: sleep } = require('node:timers/promises');
const { fixture } = require('./helpers/http-app');
const network = require('../server/network');

test('matriz de requisições hostis não altera dados, expõe arquivos ou aceita origem forjada', async t => {
  const { app, request, cookie } = await fixture(t);
  app.store.master({ color: '#123456' }); const baseline = JSON.stringify(app.store.data);
  const headers = [{ Host: 'attacker.example' }, { Origin: 'null' }, { Origin: 'https://attacker.example' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'X-Forwarded-For': '127.0.0.1' }, { Forwarded: 'for=127.0.0.1' }, { 'X-Forwarded-Host': 'localhost' }, { 'X-Nexus-Client': '' }];
  for (const header of headers) assert.equal((await request('/api/control', { method: 'POST', body: { power: false }, cookie, headers: header })).status, 403);
  for (const body of [null, [], true, 9, '"string"', '{invalid', '{"__proto__":{"polluted":true}}', { constructor: {} }, { color: '#fff' }, { color: '<svg onload=alert(1)>' }, { power: 0 }, { power: 'false' }, { brightness: 1.5 }, { brightness: -1 }, { brightness: 101 }, '{"brightness":1e309}', { speed: {} }, { effect: '../shutdown' }, { palette: Array(9).fill('#123456') }, { palette: ['javascript:alert(1)'] }, { nativeMode: 1 }, { execute: 'shutdown' }]) {
    assert.equal((await request('/api/control', { method: 'POST', body, cookie })).status, 400, JSON.stringify(body));
    assert.equal(JSON.stringify(app.store.data), baseline);
  }
  for (const route of ['/data/settings.json', '/server/index.js', '/package.json', '/scripts/install-services.ps1', '/..%2fdata%2fsettings.json', '/%2e%2e/data/settings.json', '/C:/Windows/win.ini']) assert.equal((await request(route, { cookie })).status, 404, route);
  assert.equal(Object.prototype.polluted, undefined); assert.equal(JSON.stringify(app.store.data), baseline);
  assert.equal((await request('/api/control', { method: 'OPTIONS', cookie })).status, 405);
});

test('corpo excedente por chunks é recusado e conexão interrompida não derruba o painel', async t => {
  const { origin, app, request, cookie } = await fixture(t); const baseline = JSON.stringify(app.store.data);
  assert.equal((await request('/api/control', { method: 'POST', body: JSON.stringify({ color: 'x'.repeat(12000) }), chunked: true, cookie })).status, 413);
  await new Promise(resolve => {
    const req = http.request(origin + '/api/control', { method: 'POST', headers: { Origin: origin, 'X-Nexus-Client': 'web', 'Content-Type': 'application/json', 'Content-Length': 4096, Cookie: cookie } });
    req.on('error', () => {}); req.write('{"power":'); setTimeout(() => { req.destroy(); resolve(); }, 30);
  });
  await sleep(100); assert.equal((await request('/api/health')).status, 200); assert.equal(JSON.stringify(app.store.data), baseline);
});

test('limite de streams rejeita excesso e libera a vaga quando o cliente desconecta', async t => {
  const { origin, request, cookie } = await fixture(t); const streams = [];
  t.after(() => { for (const req of streams) req.destroy(); });
  async function stream() {
    const req = http.get(origin + '/api/events', { agent: false, headers: { Cookie: cookie } }); streams.push(req); req.on('error', () => {});
    return new Promise((resolve, reject) => { req.once('response', res => { res.on('error', () => {}); res.resume(); resolve(res.statusCode); }); req.once('error', reject); });
  }
  for (let i = 0; i < 16; i++) assert.equal(await stream(), 200);
  assert.equal(await stream(), 503); streams[0].destroy(); await sleep(100);
  assert.equal(await stream(), 200); assert.equal((await request('/api/health')).status, 200);
});

test('LAN permite iluminação mas recusa todas as rotas administrativas mesmo com cookie do PC', async t => {
  const interfaces = network.adapters(); if (!interfaces.length) return t.skip('Sem adaptador LAN real neste ambiente.');
  const { app, localPort, request, cookie } = await fixture(t);
  const host = `http://${interfaces[0].address}:${localPort}`, baseline = JSON.stringify(app.store.data);
  const routes = [['/api/network', 'GET', undefined], ['/api/session/local', 'POST', {}], ['/api/profiles', 'POST', { name: 'Ataque' }], ['/api/link', 'POST', {}], ['/api/alexa', 'POST', { enabled: true }], ['/api/alexa/discover', 'POST', {}], ['/api/alexa/approve', 'POST', { ip: interfaces[0].address }], ['/api/alexa/revoke', 'POST', { ip: '192.168.1.1' }]];
  for (const [route, method, body] of routes) assert.equal((await request(route, { method, body, host, cookie })).status, 403, route);
  assert.equal(JSON.stringify(app.store.data), baseline);
  assert.equal((await request('/api/control', { method: 'POST', body: { color: '#445566' }, host })).status, 200);
  assert.equal(app.store.data.master.color, '#445566');
});

test('comando individual inválido preserva modo nativo em memória e no arquivo', async t => {
  const hardware = new EventEmitter(), id = 'a'.repeat(24);
  Object.assign(hardware, { snapshot: () => ({ devices: [{ id, effects: ['static'], modes: [{ id: 5 }] }] }), changed() {}, stop() {} });
  const { app, request, cookie } = await fixture(t, { hardware });
  app.store.device(id, { nativeMode: 5, color: '#123456' });
  const baseline = JSON.stringify(app.store.data), persisted = fs.readFileSync(app.store.file, 'utf8');
  for (const body of [{ effect: 'static', brightness: -1 }, { effect: 'static', unknown: true }]) {
    assert.equal((await request('/api/devices/' + id, { method: 'POST', body, cookie })).status, 400);
    assert.equal(JSON.stringify(app.store.data), baseline); assert.equal(fs.readFileSync(app.store.file, 'utf8'), persisted);
  }
  assert.equal((await request('/api/devices/' + id, { method: 'POST', body: { effect: 'static' }, cookie })).status, 200);
  assert.equal(app.store.data.devices[id].nativeMode, undefined);
});

test('limitação HTTP real recusa inundação e volta a atender depois da janela', { timeout: 75000 }, async t => {
  const { request } = await fixture(t); // Session creation consumed request 1.
  for (let i = 0; i < 239; i++) assert.equal((await request('/api/health')).status, 200);
  assert.equal((await request('/api/health')).status, 429);
  await sleep(60500); assert.equal((await request('/api/health')).status, 200);
});
