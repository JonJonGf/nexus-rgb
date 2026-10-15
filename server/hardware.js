'use strict';
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const { Client } = require('openrgb-sdk');
const { effects } = require('./store');
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
      zoneId: zone.id, ledCount: zone.ledsCount, offset, zones: device.zones.filter(z => z.id === zone.id) };
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
class Hardware extends EventEmitter {
  constructor(store, options = {}) {
    super(); this.store = store; this.port = options.port || 6743;
    // SDK 0.6.0 cannot parse newer zone flag bits. Protocol 4 retains colors,
    // native modes, brightness, matrices and segments without that broken parser.
    this.makeClient = options.makeClient || (() => new Client('Nexus RGB', this.port, '127.0.0.1', { forceProtocolVersion: 4 }));
    this.devices = []; this.output = new Map(); this.client = null; this.connected = false; this.busy = false; this.stopped = true;
    this.modes = new Map(); this.applied = new Map(); this.animations = new Map(); this.error = 'Aguardando o controlador RGB.'; this.nextDiscovery = 0; this.retry = 1000; this.dirty = true;
  }
  async operation(promise, timeout = 4000) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => { this.client?.socket?.destroy(); reject(new Error('O controlador RGB não respondeu.')); }, timeout); })]); }
    finally { clearTimeout(timer); }
  }
  async connect() {
    if (this.stopped || this.busy) return;
    this.busy = true;
    const client = this.makeClient(); this.client = client;
    client.on('error', error => { if (this.client === client) this.lost(error); }); client.on('disconnect', () => { if (this.client === client) this.lost(new Error('Controlador desconectado.')); });
    client.on('deviceListUpdated', () => { if (this.client === client) { this.nextDiscovery = 0; this.dirty = true; } });
    try {
      await this.operation(client.connect(2500));
      if (this.stopped) { client.socket?.destroy(); return; }
      this.modes.clear(); this.applied.clear(); await this.discover(); this.connected = true;
      this.retry = 1000; this.error = null; this.dirty = true;
    } catch (error) { this.connected = false; this.error = error.message; client.socket?.destroy(); }
    finally {
      this.busy = false; this.emit('change');
      if (!this.connected && !this.stopped) this.scheduleReconnect();
    }
  }
  scheduleReconnect() {
    if (this.reconnect || this.stopped) return;
    this.reconnect = setTimeout(() => { this.reconnect = null; this.connect(); }, this.retry);
    this.retry = Math.min(this.retry * 2, 30000);
  }
  lost(error) {
    this.connected = false; this.error = error.message; this.modes.clear(); this.emit('change');
    if (!this.busy) this.scheduleReconnect();
  }
  async discover() {
    const count = await this.operation(this.client.getControllerCount());
    if (count > 128) throw new Error('Quantidade de controladores acima do limite.');
    const devices = []; const seen = new Map(); let leds = 0;
    for (let i = 0; i < count; i++) {
      let raw = await this.operation(this.client.getControllerData(i));
      const basic = identity(raw); const duplicate = seen.get(basic) || 0; seen.set(basic, duplicate + 1);
      const id = identity(raw, duplicate);
      let restoredZone = false;
      for (const zone of raw.zones) {
        const saved = this.store.data.zones?.[id]?.[zone.id];
        if (zone.resizable && Number.isInteger(saved) && saved >= zone.ledsMin && saved <= Math.min(4096, zone.ledsMax) && saved !== zone.ledsCount) { this.client.resizeZone(i, zone.id, saved); restoredZone = true; }
      }
      if (restoredZone) { await new Promise(resolve => setTimeout(resolve, 200)); raw = await this.operation(this.client.getControllerData(i)); }
      const direct = raw.modes.find(m => /^direct$/i.test(m.name) && m.flagList.includes('perLedColor'));
      const fixed = direct || raw.modes.find(m => /static|solid|fixed/i.test(m.name) && (m.flagList.includes('perLedColor') || m.flagList.includes('modeSpecificColor')));
      const off = raw.modes.find(m => /^(off|disabled|blackout)$/i.test(m.name));
      const ledCount = raw.colors.length;
      leds += ledCount; if (ledCount > 4096 || leds > 32768) throw new Error('Quantidade de LEDs acima do limite seguro.');
      const device = { id, sdkId: i, name: raw.name, vendor: raw.vendor || '', type: raw.type, ledCount, raw, direct, fixed, off, error: null,
        effects: direct ? effects : fixed ? ['static'] : [],
        modes: raw.modes.map(m => ({ id: m.id, name: m.name })),
        zones: raw.zones.map(z => ({ id: z.id, name: z.name, leds: z.ledsCount, min: z.ledsMin, max: Math.min(4096, z.ledsMax), resizable: z.resizable })) };
      device.components = components(device); devices.push(device);
    }
    const present = new Set(devices.map(device => device.id));
    for (const id of this.modes.keys()) if (!present.has(id)) { this.modes.delete(id); this.applied.delete(id); }
    const channels = new Set(devices.flatMap(device => (device.components || [device]).map(component => component.id)));
    for (const id of this.animations.keys()) if (!channels.has(id)) this.animations.delete(id);
    for (const id of this.output.keys()) if (!channels.has(id)) this.output.delete(id);
    // The SDK can open before OpenRGB finishes scanning. Retry an empty list
    // promptly instead of hiding newly detected components for 30 seconds.
    this.devices = devices; this.nextDiscovery = Date.now() + (devices.length ? 30000 : 1500); this.dirty = true; this.emit('change');
  }
  snapshot() {
    return { connected: this.connected, error: this.error, controllerCount: this.devices.length, devices: this.devices.flatMap(({ raw, direct, fixed, off, sdkId, components: channels, ...device }) => (channels || [device]).map(channel => {
      const { offset, ...component } = channel;
      return { ...device, ...component, ...(channels ? { modes: [], splitZone: true } : {}), status: this.connected ? 'online' : 'offline', customized: Object.hasOwn(this.store.data.devices, component.id), settings: this.settings(component.id, !!channels) };
    })) };
  }
  settings(id, splitZone = false) {
    const settings = { ...this.store.data.master, ...(this.store.data.devices[id] || {}) };
    settings.power = this.store.data.master.power && settings.power;
    if (splitZone) delete settings.nativeMode;
    return settings;
  }
  changed() { this.dirty = true; }
  rememberOutput(id, colors, settings) {
    this.output.set(id, { colors, at: Date.now(), source: !settings.power ? 'off' : settings.nativeMode !== undefined ? 'native' : this.studio?.hasDevice(id) ? 'map' : 'software' });
  }
  outputFor(id) { return this.connected ? this.output.get(id) : null; }
  renderFrame(id, settings, count, seconds) {
    const spatial = this.studio?.colorsFor(id, settings, count);
    if (spatial) return spatial;
    const signature = JSON.stringify([settings.effect, settings.color, settings.palette, settings.power]);
    let animation = this.animations.get(id);
    if (!animation || animation.signature !== signature) { animation = { signature, startedAt: seconds }; this.animations.set(id, animation); }
    return frame(settings, count, Math.max(0, seconds - animation.startedAt));
  }
  async applyMode(device, mode, settings, perLedColors = false) {
    const config = { ...mode };
    if (mode.flagList.includes('brightness')) config.brightness = perLedColors ? mode.brightnessMax : Math.round(mode.brightnessMin + (mode.brightnessMax - mode.brightnessMin) * (settings.power ? settings.brightness / 100 : 0));
    if (mode.flagList.includes('speed')) config.speed = perLedColors ? mode.speedMin : Math.round(mode.speedMin + (mode.speedMax - mode.speedMin) * settings.speed / 100);
    if (!perLedColors && mode.flagList.includes('modeSpecificColor')) config.colors = Array.from({ length: Math.max(mode.colors.length, mode.colorMin, 1) }, () => frame({ ...settings, brightness: mode.flagList.includes('brightness') ? 100 : settings.brightness, effect: 'static' }, 1, 0)[0]);
    const signature = JSON.stringify({ id: config.id, brightness: mode.flagList.includes('brightness') ? config.brightness : undefined, speed: mode.flagList.includes('speed') ? config.speed : undefined, direction: config.direction, colorMode: config.colorMode, colors: !perLedColors && mode.flagList.includes('modeSpecificColor') ? config.colors : undefined });
    if (this.modes.get(device.id) !== signature) {
      await this.operation(this.client.updateMode(device.sdkId, config)); this.modes.set(device.id, signature);
    }
  }
  async tick(spatialFrame = false) {
    if (this.stopped || this.busy || !this.connected) return;
    const animated = this.devices.some(d => (d.components || [d]).some(component => {
      const s = this.settings(component.id, !!d.components);
      return s.power && d.direct && !this.studio?.hasDevice(component.id) && !('nativeMode' in s) && s.effect !== 'static';
    }));
    if (!this.dirty && !animated && Date.now() < this.nextDiscovery) return;
    this.busy = true; let changedErrors = false;
    try {
      if ((this.client.socket?.writableLength || 0) > 512 * 1024) throw new Error('Controlador RGB está demorando a processar os comandos.');
      if (Date.now() >= this.nextDiscovery) await this.discover();
      this.dirty = false;
      const seconds = performance.now() / 1000;
      for (const d of this.devices) {
        const channels = d.components || [d];
        const signature = JSON.stringify(channels.map(component => ({ id: component.id, count: component.ledCount, ...this.settings(component.id, !!d.components), spatial: this.studio?.hasDevice(component.id) ? this.studio.revision : null })));
        const changed = this.applied.get(d.id) !== signature;
        const animation = !spatialFrame && channels.some(component => { const s = this.settings(component.id, !!d.components); return s.power && d.direct && !this.studio?.hasDevice(component.id) && s.nativeMode === undefined && s.effect !== 'static'; });
        if (!changed && !animation) continue;
        if (d.components) {
          const oldError = d.error;
          // One Direct mode; independent brightness stays in each zone's colors.
          await this.applyMode(d, d.direct, { ...this.store.data.master, power: true }, true);
          const colors = Array(d.ledCount);
          for (const component of d.components) {
            const zoneColors = this.renderFrame(component.id, this.settings(component.id, true), component.ledCount, seconds);
            for (let index = 0; index < zoneColors.length; index++) colors[component.offset + index] = zoneColors[index];
          }
          this.client.updateLeds(d.sdkId, colors); d.error = null; this.applied.set(d.id, signature);
          for (const component of d.components) this.rememberOutput(component.id, colors.slice(component.offset, component.offset + component.ledCount), this.settings(component.id, true));
          if (oldError !== d.error) changedErrors = true;
          continue;
        }
        const settings = { ...this.settings(d.id) };
        if (this.studio?.hasDevice(d.id)) delete settings.nativeMode;
        const oldError = d.error;
        const mode = !settings.power ? (d.off || d.fixed) : settings.nativeMode !== undefined ? d.raw.modes.find(m => m.id === settings.nativeMode) : d.fixed;
        if (!mode) { d.error = 'Este dispositivo não oferece controle de cor compatível.'; }
        else if (settings.power && settings.nativeMode === undefined && !d.effects.includes(settings.effect)) { d.error = 'Este efeito não está disponível neste dispositivo.'; }
        else {
          await this.applyMode(d, mode, settings, mode.flagList.includes('perLedColor') && (!settings.power || settings.nativeMode === undefined));
          let colors = null;
          if ((!settings.power || settings.nativeMode === undefined) && mode.flagList.includes('perLedColor')) { colors = this.renderFrame(d.id, settings, d.ledCount, seconds); this.client.updateLeds(d.sdkId, colors); }
          if (!settings.power && !colors) colors = Array.from({ length: d.ledCount }, () => ({ red: 0, green: 0, blue: 0 }));
          this.rememberOutput(d.id, colors, settings);
          d.error = null; this.applied.set(d.id, signature);
        }
        if (oldError !== d.error) changedErrors = true;
      }
    } catch (error) { this.lost(error); this.client?.socket?.destroy(); }
    finally { this.busy = false; if (!this.connected) this.scheduleReconnect(); if (changedErrors) this.emit('change'); }
  }
  async resize(id, zoneId, count) {
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
  stop() { this.stopped = true; clearInterval(this.timer); clearTimeout(this.reconnect); this.client?.socket?.destroy(); this.client?.disconnect(); }
}
module.exports = { Hardware, identity, frame, hue, paletteColor };
