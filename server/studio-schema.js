'use strict';
const crypto = require('node:crypto');
const recipeModel = require('../public/recipe');
const LIMIT = 128 * 1024;
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'window', 'document', 'globalThis', 'performance', 'Date', 'Math', 'JSON', 'Object', 'Array', 'Function', 'Promise', 'eval', 'fetch', 'require', 'process', 'console', '_nexusDraw']);
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function text(value, max) { return typeof value === 'string' && value.length > 0 && value.length <= max; }
function number(value, min, max) { return Number.isFinite(value) && value >= min && value <= max; }
function clean(value, max = 120) { return String(value || '').replace(/<[^>]*>/g, '').replace(/[\x00-\x1f]/g, ' ').trim().slice(0, max); }
function attributes(tag) {
  const output = Object.create(null);
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) output[m[1].toLowerCase()] = m[3];
  return output;
}
function parseHTML(html) {
  if (!text(html, LIMIT) || Buffer.byteLength(html) > LIMIT) throw Error('Efeito HTML: limite de 128 KiB.');
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  if (!blocks.length || blocks.some(m => /\bsrc\s*=/i.test(m[1]))) throw Error('Use um HTML com JavaScript incorporado, sem scripts externos.');
  const canvas = attributes(html.match(/<canvas\b[^>]*>/i)?.[0] || '');
  if (!canvas.id) throw Error('O efeito precisa de um canvas com id.');
  const source = blocks.map(m => m[2]).join('\n');
  if (/\bengine\s*\.\s*audio\b/.test(source)) throw Error('Efeitos com áudio do SignalRGB ainda não são compatíveis.');
  const controls = [];
  for (const meta of metas.filter(m => m.property)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(meta.property) || forbidden.has(meta.property) || controls.some(c => c.key === meta.property) || controls.length >= 64) throw Error('Parâmetro de efeito inválido.');
    const control = { key: meta.property, label: clean(meta.label || meta.property, 70), type: meta.type };
    if (meta.type === 'number') {
      control.min = Number(meta.min ?? 0); control.max = Number(meta.max ?? 100); control.default = Number(meta.default);
      if (!number(control.min, -1e5, 1e5) || !number(control.max, control.min, 1e5) || !number(control.default, control.min, control.max)) throw Error('Intervalo numérico inválido: ' + meta.property);
    } else if (meta.type === 'color') {
      if (!/^#[\da-f]{6}$/i.test(meta.default || '')) throw Error('Cor inválida: ' + meta.property);
      control.default = meta.default.toLowerCase();
    } else if (meta.type === 'boolean') control.default = ['true', '1'].includes(String(meta.default).toLowerCase());
    else if (meta.type === 'combobox') {
      control.values = (meta.values || '').split(',').map(s => s.trim());
      if (!control.values.length || control.values.length > 32 || control.values.some(v => !text(v, 80)) || !control.values.includes(meta.default)) throw Error('Lista de opções inválida: ' + meta.property);
      control.default = meta.default;
    } else throw Error('Tipo de parâmetro ainda não suportado: ' + meta.type);
    controls.push(control);
  }
  const width = Number(canvas.width || 320), height = Number(canvas.height || 200);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 640 || height > 400) throw Error('Canvas: máximo de 640 × 400.');
  const name = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || 'Efeito importado', 60);
  return { id: crypto.createHash('sha256').update(html).digest('hex').slice(0, 24), format: 'signal-html', name, publisher: clean(metas.find(m => m.publisher)?.publisher || 'Autoria não informada'), source, controls, canvas: { id: canvas.id, width, height }, warnings: /\b(?:addEventListener|onkeydown|onkeyup)\b/.test(source) ? ['Eventos de teclado não são encaminhados ao efeito.'] : [] };
}
function recipe(input) {
  const configuration = recipeModel.normalize(input);
  return { ...configuration, id: crypto.createHash('sha256').update(JSON.stringify(configuration)).digest('hex').slice(0, 24), controls: [], publisher: 'Criado no Nexus', warnings: [] };
}
function parameters(effect, value = {}) {
  if (!object(value) || Object.keys(value).some(key => !effect.controls.some(c => c.key === key))) throw Error('Parâmetro desconhecido.');
  const output = Object.create(null);
  for (const c of effect.controls) {
    const v = Object.hasOwn(value, c.key) ? value[c.key] : c.default;
    if (c.type === 'number' ? !number(v, c.min, c.max) : c.type === 'color' ? typeof v !== 'string' || !/^#[\da-f]{6}$/i.test(v) : c.type === 'boolean' ? typeof v !== 'boolean' : !c.values.includes(v)) throw Error('Valor inválido: ' + c.label);
    output[c.key] = v;
  }
  return output;
}
function layout(value) {
  if (!Array.isArray(value) || value.length > 256) throw Error('Layout: limite de 256 componentes.');
  const covered = new Set(), keys = new Set(); let total = 0;
  return value.map(item => {
    if (!object(item) || !text(item.key, 70) || keys.has(item.key) || !/^[a-f0-9]{24}$/.test(item.deviceId) || !text(item.name, 60)) throw Error('Componente do layout inválido.');
    keys.add(item.key);
    if (!Number.isInteger(item.start) || item.start < 0 || !Number.isInteger(item.count) || item.count < 1 || item.start + item.count > 4096 || (total += item.count) > 32768) throw Error('Faixa de LEDs inválida.');
    for (let i = item.start; i < item.start + item.count; i++) { const key = item.deviceId + ':' + i; if (covered.has(key)) throw Error('Dois componentes estão usando os mesmos LEDs.'); covered.add(key); }
    if (!number(item.x, 0, 1) || !number(item.y, 0, 1) || !number(item.width, 0.01, 1) || !number(item.height, 0.01, 1) || !number(item.rotation, -360, 360) || !['strip', 'fan', 'matrix'].includes(item.shape) || typeof item.reverse !== 'boolean' || !Number.isInteger(item.columns) || item.columns < 1 || item.columns > 128) throw Error('Posição ou formato inválido.');
    const extra = {};
    if (item.rings !== undefined) {
      if (!Array.isArray(item.rings) || !item.rings.length || item.rings.length > 8 || item.rings.some(r => !object(r) || !Number.isInteger(r.count) || r.count < 1 || r.count > item.count || !Number.isInteger(r.offset) || r.offset < 0 || r.offset >= r.count || typeof r.reverse !== 'boolean') || item.rings.reduce((n,r) => n+r.count,0) !== item.count) throw Error('Anéis: a soma deve corresponder à quantidade de LEDs da peça.');
      extra.rings = item.rings.map(r => ({count:r.count,offset:r.offset,reverse:r.reverse}));
    }
    if (item.ledOrder !== undefined) {
      if (!Array.isArray(item.ledOrder) || item.ledOrder.length !== item.count || new Set(item.ledOrder).size !== item.count || item.ledOrder.some(n => !Number.isInteger(n) || n < 0 || n >= item.count)) throw Error('Ordem física: informe cada LED da peça uma única vez.');
      extra.ledOrder = [...item.ledOrder];
    }
    if (item.group !== undefined) { if (typeof item.group !== 'string' || item.group.length > 40) throw Error('Grupo: limite de 40 caracteres.'); extra.group = clean(item.group,40); }
    if (item.wiring !== undefined) { if (!['unknown','sequential','mirrored'].includes(item.wiring)) throw Error('Tipo de ligação inválido.'); extra.wiring = item.wiring; }
    return { key: item.key, deviceId: item.deviceId, name: clean(item.name, 60), start: item.start, count: item.count, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, shape: item.shape, reverse: item.reverse, columns: item.columns, ...extra };
  });
}
module.exports = { parseHTML, recipe, parameters, layout, LIMIT };
