'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const schema = require('../server/studio-schema'), spatial = require('../public/spatial'), { StudioRenderer } = require('../server/studio-render');
const { fixture } = require('./helpers/http-app'), network = require('../server/network');
const { setTimeout: sleep } = require('node:timers/promises');
const source = (code, meta = '') => '<head><title>Teste próprio</title><meta publisher="Nexus tests">' + meta + '</head><body><canvas id="exCanvas" width="320" height="200"></canvas></body><script>' + code + '</script>';
const paint = 'var c=document.getElementById("exCanvas"),ctx=c.getContext("2d");function update(){ctx.fillStyle=ink;ctx.fillRect(0,0,320,200);requestAnimationFrame(update)}requestAnimationFrame(update);';
const html = source(paint, '<meta property="ink" label="Cor" type="color" default="#1234ab">');
test('importador limita metadados, rejeita scripts externos e valida fórmulas', () => {
  const parsed = schema.parseHTML(html); assert.equal(parsed.controls[0].default, '#1234ab');
  assert.deepEqual({ ...schema.parameters(parsed, { ink: '#fe7621' }) }, { ink: '#fe7621' });
  assert.throws(() => schema.parameters(parsed, { ink: 'url(https://example.com)' }));
  assert.throws(() => schema.parseHTML(html.replace('property="ink"', 'property="constructor"')));
  assert.throws(() => schema.parseHTML(html.replace('<script>', '<script src="https://example.com/code.js">')));
  assert.throws(() => schema.parseHTML(source('engine.audio.freq'))); assert.throws(() => schema.parseHTML('x'.repeat(131073)));
  assert.throws(() => schema.recipe({ format: 'nexus-effect/1', name: 'Inválido', pattern: 'eval', palette: ['#fff'] }));
});
test('layout impede sobreposição, mantém a sequência e inverte a ordem física', () => {
  const entry = { key: 'ram', deviceId: 'a'.repeat(24), name: 'RAM', start: 0, count: 4, x: 0.5, y: 0.5, width: 0.5, height: 0.1, rotation: 0, shape: 'strip', columns: 4, reverse: false };
  schema.layout([entry]); const points = spatial.points(entry); assert.ok(points[0].x < points[3].x);
  const reversed = spatial.points({ ...entry, reverse: true }); assert.equal(points[0].x, reversed[3].x); assert.equal(reversed[0].index, 0);
  assert.throws(() => schema.layout([entry, { ...entry, key: 'duplicate' }]));
  assert.throws(() => schema.layout([{ ...entry, count: 1000000 }])); assert.throws(() => schema.layout([{ ...entry, rotation: Infinity }]));
  const split = schema.layout([{ ...entry, count: 2 }, { ...entry, key: 'second', start: 2, count: 2 }]); assert.equal(split.length, 2);
  const many = spatial.defaults(Array.from({ length: 128 }, (_, i) => ({ id: i.toString(16).padStart(24, '0'), name: 'Controller ' + i, ledCount: 8, type: 1 })));
  assert.equal(schema.layout(many).length, 128); assert.ok(many.every(i => i.y - i.height / 2 >= 0 && i.y + i.height / 2 <= 1));
});
test('Canvas importado roda sem APIs do Node/rede e produz amostras de cor', async () => {
  const renderer = new StudioRenderer();
  const check = 'if([typeof process,typeof require,typeof fetch,typeof WebSocket,typeof XMLHttpRequest].some(v=>v!=="undefined"))throw Error("Host API leaked");';
  try {
    await renderer.load(schema.parseHTML(source(check + paint, '<meta property="ink" type="color" default="#1234ab">')));
    const pixels = renderer.frame(50); assert.deepEqual(renderer.sample([{ x: 30, y: 70 }], pixels), [[18, 52, 171]]);
    assert.equal(renderer.canvas.toBuffer('image/png').subarray(1, 4).toString(), 'PNG');
  } finally { renderer.close(); }
});
test('motor interrompe loop infinito e impede operações fora do Canvas permitido', async () => {
  for (const code of ['requestAnimationFrame(()=>{while(true){}});', '_nexusDraw("loadImage",JSON.stringify(["C:/Windows/win.ini"]));', 'document.getElementById("exCanvas").width=100000000;']) {
    const renderer = new StudioRenderer(); const started = Date.now();
    try { await assert.rejects(async () => { await renderer.load(schema.parseHTML(source(code))); renderer.frame(50); }); assert.ok(Date.now() - started < 4000); }
    finally { renderer.close(); }
  }
});
test('API persiste FPS, importa somente pelo PC e não aplica um efeito ao importar', async t => {
  const { app, request, cookie, directory, localPort } = await fixture(t);
  const before = structuredClone(app.store.data.master);
  assert.equal((await request('/api/settings', { method: 'POST', cookie, body: { fps: 60 } })).status, 200);
  assert.equal(app.store.data.performance.fps, 60);
  for (const fps of [0, 61, '30', 2.5]) assert.equal((await request('/api/settings', { method: 'POST', cookie, body: { fps } })).status, 400);
  assert.equal((await request('/api/settings', { method: 'POST', cookie, body: { fps: 20 } })).status, 200);
  const imported = await request('/api/studio/import', { method: 'POST', cookie, body: { source: html } }); assert.equal(imported.status, 200, imported.text);
  assert.deepEqual(app.store.data.master, before); assert.equal(app.studio.config.enabled, false);
  const id = imported.json().id; assert.match(id, /^[a-f0-9]{24}$/);
  const active = await request('/api/studio/play', { method: 'POST', cookie, body: { activeId: id, enabled: true, values: { ink: '#fe7621' } } }); assert.equal(active.status, 200);
  assert.equal(app.studio.config.activeId, id); assert.equal(app.studio.config.values.ink, '#fe7621');
  const saved = JSON.parse(fs.readFileSync(path.join(directory, 'settings.json'))); assert.equal(saved.performance.fps, 20); assert.equal(saved.studio.activeId, id);
  const adapter = network.adapters()[0];
  if (adapter) {
    const host = 'http://' + adapter.address + ':' + localPort;
    assert.equal((await request('/api/settings', { host, method: 'POST', body: { fps: 60 } })).status, 403);
    assert.equal((await request('/api/studio/import', { host, method: 'POST', body: { source: html } })).status, 403);
    assert.equal((await request('/api/studio', { host, method: 'POST', body: { layout: [] } })).status, 403);
    assert.equal((await request('/api/studio/play', { host, method: 'POST', body: { enabled: false } })).status, 200);
  }
  assert.equal((await request('/api/studio/effects/' + id, { method: 'DELETE', cookie, body: {} })).status, 200);
  assert.equal(app.studio.effects.has(id), false);
});
test('API liga só o componente escolhido depois de desligar o geral', async t => {
  let store;
  const ids = ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)];
  const hardware = { connected: true, on() {}, stop() {}, changed() {}, snapshot() { return { connected: true, devices: ids.map(id => ({ id, ledCount: 8, effects: ['static', 'wave'], modes: [], settings: { ...store.data.master, ...store.data.devices[id] } })) }; } };
  const f = await fixture(t, { hardware }); store = f.app.store;
  await f.request('/api/control', { method: 'POST', cookie: f.cookie, body: { power: false } });
  const result = await f.request('/api/devices/' + ids[0], { method: 'POST', cookie: f.cookie, body: { power: true } });
  assert.equal(result.status, 200); assert.equal(result.json().master.power, true);
  assert.equal(result.json().hardware.devices[0].settings.power, true);
  for (const device of result.json().hardware.devices.slice(1)) assert.equal(device.settings.power, false);
});

test('falha do efeito pausa o processo e voltar a um efeito válido recupera o mapa', async t => {
  const f = await fixture(t), studio = f.app.studio;
  const id = (await f.request('/api/studio/import', { method: 'POST', cookie: f.cookie, body: { source: source('var n=0;function run(){if(++n>1)while(true){}requestAnimationFrame(run)}requestAnimationFrame(run)') } })).json().id;
  assert.ok(id); // The first frame passes import validation; a later frame is hostile.
  const client = { res: { destroyed: false, writableLength: 0, write() {}, end() {} }, authorized: () => true };
  studio.clients.add(client); studio.configure({ activeId: id });
  for (let i = 0; i < 100 && !studio.error; i++) await sleep(30);
  assert.match(studio.error, /interrupted|orçamento|tempo/i); assert.equal(studio.worker, null);
  const fallback = [...studio.effects.values()].find(e => e.builtin).id; studio.configure({ activeId: fallback });
  for (let i = 0; i < 100 && !studio.rendered; i++) await sleep(30);
  assert.equal(studio.error, null); assert.equal(studio.rendered, true);
  studio.clients.delete(client); studio.configure({ enabled: false }); studio.pump(); assert.equal(studio.worker, null);
});

test('encerrar o aplicativo cancela a validação em andamento sem salvar importação', async t => {
  const f = await fixture(t), studio = f.app.studio;
  const pending = assert.rejects(studio.import(source('while(true){}')), /cancelada|encerrando/);
  assert.equal(studio.probes.size, 1); studio.stop(); await pending;
  assert.equal(studio.probes.size, 0); assert.equal(studio.effects.size, 3);
});
