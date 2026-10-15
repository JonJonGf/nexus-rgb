'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function readJson(file, fallback) {
  if (!fs.existsSync(file)) return structuredClone(fallback);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error(`Configuração inválida: ${path.basename(file)}. Restaure um backup antes de iniciar.`); }
}
const defaults = { power: true, color: '#00f0ff', brightness: 80, effect: 'static', speed: 40 };
const effects = ['static', 'rainbow', 'wave', 'breathe', 'pulse', 'strobe', 'sequence', 'comet', 'scanner', 'sparkle'];
function validatePatch(body, allowNative = false) {
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Configuração inválida.');
  const valid = new Set(['power', 'color', 'brightness', 'effect', 'speed', 'palette', ...(allowNative ? ['nativeMode'] : [])]);
  for (const key of Object.keys(body)) if (!valid.has(key)) throw new Error(`Campo desconhecido: ${key}`);
  if ('power' in body && typeof body.power !== 'boolean') throw new Error('Ligar/desligar deve ser booleano.');
  if ('color' in body && (typeof body.color !== 'string' || !/^#[\da-f]{6}$/i.test(body.color))) throw new Error('Cor inválida.');
  for (const field of ['brightness', 'speed']) if (field in body && (!Number.isInteger(body[field]) || body[field] < 0 || body[field] > 100)) throw new Error(`${field}: use 0 a 100.`);
  if ('effect' in body && !effects.includes(body.effect)) throw new Error('Efeito inválido.');
  if ('palette' in body && (!Array.isArray(body.palette) || body.palette.length > 8 || body.palette.some(color => typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color)))) throw new Error('Paleta inválida: use até 8 cores #RRGGBB.');
  if ('nativeMode' in body && (!Number.isInteger(body.nativeMode) || body.nativeMode < 0 || body.nativeMode > 65535)) throw new Error('Modo inválido.');
  return { ...body, ...('color' in body ? { color: body.color.toLowerCase() } : {}) };
}
class Store {
  constructor(directory) {
    this.file = path.join(directory, 'settings.json');
    this.data = readJson(this.file, { version: 1, master: defaults, devices: {}, profiles: [], alexaEnabled: false });
    if (this.data.version !== 1) throw new Error('Versão de configuração incompatível.');
    validatePatch(this.data.master);
    this.data.devices ??= {};
    this.data.profiles ??= [];
    this.data.zones ??= {};
    this.committed = structuredClone(this.data);
  }
  save() {
    try { writeJson(this.file, this.data); this.committed = structuredClone(this.data); }
    catch (error) { this.data = structuredClone(this.committed); throw error; }
  }
  power(value) {
    validatePatch({ power: value });
    if (this.data.master.power === value) return false;
    this.data.master.power = value; this.save(); return true;
  }
  master(patch) { const valid = validatePatch(patch); this.data.master = { ...this.data.master, ...valid }; if (('color' in valid || 'effect' in valid) && !('palette' in valid)) delete this.data.master.palette; this.data.devices = {}; this.save(); }
  device(id, patch) {
    const valid = validatePatch(patch, true), previous = { ...(this.data.devices[id] || {}) };
    if ('effect' in valid) delete previous.nativeMode;
    this.data.devices[id] = { ...previous, ...valid }; this.save();
  }
  zone(id, zoneId, count) { this.data.zones[id] ??= {}; this.data.zones[id][zoneId] = count; this.save(); }
  profileSettings(name, settings) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 48) throw new Error('Nome: 1 a 48 caracteres.');
    if (settings === undefined) return { name: name.trim(), master: structuredClone(this.data.master), devices: structuredClone(this.data.devices) };
    const valid = validatePatch(settings);
    if (!valid.palette?.length) throw new Error('Escolha de 1 a 8 cores para a sequência.');
    return { name: name.trim(), master: { ...defaults, ...structuredClone(valid), color: valid.palette[0].toLowerCase() }, devices: {} };
  }
  profile(name, settings) {
    const configuration = this.profileSettings(name, settings);
    if (this.data.profiles.length >= 32) throw new Error('Limite de 32 perfis.');
    const item = { id: crypto.randomUUID(), ...configuration };
    this.data.profiles.push(item); this.save(); return item;
  }
  updateProfile(id, name, settings) {
    const index = this.data.profiles.findIndex(p => p.id === id);
    if (index < 0) throw new Error('Perfil não encontrado.');
    if (settings === undefined) throw new Error('Informe os ajustes do perfil.');
    const item = { id, ...this.profileSettings(name, settings) };
    this.data.profiles[index] = item; this.save(); return item;
  }
  applyProfile(id) {
    const p = this.data.profiles.find(p => p.id === id);
    if (!p) throw new Error('Perfil não encontrado.');
    this.data.master = structuredClone(p.master); this.data.devices = structuredClone(p.devices); this.save();
  }
}
module.exports = { Store, defaults, effects, validatePatch, readJson, writeJson };
