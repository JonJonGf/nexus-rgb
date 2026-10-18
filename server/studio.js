'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { fork } = require('node:child_process');
const { readJson, writeJson, readEffectJson } = require('./store');
const schema = require('./studio-schema'), spatial = require('../public/spatial');
const fingerprint = value => crypto.createHash('sha256').update(value).digest('hex');
const savedFingerprint = value => /^[a-f0-9]{64}$/.test(value) ? value : fingerprint(value);
const builtin = [
  schema.recipe({ format: 'nexus-effect/1', name: 'Aurora espacial', pattern: 'wave', palette: ['#00ff99', '#00c8ff', '#8156ff'], speed: 30, angle: 0, scale: 1 }),
  schema.recipe({ format: 'nexus-effect/1', name: 'Cometa no setup', pattern: 'comet', palette: ['#00f0ff', '#7954ff'], speed: 35, angle: 0, scale: 1 }),
  schema.recipe({ format: 'nexus-effect/1', name: 'Anéis de luz', pattern: 'rings', palette: ['#ff0055', '#ff8000', '#7954ff'], speed: 20, angle: 0, scale: 1 })
];
class Studio {
  constructor(store, hardware, directory, changed, options = {}) {
    this.store = store; this.hardware = hardware; this.directory = path.join(directory, 'effects'); this.recoveryFile = directory ? path.join(directory, 'recovery.json') : null; this.changed = changed;
    this.workingWindowMs = options.workingWindowMs ?? 3000; this.workingMinFrames = options.workingMinFrames ?? 3; this.retryDelays = Array.isArray(options.retryDelays) ? options.retryDelays : [120, 300];
    this.effects = new Map(builtin.map(e => [e.id, { ...e, builtin: true }])); this.corruptedEffects = new Set(); this.clients = new Set(); this.probes = new Set(); this.revision = 0; this.layoutRevision = 1; this.preview = null; this.colors = new Map(); this.worker = null; this.busy = false; this.error = null; this.failure = null; this.retrying = false; this.retryTimer = null; this.attempts = 0; this.attemptKey = ''; this.healthySince = 0; this.healthyFrames = 0; this.workingHistory = []; this.quarantined = null; this.hadController = Boolean(hardware?.connected); this.signature = ''; this.metrics = { fps: 0, renderMs: 0, memoryMB: 0, dropped: 0 }; this.frames = 0; this.windowAt = Date.now();
    if (fs.existsSync(this.directory)) for (const file of fs.readdirSync(this.directory).slice(0, 128)) {
      if (!/^[a-f0-9]{24}\.json$/.test(file)) continue;
      try {
        const saved = readEffectJson(path.join(this.directory, file)), effect = this.parse(saved.original);
        if (effect.id + '.json' === file && !this.effects.get(effect.id)?.builtin) this.effects.set(effect.id, effect);
        else this.corruptedEffects.add(file.slice(0, 24));
      } catch {
        this.corruptedEffects.add(file.slice(0, 24));
      }
    }
    if (store.data.studio) {
      try {
      if (typeof store.data.studio.enabled !== 'boolean') throw Error('Ativação do mapa inválida no arquivo de configuração.');
      schema.layout(store.data.studio.layout || []);
      if (!Array.isArray(store.data.studio.excluded || []) || (store.data.studio.excluded || []).some(id => !/^[a-f0-9]{24}$/.test(id))) throw Error('Configuração de componentes inválida.');
      const effect = this.effects.get(store.data.studio.activeId);
      if (effect) {
        try {
          schema.parameters(effect, store.data.studio.values || {});
        } catch {
          store.data.studio.values = schema.parameters(effect, {});
          if (store.data.studio.enabled) this.initialFailure = { kind: 'config', message: 'Parâmetros salvos do efeito eram inválidos e foram isolados.' };
        }
      } else if (store.data.studio.enabled && store.data.studio.activeId) {
        this.initialFailure = {
          kind: 'config',
          message: this.corruptedEffects.has(store.data.studio.activeId)
            ? 'O arquivo do efeito salvo está inválido ou corrompido. Importe novamente ou escolha outro efeito.'
            : 'O efeito salvo não está na biblioteca. Importe o arquivo novamente ou escolha outro efeito.'
        };
      }
      } catch {
        this.recoveryConfig = { enabled: false, activeId: builtin[0].id, values: {}, layout: [], excluded: [] };
        this.initialFailure = { kind: 'config', message: 'O mapa salvo está inválido. A configuração original foi preservada; revise o mapa antes de reativar.' };
      }
    }
    this.loadRecovery();
    if (this.initialFailure) {
      this.fail(this.initialFailure.message, this.initialFailure.kind, { attempts: 1, maxAttempts: 1, quarantined: true, persist: false });
    } else if (this.config.enabled && this.quarantined && this.quarantined.versionKey === this.versionKey()) {
      this.error = this.quarantined.message;
      this.failure = { ...this.quarantined, quarantined: true };
    }
    this.timer = setInterval(() => this.pump(), 8); this.timer.unref();
  }
  get config() {
    if (this.recoveryConfig) return this.recoveryConfig;
    if (this.store.data.studio) return this.store.data.studio;
    const excluded = Object.entries(this.store.data.devices || {}).filter(([, d]) => d && ('color' in d || 'effect' in d || 'nativeMode' in d)).map(([id]) => id);
    return { enabled: false, activeId: builtin[0].id, values: {}, layout: [], excluded };
  }
  get fps() { return this.store.data.performance?.fps || 20; }
  versionKey(activeId = this.config.activeId, values = this.config.values) {
    const effect = this.effects.get(activeId);
    const cleanValues = effect ? (() => { try { return schema.parameters(effect, values || {}); } catch { return values || {}; } })() : (values || {});
    return fingerprint(JSON.stringify([activeId, cleanValues, effect?.source || effect?.pattern || null, effect?.palette || null, effect?.speed ?? null, effect?.angle ?? null, effect?.scale ?? null]));
  }
  loadRecovery() {
    this.workingHistory = [];
    this.quarantined = null;
    if (!this.recoveryFile) return;
    try {
      const saved = readJson(this.recoveryFile, null);
      if (!saved) return;
      const history = Array.isArray(saved?.workingHistory) ? saved.workingHistory : saved?.lastWorking ? [saved.lastWorking] : [];
      for (const item of history.slice(0, 2)) {
        if (!item || typeof item.activeId !== 'string' || !/^[a-f0-9]{24}$/.test(item.activeId) || typeof item.versionKey !== 'string') continue;
        const effect = this.effects.get(item.activeId);
        if (!effect) continue;
        try {
          const values = schema.parameters(effect, item.values || {});
          const key = this.versionKey(effect.id, values);
          if (key === savedFingerprint(item.versionKey)) this.workingHistory.push({ activeId: effect.id, values, versionKey: key, promotedAt: Number(item.promotedAt) || Date.now() });
        } catch {}
      }
      if (saved?.quarantined && typeof saved.quarantined.versionKey === 'string' && typeof saved.quarantined.message === 'string') {
        this.quarantined = {
          versionKey: savedFingerprint(saved.quarantined.versionKey),
          activeId: String(saved.quarantined.activeId || '').slice(0, 24),
          kind: ['effect', 'worker', 'config'].includes(saved.quarantined.kind) ? saved.quarantined.kind : 'effect',
          message: String(saved.quarantined.message).slice(0, 160),
          attempts: Number.isInteger(saved.quarantined.attempts) ? saved.quarantined.attempts : 1,
          maxAttempts: Number.isInteger(saved.quarantined.maxAttempts) ? saved.quarantined.maxAttempts : (this.retryDelays.length + 1),
          at: Number(saved.quarantined.at) || Date.now()
        };
      }
    } catch { /* Ignore corrupted recovery.json */ }
  }
  saveRecovery() {
    if (!this.recoveryFile) return;
    try {
      writeJson(this.recoveryFile, {
        version: 1,
        lastWorking: this.workingHistory[0] || null,
        workingHistory: this.workingHistory.slice(0, 2),
        quarantined: this.quarantined ? { ...this.quarantined } : null
      });
    } catch { /* Best-effort recovery state persistence */ }
  }
  validLastWorking(excludeFailed = Boolean(this.error)) {
    const failedKey = excludeFailed && this.error ? this.versionKey() : null;
    for (const item of this.workingHistory) {
      const effect = this.effects.get(item.activeId);
      if (!effect) continue;
      try {
        const values = schema.parameters(effect, item.values || {});
        const key = this.versionKey(effect.id, values);
        if (key !== item.versionKey) continue;
        if (failedKey && key === failedKey) continue;
        return { ...item, name: effect.name, values };
      } catch {}
    }
    return null;
  }
  checkPromotion(effect) {
    if (this.error || this.retrying || !this.rendered || !this.healthySince) return;
    const isStatic = effect.format === 'nexus-effect/1' && (effect.pattern === 'gradient' || effect.speed === 0);
    const minFrames = isStatic ? 1 : this.workingMinFrames;
    if (this.healthyFrames < minFrames) return;
    if (Date.now() - this.healthySince < this.workingWindowMs) return;
    const key = this.versionKey(effect.id, this.config.values);
    this.attempts = 0;
    let dirty = false;
    if (this.quarantined?.versionKey === key) {
      this.quarantined = null;
      dirty = true;
    }
    if (this.workingHistory[0]?.versionKey !== key) {
      const entry = { activeId: effect.id, values: structuredClone(this.config.values || {}), versionKey: key, promotedAt: Date.now() };
      this.workingHistory = [entry, ...this.workingHistory.filter(i => i.versionKey !== key)].slice(0, 2);
      dirty = true;
    }
    if (dirty) {
      this.saveRecovery();
      this.changed();
    }
  }
  recoverySnapshot() {
    if (this.hardware?.connected) this.hadController = true;
    const controllerConfirmed = Boolean(this.hardware?.connected);
    const controllerState = !controllerConfirmed ? 'unconfirmed' : !this.store.data.master.power ? 'lights-off' : this.error ? 'fallback' : this.config.enabled ? 'spatial' : 'common';
    const lw = this.validLastWorking(Boolean(this.error));
    const lastWorking = lw ? { activeId: lw.activeId, name: lw.name, values: lw.values, promotedAt: lw.promotedAt } : null;
    if (this.error) {
      const kind = this.failure?.kind || 'effect';
      return {
        active: true,
        kind,
        message: this.error,
        attempts: this.failure?.attempts || 1,
        maxAttempts: this.failure?.maxAttempts || (this.retryDelays.length + 1),
        quarantined: Boolean(this.failure?.quarantined),
        retrying: false,
        controllerConfirmed,
        controllerState,
        lastWorking,
        actions: ['retry', ...(lastWorking ? ['last-working'] : []), 'lights-off']
      };
    }
    const hwSnap = this.hardware?.snapshot?.() || {};
    const controllerLost = !controllerConfirmed && Boolean(this.hadController || this.hardware?.lostAt || (!this.hardware?.stopped && hwSnap.error && hwSnap.error !== 'Aguardando o controlador RGB.'));
    if (controllerLost) {
      return {
        active: true,
        kind: 'controller',
        message: hwSnap.error || 'Controlador desconectado.',
        attempts: 0,
        maxAttempts: 0,
        quarantined: false,
        retrying: true,
        controllerConfirmed: false,
        controllerState: 'unconfirmed',
        lastWorking,
        actions: ['lights-off']
      };
    }
    return {
      active: false,
      kind: null,
      message: null,
      attempts: this.attempts || 0,
      maxAttempts: this.retryDelays.length + 1,
      quarantined: false,
      retrying: Boolean(this.retrying),
      controllerConfirmed,
      controllerState,
      lastWorking,
      actions: []
    };
  }
  devices() { return this.hardware.snapshot().devices.filter(d => d.ledCount > 0 && d.effects.includes('wave')); }
  layout() {
    const saved = this.config.layout || [], devices = this.devices(), covered = new Set(saved.map(item => item.deviceId));
    const deviceMap = new Map(devices.map(d => [d.id, d]));
    for (const item of saved) {
      const dev = deviceMap.get(item.deviceId);
      if (dev && (dev.type === 5 || dev.kind === 'keyboard') && item.shape === 'strip') {
        item.shape = 'matrix';
        item.columns = 14;
        if (!item.width || item.width < 0.2) item.width = 0.32;
        if (!item.height || item.height < 0.1) item.height = 0.12;
      }
    }
    let total = saved.reduce((n, item) => n + item.count, 0);
    const added = [];
    for (const item of spatial.defaults(devices.filter(d => !covered.has(d.id)))) {
      if (saved.length + added.length >= 256 || total + item.count > 32768) continue;
      total += item.count; added.push(item);
    }
    return [...saved, ...added];
  }
  snapshot(full = false) {
    const data = { enabled: this.config.enabled, activeId: this.config.activeId, excluded: [...(this.config.excluded || [])], layoutRevision: this.layoutRevision, error: this.error, recovery: this.recoverySnapshot(), metrics: { ...this.metrics }, fps: this.fps };
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
    this.corruptedEffects.delete(effect.id);
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
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['layout', 'activeId', 'values', 'enabled', 'baseLayoutRevision'].includes(k))) throw Error('Configuração de mapa inválida.');
    const previous = this.config, next = { ...previous, excluded: [...(previous.excluded || [])] };
    if (Object.hasOwn(body, 'layout')) {
      if (body.baseLayoutRevision !== undefined && (!Number.isInteger(body.baseLayoutRevision) || body.baseLayoutRevision !== this.layoutRevision)) {
        const err = Error('O mapa foi alterado em outro dispositivo. Revise a posição atual antes de desfazer ou salvar.');
        err.status = 409;
        throw err;
      }
      next.layout = schema.layout(body.layout);
    }
    if (Object.hasOwn(body, 'enabled')) { if (typeof body.enabled !== 'boolean') throw Error('Ativação inválida.'); next.enabled = body.enabled; }
    if (Object.hasOwn(body, 'activeId')) { if (!this.effects.has(body.activeId)) throw Error('Efeito não encontrado.'); if (body.activeId !== previous.activeId) next.values = {}; next.activeId = body.activeId; }
    const effect = this.effects.get(next.activeId);
    if (!effect) throw Error('Efeito não encontrado.');
    next.values = schema.parameters(effect, Object.hasOwn(body, 'values') ? body.values : next.values);
    if (body.layout) {
      const devices = new Map(this.devices().map(d => [d.id, d.ledCount]));
      for (const item of next.layout) if (devices.has(item.deviceId) && item.start + item.count > devices.get(item.deviceId)) throw Error('A faixa ultrapassa a quantidade de LEDs do componente.');
      this.layoutRevision++;
    }
    if (this.recoveryConfig) {
      const original = this.store.data.studio;
      const name = 'invalid-studio-' + crypto.createHash('sha256').update(JSON.stringify(original)).digest('hex').slice(0, 24) + '.json';
      const file = path.join(path.dirname(this.recoveryFile), name);
      if (!fs.existsSync(file)) writeJson(file, original);
    }
    this.store.data.studio = next; this.store.save(); this.recoveryConfig = null;
    // Geometry only changes where the next frame is sampled. Keep the worker
    // and animation clock alive while editing; failed effects can be retried.
    if (previous.activeId !== next.activeId || JSON.stringify(previous.values) !== JSON.stringify(next.values) || (this.error && ['enabled', 'values', 'activeId'].some(key => Object.hasOwn(body, key)))) {
      this.attempts = 0; this.attemptKey = '';
      if (this.quarantined && ['enabled', 'values', 'activeId'].some(key => Object.hasOwn(body, key))) {
        this.quarantined = null; this.saveRecovery();
      }
      this.reset();
    }
    this.hardware.changed(); this.changed();
  }
  async recover(action) {
    if (!['retry', 'last-working', 'lights-off'].includes(action)) throw Error('Ação de recuperação inválida.');
    clearTimeout(this.retryTimer); this.retryTimer = null; this.retrying = false;
    if (action === 'retry') {
      this.quarantined = null; this.attempts = 0; this.attemptKey = '';
      this.saveRecovery();
      this.store.data.studio = { ...this.config, excluded: [...(this.config.excluded || [])], enabled: true };
      this.store.save();
      this.reset();
      this.hardware.changed(); this.changed();
      return;
    }
    if (action === 'last-working') {
      const lw = this.validLastWorking(true);
      if (!lw) throw Error('Nenhum efeito funcional validado anteriormente.');
      this.quarantined = null; this.attempts = 0; this.attemptKey = '';
      this.saveRecovery();
      this.store.data.studio = { ...this.config, excluded: [...(this.config.excluded || [])], enabled: true, activeId: lw.activeId, values: structuredClone(lw.values) };
      this.store.save();
      this.reset();
      this.hardware.changed(); this.changed();
      return;
    }
    if (action === 'lights-off') {
      this.stopWorker();
      this.store.power(false);
      this.hardware.cancelIdentification?.();
      this.hardware.changed();
      if (this.hardware.connected && this.hardware.tick) await this.hardware.tick();
      this.changed();
    }
  }
  remove(id) {
    const effect = this.effects.get(id); if (!effect || effect.builtin) throw Error('Este efeito não pode ser removido.');
    if (this.config.activeId === id) this.configure({ activeId: builtin[0].id, enabled: false });
    if (this.workingHistory.some(i => i.activeId === id)) {
      this.workingHistory = this.workingHistory.filter(i => i.activeId !== id);
      this.saveRecovery();
    }
    fs.unlinkSync(path.join(this.directory, id + '.json')); this.effects.delete(id); this.changed();
  }
  async duplicate(id,name) {
    const effect=this.effects.get(id);if(!effect||typeof name!=='string'||!name.trim()||name.trim().length>60)throw Error('Nome do efeito: 1 a 60 caracteres.');
    let original;
    if(effect.format==='nexus-effect/1')original=JSON.stringify({...effect,name:name.trim()});
    else {original=readEffectJson(path.join(this.directory,id+'.json')).original;const safe=name.trim().replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');original=/<title[^>]*>[\s\S]*?<\/title>/i.test(original)?original.replace(/<title[^>]*>[\s\S]*?<\/title>/i,()=>'<title>'+safe+'</title>'):'<title>'+safe+'</title>'+original;}
    return this.import(original);
  }
  profile(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['name', 'activeId', 'values'].includes(k))) throw Error('Perfil do mapa inválido.');
    const effect = this.effects.get(Object.hasOwn(body, 'activeId') ? body.activeId : this.config.activeId);
    if (!effect) throw Error('Efeito não encontrado.');
    const values = schema.parameters(effect, Object.hasOwn(body, 'values') ? body.values : effect.id === this.config.activeId ? this.config.values : {});
    return this.store.profile(body.name, undefined, { enabled: true, activeId: effect.id, values, excluded: [] });
  }
  reset() { clearTimeout(this.retryTimer); this.retryTimer = null; this.retrying = false; this.signature = ''; this.error = null; this.failure = null; this.colors.clear(); this.stopWorker(); this.preview = null; this.rendered = false; this.healthySince = 0; this.healthyFrames = 0; }
  hasDevice(id) { return this.config.enabled && !this.error && !(this.config.excluded || []).includes(id) && this.layout().some(item => item.deviceId === id); }
  colorsFor(id, settings, count) {
    if (!this.hasDevice(id) || !this.colors.has(id)) return null;
    const colors = this.colors.get(id), scale = settings.power ? settings.brightness / 100 : 0;
    return Array.from({ length: count }, (_, index) => { const color = colors[index] || [0, 0, 0]; return { red: Math.round(color[0] * scale), green: Math.round(color[1] * scale), blue: Math.round(color[2] * scale) }; });
  }
  previewPacket() {
    const devices = this.devices();
    const spatial = this.config.enabled && !this.error;
    return { image: spatial && this.preview ? this.preview.toString('base64') : null, layout: spatial && this.frameLayout ? this.frameLayout : this.layout(), enabled: this.config.enabled, power: this.store.data.master.power, connected: this.hardware.connected, error: this.error, recovery: this.recoverySnapshot(),
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
    for (const c of this.clients) if (c.res.destroyed || !c.authorized() || c.res.writableLength > 512 * 1024) { c.res.end(); this.clients.delete(c); }
    const current = authorized?.(), isAdmin = Boolean(current === true || current?.admin);
    let lanClients = 0;
    for (const c of this.clients) { const s = c.authorized?.(); if (!(s === true || s?.admin)) lanClients++; }
    if (this.clients.size >= 4 || (!isAdmin && lanClients >= 2)) throw Object.assign(Error('Limite de prévias simultâneas atingido.'), { status: 503 });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' }); res.write('retry: 2000\n\n');
    const client = { req, res, authorized }; this.clients.add(client); res.on('close', () => this.clients.delete(client)); res.on('error', () => this.clients.delete(client));
    res.write('data: ' + JSON.stringify(this.previewPacket()) + '\n\n');
  }
  stopWorker() { clearTimeout(this.deadline); this.worker?.kill(); this.worker = null; this.busy = false; this.ready = false; this.frames = 0; this.windowAt = Date.now(); this.nextFrame = 0; this.metrics.fps = 0; this.metrics.memoryMB = 0; }
  fail(message, kind = 'effect', details = {}) {
    clearTimeout(this.retryTimer); this.retryTimer = null; this.retrying = false;
    this.stopWorker();
    this.error = String(message).slice(0, 160);
    const maxAttempts = details.maxAttempts || (this.retryDelays.length + 1);
    const attempts = details.attempts || Math.max(1, this.attempts);
    const quarantined = details.quarantined !== undefined ? Boolean(details.quarantined) : true;
    this.failure = { kind, message: this.error, attempts, maxAttempts, quarantined };
    if (quarantined && details.persist !== false) {
      this.quarantined = { versionKey: this.versionKey(), activeId: this.config.activeId || '', kind, message: this.error, attempts, maxAttempts, at: Date.now() };
      this.saveRecovery();
    }
    this.changed(); this.hardware.changed();
  }
  handleRuntimeFailure(message, kind = 'effect') {
    const key = this.versionKey();
    if (this.attemptKey !== key) { this.attemptKey = key; this.attempts = 0; }
    this.attempts++;
    const maxAttempts = this.retryDelays.length + 1;
    this.stopWorker();
    if (this.attempts < maxAttempts && !this.stopped) {
      const delay = this.retryDelays[this.attempts - 1];
      this.retrying = true;
      this.failure = { kind, message: String(message).slice(0, 160), attempts: this.attempts, maxAttempts, quarantined: false };
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.retrying = false;
        this.signature = '';
        if (!this.stopped) this.pump();
      }, delay);
      this.retryTimer.unref?.();
      this.changed();
      return;
    }
    this.retrying = false;
    this.fail(message, kind, { attempts: this.attempts, maxAttempts, quarantined: true, persist: true });
  }
  hasActiveDevices() {
    return Boolean(this.config.enabled && !this.error && this.hardware.connected && this.devices().some(d => this.hasDevice(d.id) && ((this.store.data.master.power && d.settings?.power !== false) || this.hardware.isPowerTransitioning?.(d.id)) && (d.settings?.brightness ?? 100) > 0));
  }
  pump() {
    if (this.hardware?.connected) this.hadController = true;
    for (const c of this.clients) if (c.res.destroyed || !c.authorized() || c.res.writableLength > 512 * 1024) { c.res.end(); this.clients.delete(c); }
    const running = this.hasActiveDevices();
    // Common effects already run in Hardware. Watching their output must not
    // start a second animation clock or keep an unrelated Canvas worker alive.
    if (!this.config.enabled || (!this.store.data.master.power && !running) || this.error || this.retrying) {
      if (this.worker) this.stopWorker();
      if (this.clients.size && performance.now() - (this.lastPreview || 0) >= 100) { this.lastPreview = performance.now(); this.publishPreview(); }
      return;
    }
    if (!running && !this.clients.size) { if (this.worker) this.stopWorker(); return; }
    const effect = this.effects.get(this.config.activeId);
    if (!effect) {
      const msg = this.corruptedEffects.has(this.config.activeId)
        ? 'O arquivo do efeito salvo está inválido ou corrompido. Importe novamente ou escolha outro efeito.'
        : 'O efeito salvo não está na biblioteca. Importe o arquivo novamente ou escolha outro efeito.';
      this.fail(msg, 'config', { attempts: 1, maxAttempts: 1, quarantined: true });
      return;
    }
    const layout = this.layout(), layoutSignature = JSON.stringify(layout), signature = JSON.stringify([effect.id, this.config.values]);
    if (signature !== this.signature || !this.worker) {
      this.stopWorker(); this.signature = signature; this.ready = false; this.healthySince = Date.now(); this.healthyFrames = 0;
      const child = this.worker = this.spawn();
      this.deadline = setTimeout(() => { if (this.worker === child) this.handleRuntimeFailure('O motor demorou para iniciar.', 'worker'); }, 6000);
      child.on('error', () => { if (this.worker === child) this.handleRuntimeFailure('Não foi possível iniciar o motor.', 'worker'); });
      child.on('exit', () => { if (this.worker === child) this.handleRuntimeFailure('O motor encerrou inesperadamente.', 'worker'); });
      child.on('message', async message => {
        try {
        if (this.worker !== child) return;
        clearTimeout(this.deadline);
        if (message.kind === 'ready') { this.ready = true; this.busy = false; }
        else if (message.kind === 'failure') this.handleRuntimeFailure(message.error, 'effect');
        else if (message.kind === 'frame') {
          this.colors.clear();
          this.rendered = true; this.healthyFrames++; this.revision++; this.renderedLayout = this.pendingLayoutSignature; this.frameLayout = this.pendingLayout;
          for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i]; if (!this.colors.has(p.deviceId)) this.colors.set(p.deviceId, []);
            this.colors.get(p.deviceId)[p.index] = message.colors[i];
          }
          if (this.hasActiveDevices()) {
            this.hardware.changed();
            // Submit a completed spatial frame without waiting for a second timer.
            // Hardware's busy guard and SDK backpressure still serialize writes.
            if (this.config.enabled && this.hardware.tick) await this.hardware.tick(true);
          }
          if (this.worker !== child) return;
          this.busy = false;
          this.metrics.renderMs = Math.round(message.renderMs * 100) / 100; this.metrics.memoryMB = Math.round(message.memoryMB);
          this.frames++; const elapsed = Date.now() - this.windowAt;
          if (elapsed >= 1000) { this.metrics.fps = Math.round(this.frames * 1000 / elapsed); this.frames = 0; this.windowAt = Date.now(); }
          this.checkPromotion(effect);
          if (message.preview) {
            this.preview = Buffer.from(message.preview);
            this.publishPreview();
          }
        }
        } catch (error) { if (this.worker === child) this.handleRuntimeFailure(error.message, 'effect'); }
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
      this.checkPromotion(effect);
      if (this.clients.size && now - (this.lastPreview || 0) > 100) { this.lastPreview = now; this.publishPreview(); }
      return;
    }
    this.lastFrame = now; this.pendingLayout = structuredClone(layout); this.pendingLayoutSignature = layoutSignature; this.points = layout.flatMap(spatial.points); this.busy = true;
    this.deadline = setTimeout(() => this.handleRuntimeFailure('O efeito excedeu o tempo de resposta e foi pausado.', 'effect'), 1000);
    const preview = this.clients.size > 0 && now - (this.lastPreview || 0) > 100;
    if (preview) this.lastPreview = now;
    this.worker.send({ kind: 'frame', points: this.points, preview });
  }
  stop() { this.stopped = true; clearInterval(this.timer); clearTimeout(this.retryTimer); this.retryTimer = null; this.retrying = false; this.stopWorker(); for (const cancel of this.probes) cancel(); for (const c of this.clients) c.res.end(); this.clients.clear(); }
}
module.exports = { Studio, builtin };
