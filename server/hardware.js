'use strict';
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const { Client } = require('openrgb-sdk');
const { effects } = require('./store');
const { ControllerRegistry } = require('./controllers');
function identity(device, duplicate = 0) {
  const physical = [device.vendor, device.name, device.serial, device.location, duplicate].join('|');
  return crypto.createHash('sha256').update(physical).digest('hex').slice(0, 24);
}
function components(device) {
  // Split only when OpenRGB exposes an exact, complete per-zone LED map.
  // Names, IDs and sizes come from hardware; no motherboard model is assumed.
  const zones = device.raw.zones;
  if (!device.direct || zones.length < 2 || zones.reduce((sum, zone) => sum + zone.ledsCount, 0) !== device.ledCount) return null;
  let offset = 0;
  return zones.map((zone, index) => {
    const port = /header|argb|addressable|connector|port/i.test(zone.name);
    const header = zone.name.match(/^Addressable RGB Header\s*(\d+)$/i);
    const id = index === 0 && !port ? device.id : crypto.createHash('sha256').update(`${device.id}|zone|${zone.id}|${zone.name}`).digest('hex').slice(0, 24);
    const item = { id, name: index === 0 && !port ? device.name : header ? `ARGB ${header[1]}` : zone.name,
      kind: /argb|addressable/i.test(zone.name) ? 'argb' : port ? 'port' : 'device', controllerName: device.name,
      zoneId: zone.id, ledCount: zone.ledsCount, offset, zones: device.zones.filter(z => z.id === zone.id),
      type: device.type, busType: device.busType, vendor: device.vendor };
    offset += zone.ledsCount; return item;
  });
}
function rgb(hex) { return { red: parseInt(hex.slice(1, 3), 16), green: parseInt(hex.slice(3, 5), 16), blue: parseInt(hex.slice(5, 7), 16) }; }
function hue(h) {
  const x = (h % 1 + 1) % 1 * 6; const f = x - Math.floor(x); const q = Math.round((1 - f) * 255); const t = Math.round(f * 255);
  return [{ red: 255, green: t, blue: 0 }, { red: q, green: 255, blue: 0 }, { red: 0, green: 255, blue: t }, { red: 0, green: q, blue: 255 }, { red: t, green: 0, blue: 255 }, { red: 255, green: 0, blue: q }][Math.floor(x)];
}
function paletteColor(palette, position) {
  const step = ((position % 1 + 1) % 1) * palette.length;
  const start = rgb(palette[Math.floor(step)]); const end = rgb(palette[(Math.floor(step) + 1) % palette.length]);
  return Object.fromEntries(Object.keys(start).map(channel => [channel, Math.round(start[channel] + (end[channel] - start[channel]) * (step % 1))]));
}
function colorsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i], cb = b[i];
    if (!ca || !cb || ca.red !== cb.red || ca.green !== cb.green || ca.blue !== cb.blue) return false;
  }
  return true;
}
function isSmbusRam(device) {
  if (!device) return false;
  const loc = String(device.location || device.raw?.location || '').toLowerCase();
  if (loc.startsWith('usb') || loc.startsWith('hid')) return false;
  if (device.type === 0 || device.raw?.type === 0) return false;
  if (device.type === 1 || device.raw?.type === 1) return true;
  const name = String(device.name || device.raw?.name || '');
  return /dram|\bram\b|mem[oó]ria|memory|ene\s*(?:smbus|dram)|trident|vengeance|ballistix|dominator/i.test(name);
}
function detectBusArchitecture(device) {
  if (!device) return 'unknown';
  const loc = String(device.location || device.raw?.location || '').toLowerCase();
  const name = String(device.name || device.raw?.name || '').toLowerCase();
  const desc = String(device.description || device.raw?.description || '').toLowerCase();
  const combined = `${loc} ${name} ${desc}`;
  if (loc.startsWith('usb') || loc.startsWith('hid') || combined.includes('hidapi') || combined.includes('usb')) {
    return 'usb-hid';
  }
  if (combined.includes('i801') || combined.includes('intel')) {
    return 'intel-smbus';
  }
  if (combined.includes('piix4') || combined.includes('amd')) {
    return 'amd-smbus';
  }
  if (combined.includes('nct67') || combined.includes('nuvoton') || combined.includes('superio') || combined.includes('lpc')) {
    return 'superio';
  }
  if (combined.includes('smbus') || combined.includes('i2c')) {
    return 'generic-smbus';
  }
  return 'unknown';
}
function classifyDeviceType(device) {
  if (!device) return 21;
  const type = Number.isInteger(device.type) ? device.type : Number.isInteger(device.raw?.type) ? device.raw.type : null;
  if (type !== null && type >= 0 && type <= 20) return type;
  const name = String(device.name || device.raw?.name || '').toLowerCase();
  if (/\b(?:teclado|keyboard)\b/i.test(name)) return 5;
  if (/\b(?:mousepad|mousemat)\b/i.test(name)) return 7;
  if (/\b(?:mouse)\b/i.test(name)) return 6;
  if (/\b(?:gpu|placa de v[ií]deo|geforce|radeon|rtx|gtx)\b/i.test(name)) return 2;
  if (/\b(?:cooler|fan|ventoinha|aio|kraken|hydro|prism)\b/i.test(name)) return 3;
  if (/\b(?:strip|fita)\b/i.test(name)) return 4;
  if (/\b(?:headset|fone)\b/i.test(name)) return 8;
  if (isSmbusRam(device)) return 1;
  return 0;
}
function frame(settings, count, seconds) {
  const factor = settings.power ? settings.brightness / 100 : 0;
  const phase = seconds * (0.03 + settings.speed / 100 * 0.7);
  // Deliberate flashes have a separate, bounded rate; never animate the UI preview.
  const flashPhase = seconds * (0.5 + settings.speed / 100 * 1.5);
  return Array.from({ length: count }, (_, index) => {
    const position = phase + (settings.effect === 'wave' ? index / Math.max(count, 1) : 0);
    const palette = settings.palette;
    const cycle = settings.effect === 'strobe' ? flashPhase : phase;
    const selected = palette?.length ? palette[((Math.floor(cycle) % palette.length) + palette.length) % palette.length] : settings.color;
    const color = ['wave', 'rainbow'].includes(settings.effect) ? palette?.length ? paletteColor(palette, position) : hue(position) : rgb(settings.effect === 'static' ? settings.color : selected);
    const pulse = settings.effect === 'strobe' ? (flashPhase % 1 < 0.5 ? 1 : 0) : settings.effect === 'breathe' ? 0.05 + 0.95 * (Math.sin(phase * Math.PI * 2) + 1) / 2 : settings.effect === 'pulse' ? 0.1 + 0.9 * Math.pow((Math.sin(phase * Math.PI * 2) + 1) / 2, 3) : 1;
    const progress = (phase % 1 + 1) % 1;
    const distance = (progress - index / Math.max(count, 1) + 1) % 1;
    const beam = 1 - Math.abs(progress * 2 - 1);
    const motion = settings.effect === 'comet' && count > 1 ? Math.pow(Math.max(0, 1 - distance / 0.28), 2)
      : settings.effect === 'scanner' && count > 1 ? Math.max(0, 1 - Math.abs(index / (count - 1) - beam) / Math.max(0.16, 1 / (count - 1)))
        : settings.effect === 'sparkle' ? Math.pow((Math.sin((phase + index * 0.61803398875) * Math.PI * 2) + 1) / 2, 8) : 1;
    return Object.fromEntries(Object.entries(color).map(([k, v]) => [k, Math.round(v * factor * pulse * motion)]));
  });
}
const DISCOVERY_STAGES = [1500, 1500, 3000, 6000, 15000, 30000, 60000];
class Hardware extends EventEmitter {
  constructor(store, options = {}) {
    super(); this.store = store; this.port = options.port || 6743;
    this.now = options.now || (() => performance.now());
    this.operationTimeout = options.operationTimeout || 4000;
    // SDK 0.6.0 cannot parse newer zone flag bits. Protocol 4 retains colors,
    // native modes, brightness, matrices and segments without that broken parser.
    this.makeClient = options.makeClient || (() => new Client('Nexus RGB', this.port, '127.0.0.1', { forceProtocolVersion: 4 }));
    this.devices = []; this.output = new Map(); this.client = null; this.connected = false; this.busy = false; this.stopped = true;
    this.modes = new Map(); this.applied = new Map(); this.animations = new Map(); this.powerKnown = new Map(); this.powerRamps = new Map();
    this.error = 'Aguardando o controlador RGB.'; this.nextDiscovery = 0; this.discoveryStage = 0; this.discoverySignature = ''; this.discoveryMs = 0; this.retry = 1000; this.dirty = true;
    this.generation = 0; this.activeTimers = new Set(); this.activeOperations = new Set(); this.opSeq = 0;
    this.lastFailure = null; this.failureHistory = [];
    this.consecutiveDescriptionHangs = 0; this.controllerHung = false; this.sharedAnimations = new Map();
    this.lastSentColors = new Map(); this.ramLastSentTime = new Map(); this.hasDroppedFrame = false; this.tickPending = false; this.tickPendingSpatial = false; this.deferredFromSpatial = new Set();
    this.metrics = { framesCalculated: 0, framesSent: 0, framesDeduplicated: 0, framesDroppedTransport: 0, framesThrottledRam: 0 };
    this.controllerRegistry = options.controllerRegistry || new ControllerRegistry({ store: this.store });
    if (this.controllerRegistry.getDevices().length > 0) {
      this.devices = [...this.controllerRegistry.getDevices()];
    }
    this.nativePending = new Map();
  }
  hasNativeControllers() {
    return Boolean(this.controllerRegistry && this.controllerRegistry.getDevices().length > 0);
  }
  cancelOperations(reason, generation = null, client = null) {
    const err = reason instanceof Error ? reason : new Error(reason || 'Operação cancelada.');
    if (!err.code) err.code = 'ECANCELLED';
    err.cancelled = true;
    for (const op of Array.from(this.activeOperations)) {
      if ((generation === null || op.generation === generation) &&
          (client === null || op.client === client)) {
        op.cancel(err);
      }
    }
  }
  recordFailure(err) {
    if (this.stopped || err.code === 'ECANCELLED') return;
    const generation = Number.isInteger(err.generation) ? err.generation : this.generation;
    if (generation !== this.generation) return;
    const code = err.code || 'controller-error';
    const phase = err.phase || 'unknown';
    const controllerIndex = Number.isInteger(err.controllerIndex) ? err.controllerIndex : null;
    const timeoutMs = Number.isInteger(err.timeoutMs) ? err.timeoutMs : null;
    const message = err.message || 'Falha no controlador RGB.';
    const now = Date.now();
    if (this.lastFailure && this.lastFailure.code === code && this.lastFailure.phase === phase && this.lastFailure.controllerIndex === controllerIndex) {
      this.lastFailure.lastOccurredAt = now;
      this.lastFailure.count = (this.lastFailure.count || 1) + 1;
      this.lastFailure.generation = generation;
      this.lastFailure.message = message;
    } else {
      this.lastFailure = { code, phase, timeoutMs, controllerIndex, generation, message, firstOccurredAt: now, lastOccurredAt: now, count: 1 };
      if (!this.failureHistory) this.failureHistory = [];
      this.failureHistory.push({ ...this.lastFailure });
      if (this.failureHistory.length > 5) this.failureHistory.shift();
    }
    if (phase === 'controller-description' && code === 'ETIMEDOUT') {
      this.consecutiveDescriptionHangs = (this.consecutiveDescriptionHangs || 0) + 1;
      if (this.consecutiveDescriptionHangs >= 3) {
        this.controllerHung = true;
      }
    } else if (phase === 'connect' || code === 'ECONNREFUSED' || code === 'EADDRNOTAVAIL') {
      this.consecutiveDescriptionHangs = 0;
    }
  }
  async operation(promise, timeout = this.operationTimeout, options = {}) {
    if (typeof timeout === 'object' && timeout !== null) {
      options = timeout;
      timeout = options.timeout || this.operationTimeout;
    }
    const opClient = options.client || this.client;
    const opGen = options.generation ?? this.generation;
    const phase = options.phase || 'unknown';
    const controllerIndex = options.controllerIndex ?? null;

    if (options.generation !== undefined && options.generation !== this.generation) {
      const err = new Error('Operação cancelada: geração substituída.');
      err.code = 'ECANCELLED';
      err.cancelled = true;
      throw err;
    }
    if (this.stopped && this.generation > 0) {
      const err = new Error('Operação cancelada: hardware encerrado.');
      err.code = 'ECANCELLED';
      err.cancelled = true;
      throw err;
    }

    if (promise && typeof promise.catch === 'function') {
      // Prevent late rejections from escaping unhandled
      promise.catch(() => {});
    }

    const op = {
      id: ++this.opSeq,
      client: opClient,
      generation: opGen,
      phase,
      controllerIndex,
      timeoutMs: timeout,
      timer: null,
      cancel: null,
      settled: false
    };

    let timer;
    try {
      this.activeOperations.add(op);
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          op.cancel = cancelErr => {
            if (op.settled) return;
            op.settled = true;
            if (timer) {
              clearTimeout(timer);
              this.activeTimers.delete(timer);
            }
            reject(cancelErr);
          };

          timer = setTimeout(() => {
            this.activeTimers.delete(timer);
            if (op.settled) return;
            op.settled = true;

            try { opClient?.socket?.destroy(); } catch {}

            const isDesc = phase === 'controller-description';
            const msg = isDesc ? 'OpenRGB não respondeu ao consultar um componente.' : 'O controlador RGB não respondeu.';
            const err = new Error(msg);
            err.code = 'ETIMEDOUT';
            err.phase = phase;
            err.controllerIndex = controllerIndex;
            err.generation = opGen;
            err.timeoutMs = timeout;

            const isCurrentGen = !this.stopped && opGen === this.generation && (!this.client || opClient === this.client);
            if (isCurrentGen) {
              this.recordFailure(err);
            }
            reject(err);
          }, timeout);

          op.timer = timer;
          this.activeTimers.add(timer);
        })
      ]);
    } finally {
      op.settled = true;
      if (timer) {
        clearTimeout(timer);
        this.activeTimers.delete(timer);
      }
      this.activeOperations.delete(op);
    }
  }
  async connect() {
    if (this.stopped || this.busy) return;
    this.busy = true;
    const prevClient = this.client;
    try { prevClient?.socket?.destroy(); } catch {}
    const gen = ++this.generation;
    this.cancelOperations(new Error('Conexão substituída por uma nova geração.'));
    for (const timer of this.activeTimers) clearTimeout(timer);
    this.activeTimers.clear();
    this.lastSentColors.clear();
    this.ramLastSentTime.clear();
    this.hasDroppedFrame = false;
    this.tickPending = false;
    this.tickPendingSpatial = false;
    this.deferredFromSpatial.clear();
    if (this.controllerRegistry) {
      try {
        if (typeof this.controllerRegistry.autoDetectHardware === 'function') {
          await this.controllerRegistry.autoDetectHardware();
        }
        this.devices = this.devices.filter(d => !d.nativeController);
        for (const nativeDev of this.controllerRegistry.getDevices()) {
          if (!this.devices.some(d => d.id === nativeDev.id)) {
            this.devices.push(nativeDev);
          }
        }
      } catch {}
    }
    if (this.stopped || this.generation !== gen) { this.busy = false; return; }
    const client = this.makeClient(); this.client = client;
    client.on('error', error => { if (this.client === client && this.generation === gen && !this.stopped) this.lost(error, client, gen); });
    client.on('disconnect', () => { if (this.client === client && this.generation === gen && !this.stopped) this.lost(new Error('Controlador desconectado.'), client, gen); });
    client.on('deviceListUpdated', () => {
      if (this.client === client && this.generation === gen && !this.stopped) {
        this.discoveryStage = 0;
        this.nextDiscovery = 0;
        this.dirty = true;
      }
    });
    try {
      await this.operation(client.connect(2500), this.operationTimeout, { phase: 'connect', client, generation: gen });
      if (this.stopped || this.generation !== gen) { client.socket?.destroy(); return; }
      if (client.socket && typeof client.socket.on === 'function') {
        client.socket.on('drain', () => {
          if (this.client === client && this.generation === gen && !this.stopped && this.hasDroppedFrame && !this.busy) {
            this.tick().catch(error => this.lost(error));
          }
        });
      }
      this.modes.clear(); this.applied.clear(); this.powerKnown.clear(); this.powerRamps.clear(); this.discoveryStage = 0; this.discoverySignature = '';
      await this.discover(gen);
      if (this.generation !== gen || this.stopped) return;
      this.connected = true; this.lostAt = null;
      this.retry = 1000; this.error = null; this.dirty = true;
      this.consecutiveDescriptionHangs = 0;
      this.controllerHung = false;
      this.lastFailure = null;
    } catch (error) {
      if (this.generation === gen && !this.stopped) {
        this.connected = false;
        this.error = error.message;
        if (!this.lastFailure || this.lastFailure.generation !== gen) {
          const err = error.code ? error : Object.assign(error, { phase: 'connect', code: error.code || 'connect-failed', generation: gen });
          this.recordFailure(err);
        }
      }
      client.socket?.destroy();
    } finally {
      if (this.generation === gen) {
        this.busy = false; this.emit('change');
        if (!this.connected && !this.stopped) this.scheduleReconnect();
      } else if (this.stopped) {
        this.busy = false;
      }
    }
  }
  scheduleReconnect() {
    if (this.reconnect || this.stopped) return;
    this.reconnect = setTimeout(() => { this.reconnect = null; this.connect(); }, this.retry);
    this.retry = Math.min(this.retry * 2, 30000);
  }
  lost(error, client = null, generation = null) {
    const opGen = generation ?? this.generation;
    if (this.stopped || opGen !== this.generation) return;
    if (client && this.client && client !== this.client) return;
    this.cancelIdentification();
    this.connected = false; this.lostAt = Date.now();
    this.lastSentColors.clear();
    this.ramLastSentTime.clear();
    this.hasDroppedFrame = false;
    this.tickPending = false;
    this.tickPendingSpatial = false;
    this.deferredFromSpatial.clear();
    this.cancelOperations(new Error('Controlador desconectado.'), opGen, client);
    const isGenericDisconnect = error?.message === 'Controlador desconectado.';
    const hasSpecificFailure = this.lastFailure && this.lastFailure.generation === this.generation && this.error && !this.error.includes('Aguardando');
    if (!isGenericDisconnect || !hasSpecificFailure) {
      this.error = error?.message || 'Controlador desconectado.';
      if (error && (!this.lastFailure || this.lastFailure.generation !== this.generation)) {
        this.recordFailure(error);
      }
    }
    this.modes.clear(); this.powerKnown.clear(); this.powerRamps.clear(); this.discoveryStage = 0; this.discoverySignature = ''; this.emit('change');
    if (!this.busy) this.scheduleReconnect();
  }
  get detecting() { return Boolean(!this.stopped && this.connected && this.discoveryStage < (this.devices.length ? 1 : 3)); }
  async discover(expectedGen = this.generation) {
    const currentGen = expectedGen;
    const client = this.client;
    if (this.generation !== currentGen || !client || this.stopped) return;
    const started = performance.now(), wasDetecting = this.detecting;
    const count = await this.operation(client.getControllerCount(), this.operationTimeout, { phase: 'controller-count', client, generation: currentGen });
    if (this.generation !== currentGen || this.stopped) return;
    if (count > 128) throw new Error('Quantidade de controladores acima do limite.');
    const devices = []; const seen = new Map(); let leds = 0;
    for (let i = 0; i < count; i++) {
      if (this.generation !== currentGen || this.stopped) return;
      let raw = await this.operation(client.getControllerData(i), this.operationTimeout, { phase: 'controller-description', controllerIndex: i, client, generation: currentGen });
      if (this.generation !== currentGen || this.stopped) return;
      const basic = identity(raw); const duplicate = seen.get(basic) || 0; seen.set(basic, duplicate + 1);
      const id = identity(raw, duplicate);
      let restoredZone = false;
      for (const zone of raw.zones) {
        const saved = this.store.data.zones?.[id]?.[zone.id];
        if (zone.resizable && Number.isInteger(saved) && saved >= zone.ledsMin && saved <= Math.min(4096, zone.ledsMax) && saved !== zone.ledsCount) { client.resizeZone(i, zone.id, saved); restoredZone = true; }
      }
      if (restoredZone) {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (this.generation !== currentGen || this.stopped) return;
        raw = await this.operation(client.getControllerData(i), this.operationTimeout, { phase: 'controller-description', controllerIndex: i, client, generation: currentGen });
        if (this.generation !== currentGen || this.stopped) return;
      }
      const direct = raw.modes.find(m => /^direct$/i.test(m.name) && m.flagList.includes('perLedColor'));
      const fixed = direct || raw.modes.find(m => /static|solid|fixed/i.test(m.name) && (m.flagList.includes('perLedColor') || m.flagList.includes('modeSpecificColor')));
      const off = raw.modes.find(m => /^(off|disabled|blackout)$/i.test(m.name));
      const ledCount = raw.colors.length;
      leds += ledCount; if (ledCount > 4096 || leds > 32768) throw new Error('Quantidade de LEDs acima do limite seguro.');
      const busType = detectBusArchitecture(raw);
      const devType = classifyDeviceType(raw);
      const device = { id, sdkId: i, name: raw.name, vendor: raw.vendor || '', type: devType, busType, ledCount, raw, direct, fixed, off, error: null,
        effects: direct ? effects : fixed ? ['static'] : [],
        modes: raw.modes.map(m => ({ id: m.id, name: m.name })),
        zones: raw.zones.map(z => ({ id: z.id, name: z.name, leds: z.ledsCount, min: z.ledsMin, max: Math.min(4096, z.ledsMax), resizable: z.resizable })) };
      device.components = components(device); devices.push(device);
    }
    if (this.controllerRegistry) {
      {
        try {
          if (typeof this.controllerRegistry.autoDetectHardware === 'function') {
            await this.controllerRegistry.autoDetectHardware();
          }
        } catch {
          // Non-blocking auto-detect
        }
      }
      for (const nativeDev of this.controllerRegistry.getDevices()) {
        devices.push(nativeDev);
        leds += nativeDev.ledCount;
      }
    }
    if (this.generation !== currentGen || this.stopped) return;
    const present = new Set(devices.map(device => device.id));
    for (const id of this.modes.keys()) if (!present.has(id)) { this.modes.delete(id); this.applied.delete(id); }
    for (const id of this.lastSentColors.keys()) if (!present.has(id)) this.lastSentColors.delete(id);
    for (const device of devices) {
      const prev = this.devices.find(d => d.id === device.id);
      if (prev && prev.sdkId !== device.sdkId) {
        this.applied.delete(device.id);
        this.lastSentColors.delete(device.id);
      }
    }
    const channels = new Set(devices.flatMap(device => (device.components || [device]).map(component => component.id)));
    for (const id of this.animations.keys()) if (!channels.has(id)) this.animations.delete(id);
    for (const id of this.output.keys()) if (!channels.has(id)) this.output.delete(id);
    for (const id of this.powerKnown.keys()) if (!channels.has(id)) { this.powerKnown.delete(id); this.powerRamps.delete(id); }
    const signature = JSON.stringify(devices.map(d => [d.id, d.sdkId, d.name, d.vendor, d.type, d.ledCount, d.modes, d.zones, d.components?.map(c => [c.id, c.name, c.kind, c.zoneId, c.ledCount, c.offset])]));
    const changed = signature !== this.discoverySignature;
    this.discoverySignature = signature;
    // The first detected controller does not mean OpenRGB finished scanning.
    // Probe in gradual stages after changes, then back off to bounded recovery.
    this.discoveryStage = changed ? 0 : Math.min(this.discoveryStage + 1, DISCOVERY_STAGES.length - 1);
    this.devices = devices; this.discoveryMs = Math.round((performance.now() - started) * 100) / 100;
    this.nextDiscovery = Date.now() + DISCOVERY_STAGES[this.discoveryStage];
    if (changed) this.dirty = true;
    if (changed || wasDetecting !== this.detecting) this.emit('change');
  }
  canSmoothPower(id, settings, direct = true, checkStudio = true) {
    if (!direct) return false;
    if (settings.nativeMode === undefined) return true;
    return Boolean(checkStudio && this.studio?.hasDevice(id));
  }
  isPowerTransitioning(id) {
    return this.powerRamps.has(id);
  }
  powerMultiplier(id, settingsPower, canSmooth = true, now = this.now()) {
    const targetPower = Boolean(settingsPower);
    const configuredMs = Number(this.store.data.performance?.powerTransitionMs) || 0;
    const fullDuration = canSmooth && configuredMs >= 200 ? configuredMs : 0;
    if (!this.powerKnown.has(id)) {
      this.powerKnown.set(id, targetPower);
      this.powerRamps.delete(id);
      return targetPower ? 1 : 0;
    }
    let current = this.powerKnown.get(id) ? 1 : 0;
    if (this.powerRamps.has(id)) {
      const ramp = this.powerRamps.get(id);
      const p = ramp.duration > 0 ? Math.min(1, Math.max(0, (now - ramp.startedAt) / ramp.duration)) : 1;
      current = ramp.from + (ramp.to - ramp.from) * p;
    }
    if (this.powerKnown.get(id) !== targetPower) {
      this.powerKnown.set(id, targetPower);
      const to = targetPower ? 1 : 0;
      const distance = Math.abs(to - current);
      if (fullDuration <= 0 || distance <= 0.001) {
        this.powerRamps.delete(id);
        return to;
      }
      this.powerRamps.set(id, {
        from: current,
        to,
        startedAt: now,
        duration: Math.max(1, Math.round(fullDuration * distance))
      });
      return current;
    }
    if (this.powerRamps.has(id)) {
      const ramp = this.powerRamps.get(id);
      if (fullDuration <= 0) {
        this.powerRamps.delete(id);
        return ramp.to;
      }
      const p = ramp.duration > 0 ? Math.min(1, Math.max(0, (now - ramp.startedAt) / ramp.duration)) : 1;
      if (p >= 1) {
        this.powerRamps.delete(id);
        return ramp.to;
      }
      return ramp.from + (ramp.to - ramp.from) * p;
    }
    return targetPower ? 1 : 0;
  }
  snapshot() {
    const excluded = new Set(this.studio ? (this.studio.config.excluded || []) : (this.store.data.studio?.excluded || Object.entries(this.store.data.devices || {}).filter(([, d]) => d && ('color' in d || 'effect' in d || 'nativeMode' in d)).map(([k]) => k)));
    const transitionMs = this.store.data.performance?.powerTransitionMs || 0;
    const studioActive = Boolean(this.studio?.config.enabled && !this.studio?.error);
    const lastFailure = this.lastFailure ? {
      code: this.lastFailure.code,
      phase: this.lastFailure.phase,
      timeoutMs: this.lastFailure.timeoutMs,
      controllerIndex: this.lastFailure.controllerIndex,
      generation: this.lastFailure.generation,
      firstOccurredAt: this.lastFailure.firstOccurredAt,
      lastOccurredAt: this.lastFailure.lastOccurredAt,
      count: this.lastFailure.count
    } : null;
    const hasNative = this.hasNativeControllers();
    const effectiveDevices = [...this.devices];
    if (this.controllerRegistry) {
      for (const d of this.controllerRegistry.getDevices()) {
        if (!effectiveDevices.some(existing => existing.id === d.id)) {
          effectiveDevices.push(d);
        }
      }
    }
    return {
      connected: Boolean(this.connected || (hasNative && this.controllerRegistry.getDevices().some(d => this.controllerRegistry.isConnected(d.id)))),
      detecting: this.detecting,
      error: this.error,
      controllerCount: effectiveDevices.length,
      controllerHung: Boolean(this.controllerHung),
      busTypes: Array.from(new Set(effectiveDevices.map(d => d.busType).filter(Boolean))),
      nativeControllers: this.controllerRegistry ? this.controllerRegistry.getSummary() : [],
      nativeError: this.controllerRegistry?.discoveryError || null,
      lastFailure,
      metrics: {
        framesCalculated: this.metrics.framesCalculated,
        framesSent: this.metrics.framesSent,
        framesDeduplicated: this.metrics.framesDeduplicated,
        framesDroppedTransport: this.metrics.framesDroppedTransport,
        framesThrottledRam: this.metrics.framesThrottledRam || 0
      },
      devices: effectiveDevices.flatMap(({ raw, direct, fixed, off, sdkId, components: channels, ...device }) => (channels || [device]).map(channel => {
        const { offset, ...component } = channel;
        const settings = this.settings(component.id, !!channels);
        const smoothPowerCapable = Boolean(direct && (settings.nativeMode === undefined || (studioActive && !excluded.has(component.id))));
        const isSinglePiece = !channels || (channels.length === 1 && (channel.type === 5 || channel.type === 6));
        return {
          ...device,
          ...component,
          ...(channels && !isSinglePiece ? { modes: [], splitZone: true } : {}),
          status: device.error ? 'error' : (device.nativeController ? this.controllerRegistry.isConnected(device.id) : this.connected) ? 'online' : 'offline',
          stale: !(device.nativeController ? this.controllerRegistry.isConnected(device.id) : this.connected),
          customized: Object.hasOwn(this.store.data.devices, component.id),
          mapExcluded: excluded.has(component.id),
          spatialCapable: Boolean(direct),
          smoothPowerCapable,
          rateLimited: isSmbusRam(device),
          powerTransitionFallback: Boolean(transitionMs >= 200 && !smoothPowerCapable),
          settings
        };
      }))
    };
  }
  settings(id, splitZone = false) {
    const settings = { ...this.store.data.master, ...(this.store.data.devices[id] || {}) };
    settings.power = this.store.data.master.power && settings.power;
    if (splitZone && !this.devices.some(d => d.id === id && d.type === 5 && d.components?.length === 1)) delete settings.nativeMode;
    return settings;
  }
  changed() { this.dirty = true; }
  transition(duration) {
    if(!duration){this.transitionState=null;this.changed();return;}
    const from=new Map();for(const [id,output]of this.output)if(output.colors&&output.source!=='native'&&output.source!=='identify')from.set(id,output.colors.map(c=>({...c})));
    this.transitionState=duration>0&&from.size?{from,started:performance.now(),duration}:null;this.changed();
  }
  blend(id,colors,settings) {
    const state=this.transitionState,from=state?.from.get(id);if(!state||!from||!settings.power)return colors;
    const amount=Math.min(1,Math.max(0,(performance.now()-state.started)/state.duration));
    return colors.map((color,index)=>{const old=from[index]||color;return {red:Math.round(old.red+(color.red-old.red)*amount),green:Math.round(old.green+(color.green-old.green)*amount),blue:Math.round(old.blue+(color.blue-old.blue)*amount)};});
  }
  cancelIdentification(id) {
    if (!this.identification || id && this.identification.id !== id) return;
    const parent = this.devices.find(d => d.id === this.identification.id || d.components?.some(c => c.id === this.identification.id));
    this.identification = null; clearTimeout(this.identifyTimer);
    if (parent) {
      this.applied.delete(parent.id);
      this.lastSentColors.delete(parent.id);
    }
    this.changed();
  }
  identify(id, led, stop = false) {
    if (stop) { this.cancelIdentification(id); return; }
    const parent = this.devices.find(d => d.id === id || d.components?.some(c => c.id === id)), component = parent?.components?.find(c => c.id === id) || parent;
    if (!parent?.direct || !this.connected || !component) throw Error('Este componente não está disponível para identificação por LED.');
    if (led !== undefined && (!Number.isInteger(led) || led < 0 || led >= component.ledCount)) throw Error('LED de identificação fora da faixa do componente.');
    {
      this.cancelIdentification();
      clearTimeout(this.identifyTimer);
      const selection = this.identification = {id,led:led ?? null,until:Date.now()+3000};
      this.identifyTimer = setTimeout(() => { if (this.identification === selection) { this.identification = null; this.applied.delete(parent.id); this.lastSentColors.delete(parent.id); this.changed(); } },3000);
      this.identifyTimer.unref?.();
    }
    this.applied.delete(parent.id);
    this.lastSentColors.delete(parent.id);
    this.changed();
  }
  rememberOutput(id, colors, settings) {
    const activePower = Boolean(settings.power || this.powerRamps.has(id));
    this.output.set(id, { colors, at: Date.now(), source: this.identification?.id === id ? 'identify' : !activePower ? 'off' : settings.nativeMode !== undefined ? 'native' : this.studio?.hasDevice(id) ? 'map' : 'software' });
  }
  outputFor(id) { return this.connected ? this.output.get(id) : null; }
  renderFrame(id, settings, count, seconds, now = this.now()) {
    if (this.identification?.id === id) return Array.from({length:count},(_,n) => ({red:0,green:this.identification.led === null || this.identification.led === n ? 64 : 0,blue:this.identification.led === null || this.identification.led === n ? 64 : 0}));
    const parent = this.devices.find(d => d.id === id || d.components?.some(c => c.id === id));
    const canSmooth = this.canSmoothPower(id, settings, !parent || !!parent.direct) && settings.brightness > 0;
    const mult = this.powerMultiplier(id, settings.power, canSmooth, now);
    if (mult <= 0) {
      return Array.from({ length: count }, () => ({ red: 0, green: 0, blue: 0 }));
    }
    const effective = settings.power ? settings : { ...settings, power: true };
    const spatial = this.studio?.colorsFor(id, effective, count);
    const base = spatial
      ? this.blend(id, spatial, effective)
      : (() => {
          const signature = JSON.stringify([effective.effect, effective.color, effective.palette, true]);
          let animation = this.sharedAnimations.get(signature);
          if (!animation) {
            animation = { startedAt: seconds };
            this.sharedAnimations.set(signature, animation);
            if (this.sharedAnimations.size > 32) {
              const oldest = this.sharedAnimations.keys().next().value;
              this.sharedAnimations.delete(oldest);
            }
          }
          return this.blend(id, frame(effective, count, Math.max(0, seconds - animation.startedAt)), effective);
        })();
    if (mult >= 1) return base;
    return base.map(c => ({ red: Math.round(c.red * mult), green: Math.round(c.green * mult), blue: Math.round(c.blue * mult) }));
  }
  async applyMode(device, mode, settings, perLedColors = false) {
    if (device.nativeController) return;
    const config = { ...mode };
    if (mode.flagList.includes('brightness')) config.brightness = perLedColors ? mode.brightnessMax : Math.round(mode.brightnessMin + (mode.brightnessMax - mode.brightnessMin) * (settings.power ? settings.brightness / 100 : 0));
    if (mode.flagList.includes('speed')) config.speed = perLedColors ? mode.speedMin : Math.round(mode.speedMin + (mode.speedMax - mode.speedMin) * settings.speed / 100);
    if (!perLedColors && mode.flagList.includes('modeSpecificColor')) config.colors = Array.from({ length: Math.max(mode.colors.length, mode.colorMin, 1) }, () => frame({ ...settings, brightness: mode.flagList.includes('brightness') ? 100 : settings.brightness, effect: 'static' }, 1, 0)[0]);
    const signature = JSON.stringify({ id: config.id, brightness: mode.flagList.includes('brightness') ? config.brightness : undefined, speed: mode.flagList.includes('speed') ? config.speed : undefined, direction: config.direction, colorMode: config.colorMode, colors: !perLedColors && mode.flagList.includes('modeSpecificColor') ? config.colors : undefined });
    if (this.modes.get(device.id) !== signature) {
      await this.operation(this.client.updateMode(device.sdkId, config), this.operationTimeout, { phase: 'mode', controllerIndex: device.sdkId, client: this.client, generation: this.generation });
      this.modes.set(device.id, signature);
      this.lastSentColors.delete(device.id);
    }
  }
  sendLeds(device, colors, isPowerOff = false, forceSend = false) {
    this.metrics.framesCalculated++;
    const id = device.id;
    const last = this.lastSentColors.get(id);

    // 1. Color deduplication: skip identical colors for this controller when no explicit change was requested
    if (!forceSend && last && colorsEqual(last, colors)) {
      this.metrics.framesDeduplicated++;
      return false;
    }

    // Native USB-HID controllers (Lian Li Uni Hub, NZXT Kraken, etc.)
    if (device.nativeController) {
      const pending = this.nativePending.get(id);
      if (pending) { pending.refresh = true; return false; }
      const generation = this.generation;
      const oldError = device.error;
      const delivery = { refresh: false }; this.nativePending.set(id, delivery);
      this.controllerRegistry.sendLeds(device.id, colors, isPowerOff).then(sent => {
        if (this.stopped || generation !== this.generation || this.nativePending.get(id) !== delivery) return;
        this.nativePending.delete(id);
        if (!sent) { this.applied.delete(id); this.lastSentColors.delete(id); }
        else {
          this.metrics.framesSent++;
          this.hasDroppedFrame = false;
          this.lastSentColors.set(id, colors.map(c => ({ red: c.red, green: c.green, blue: c.blue })));
        }
        if (!sent || delivery.refresh) { this.applied.delete(id); this.changed(); }
        if (sent || oldError !== device.error) this.emit('change');
      });
      return false; // Completion is reported by the acknowledgement, never by queue acceptance.
    }

    // 2. Safe rate limit for SMBus / RAM controllers (fixed 20 FPS = minimum ~46 ms between physical writes)
    // Flooding SMBus controllers with 60 FPS writes causes bus saturation, I2C collision with motherboard sensors, and OpenRGB hangs.
    // Power-off frames and manual identification are never throttled so state changes take effect immediately.
    if (!isPowerOff && !this.identification && isSmbusRam(device)) {
      const now = this.now();
      const lastSent = this.ramLastSentTime.get(id);
      if (lastSent !== undefined && (now - lastSent) < 46) {
        this.metrics.framesThrottledRam = (this.metrics.framesThrottledRam || 0) + 1;
        return false;
      }
    }

    // 3. Transport backpressure:
    // socket.writableLength measures queued bytes waiting in local Node stream buffer to reach OS kernel.
    // Note: writableLength > 0 indicates local transport delay, not physical bus/OpenRGB completion.
    const socket = this.client?.socket;
    const isBacklogged = Boolean(socket && typeof socket.writableLength === 'number' && socket.writableLength > 2048);

    if (isBacklogged && !isPowerOff) {
      this.metrics.framesDroppedTransport++;
      this.hasDroppedFrame = true;
      return false;
    }

    // 4. Send to SDK client
    this.client.updateLeds(device.sdkId, colors);
    this.metrics.framesSent++;
    this.hasDroppedFrame = false;
    this.lastSentColors.set(id, colors.map(c => ({ red: c.red, green: c.green, blue: c.blue })));
    if (isSmbusRam(device)) {
      this.ramLastSentTime.set(id, this.now());
    }
    return true;
  }
  async tick(spatialFrame = false) {
    if (this.stopped || (!this.connected && !this.hasNativeControllers())) return;
    if (this.busy) {
      this.tickPending = true;
      if (spatialFrame) this.tickPendingSpatial = true;
      return;
    }
    if (this.identification && Date.now() >= this.identification.until) this.cancelIdentification();
    const animated = this.devices.some(d => (d.components || [d]).some(component => {
      const s = this.settings(component.id, !!d.components);
      const canSmooth = this.canSmoothPower(component.id, s, !!d.direct) && s.brightness > 0;
      const powerChanged = this.powerKnown.has(component.id) && this.powerKnown.get(component.id) !== Boolean(s.power);
      return this.powerRamps.has(component.id) || (canSmooth && powerChanged) || (s.power && canSmooth && (this.transitionState?.from.has(component.id) || !this.studio?.hasDevice(component.id) && s.effect !== 'static'));
    }));
    if (!this.dirty && !animated && Date.now() < this.nextDiscovery) return;
    this.busy = true; let changedErrors = false;
    try {
      if ((this.client?.socket?.writableLength || 0) > 512 * 1024) throw new Error('Controlador RGB está demorando a processar os comandos.');
      if (this.client && Date.now() >= this.nextDiscovery) {
        const socketBacklogged = Boolean(this.client?.socket && typeof this.client.socket.writableLength === 'number' && this.client.socket.writableLength > 0);
        if (socketBacklogged) {
          this.nextDiscovery = Date.now() + 500;
        } else {
          await this.discover();
        }
      }
      this.dirty = false;
      const tickNow = this.now(), seconds = tickNow / 1000;
      for (const d of this.devices) {
        if (d.nativeController && d.controllerType === 'keyboard') {
          const settings = this.settings(d.id, true), signature = JSON.stringify(settings);
          if (this.applied.get(d.id) === signature && !d.error && (this.nativePending.has(d.id) || this.controllerRegistry.isConnected(d.id))) continue;
          this.sendLeds(d, [], !settings.power, true);
          this.applied.set(d.id, signature);
          continue;
        }
        const channels = d.components || [d];
        for (const component of channels) {
          if (this.identification?.id === component.id) continue;
          const s = this.settings(component.id, !!d.components);
          this.powerMultiplier(component.id, s.power, this.canSmoothPower(component.id, s, !!d.direct) && s.brightness > 0, tickNow);
        }
        const signature = JSON.stringify(channels.map(component => {
          const s = this.settings(component.id, !!d.components);
          const identify = this.identification?.id === component.id ? this.identification : null;
          const powerRamp = this.powerRamps.has(component.id);
          const lit = Boolean(identify || powerRamp || (s.power && (s.brightness > 0 || s.nativeMode !== undefined)));
          return lit
            ? { id: component.id, count: component.ledCount, ...s, identify, powerRamp, spatial: !identify && this.studio?.hasDevice(component.id) ? this.studio.revision : null }
            : { id: component.id, count: component.ledCount, lit: false, power: Boolean(s.power) };
        }));
        const changed = this.applied.get(d.id) !== signature;
        const animation = channels.some(component => {
          const s = this.settings(component.id, !!d.components);
          const canSmooth = this.canSmoothPower(component.id, s, !!d.direct) && s.brightness > 0;
          return this.powerRamps.has(component.id) || (s.power && canSmooth && (this.transitionState?.from.has(component.id) || !spatialFrame && !this.studio?.hasDevice(component.id) && s.effect !== 'static'));
        });
        if (!changed && !animation) {
          if (spatialFrame && !channels.some(c => this.studio?.hasDevice(c.id))) {
            this.deferredFromSpatial.add(d.id);
          }
          continue;
        }
        const deferred = !spatialFrame && this.deferredFromSpatial.delete(d.id);
        const forceSend = (changed && !spatialFrame) || deferred;
        if (d.components) {
          const oldError = d.error;
          const colors = Array(d.ledCount);
          for (const component of d.components) {
            const zoneColors = this.renderFrame(component.id, this.settings(component.id, true), component.ledCount, seconds, tickNow);
            for (let index = 0; index < zoneColors.length; index++) colors[component.offset + index] = zoneColors[index];
          }
          const allOff = d.components.every(component => {
            if (this.identification?.id === component.id || this.powerRamps.has(component.id)) return false;
            const s = this.settings(component.id, true);
            return !s.power || s.brightness === 0;
          });
          if (allOff && d.off) {
            await this.sendLeds(d, colors, true, forceSend);
            await this.applyMode(d, d.off, { ...this.store.data.master, power: false }, false);
          } else {
            // One Direct mode; independent brightness stays in each zone's colors.
            await this.applyMode(d, d.direct, { ...this.store.data.master, power: true }, true);
            await this.sendLeds(d, colors, allOff, forceSend);
          }
          if (d.nativeController && d.error) { changedErrors = true; continue; }
          d.error = null; this.applied.set(d.id, signature);
          for (const component of d.components) this.rememberOutput(component.id, colors.slice(component.offset, component.offset + component.ledCount), this.settings(component.id, true));
          if (oldError !== d.error) changedErrors = true;
          continue;
        }
        const settings = { ...this.settings(d.id) };
        const identifying = this.identification?.id === d.id;
        const fading = this.powerRamps.has(d.id);
        if (identifying) { settings.power = true; delete settings.nativeMode; }
        if (this.studio?.hasDevice(d.id)) delete settings.nativeMode;
        const oldError = d.error;
        const activePower = Boolean(settings.power || fading);
        const mode = identifying ? d.direct : !activePower ? (d.off || d.fixed) : settings.nativeMode !== undefined ? d.raw.modes.find(m => m.id === settings.nativeMode) : d.fixed;
        if (!mode) { d.error = 'Este dispositivo não oferece controle de cor compatível.'; }
        else if (activePower && settings.nativeMode === undefined && !d.effects.includes(settings.effect)) { d.error = 'Este efeito não está disponível neste dispositivo.'; }
        else {
          const modeSettings = fading && !settings.power ? { ...settings, power: true } : settings;
          await this.applyMode(d, mode, modeSettings, mode.flagList.includes('perLedColor') && (!activePower || settings.nativeMode === undefined));
          let colors = null;
          if ((!activePower || settings.nativeMode === undefined) && mode.flagList.includes('perLedColor')) {
            colors = this.renderFrame(d.id, settings, d.ledCount, seconds, tickNow);
            await this.sendLeds(d, colors, !activePower, forceSend);
          }
          if (d.nativeController && d.error) { changedErrors = true; continue; }
          if (!activePower && !colors) colors = Array.from({ length: d.ledCount }, () => ({ red: 0, green: 0, blue: 0 }));
          this.rememberOutput(d.id, colors, settings);
          d.error = null; this.applied.set(d.id, signature);
        }
        if (oldError !== d.error) changedErrors = true;
      }
    } catch (error) { this.lost(error); this.client?.socket?.destroy(); }
    finally {
      this.busy = false;
      if (this.transitionState && performance.now() - this.transitionState.started >= this.transitionState.duration) this.transitionState = null;
      if (!this.connected) this.scheduleReconnect();
      if (changedErrors) this.emit('change');
      if (this.tickPending && !this.stopped && this.connected) {
        const nextSpatial = this.tickPendingSpatial;
        this.tickPending = false;
        this.tickPendingSpatial = false;
        setImmediate(() => {
          if (!this.stopped && this.connected) {
            this.tick(nextSpatial).catch(error => this.lost(error));
          }
        });
      }
    }
  }
  async resize(id, zoneId, count) {
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(zoneId) || zoneId < 0 || zoneId > 65535) throw new Error('Tamanho de zona inválido.');
    if (!this.connected || this.busy) throw new Error('Controlador ocupado ou desconectado. Tente novamente.');
    const d = this.devices.find(d => d.id === id || d.components?.some(component => component.id === id));
    const component = d?.components?.find(component => component.id === id);
    const z = d?.zones.find(z => z.id === zoneId && (!component || component.zoneId === zoneId));
    if (!z?.resizable || !Number.isInteger(count) || count < z.min || count > z.max) throw new Error('Tamanho de zona inválido.');
    if (d.ledCount - z.leds + count > 4096) throw new Error('Quantidade de LEDs da controladora acima do limite seguro.');
    if (this.devices.reduce((total, device) => total + device.ledCount, 0) - z.leds + count > 32768) throw new Error('Quantidade total de LEDs acima do limite seguro.');
    this.busy = true;
    const previous = this.store.data.zones?.[d.id]?.[zoneId];
    try {
      // Prevent periodic discovery from restoring the old value during this write.
      if (this.store.data.zones?.[d.id]) delete this.store.data.zones[d.id][zoneId];
      this.client.resizeZone(d.sdkId, zoneId, count); await new Promise(resolve => setTimeout(resolve, 300)); await this.discover();
      this.lastSentColors.delete(d.id);
      if (this.devices.find(device => device.id === d.id)?.zones.find(zone => zone.id === zoneId)?.leds !== count) {
        throw new Error('O controlador não confirmou essa quantidade de LEDs.');
      }
      this.store.zone(d.id, zoneId, count);
    }
    catch (error) { if (previous !== undefined) this.store.data.zones[d.id][zoneId] = previous; throw error; }
    finally { this.busy = false; if (!this.connected) this.scheduleReconnect(); }
  }
  setFps() { clearInterval(this.timer); if (!this.stopped) this.timer = setInterval(() => { this.tick().catch(error => this.lost(error)); }, 1000 / (this.store.data.performance?.fps || 20)); }
  start() { this.stopped = false; this.connect(); this.setFps(); }
  stop() {
    this.stopped = true;
    this.busy = false;
    this.generation++;
    clearInterval(this.timer);
    clearTimeout(this.identifyTimer);
    this.identification = null;
    clearTimeout(this.reconnect);
    this.reconnect = null;
    this.lastSentColors.clear();
    this.ramLastSentTime.clear();
    this.hasDroppedFrame = false;
    this.tickPending = false;
    this.tickPendingSpatial = false;
    this.deferredFromSpatial.clear();
    this.cancelOperations(new Error('Operação cancelada: hardware encerrado.'));
    for (const timer of this.activeTimers) clearTimeout(timer);
    this.activeTimers.clear();
    try { this.client?.socket?.destroy(); } catch {}
    try { this.client?.disconnect(); } catch {}
    this.client = null;
    this.connected = false;
    this.nativePending.clear();
    this.controllerRegistry?.destroy();
  }
}
module.exports = { Hardware, identity, frame, hue, paletteColor, colorsEqual, isSmbusRam, detectBusArchitecture, classifyDeviceType, ControllerRegistry };
