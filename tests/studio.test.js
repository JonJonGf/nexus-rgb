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
    await renderer.load(schema.parseHTML(source('var ctx=document.getElementById("exCanvas").getContext("2d");ctx.fillStyle="#ff0000";ctx.fillRect(0,0,160,200);ctx.fillStyle="#00ff00";ctx.fillRect(160,0,160,200)')));
    const base = { deviceId: 'a'.repeat(24), start: 0, count: 36, x: 0.25, y: 0.5, width: 0.13, height: 0.21, rotation: 0, shape: 'fan', columns: 8, reverse: false };
    const splitPixels = renderer.frame(50);
    assert.ok(renderer.sample(spatial.points(base), splitPixels).every(color => color.join(',') === '255,0,0'));
    assert.ok(renderer.sample(spatial.points({ ...base, x: 0.75 }), splitPixels).every(color => color.join(',') === '0,255,0'));
    await renderer.load(schema.parseHTML(source('var ctx=document.getElementById("exCanvas").getContext("2d");ctx.fillStyle="#ff0000";ctx.fillRect(0,0,320,100);ctx.fillStyle="#00ff00";ctx.fillRect(0,100,320,100)')));
    const vertical = renderer.frame(50), colors = renderer.sample(spatial.points({ ...base, count: 12, y: 0.5 }), vertical);
    assert.deepEqual(colors[0], [255, 0, 0]); assert.deepEqual(colors[6], [0, 255, 0]);
    assert.deepEqual(colors[1], colors[11]); assert.deepEqual(colors[2], colors[10]); assert.deepEqual(colors[4], colors[8]);
  } finally { renderer.close(); }
});

test('parâmetros escolhidos prevalecem sobre defaults declarados no HTML e respeitam o círculo da ventoinha', async () => {
  const renderer = new StudioRenderer();
  const effect = schema.parseHTML(source('var vertical=false,ink="#ff0000";var ctx=document.getElementById("exCanvas").getContext("2d");function tick(){ctx.fillStyle="#000000";ctx.fillRect(0,0,320,200);ctx.fillStyle=ink;if(vertical)ctx.fillRect(0,0,320,100);else ctx.fillRect(0,0,160,200);requestAnimationFrame(tick)}requestAnimationFrame(tick)', '<meta property="vertical" type="boolean" default="0"><meta property="ink" type="color" default="#ff0000">'));
  const fan = {deviceId:'a'.repeat(24),start:0,count:36,x:0.5,y:0.5,width:0.3,height:0.48,rotation:0,shape:'fan',columns:8,reverse:false};
  try {
    await renderer.load(effect,{vertical:true,ink:'#00ff00'});
    const colors=renderer.sample(spatial.points(fan),renderer.frame(100));
    assert.deepEqual(colors[0],[0,255,0]); assert.deepEqual(colors[18],[0,0,0]);
    for(const n of [1,2,3,5,7,11,13,16]) assert.deepEqual(colors[n],colors[36-n]);
    await renderer.load(effect,{vertical:false,ink:'#0000ff'});
    const horizontal=renderer.sample(spatial.points(fan),renderer.frame(100));
    assert.deepEqual(horizontal[9],[0,0,0]); assert.deepEqual(horizontal[27],[0,0,255]);
  } finally {renderer.close();}
});

test('booleanos SignalRGB entram no script como 0/1, inclusive comparação estrita', async () => {
  const renderer = new StudioRenderer();
  const effect = schema.parseHTML(source('var ctx=document.getElementById("exCanvas").getContext("2d");function run(){ctx.fillStyle=enabled===1?"#ff0000":"#00ff00";ctx.fillRect(0,0,320,200);requestAnimationFrame(run)}requestAnimationFrame(run)', '<meta property="enabled" type="boolean" default="1">'));
  try {
    await renderer.load(effect); assert.deepEqual(renderer.sample([{ x: 20, y: 20 }], renderer.frame(50)), [[255, 0, 0]]);
    await renderer.load(effect, { enabled: false }); assert.deepEqual(renderer.sample([{ x: 20, y: 20 }], renderer.frame(50)), [[0, 255, 0]]);
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
  studio.clients.add(client); studio.configure({ activeId: id, enabled: true });
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

test('mover um componente troca a amostra estática sem reiniciar o motor e persiste a posição', async t => {
  const id = 'a'.repeat(24);
  const hardware = { connected: true, on() {}, changed() {}, stop() {}, snapshot() { return { connected: true, devices: [{ id, name: 'Teste', type: 1, ledCount: 2, effects: ['static', 'wave'], settings: { power: true } }] }; } };
  const f = await fixture(t, { hardware }), studio = f.app.studio;
  const effect = schema.recipe({ format: 'nexus-effect/1', name: 'Gradiente imóvel', pattern: 'gradient', palette: ['#ff0000', '#00ff00'], speed: 0, angle: 0, scale: 1 }); studio.effects.set(effect.id, effect);
  const layout = spatial.defaults(hardware.snapshot().devices).map(i => ({ ...i, x: 0.1, width: 0.01 }));
  studio.configure({ layout, activeId: effect.id, enabled: true });
  for (let i = 0; i < 100 && !studio.rendered; i++) await sleep(20);
  assert.ok(studio.rendered); const child = studio.worker, before = structuredClone(studio.colors.get(id)), revision = studio.revision;
  const moved = layout.map(i => ({ ...i, x: 0.9 }));
  assert.equal((await f.request('/api/studio', { method: 'POST', cookie: f.cookie, body: { layout: moved, enabled: true } })).status, 200);
  for (let i = 0; i < 100 && studio.revision === revision; i++) await sleep(20);
  assert.equal(studio.worker, child); assert.notDeepEqual(studio.colors.get(id), before);
  assert.equal(studio.frameLayout[0].x, 0.9); assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory, 'settings.json'))).studio.layout[0].x, 0.9);
  const after = studio.revision; await sleep(150); assert.equal(studio.revision, after);
});

test('biblioteca cria perfil espacial sem aplicar o efeito e valida referências antes de salvar', async t => {
  const f = await fixture(t), studio = f.app.studio, before = structuredClone(f.app.store.data.master), effect = [...studio.effects.values()][1];
  const save = body => f.request('/api/studio/profiles', { method: 'POST', cookie: f.cookie, body });
  assert.equal((await save({ name: 'Cometa guardado', activeId: effect.id })).status, 200);
  assert.deepEqual(f.app.store.data.master, before); assert.equal(studio.config.enabled, false); assert.equal(f.app.store.data.studio, undefined);
  const p = f.app.store.data.profiles.at(-1); assert.equal(p.studio.activeId, effect.id); assert.equal(p.studio.enabled, true);
  assert.equal((await save({ name: 'Falha', activeId: '0'.repeat(24) })).status, 400);
  assert.equal((await save({ name: 'Falha', activeId: effect.id, values: { invalid: 1 } })).status, 400);
  assert.equal((await save({ name: 'Falha', activeId: effect.id, values: null })).status, 400);
  assert.equal((await save({ name: 'Falha', activeId: '' })).status, 400);
  assert.equal(f.app.store.data.profiles.length, 1);
  assert.equal((await f.request('/api/profiles/' + p.id, { method: 'POST', cookie: f.cookie, body: {} })).status, 200);
  assert.equal(studio.config.enabled, true); assert.equal(studio.config.activeId, effect.id);
  const saved = JSON.parse(fs.readFileSync(path.join(f.directory, 'settings.json'))); assert.equal(saved.studio.activeId, effect.id);
});

test('prévia leva as cores enviadas por índice de LED e atualiza desligamento com imagem estática', async t => {
  const id = 'a'.repeat(24); let colors = [{ red: 0, green: 0, blue: 0 }, { red: 0, green: 0, blue: 0 }];
  const hardware = { connected: true, on() {}, changed() {}, stop() {}, async tick() { await sleep(50); colors = [{ red: 255, green: 0, blue: 0 }, { red: 0, green: 255, blue: 0 }]; }, snapshot() { return { connected: this.connected, devices: [{ id, name: 'Teste', type: 1, ledCount: 2, effects: ['static', 'wave'], settings: { power: true } }] }; }, outputFor() { return this.connected ? { colors, source: 'map', at: Date.now() } : null; } };
  const f = await fixture(t, { hardware }), studio = f.app.studio;
  const effect = schema.recipe({ format: 'nexus-effect/1', name: 'Gradiente teste', pattern: 'gradient', palette: ['#ff0000', '#00ff00'], speed: 0, angle: 0, scale: 1 }); studio.effects.set(effect.id, effect);
  const events = [], client = { res: { destroyed: false, writableLength: 0, end() {}, write(text) { if (text.startsWith('data: ')) events.push(JSON.parse(text.slice(6))); } }, authorized: () => true };
  studio.clients.add(client); studio.configure({ activeId: effect.id, enabled: true });
  for (let i = 0; i < 100 && !events.length; i++) await sleep(30);
  assert.ok(events.length); assert.ok(studio.worker); assert.deepEqual([...Buffer.from(events.at(-1).output[0].rgb, 'base64')], [255, 0, 0, 0, 255, 0]);
  assert.equal(events.at(-1).layout[0].deviceId, id); const image = events.at(-1).image, revision = studio.revision;
  f.app.store.power(false); colors = colors.map(() => ({ red: 0, green: 0, blue: 0 }));
  for (let i = 0; i < 50 && studio.worker; i++) await sleep(20);
  assert.equal(studio.worker, null);
  await sleep(250); assert.equal(events.at(-1).power, false); assert.equal(events.at(-1).image, image); assert.equal(studio.revision, revision);
  assert.deepEqual([...Buffer.from(events.at(-1).output[0].rgb, 'base64')], [0, 0, 0, 0, 0, 0]);
  hardware.connected = false; await sleep(250); assert.equal(events.at(-1).output[0].rgb, null);
});

test('prévia comum acompanha exatamente a saída do SDK no arco-íris, perfil, desligamento e modo nativo sem criar motor', async t => {
  const { EventEmitter } = require('node:events'), { Hardware } = require('../server/hardware');
  const { Store } = require('../server/store');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-output-'));
  const store = new Store(directory);
  class SDK extends EventEmitter {
    async connect() {} async getControllerCount() { return 1; }
    async getControllerData() { return { name: 'ARGB genérico', vendor: 'Teste', location: 'USB:test', type: 2, zones: [], colors: Array(37).fill({ red: 0, green: 0, blue: 0 }), modes: [{ id: 0, name: 'Rainbow', flagList: [] }, { id: 1, name: 'Direct', flagList: ['perLedColor'] }] }; }
    async updateMode() {} updateLeds(id, colors) { this.last = structuredClone(colors); } disconnect() {}
  }
  const sdk = new SDK(), hardware = new Hardware(store, { makeClient: () => sdk });
  const f = await fixture(t, { store, hardware });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  hardware.stopped = false; await hardware.connect();
  const studio = f.app.studio, events = [], client = { res: { destroyed: false, writableLength: 0, end() {}, write(text) { events.push(JSON.parse(text.slice(6))); } }, authorized: () => true };
  studio.spawn = () => { throw Error('Observar a saída comum não pode iniciar Canvas.'); }; studio.clients.add(client);
  store.master({ effect: 'rainbow', brightness: 100 }); await hardware.tick(); studio.pump();
  const encoded = () => Buffer.from(sdk.last.flatMap(c => [c.red, c.green, c.blue])).toString('base64');
  assert.equal(events.at(-1).image, null); assert.equal(events.at(-1).output[0].rgb, encoded());
  assert.deepEqual(events.at(-1).playback, { spatial: false, effect: 'rainbow', name: null });
  const before = encoded(); await sleep(170); await hardware.tick(); await sleep(120);
  assert.notEqual(encoded(), before); assert.equal(events.at(-1).output[0].rgb, encoded());
  const profile = store.profile('Sequência teste', { palette: ['#ff0000', '#00ff00'], effect: 'sequence', brightness: 31, speed: 25 });
  await f.request('/api/profiles/' + profile.id, { method: 'POST', cookie: f.cookie, body: {} });
  await hardware.tick(); await sleep(120); assert.equal(events.at(-1).playback.effect, 'sequence'); assert.equal(events.at(-1).output[0].rgb, encoded());
  store.power(false); hardware.changed(); await hardware.tick(); await sleep(120);
  assert.equal(events.at(-1).power, false); assert.ok([...Buffer.from(events.at(-1).output[0].rgb, 'base64')].every(v => v === 0));
  const id = hardware.snapshot().devices[0].id;
  store.power(true); store.device(id, { nativeMode: 0 }); hardware.changed(); await hardware.tick(); await sleep(120);
  assert.equal(events.at(-1).output[0].source, 'native'); assert.equal(events.at(-1).output[0].rgb, null);
  hardware.connected = false; await sleep(120); assert.equal(events.at(-1).connected, false); assert.equal(events.at(-1).output[0].rgb, null);
  assert.equal(studio.worker, null); assert.equal(studio.metrics.memoryMB, 0);
});

test('editar geometria preserva a fonte ativa, os ajustes individuais e um efeito pausado', async t => {
  const id = 'b'.repeat(24), hardware = { connected: true, on() {}, changed() {}, stop() {}, snapshot() { return { connected: true, devices: [{ id, name: 'Peça', type: 1, ledCount: 8, effects: ['static', 'wave'] }] }; } };
  const f = await fixture(t, { hardware }), studio = f.app.studio, layout = studio.layout();
  studio.configure({ layout, enabled: false });
  f.app.store.master({ effect: 'rainbow' });
  f.app.store.device(id, { color: '#00ff00', effect: 'static' });
  const before = structuredClone(f.app.store.data), moved = layout.map(i => ({ ...i, x: 0.6 }));
  studio.configure({ layout: moved });
  assert.equal(studio.config.enabled, false); assert.deepEqual(f.app.store.data.master, before.master); assert.deepEqual(f.app.store.data.devices, before.devices); assert.deepEqual(studio.config.excluded, [id]);
  studio.configure({ enabled: true }); studio.fail('Teste pausado'); studio.configure({ layout });
  assert.equal(studio.error, 'Teste pausado'); assert.equal(studio.worker, null);
  assert.equal(studio.previewPacket().image, null); assert.equal(studio.previewPacket().playback.spatial, false);
});
