'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const { huePatch } = require('../server/alexa');
test('Hue aceita somente ligar/desligar e não transforma cor, brilho ou efeito em ajustes', () => {
  assert.deepEqual(huePatch({ on: false, bri: 0, hue: 0, sat: 254, effect: 'colorloop' }), { power: false });
  assert.deepEqual(huePatch({ on: true }), { power: true });
  assert.deepEqual(huePatch({ bri: 127, xy: [0.3, 0.3] }), {});
});
test('Hue recusa estados e comandos de energia ambíguos', () => { for (const body of [{ on: 'true' }, { on: 1 }, { on: null }, {}, [], null]) assert.throws(() => huePatch(body)); });

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
    const res = Object.assign(new (require('node:events').EventEmitter)(), { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(value) { this.body = value; this.emit('finish'); } });
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
  assert.equal(Object.keys(JSON.parse((await request('192.168.20.8', '/api/nexus/lights')).body)).length, 1);
  const root = JSON.parse((await request('192.168.20.8', '/api/nexus')).body);
  const config = JSON.parse((await request('192.168.20.8', '/api/nexus/config')).body);
  assert.deepEqual(root.config, config);
  assert.equal(root.lights[1].name, 'Iluminação Nexus');
  assert.equal(root.lights[1].type, 'Dimmable light');
  assert.equal(root.lights[1].modelid, 'HASS123');
  assert.deepEqual(Object.keys(root.lights[1].state).sort(), ['alert', 'bri', 'mode', 'on', 'reachable']);
  assert.equal(root.lights[1].state.bri, 254);
  assert.ok(Object.values(root.lights).every(light => !/\bPC\b|computador/i.test(light.name)));
  assert.ok(Object.values(root.lights).every(light => /^(?:[a-f0-9]{2}:){7}[a-f0-9]{2}-[a-f0-9]{2}$/.test(light.uniqueid)));
  store.master({ color: '#ff0055', brightness: 37, speed: 63, effect: 'wave', palette: ['#ff0055', '#6600ff'] });
  store.device('ram', { power: true, color: '#00ff00', nativeMode: 7 });
  store.device('argb', { power: false, brightness: 12, effect: 'breathe' });
  store.profile('Meu setup');
  const before = structuredClone(store.data);
  const off = await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: false, bri: 0, transitiontime: 4, effect: 'colorloop', hue: 0, sat: 254 });
  assert.equal(off.status, 200); assert.equal(store.data.master.power, false);
  assert.deepEqual(JSON.parse(off.body), [{ success: { '/lights/1/state/on': false } }]);
  assert.equal(off.headers['Content-Length'], Buffer.byteLength(off.body));
  assert.equal(off.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(writes, 1); assert.equal(broadcasts, 1);
  const reportedOff = JSON.parse((await request('192.168.20.8', '/api/nexus/lights/1')).body);
  assert.equal(reportedOff.state.on, false); assert.equal(reportedOff.state.bri, 254);
  assert.equal(store.data.master.brightness, 37);
  assert.equal(alexa.snapshot().diagnostics.lastCommand.name, 'Iluminação Nexus');
  assert.equal(alexa.snapshot().diagnostics.lastCommand.power, false);
  assert.deepEqual(alexa.snapshot().diagnostics.lastCommand.fields, ['on', 'bri', 'hue', 'sat', 'effect', 'transitiontime']);
  assert.equal(alexa.snapshot().diagnostics.lastCommand.otherFieldCount, 0);
  assert.equal((await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: false })).status, 200);
  assert.equal(writes, 1); assert.equal(broadcasts, 1);
  assert.equal((await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: 'true' })).status, 400); assert.equal(store.data.master.power, false);
  assert.equal(alexa.snapshot().diagnostics.lastCommand.power, false);
  const unsupported = await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { effect: 'colorloop', bri: 254 });
  assert.ok(JSON.parse(unsupported.body).every(item => item.error.type === 6)); assert.equal(writes, 1);
  for (let id = 2; id <= 6; id++) {
    assert.equal((await request('192.168.20.8', `/api/nexus/lights/${id}`)).status, 404);
    assert.equal((await request('192.168.20.8', `/api/nexus/lights/${id}/state`, 'PUT', { on: true })).status, 404);
  }
  const on = await request('192.168.20.8', '/api/nexus/lights/1/state', 'PUT', { on: true, bri: 254, transitiontime: 0, xy: [0.3, 0.3], privateUsername: 'do-not-log-this' });
  assert.equal(on.status, 200);
  assert.deepEqual(JSON.parse(on.body), [{ success: { '/lights/1/state/on': true } }]);
  assert.equal(alexa.snapshot().diagnostics.lastCommand.otherFieldCount, 1);
  assert.ok(!JSON.stringify(alexa.snapshot().diagnostics).includes('do-not-log-this'));
  assert.ok(alexa.snapshot().diagnostics.recent.length <= 32);
  assert.equal(alexa.snapshot().diagnostics.recent.at(-1).method, 'PUT');
  assert.equal(alexa.snapshot().diagnostics.recent.at(-1).power, true);
  assert.equal(alexa.snapshot().diagnostics.recent.at(-1).finished, true);
  assert.deepEqual(store.data, before); assert.deepEqual(new Store(directory).data, before);
  assert.equal(writes, 2); assert.equal(broadcasts, 2);
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

test('descoberta acompanha DHCP e troca de IP sem reiniciar a ponte ou ampliar aprovação', t => {
  const { Alexa } = require('../server/alexa');
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-hue-dhcp-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let interfaces = [], rejectJoin = false;
  const calls = [];
  const alexa = new Alexa({ data: { alexaEnabled: true } }, {}, directory, () => {}, { getInterfaces: () => interfaces });
  alexa.socket = {
    addMembership(group, address) { calls.push(['join', group, address]); if (rejectJoin) throw new Error('Interface not ready'); },
    dropMembership(group, address) { calls.push(['leave', group, address]); },
    close() {}
  };
  alexa.udpReady = true;
  assert.equal(alexa.syncInterfaces(), false); assert.deepEqual(calls, []);
  interfaces = [{ address: '192.168.20.5', netmask: '255.255.255.0' }];
  assert.equal(alexa.syncInterfaces(), true);
  assert.deepEqual(calls, [['join', '239.255.255.250', '192.168.20.5']]);
  assert.equal(alexa.syncInterfaces(), false); assert.equal(calls.length, 1);
  interfaces = [{ address: '192.168.20.6', netmask: '255.255.255.0' }];
  rejectJoin = true; assert.equal(alexa.syncInterfaces(), true);
  assert.deepEqual([...alexa.multicastInterfaces], []);
  rejectJoin = false; assert.equal(alexa.syncInterfaces(), true);
  assert.deepEqual([...alexa.multicastInterfaces], ['192.168.20.6']);
  assert.deepEqual(calls.slice(1), [
    ['leave', '239.255.255.250', '192.168.20.5'],
    ['join', '239.255.255.250', '192.168.20.6'],
    ['join', '239.255.255.250', '192.168.20.6']
  ]);
  assert.deepEqual(alexa.data.peers, []); assert.deepEqual(alexa.snapshot().candidates, []);
  interfaces = []; assert.equal(alexa.syncInterfaces(), true);
  assert.deepEqual(calls.at(-1), ['leave', '239.255.255.250', '192.168.20.6']);
  alexa.stop(); assert.equal(alexa.multicastInterfaces.size, 0);
});
