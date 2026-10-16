'use strict';
const fs = require('node:fs'), path = require('node:path'), { fork } = require('node:child_process');
const { readJson, writeJson } = require('./store');
const schema = require('./studio-schema'), spatial = require('../public/spatial');
const builtin = [
  schema.recipe({ format: 'nexus-effect/1', name: 'Aurora espacial', pattern: 'wave', palette: ['#00ff99', '#00c8ff', '#8156ff'], speed: 30, angle: 0, scale: 1 }),
  schema.recipe({ format: 'nexus-effect/1', name: 'Cometa no setup', pattern: 'comet', palette: ['#00f0ff', '#7954ff'], speed: 35, angle: 0, scale: 1 }),
  schema.recipe({ format: 'nexus-effect/1', name: 'Anéis de luz', pattern: 'rings', palette: ['#ff0055', '#ff8000', '#7954ff'], speed: 20, angle: 0, scale: 1 })
];
class Studio {
  constructor(store, hardware, directory, changed) {
    this.store = store; this.hardware = hardware; this.directory = path.join(directory, 'effects'); this.changed = changed;
    this.effects = new Map(builtin.map(e => [e.id, { ...e, builtin: true }])); this.clients = new Set(); this.probes = new Set(); this.revision = 0; this.preview = null; this.colors = new Map(); this.worker = null; this.busy = false; this.error = null; this.signature = ''; this.metrics = { fps: 0, renderMs: 0, memoryMB: 0, dropped: 0 }; this.frames = 0; this.windowAt = Date.now();
    if (fs.existsSync(this.directory)) for (const file of fs.readdirSync(this.directory).slice(0, 128)) {
      if (!/^[a-f0-9]{24}\.json$/.test(file)) continue;
      try {
        const full = path.join(this.directory, file), stat = fs.lstatSync(full);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) continue;
        const saved = readJson(full), effect = this.parse(saved.original);
        if (effect.id + '.json' === file && !this.effects.get(effect.id)?.builtin) this.effects.set(effect.id, effect);
      } catch { /* An invalid local import does not block startup. */ }
    }
    if (store.data.studio) {
      if (typeof store.data.studio.enabled !== 'boolean') throw Error('Ativação do mapa inválida no arquivo de configuração.');
      schema.layout(store.data.studio.layout || []);
      if (!Array.isArray(store.data.studio.excluded || []) || (store.data.studio.excluded || []).some(id => !/^[a-f0-9]{24}$/.test(id))) throw Error('Configuração de componentes inválida.');
      const effect = this.effects.get(store.data.studio.activeId);
      if (effect) schema.parameters(effect, store.data.studio.values || {});
    }
    this.timer = setInterval(() => this.pump(), 8); this.timer.unref();
  }
  get config() { return this.store.data.studio || { enabled: false, activeId: builtin[0].id, values: {}, layout: [], excluded: [] }; }
  get fps() { return this.store.data.performance?.fps || 20; }
  devices() { return this.hardware.snapshot().devices.filter(d => d.ledCount > 0 && d.effects.includes('wave')); }
  layout() {
    const saved = this.config.layout || [], devices = this.devices(), covered = new Set(saved.map(item => item.deviceId));
    let total = saved.reduce((n, item) => n + item.count, 0);
    const added = [];
    for (const item of spatial.defaults(devices.filter(d => !covered.has(d.id)))) {
      if (saved.length + added.length >= 256 || total + item.count > 32768) continue;
      total += item.count; added.push(item);
    }
    return [...saved, ...added];
  }
  snapshot(full = false) {
    const data = { enabled: this.config.enabled, activeId: this.config.activeId, error: this.error, metrics: { ...this.metrics }, fps: this.fps };
    if (full) { data.layout = this.layout(); data.values = this.config.values; data.effects = [...this.effects.values()].map(({ source, canvas, ...effect }) => effect); }
    return data;
  }
  parse(original) {
    if (typeof original !== 'string' || Buffer.byteLength(original) > schema.LIMIT) throw Error('Efeito: limite de 128 KiB.');
    return original.trimStart().startsWith('{') ? schema.recipe(JSON.parse(original)) : schema.parseHTML(original);
  }
  async import(original) {
    if (this.stopped) throw Error('O aplicativo está encerrando.');
    if (this.importing) throw Error('Aguarde a importação em andamento.');
    this.importing = true;
    try {
    const effect = this.parse(original);
    if (!this.effects.has(effect.id) && this.effects.size >= 67) throw Error('Limite de 64 efeitos importados.');
    // Probe through the same isolated worker used for playback before accepting.
    await this.probe(effect);
    if (this.stopped) throw Error('O aplicativo está encerrando.');
    if(this.effects.get(effect.id)?.builtin)return effect.id;
    fs.mkdirSync(this.directory, { recursive: true });
    writeJson(path.join(this.directory, effect.id + '.json'), { original });
    this.effects.set(effect.id, effect); this.changed(); return effect.id;
    } finally { this.importing = false; }
  }
  probe(effect) {
    return new Promise((resolve, reject) => {
      const child = this.spawn(); let done = false;
      const finish = error => { if (done) return; done = true; clearTimeout(timer); this.probes.delete(cancel); child.kill(); if (error) reject(error); else resolve(); };
      const cancel = () => finish(Error('Importação cancelada ao encerrar o aplicativo.')); this.probes.add(cancel);
      const timer = setTimeout(() => finish(Error('O efeito excedeu o tempo de validação.')), 6000);
      child.on('error', error => finish(error)); child.on('exit', () => { if (!done) finish(Error('O motor do efeito encerrou durante a validação.')); });
      child.on('message', message => {
        if (message.kind === 'ready') child.send({ kind: 'frame', points: [], preview: false });
        else if (message.kind === 'frame') finish();
        else if (message.kind === 'failure') finish(Error(message.error));
      });
      child.send({ kind: 'load', effect, values: {} });
    });
  }
  spawn() {
    return fork(path.join(__dirname, 'studio-worker.js'), [], { execArgv: ['--max-old-space-size=64'], windowsHide: true, serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', DISABLE_SYSTEM_FONTS_LOADING: '1' } });
  }
  configure(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['layout', 'activeId', 'values', 'enabled'].includes(k))) throw Error('Configuração de mapa inválida.');
    const previous = this.config, next = { ...previous };
    if (Object.hasOwn(body, 'layout')) next.layout = schema.layout(body.layout);
    if (Object.hasOwn(body, 'enabled')) { if (typeof body.enabled !== 'boolean') throw Error('Ativação inválida.'); next.enabled = body.enabled; }
    if (Object.hasOwn(body, 'activeId')) { if (!this.effects.has(body.activeId)) throw Error('Efeito não encontrado.'); next.activeId = body.activeId; next.values = {}; next.excluded = []; }
    const effect = this.effects.get(next.activeId);
    if (!effect) throw Error('Efeito não encontrado.');
    next.values = schema.parameters(effect, Object.hasOwn(body, 'values') ? body.values : next.values);
    if (body.layout) {
      const devices = new Map(this.devices().map(d => [d.id, d.ledCount]));
      for (const item of next.layout) if (devices.has(item.deviceId) && item.start + item.count > devices.get(item.deviceId)) throw Error('A faixa ultrapassa a quantidade de LEDs do componente.');
    }
    this.store.data.studio = next; this.store.save();
    // Geometry only changes where the next frame is sampled. Keep the worker
    // and animation clock alive while editing; failed effects can be retried.
    if (previous.activeId !== next.activeId || JSON.stringify(previous.values) !== JSON.stringify(next.values) || (this.error && ['enabled', 'values', 'activeId'].some(key => Object.hasOwn(body, key)))) this.reset();
    this.hardware.changed(); this.changed();
  }
  remove(id) {
    const effect = this.effects.get(id); if (!effect || effect.builtin) throw Error('Este efeito não pode ser removido.');
    if (this.config.activeId === id) this.configure({ activeId: builtin[0].id, enabled: false });
    fs.unlinkSync(path.join(this.directory, id + '.json')); this.effects.delete(id); this.changed();
  }
  async duplicate(id,name) {
    const effect=this.effects.get(id);if(!effect||typeof name!=='string'||!name.trim()||name.trim().length>60)throw Error('Nome do efeito: 1 a 60 caracteres.');
    let original;
    if(effect.format==='nexus-effect/1')original=JSON.stringify({...effect,name:name.trim()});
    else {const file=path.join(this.directory,id+'.json'),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>256*1024)throw Error('Arquivo de efeito inválido.');original=readJson(file).original;const safe=name.trim().replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');original=/<title[^>]*>[\s\S]*?<\/title>/i.test(original)?original.replace(/<title[^>]*>[\s\S]*?<\/title>/i,()=>'<title>'+safe+'</title>'):'<title>'+safe+'</title>'+original;}
    return this.import(original);
  }
  profile(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['name', 'activeId', 'values'].includes(k))) throw Error('Perfil do mapa inválido.');
    const effect = this.effects.get(Object.hasOwn(body, 'activeId') ? body.activeId : this.config.activeId);
    if (!effect) throw Error('Efeito não encontrado.');
    const values = schema.parameters(effect, Object.hasOwn(body, 'values') ? body.values : effect.id === this.config.activeId ? this.config.values : {});
    return this.store.profile(body.name, undefined, { enabled: true, activeId: effect.id, values, excluded: [] });
  }
  reset() { this.signature = ''; this.error = null; this.colors.clear(); this.stopWorker(); this.preview = null; this.rendered = false; }
  hasDevice(id) { return this.config.enabled && !this.error && !(this.config.excluded || []).includes(id) && this.layout().some(item => item.deviceId === id); }
  colorsFor(id, settings, count) {
    if (!this.hasDevice(id) || !this.colors.has(id)) return null;
    const colors = this.colors.get(id), scale = settings.power ? settings.brightness / 100 : 0;
    return Array.from({ length: count }, (_, index) => { const color = colors[index] || [0, 0, 0]; return { red: Math.round(color[0] * scale), green: Math.round(color[1] * scale), blue: Math.round(color[2] * scale) }; });
  }
  previewPacket() {
    const devices = this.devices();
    const spatial = this.config.enabled && !this.error;
    return { image: spatial && this.preview ? this.preview.toString('base64') : null, layout: spatial && this.frameLayout ? this.frameLayout : this.layout(), enabled: this.config.enabled, power: this.store.data.master.power, connected: this.hardware.connected, error: this.error,
      playback: { spatial, effect: this.store.data.master.effect, name: spatial ? this.effects.get(this.config.activeId)?.name || null : null },
      output: devices.map(device => {
        const sent = this.hardware.outputFor?.(device.id);
        return { id: device.id, source: sent?.source || 'unavailable', at: sent?.at || null,
          rgb: sent?.colors ? Buffer.from(sent.colors.flatMap(color => [color.red, color.green, color.blue])).toString('base64') : null };
      }) };
  }
  publishPreview() {
    const event = 'data: ' + JSON.stringify(this.previewPacket()) + '\n\n';
    for (const client of this.clients) client.res.write(event);
  }
  watch(req, res, authorized) {
    if (this.clients.size >= 4) throw Error('Limite de prévias simultâneas atingido.');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' }); res.write('retry: 2000\n\n');
    const client = { req, res, authorized }; this.clients.add(client); res.on('close', () => this.clients.delete(client));
    res.write('data: ' + JSON.stringify(this.previewPacket()) + '\n\n');
  }
  stopWorker() { clearTimeout(this.deadline); this.worker?.kill(); this.worker = null; this.busy = false; this.ready = false; this.frames = 0; this.windowAt = Date.now(); this.nextFrame = 0; this.metrics.fps = 0; this.metrics.memoryMB = 0; }
  fail(message) { this.stopWorker(); this.error = String(message).slice(0, 160); this.changed(); this.hardware.changed(); }
  pump() {
    for (const c of this.clients) if (c.res.destroyed || !c.authorized() || c.res.writableLength > 512 * 1024) { c.res.end(); this.clients.delete(c); }
    const running = this.config.enabled && this.store.data.master.power && this.hardware.connected && this.devices().some(d => d.settings?.power !== false && !(this.config.excluded || []).includes(d.id));
    // Common effects already run in Hardware. Watching their output must not
    // start a second animation clock or keep an unrelated Canvas worker alive.
    if (!this.config.enabled || this.error) {
      if (this.worker) this.stopWorker();
      if (this.clients.size && performance.now() - (this.lastPreview || 0) >= 100) { this.lastPreview = performance.now(); this.publishPreview(); }
      return;
    }
    if (!running && !this.clients.size) { if (this.worker) this.stopWorker(); return; }
    const effect = this.effects.get(this.config.activeId); if (!effect) { this.fail('O efeito salvo não está na biblioteca. Importe o arquivo novamente ou escolha outro efeito.'); return; }
    const layout = this.layout(), layoutSignature = JSON.stringify(layout), signature = JSON.stringify([effect.id, this.config.values]);
    if (signature !== this.signature || !this.worker) {
      this.stopWorker(); this.signature = signature; this.ready = false;
      const child = this.worker = this.spawn();
      this.deadline = setTimeout(() => { if (this.worker === child) this.fail('O motor demorou para iniciar.'); }, 6000);
      child.on('error', () => { if (this.worker === child) this.fail('Não foi possível iniciar o motor.'); });
      child.on('exit', () => { if (this.worker === child) this.fail('O motor encerrou inesperadamente.'); });
      child.on('message', async message => {
        try {
        if (this.worker !== child) return;
        clearTimeout(this.deadline);
        if (message.kind === 'ready') { this.ready = true; this.busy = false; }
        else if (message.kind === 'failure') this.fail(message.error);
        else if (message.kind === 'frame') {
          this.colors.clear();
          this.rendered = true; this.revision++; this.renderedLayout = this.pendingLayoutSignature; this.frameLayout = this.pendingLayout;
          for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i]; if (!this.colors.has(p.deviceId)) this.colors.set(p.deviceId, []);
            this.colors.get(p.deviceId)[p.index] = message.colors[i];
          }
          this.hardware.changed();
          // Submit a completed spatial frame without waiting for a second timer.
          // Hardware's busy guard and SDK backpressure still serialize writes.
          if (this.config.enabled && this.hardware.tick) await this.hardware.tick(true);
          if (this.worker !== child) return;
          this.busy = false;
          this.metrics.renderMs = Math.round(message.renderMs * 100) / 100; this.metrics.memoryMB = Math.round(message.memoryMB);
          this.frames++; const elapsed = Date.now() - this.windowAt;
          if (elapsed >= 1000) { this.metrics.fps = Math.round(this.frames * 1000 / elapsed); this.frames = 0; this.windowAt = Date.now(); }
          if (message.preview) {
            this.preview = Buffer.from(message.preview);
            this.publishPreview();
          }
        }
        } catch (error) { if (this.worker === child) this.fail(error.message); }
      });
      child.send({ kind: 'load', effect, values: this.config.values }); return;
    }
    if (!this.ready) return;
    const now = performance.now();
    const interval = 1000 / this.fps;
    if (now < (this.nextFrame || 0)) return;
    this.nextFrame = Math.max((this.nextFrame || now) + interval, now);
    if (this.busy) { this.metrics.dropped++; return; }
    // Static recipes retain their frame instead of redrawing while idle.
    if (effect.format === 'nexus-effect/1' && (effect.pattern === 'gradient' || effect.speed === 0) && this.rendered && this.renderedLayout === layoutSignature && (!this.clients.size || this.preview)) {
      if (this.clients.size && now - (this.lastPreview || 0) > 100) { this.lastPreview = now; this.publishPreview(); }
      return;
    }
    this.lastFrame = now; this.pendingLayout = structuredClone(layout); this.pendingLayoutSignature = layoutSignature; this.points = layout.flatMap(spatial.points); this.busy = true;
    this.deadline = setTimeout(() => this.fail('O efeito excedeu o tempo de resposta e foi pausado.'), 1000);
    const preview = this.clients.size > 0 && now - (this.lastPreview || 0) > 100;
    if (preview) this.lastPreview = now;
    this.worker.send({ kind: 'frame', points: this.points, preview });
  }
  stop() { this.stopped = true; clearInterval(this.timer); this.stopWorker(); for (const cancel of this.probes) cancel(); for (const c of this.clients) c.res.end(); this.clients.clear(); }
}
module.exports = { Studio, builtin };
