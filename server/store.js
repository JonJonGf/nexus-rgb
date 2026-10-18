'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  let descriptor = null, created = false;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600); created = true;
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2));
    fs.closeSync(descriptor); descriptor = null;
    fs.renameSync(temporary, file);
    created = false;
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (created) try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
// Check and read the same handle. Windows data-directory ACLs remain the trust boundary.
function readEffectJson(file) {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(descriptor), entry = fs.lstatSync(file), maximum = 256 * 1024;
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > maximum || !entry.isFile() || entry.isSymbolicLink() || entry.dev !== stat.dev || entry.ino !== stat.ino) throw Error('Arquivo de efeito inválido.');
    const buffer = Buffer.alloc(maximum + 1); let length = 0, count;
    while (length < buffer.length && (count = fs.readSync(descriptor, buffer, length, buffer.length - length, null)) > 0) length += count;
    if (length > maximum) throw Error('Arquivo de efeito inválido.');
    return JSON.parse(buffer.toString('utf8', 0, length));
  } finally { fs.closeSync(descriptor); }
}
function readJson(file, fallback) {
  if (!fs.existsSync(file)) return structuredClone(fallback);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error(`Configuração inválida: ${path.basename(file)}. Restaure um backup antes de iniciar.`); }
}
const defaults = { power: true, color: '#00f0ff', brightness: 80, effect: 'static', speed: 40 };
const effects = ['static', 'rainbow', 'wave', 'breathe', 'pulse', 'strobe', 'sequence', 'comet', 'scanner', 'sparkle'];
function validateLibrary(value) {
  const key=/^(?:profile:[a-f0-9-]{36}|spatial:[a-f0-9]{24}|(?:motion|preset):[a-z]{1,24})$/;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['favorites','categories','transitionMs'].includes(k))||!Array.isArray(value.favorites)||value.favorites.length>256||value.favorites.some(k=>typeof k!=='string'||!key.test(k))||!value.categories||typeof value.categories!=='object'||Array.isArray(value.categories)||Object.keys(value.categories).length>256||Object.entries(value.categories).some(([k,v])=>!key.test(k)||typeof v!=='string'||!v.trim()||v.length>40)||!Number.isInteger(value.transitionMs)||value.transitionMs<0||value.transitionMs>1000)throw Error('Backup: biblioteca inválida.');
  return {favorites:[...new Set(value.favorites)],categories:Object.fromEntries(Object.entries(value.categories).map(([k,v])=>[k,v.trim()])),transitionMs:value.transitionMs};
}
function validatePatch(body, allowNative = false) {
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Configuração inválida.');
  const valid = new Set(['power', 'color', 'brightness', 'effect', 'speed', 'palette', ...(allowNative ? ['nativeMode', 'syncWithPc'] : [])]);
  for (const key of Object.keys(body)) if (!valid.has(key)) throw new Error(`Campo desconhecido: ${key}`);
  if ('power' in body && typeof body.power !== 'boolean') throw new Error('Ligar/desligar deve ser booleano.');
  if ('syncWithPc' in body && typeof body.syncWithPc !== 'boolean') throw new Error('Sincronizar deve ser booleano.');
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
    if (this.data.performance) {
      if (!Number.isInteger(this.data.performance.fps) || this.data.performance.fps < 5 || this.data.performance.fps > 60) throw Error('Configuração de FPS inválida.');
      const transitionMs = this.data.performance.powerTransitionMs;
      if (transitionMs !== undefined && (!Number.isInteger(transitionMs) || (transitionMs !== 0 && (transitionMs < 200 || transitionMs > 3000)))) throw Error('Configuração de transição de energia inválida.');
    }
    this.data.devices ??= {};
    this.data.profiles ??= [];
    this.data.zones ??= {};
    if(this.data.library)this.data.library=validateLibrary(this.data.library);
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
  master(patch) { const valid = validatePatch(patch); this.data.master = { ...this.data.master, ...valid }; if (('color' in valid || 'effect' in valid) && !('palette' in valid)) delete this.data.master.palette; if (this.data.studio && ('color' in valid || 'effect' in valid)) this.data.studio = { ...this.data.studio, enabled: false, excluded: [] }; else if (this.data.studio) this.data.studio = { ...this.data.studio, excluded: [] }; this.data.devices = {}; this.save(); }
  performance(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length || Object.keys(patch).some(k => !['fps', 'powerTransitionMs'].includes(k))) throw Error('Taxa de atualização: escolha de 5 a 60 FPS.');
    const fps = Object.hasOwn(patch, 'fps') ? patch.fps : (this.data.performance?.fps ?? 20);
    if (!Number.isInteger(fps) || fps < 5 || fps > 60) throw Error('Taxa de atualização: escolha de 5 a 60 FPS.');
    const powerTransitionMs = Object.hasOwn(patch, 'powerTransitionMs') ? patch.powerTransitionMs : (this.data.performance?.powerTransitionMs ?? 0);
    if (!Number.isInteger(powerTransitionMs) || (powerTransitionMs !== 0 && (powerTransitionMs < 200 || powerTransitionMs > 3000))) throw Error('Transição de energia: escolha 0 (instantânea) ou de 200 a 3000 ms.');
    this.data.performance = powerTransitionMs > 0 ? { fps, powerTransitionMs } : { fps };
    this.save();
  }
  library(patch, keys) {
    if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['key','favorite','category','transitionMs'].includes(k)))throw Error('Ajuste de biblioteca inválido.');
    const next=structuredClone(this.data.library||{favorites:[],categories:{},transitionMs:0});
    if(Object.hasOwn(patch,'transitionMs')){if(!Number.isInteger(patch.transitionMs)||patch.transitionMs<0||patch.transitionMs>1000)throw Error('Transição: escolha de 0 a 1000 ms.');next.transitionMs=patch.transitionMs;}
    if(Object.hasOwn(patch,'favorite')||Object.hasOwn(patch,'category')){
      if(typeof patch.key!=='string'||!keys.includes(patch.key))throw Error('Item da biblioteca não encontrado.');
      if(Object.hasOwn(patch,'favorite')){if(typeof patch.favorite!=='boolean')throw Error('Favorito inválido.');next.favorites=next.favorites.filter(k=>k!==patch.key);if(patch.favorite)next.favorites.push(patch.key);}
      if(Object.hasOwn(patch,'category')){if(typeof patch.category!=='string'||patch.category.length>40)throw Error('Categoria: limite de 40 caracteres.');if(patch.category.trim())next.categories[patch.key]=patch.category.trim();else delete next.categories[patch.key];}
    }
    this.data.library=validateLibrary(next);this.save();
  }
  duplicateProfile(id,name) {const source=this.data.profiles.find(p=>p.id===id);if(!source)throw Error('Perfil não encontrado.');this.profileSettings(name);if(this.data.profiles.length>=32)throw Error('Limite de 32 perfis.');const copy={...structuredClone(source),id:crypto.randomUUID(),name:name.trim()};this.data.profiles.push(copy);this.save();return copy;}
  device(id, patch, knownIds = []) {
    if (patch && typeof patch === 'object' && !Array.isArray(patch) && Object.hasOwn(patch, 'followMap')) {
      if (Object.keys(patch).length !== 1 || patch.followMap !== true) throw new Error('Configuração inválida.');
      const previous = { ...(this.data.devices[id] || {}) };
      for (const key of ['color', 'effect', 'palette', 'speed', 'nativeMode']) delete previous[key];
      if (Object.keys(previous).length) this.data.devices[id] = previous; else delete this.data.devices[id];
      if (this.data.studio) this.data.studio = { ...this.data.studio, excluded: (this.data.studio.excluded || []).filter(item => item !== id) };
      this.save(); return;
    }
    const valid = validatePatch(patch, true), previous = { ...(this.data.devices[id] || {}) };
    if ('effect' in valid) delete previous.nativeMode;
    if (this.data.studio && ('color' in valid || 'effect' in valid || 'nativeMode' in valid)) this.data.studio = { ...this.data.studio, excluded: [...new Set([...(this.data.studio.excluded || []), id])] };
    if (valid.power === true && !this.data.master.power) {
      // Release the global gate for this component without waking its peers.
      // Preserve their colors, effects and native modes while keeping them off.
      for (const other of new Set([...knownIds, ...Object.keys(this.data.devices)])) {
        if (other !== id) this.data.devices[other] = { ...(this.data.devices[other] || {}), power: false };
      }
      this.data.master = { ...this.data.master, power: true };
    }
    this.data.devices[id] = { ...previous, ...valid }; this.save();
  }
  zone(id, zoneId, count) {
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(zoneId) || zoneId < 0 || zoneId > 65535 || !Number.isInteger(count) || count < 1 || count > 4096) throw Error('Tamanho de zona inválido.');
    this.data.zones[id] ??= {}; this.data.zones[id][zoneId] = count; this.save();
  }
  profileSettings(name, settings) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 48) throw new Error('Nome: 1 a 48 caracteres.');
    if (settings === undefined) return { name: name.trim(), master: structuredClone(this.data.master), devices: structuredClone(this.data.devices), ...(this.data.studio?.enabled ? { studio: structuredClone({ enabled: true, activeId: this.data.studio.activeId, values: this.data.studio.values || {}, excluded: this.data.studio.excluded || [] }) } : {}) };
    const valid = validatePatch(settings);
    if (!valid.palette?.length) throw new Error('Escolha de 1 a 8 cores para a sequência.');
    return { name: name.trim(), master: { ...defaults, ...structuredClone(valid), color: valid.palette[0].toLowerCase() }, devices: {} };
  }
  profile(name, settings, studio) {
    const configuration = this.profileSettings(name, settings);
    if (studio) configuration.studio = structuredClone(studio);
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
    this.data.master = structuredClone(p.master); this.data.devices = structuredClone(p.devices);
    if (this.data.studio || p.studio) this.data.studio = { layout: [], ...this.data.studio, enabled: false, ...(p.studio ? structuredClone(p.studio) : {}) };
    this.save();
  }
}
module.exports = { Store, defaults, effects, validatePatch, validateLibrary, readJson, writeJson, readEffectJson };
