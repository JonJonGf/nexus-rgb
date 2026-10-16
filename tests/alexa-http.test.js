'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { Alexa } = require('../server/alexa'), { Store } = require('../server/store');

test('Hue entrega confirmações completas por HTTP e consultas seguintes preservam o estado', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-hue-http-'));
  const store = new Store(directory); store.master({ brightness: 23, color: '#abcdef', effect: 'wave' });
  const before = structuredClone(store.data); let writes = 0;
  const alexa = new Alexa(store, { connected: true, changed() { writes++; } }, directory, () => {}, { port: 0, getInterfaces: () => [{ address: '192.168.20.5', netmask: '255.255.255.0' }] });
  alexa.data.peers.push('192.168.20.8');
  // A real loopback HTTP transport carries a simulated, approved LAN peer.
  // The production handler still performs its normal host/origin/peer checks.
  const server = http.createServer((incoming, res) => {
    const req = { method: incoming.method, url: incoming.url, headers: incoming.headers, socket: { remoteAddress: '192.168.20.8', localAddress: '192.168.20.5' }, [Symbol.asyncIterator]: () => incoming[Symbol.asyncIterator]() };
    alexa.request(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); alexa.port = server.address().port;
  const request = (route, method = 'GET', body) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: alexa.port, path: route, method, agent: false, headers: { host: '192.168.20.5:' + alexa.port, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('error', reject); res.on('end', () => {
        try { const bytes = Buffer.concat(chunks); assert.equal(Number(res.headers['content-length']), bytes.length); assert.equal(res.headers.connection, 'close'); resolve({ status: res.statusCode, body: JSON.parse(bytes) }); } catch (error) { reject(error); }
      });
    });
    req.setTimeout(3000, () => req.destroy(Error('HTTP response timed out'))); req.on('error', reject);
    if (body !== undefined) { const text = typeof body === 'string' ? body : JSON.stringify(body), half = Math.floor(text.length / 2); req.write(text.slice(0, half)); req.end(text.slice(half)); } else req.end();
  });
  assert.equal((await request('/api/', 'POST', {})).status, 200);
  const off = await request('/api/nexus/lights/1/state/', 'PUT', { on: false, bri: 127 });
  assert.deepEqual(off.body, [{ success: { '/lights/1/state/on': false } }, { success: { '/lights/1/state/bri': 127 } }]);
  const snapshot = (await request('/api/nexus/lights/1')).body;
  assert.equal(snapshot.state.on, false); assert.equal(snapshot.state.bri, 127);
  const offBytes = fs.readFileSync(store.file);
  assert.deepEqual((await request('/api/nexus/lights/1/state', 'PUT', { bri: 254 })).body, [{ success: { '/lights/1/state/bri': 254 } }]);
  assert.equal((await request('/api/nexus/lights/1')).body.state.on, false);
  assert.deepEqual(fs.readFileSync(store.file), offBytes); assert.equal(writes, 1);
  for (const invalid of ['{"on":true,', { on: true, bri: 255 }, { on: true, bri: '127' }]) assert.equal((await request('/api/nexus/lights/1/state', 'PUT', invalid)).status, 400);
  assert.equal((await request('/api/nexus/lights/1/state', 'PUT', JSON.stringify({ ignored: 'x'.repeat(2100) }))).status, 413);
  assert.equal(store.data.master.power, false); assert.equal(writes, 1);
  assert.equal((await request('/api/nexus/lights/1/state', 'PUT', { on: true, bri: 0 })).status, 200);
  assert.equal((await request('/api/nexus/lights/1')).body.state.on, true);
  assert.equal((await request('/api/nexus/lights/1')).body.state.bri, 0);
  assert.deepEqual(store.data, before); assert.deepEqual(new Store(directory).data, before); assert.equal(writes, 2);
});
