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
  const publicConfig = await request('192.168.20.8', '/api/config'); assert.equal(publicConfig.status, 200);
  assert.equal(JSON.parse(publicConfig.body).modelid, 'BSB001'); assert.equal(JSON.parse(publicConfig.body).lights, undefined);
  assert.equal(writes, 0);
  alexa.openDiscovery();
  assert.equal((await request('192.168.20.5', '/api')).status, 403); assert.deepEqual(alexa.snapshot().candidates, []);
  assert.equal((await request('192.168.20.8', '/api/nexus/lights')).status, 403); assert.deepEqual(alexa.snapshot().candidates, ['192.168.20.8']);
  assert.throws(() => alexa.approve('192.168.20.5')); alexa.approve('192.168.20.8');
  assert.equal((await request('192.168.20.8', '/api', 'POST', {})).status, 200);
  assert.equal(Object.keys(JSON.parse((await request('192.168.20.8', '/api/nexus/lights')).body)).length, 6);
  const root = JSON.parse((await request('192.168.20.8', '/api/nexus')).body);
  const config = JSON.parse((await request('192.168.20.8', '/api/nexus/config')).body);
  assert.deepEqual(root.config, config);
  assert.equal(root.lights[1].name, 'Iluminação Nexus');
  assert.ok(Object.values(root.lights).every(light => !/\bPC\b|computador/i.test(light.name)));
  assert.ok(Object.values(root.lights).every(light => /^(?:[a-f0-9]{2}:){7}[a-f0-9]{2}-[a-f0-9]{2}$/.test(light.uniqueid)));
  assert.equal((await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: true, bri: 127, hue: 0, sat: 254 })).status, 200);
  assert.equal(store.data.master.color, '#ff0000'); assert.equal(store.data.master.brightness, 50); assert.equal(writes, 1); assert.equal(broadcasts, 1);
  assert.equal(alexa.snapshot().diagnostics.lastCommand.name, 'Iluminação Nexus');
  assert.equal((await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: false })).status, 200); assert.equal(store.data.master.power, false);
  assert.equal(alexa.snapshot().diagnostics.lastCommand.power, false);
  assert.equal((await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: 'true' })).status, 400); assert.equal(store.data.master.power, false);
  assert.equal(alexa.snapshot().diagnostics.lastCommand.power, false);
  assert.ok(!JSON.stringify(alexa.snapshot().diagnostics).includes('/api/nexus'));
});

test('identidade Hue é estável, única por instalação e consistente com o MAC', () => {
  const { bridgeIdentity } = require('../server/alexa');
  const first = bridgeIdentity('e7790cc1-d2a4-4c01-b16c-b743c5066530');
  assert.deepEqual(bridgeIdentity('e7790cc1-d2a4-4c01-b16c-b743c5066530'), first);
  assert.notEqual(bridgeIdentity('e7790cc1-d2a4-4c01-b16c-b743c5066531').bridgeId, first.bridgeId);
  const bytes = first.mac.replaceAll(':', '').toUpperCase();
  assert.equal(first.bridgeId, bytes.slice(0, 6) + 'FFFE' + bytes.slice(6));
});
test('SSDP responde ao tipo solicitado e ignora buscas de outros dispositivos', () => {
  const { searchTargets, Alexa } = require('../server/alexa');
  const search = target => `M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: ${target}\r\n\r\n`;
  const uuid = 'e7790cc1-d2a4-4c01-b16c-b743c5066530';
  assert.deepEqual(searchTargets(search('upnp:rootdevice'), uuid), ['upnp:rootdevice']);
  assert.equal(searchTargets(search('ssdp:all'), uuid).length, 3);
  assert.deepEqual(searchTargets(search('urn:schemas-upnp-org:device:MediaRenderer:1'), uuid), []);
  assert.deepEqual(searchTargets(search('ssdp:all').replace('M-SEARCH', 'GET'), uuid), []);
  const response = Alexa.prototype.ssdp.call({ data: { uuid }, identity: { bridgeId: '001788FFFE010203' }, port: 80 }, 'upnp:rootdevice', '192.168.20.5');
  assert.match(response, /^HTTP\/1\.1 200 OK/); assert.match(response, /\r\nST: upnp:rootdevice\r\n/);
  assert.match(response, /LOCATION: http:\/\/192.168.20.5:80\/description.xml/);
  assert.match(response, /USN: uuid:e7790cc1-d2a4-4c01-b16c-b743c5066530::upnp:rootdevice/);
});
