'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const http = require('node:http');
const { createApp } = require('../server'); const network = require('../server/network');
test('API bloqueia ataques de origem/Host, limita payload e mantém controles após reinício', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-api-'));
  const app = await createApp({ directory, localPort: 0, disableHardware: true, disableAlexa: true });
  const { localPort } = await app.start(); const origin = `http://127.0.0.1:${localPort}`;
  t.after(async () => { await app.stop(); fs.rmSync(directory, { recursive: true, force: true }); });
  const request = (route, body, extras = {}, cookie = '') => new Promise((resolve, reject) => {
    const encoded = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: { ...(encoded !== undefined ? { Origin: origin, 'X-Nexus-Client': 'web', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded) } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extras } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    }); req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Test HTTP timeout'))); req.end(encoded);
  });
  assert.equal((await request('/api/state')).status, 401);
  assert.equal((await request('/api/session/local', {}, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request('/api/health', undefined, { Host: 'attacker.example' })).status, 403);
  assert.equal((await request('/api/health', undefined, { 'X-Forwarded-For': '127.0.0.1' })).status, 403);
  const session = await request('/api/session/local', {}); assert.equal(session.status, 200); const cookie = session.headers.get('set-cookie').split(';')[0]; assert.match(session.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal((await request('/api/control', { power: false }, {}, cookie)).status, 200);
  assert.equal((await request('/api/control', { power: 'true' }, {}, cookie)).status, 400);
  assert.equal((await request('/api/control', '{bad', {}, cookie)).status, 400);
  assert.equal((await request('/api/control', JSON.stringify({ color: 'x'.repeat(9000) }), {}, cookie)).status, 413);
  assert.equal((await request('/api/control', {}, { 'Content-Type': 'text/plain' }, cookie)).status, 415);
  const state = await (await request('/api/state', undefined, {}, cookie)).json(); assert.equal(state.master.power, false); assert.deepEqual(state.hardware.devices, []);
  const { Store } = require('../server/store'); assert.equal(new Store(directory).data.master.power, false);
  const maliciousName = '<img src=x onerror=alert(1)>';
  assert.equal((await request('/api/profiles', { name: maliciousName }, {}, cookie)).status, 200);
  const home = await request('/'); assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.equal(home.headers.get('access-control-allow-origin'), null);
  assert.equal((await request('/api/conflicts', undefined, {}, cookie)).status, 200);
  assert.equal((await request('/api/restart', {}, {}, cookie)).status, 405);
  assert.equal((await request('/api/shutdown', {}, {}, cookie)).status, 405);
  assert.equal((await request('/server/index.js')).status, 404);
  assert.equal((await request('/data/settings.json')).status, 404);
  const interfaces = network.adapters();
  if (interfaces.length) {
    // Actual local TCP request from the private IP, without authentication.
    const lan = `http://${interfaces[0].address}:${localPort}`;
    const lanState = await fetch(lan + '/api/state'); assert.equal(lanState.status, 200);
    assert.equal((await fetch(lan + '/api/control', { method: 'POST', headers: { Origin: lan, 'X-Nexus-Client': 'web', 'Content-Type': 'application/json' }, body: JSON.stringify({ color: '#ff0055' }) })).status, 200);
    assert.equal((await fetch(lan + '/api/network')).status, 403);
    assert.equal((await fetch(lan + '/api/backups')).status, 403);
    assert.equal((await fetch(lan + '/api/resources')).status, 403);
    assert.equal((await fetch(lan + '/api/diagnostics')).status, 403);
    assert.equal((await fetch(lan + '/api/conflicts')).status, 403);
    for(const route of ['/api/backups/review','/api/backups/restore','/api/devices/'+'a'.repeat(24)+'/identify'])assert.equal((await fetch(lan+route,{method:'POST',headers:{Origin:lan,'X-Nexus-Client':'web','Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(lan + '/api/session/local', { method: 'POST', headers: { Origin: lan, 'X-Nexus-Client': 'web' } })).status, 403);
    const firstLink = await (await request('/api/link', {}, {}, cookie)).json(); const secondLink = await (await request('/api/link', {}, {}, cookie)).json();
    assert.equal(firstLink.link, secondLink.link); assert.equal(new URL(firstLink.link).hash, ''); assert.match(firstLink.qr, /^data:image\/png;base64,/);
  }
});
