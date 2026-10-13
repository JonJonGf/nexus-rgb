'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const { huePatch } = require('../server/alexa');
test('Hue preserva desligar/brilho zero e converte cores válidas', () => {
  assert.deepEqual(huePatch({ on: false, bri: 0 }), { power: false, brightness: 0 }); assert.equal(huePatch({ hue: 0, sat: 254 }).color, '#ff0000'); assert.match(huePatch({ xy: [0.3, 0.3] }).color, /^#[a-f0-9]{6}$/);
});
test('Hue recusa valores inválidos sem produzir NaN ou estados ambíguos', () => { for (const body of [{ on: 'true' }, { bri: 256 }, { hue: -1 }, { sat: 300 }, { xy: [0.4, 0] }, { xy: [0.8, 0.8] }, { xy: [NaN, 0.3] }]) assert.throws(() => huePatch(body)); });

test('ponte Hue exige aprovação, aceita comandos autorizados e exclui o próprio PC', async t => {
  const { Alexa } = require('../server/alexa'); const { Store } = require('../server/store');
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path'); const { Readable } = require('node:stream');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-hue-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new Store(directory); let writes = 0, broadcasts = 0;
  const alexa = new Alexa(store, { connected: true, changed() { writes++; } }, directory, () => { broadcasts++; }, { getInterfaces: () => [{ address: '192.168.20.5', netmask: '255.255.255.0' }] });
  const request = async (ip, route, method = 'GET', body) => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    Object.assign(req, { socket: { remoteAddress: ip, localAddress: '192.168.20.5' }, headers: { host: '192.168.20.5' }, url: route, method });
    const res = { writeHead(status) { this.status = status; }, end(value) { this.body = value; } };
    await alexa.request(req, res); return res;
  };
  alexa.openDiscovery();
  assert.equal((await request('192.168.20.5', '/api')).status, 403); assert.deepEqual(alexa.snapshot().candidates, []);
  assert.equal((await request('192.168.20.8', '/api/nexus/lights')).status, 403); assert.deepEqual(alexa.snapshot().candidates, ['192.168.20.8']);
  assert.throws(() => alexa.approve('192.168.20.5')); alexa.approve('192.168.20.8');
  assert.equal((await request('192.168.20.8', '/api', 'POST', {})).status, 200);
  assert.equal(Object.keys(JSON.parse((await request('192.168.20.8', '/api/nexus/lights')).body)).length, 6);
  assert.equal((await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: true, bri: 127, hue: 0, sat: 254 })).status, 200);
  assert.equal(store.data.master.color, '#ff0000'); assert.equal(store.data.master.brightness, 50); assert.equal(writes, 1); assert.equal(broadcasts, 1);
  assert.equal((await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: false })).status, 200); assert.equal(store.data.master.power, false);
  assert.equal((await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: 'true' })).status, 400); assert.equal(store.data.master.power, false);
});
