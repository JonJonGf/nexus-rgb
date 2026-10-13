'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const { huePatch } = require('../server/alexa');
test('Hue preserva desligar/brilho zero e converte cores válidas', () => {
  assert.deepEqual(huePatch({ on: false, bri: 0 }), { power: false, brightness: 0 }); assert.equal(huePatch({ hue: 0, sat: 254 }).color, '#ff0000'); assert.match(huePatch({ xy: [0.3, 0.3] }).color, /^#[a-f0-9]{6}$/);
});
test('Hue recusa valores inválidos sem produzir NaN ou estados ambíguos', () => { for (const body of [{ on: 'true' }, { bri: 256 }, { hue: -1 }, { sat: 300 }, { xy: [0.4, 0] }, { xy: [0.8, 0.8] }, { xy: [NaN, 0.3] }]) assert.throws(() => huePatch(body)); });
