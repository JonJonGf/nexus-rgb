'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/http-app');
const network = require('../server/network');

test('API edita perfil do mapa preservando estado, exclusões e o efeito original', async t => {
  const { app, request, cookie } = await fixture(t);
  const effect = app.studio.snapshot(true).effects[0];
  app.store.master({ effect: 'strobe', palette: ['#ff0000', '#0000ff'] });
  app.studio.configure({ enabled: true });
  const excluded = 'e'.repeat(24);
  app.store.device(excluded, { effect: 'static', color: '#123456', power: false });
  app.store.power(false);
  const created = await request('/api/studio/profiles', { method: 'POST', cookie, body: { name: 'Mapa salvo', activeId: effect.id } });
  assert.equal(created.status, 200);
  const profile = created.json().profiles[0], route = '/api/profiles/' + profile.id;
  const before = created.json();
  const edited = await request(route, { method: 'PUT', cookie, body: { name: 'Mapa editado', studio: { activeId: effect.id, recipe: { ...effect, name: 'Mapa editado', palette: ['#112233', '#abcdef'], angle: 90, speed: 17 } }, settings: { brightness: 37 } } });
  assert.equal(edited.status, 200);
  const saved = edited.json().profiles[0];
  assert.equal(saved.spatial, true); assert.deepEqual(saved.mapEffect.palette, ['#112233', '#abcdef']);
  assert.notEqual(saved.studio.activeId, effect.id); assert.equal(saved.settings.brightness, 37);
  assert.deepEqual(edited.json().master, before.master); assert.deepEqual(edited.json().studio, before.studio);
  assert.deepEqual(app.studio.effects.get(effect.id).palette, effect.palette);
  assert.equal((await request(route, { method: 'PUT', cookie, body: { name: 'Cliente antigo', settings: { effect: 'sequence', palette: ['#ff0000'] } } })).status, 409);
  assert.equal((await request(route, { method: 'POST', cookie, body: {} })).status, 200);
  assert.equal(app.studio.config.activeId, saved.studio.activeId); assert.equal(app.store.data.master.brightness, 37);
  assert.deepEqual(app.studio.config.excluded, [excluded]); assert.equal(app.store.data.devices[excluded].power, false); assert.equal(app.store.data.master.power, false);
});

test('código de perfil é restrito ao administrador e código recusado preserva o perfil', async t => {
  const { app, request, cookie, localPort } = await fixture(t);
  const effect = app.studio.snapshot(true).effects[0];
  const created = await request('/api/studio/profiles', { method: 'POST', cookie, body: { name: 'Seguro', activeId: effect.id } });
  const profile = created.json().profiles[0], route = '/api/profiles/' + profile.id;
  assert.equal((await request(route + '/effect')).status, 401);
  const adapter = network.adapters()[0];
  if (adapter) assert.equal((await request(route + '/effect', { cookie, host: `http://${adapter.address}:${localPort}` })).status, 403);
  const source = await request(route + '/effect', { cookie });
  assert.equal(source.status, 200); assert.equal(JSON.parse(source.json().source).pattern, 'wave');
  for (const body of [
    { name: 'Não salvar', studio: { activeId: effect.id, source: '{}' } },
    { name: 'Não salvar', studio: { activeId: effect.id, values: { missing: 7 } } },
    { name: 'Não salvar', studio: { activeId: effect.id, recipe: { ...effect, angle: 999 } } },
    { name: 'Não salvar', studio: { activeId: effect.id }, settings: { brightness: 101 } }
  ]) assert.equal((await request(route, { method: 'PUT', cookie, body })).status, 400);
  assert.deepEqual((await request('/api/state', { cookie })).json().profiles, created.json().profiles);
  const converted = await request(route, { method: 'PUT', cookie, body: { name: 'Sequência explícita', replaceSpatial: true, settings: { palette: ['#00ff00'], effect: 'static' } } });
  assert.equal(converted.status, 200); assert.equal(converted.json().profiles[0].spatial, false);
});

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
