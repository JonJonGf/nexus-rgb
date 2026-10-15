'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/http-app');
const network = require('../server/network');

test('API cria, edita e aplica perfis com sequência validada e preserva controles locais', async t => {
  const { app, request, cookie, localPort } = await fixture(t);
  const initial = structuredClone(app.store.data.master);
  const settings = { palette: ['#ff0055', '#0094ff'], effect: 'strobe', brightness: 27, speed: 15 };
  const created = await request('/api/profiles', { method: 'POST', cookie, body: { name: 'Minha sequência', settings } });
  assert.equal(created.status, 200);
  const profile = created.json().profiles[0]; assert.equal(profile.settings.effect, 'strobe'); assert.deepEqual(app.store.data.master, initial);
  const route = `/api/profiles/${profile.id}`;
  const invalid = await request(route, { method: 'PUT', cookie, body: { name: 'Quebrado', settings: { ...settings, palette: Array(9).fill('#000000') } } });
  assert.equal(invalid.status, 400); assert.equal(app.store.data.profiles[0].name, 'Minha sequência');
  const edited = await request(route, { method: 'PUT', cookie, body: { name: 'Cometa azul', settings: { ...settings, effect: 'comet', palette: ['#0094ff', '#ff0055'] } } });
  assert.equal(edited.status, 200); assert.equal(edited.json().profiles.length, 1); assert.deepEqual(app.store.data.master, initial);
  const adapter = network.adapters()[0];
  if (adapter) {
    const host = `http://${adapter.address}:${localPort}`;
    const rejected = await request(route, { host, method: 'PUT', body: { name: 'Remoto', settings } }); assert.equal(rejected.status, 403);
  }
  const applied = await request(route, { method: 'POST', cookie, body: {} });
  assert.equal(applied.status, 200); assert.equal(applied.json().master.effect, 'comet'); assert.deepEqual(applied.json().master.palette, ['#0094ff', '#ff0055']);
});
