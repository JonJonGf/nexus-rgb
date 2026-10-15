'use strict';
// Imported source is evaluated only inside QuickJS WASM, never Node's eval/vm.
const fs = require('node:fs'), path = require('node:path');
const { createCanvas } = require('@napi-rs/canvas');
const { getQuickJS } = require('quickjs-emscripten');
const { parameters } = require('./studio-schema');
const { paletteColor } = require('./hardware');
const methods = new Map(Object.entries({ fillRect: 4, clearRect: 4, strokeRect: 4, beginPath: 0, closePath: 0, rect: 4, arc: [5, 6], ellipse: [7, 8], moveTo: 2, lineTo: 2, bezierCurveTo: 6, quadraticCurveTo: 4, fill: [0, 1], stroke: 0, clip: [0, 1], save: 0, restore: 0, translate: 2, rotate: 1, scale: 2, transform: 6, setTransform: [0, 6], resetTransform: 0, getTransform: 0 }));
const styleNames = new Set(['fillStyle', 'strokeStyle', 'globalAlpha', 'lineWidth', 'lineJoin', 'lineCap', 'globalCompositeOperation']);
class StudioRenderer {
  constructor() { this.canvas = createCanvas(320, 200); this.ctx = this.canvas.getContext('2d'); this.calls = 0; this.depth = 0; this.deadline = 0; this.pathSegments = 0; }
  result(result) {
    if (result.error) {
      let message = 'Falha no efeito.';
      try { const error = this.vm.dump(result.error); message = String(error?.message || error).slice(0, 160); } finally { result.error.dispose(); }
      throw Error(message);
    }
    return result.value;
  }
  numeric(args) { if (args.some(v => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e6)) throw Error('Coordenada fora do limite.'); }
  draw(op, args) {
    if (++this.calls > 30000 || Date.now() > this.deadline) throw Error('O efeito excedeu o orçamento de desenho.');
    if (this.calls % 256 === 0 && process.memoryUsage().rss > 256 * 1024 * 1024) throw Error('O motor excedeu o limite observado de memória.');
    if (op === 'batch') { if (!Array.isArray(args) || args.length > 30000) throw Error('Quadro inválido.'); for (const command of args) { if (!Array.isArray(command) || command.length !== 2 || command[0] === 'batch') throw Error('Comando inválido.'); this.draw(command[0], command[1]); } return null; }
    if (!Array.isArray(args) || args.length > 8) throw Error('Operação Canvas inválida.');
    const ctx = this.ctx;
    if (op === 'dimension') {
      const name = args[0]; if (!['width', 'height'].includes(name)) throw Error('Dimensão inválida.');
      if (args.length > 1) {
        const max = name === 'width' ? 640 : 400;
        if (!Number.isInteger(args[1]) || args[1] < 1 || args[1] > max) throw Error('Canvas acima do limite.');
        this.canvas[name] = args[1]; this.depth = 0; this.pathSegments = 0;
      }
      return this.canvas[name];
    }
    if (op === 'style') {
      const [name, value] = args; if (!styleNames.has(name)) throw Error('Estilo não permitido.');
      if (value === null || value === undefined) return null;
      if (value && typeof value === 'object') {
        if (!['fillStyle', 'strokeStyle'].includes(name) || !['linear', 'radial'].includes(value.kind) || !Array.isArray(value.coords) || value.coords.length !== (value.kind === 'linear' ? 4 : 6) || !Array.isArray(value.stops) || value.stops.length > 64) throw Error('Gradiente inválido.');
        this.numeric(value.coords);
        const gradient = ctx[value.kind === 'linear' ? 'createLinearGradient' : 'createRadialGradient'](...value.coords);
        for (const stop of value.stops) { if (!Array.isArray(stop) || stop.length !== 2 || !Number.isFinite(stop[0]) || stop[0] < 0 || stop[0] > 1 || typeof stop[1] !== 'string' || stop[1].length > 120) throw Error('Cor do gradiente inválida.'); gradient.addColorStop(stop[0], stop[1]); }
        ctx[name] = gradient;
      } else {
        if (!['string', 'number'].includes(typeof value) || typeof value === 'string' && value.length > 120 || typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e4)) throw Error('Estilo inválido.');
        ctx[name] = value;
      }
      return null;
    }
    const arity = methods.get(op);
    if (arity === undefined || !(Array.isArray(arity) ? arity.includes(args.length) : args.length === arity)) throw Error('Método Canvas não suportado: ' + op);
    if (['fill', 'clip'].includes(op)) { if (args.length && !['nonzero', 'evenodd'].includes(args[0])) throw Error('Preenchimento inválido.'); }
    else if (['arc', 'ellipse'].includes(op)) { if (args.slice(0, op === 'arc' ? 5 : 7).some(v => v === null || !Number.isFinite(v))) return null; this.numeric(args.slice(0, op === 'arc' ? 5 : 7)); if (args.length > (op === 'arc' ? 5 : 7) && typeof args.at(-1) !== 'boolean') throw Error('Direção inválida.'); }
    else { if (args.some(v => v === null || !Number.isFinite(v))) return null; this.numeric(args); }
    if (op === 'save' && ++this.depth > 64) throw Error('Pilha Canvas excedida.');
    if (op === 'restore') this.depth = Math.max(0, this.depth - 1);
    if (op === 'beginPath') this.pathSegments = 0;
    if (['moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'bezierCurveTo', 'quadraticCurveTo'].includes(op) && ++this.pathSegments > 30000) throw Error('Caminho Canvas acima do limite.');
    const result = ctx[op](...args);
    if (op === 'getTransform') return { a: result.a, b: result.b, c: result.c, d: result.d, e: result.e, f: result.f };
    return null;
  }
  async load(effect, values = {}) {
    this.close(); this.effect = effect; this.calls = 0; this.depth = 0; this.pathSegments = 0; this.deadline = Date.now() + 1000;
    this.canvas = createCanvas(effect.canvas?.width || 320, effect.canvas?.height || 200); this.ctx = this.canvas.getContext('2d');
    if (effect.format !== 'signal-html') return;
    const quickjs = await getQuickJS();
    this.runtime = quickjs.newRuntime(); this.runtime.setMemoryLimit(16 * 1024 * 1024); this.runtime.setMaxStackSize(256 * 1024);
    this.runtime.setInterruptHandler(() => Date.now() > this.deadline);
    this.vm = this.runtime.newContext();
    this.deadline = Date.now() + 1000;
    const draw = this.vm.newFunction('_nexusDraw', (operation, input) => {
      const op = this.vm.getString(operation), text = this.vm.getString(input);
      if (text.length > 4 * 1024 * 1024) throw Error('Argumento Canvas muito grande.');
      return this.vm.newString(JSON.stringify(this.draw(op, JSON.parse(text))));
    });
    this.vm.setProp(this.vm.global, '_nexusDraw', draw); draw.dispose();
    this.tick = this.result(this.vm.evalCode(fs.readFileSync(path.join(__dirname, 'studio-sandbox.txt'), 'utf8'), 'nexus-sandbox.js'));
    this.setValues(parameters(effect, values));
    this.result(this.vm.evalCode(effect.source, 'imported-effect.js')).dispose();
  }
  setValues(values) {
    for (const [key, value] of Object.entries(values)) {
      // SignalRGB's boolean metatags expose numeric 0/1 to Lightscripts.
      const handle = typeof value === 'string' ? this.vm.newString(value) : this.vm.newNumber(typeof value === 'boolean' ? Number(value) : value);
      this.vm.setProp(this.vm.global, key, handle); handle.dispose();
    }
  }
  frame(milliseconds) {
    const start = performance.now(); this.deadline = Date.now() + 40; this.calls = 0;
    if (this.vm) {
      const time = this.vm.newNumber(milliseconds);
      try { this.result(this.vm.callFunction(this.tick, this.vm.undefined, time)).dispose(); } finally { time.dispose(); }
    } else this.nativeFrame(milliseconds / 1000);
    this.lastRenderMs = performance.now() - start;
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
  }
  nativeFrame(seconds) {
    const e = this.effect, ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.resetTransform(); ctx.globalAlpha = 1; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    const angle = e.angle * Math.PI / 180, phase = seconds * e.speed / 100 * 0.7, span = Math.hypot(w, h) * 2;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(angle);
    const gradient = e.pattern === 'rings' ? ctx.createRadialGradient(0, 0, 0, 0, 0, span / 2) : ctx.createLinearGradient(-span / 2, 0, span / 2, 0);
    for (let index = 0; index <= 128; index++) {
      const position = index / 128 * e.scale * (e.pattern === 'rings' ? 3 : 2);
      const t = e.pattern === 'gradient' ? position : position - phase;
      const color = paletteColor(e.palette, t), intensity = e.pattern === 'comet' ? Math.pow(Math.max(0, 1 - (((t % 1) + 1) % 1) / 0.25), 2) : 1;
      gradient.addColorStop(index / 128, 'rgb(' + Math.round(color.red * intensity) + ',' + Math.round(color.green * intensity) + ',' + Math.round(color.blue * intensity) + ')');
    }
    ctx.fillStyle = gradient; ctx.fillRect(-span / 2, -span / 2, span, span); ctx.restore();
  }
  sample(points, pixels) {
    const w = this.canvas.width, h = this.canvas.height;
    return points.map(p => {
      const x = Math.floor(p.x / 320 * w), y = Math.floor(p.y / 200 * h);
      if (x < 0 || y < 0 || x >= w || y >= h) return [0, 0, 0];
      const n = (y * w + x) * 4, alpha = pixels[n + 3] / 255;
      return [Math.round(pixels[n] * alpha), Math.round(pixels[n + 1] * alpha), Math.round(pixels[n + 2] * alpha)];
    });
  }
  close() { this.tick?.dispose(); this.tick = null; this.vm?.dispose(); this.vm = null; this.runtime?.dispose(); this.runtime = null; }
}
module.exports = { StudioRenderer };
