'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { frame, Hardware } = require('../server/hardware');
const { defaults, effects } = require('../server/store');
const palette = ['#ff0000', '#00ff00', '#0000ff'];
const settings = { ...defaults, brightness: 100, speed: 0, palette };

test('sequência respeita a ordem, estático mantém a cor e estrobo alterna luz e apagado', () => {
  for (let cycle = 0; cycle < 6; cycle++) {
    const expected = { red: cycle % 3 === 0 ? 255 : 0, green: cycle % 3 === 1 ? 255 : 0, blue: cycle % 3 === 2 ? 255 : 0 };
    assert.deepEqual(frame({ ...settings, effect: 'sequence' }, 1, (cycle + 0.1) / 0.03)[0], expected);
    assert.deepEqual(frame({ ...settings, effect: 'strobe' }, 4, (cycle + 0.1) / 0.5), Array(4).fill(expected));
    assert.deepEqual(frame({ ...settings, effect: 'strobe' }, 1, (cycle + 0.75) / 0.5)[0], { red: 0, green: 0, blue: 0 });
  }
  assert.deepEqual(frame({ ...settings, effect: 'static', color: '#abcdef' }, 1, 0)[0], { red: 171, green: 205, blue: 239 });
});

test('cometa percorre os LEDs, feixe volta e cintilação é contínua e determinística', () => {
  const peak = colors => colors.map(c => c.red).indexOf(Math.max(...colors.map(c => c.red)));
  const comet = { ...settings, effect: 'comet' };
  assert.ok(peak(frame(comet, 40, 0.7 / 0.03)) > peak(frame(comet, 40, 0.2 / 0.03)));
  const scanner = { ...settings, effect: 'scanner' };
  assert.equal(peak(frame(scanner, 21, 0)), 0);
  assert.equal(peak(frame(scanner, 21, 0.5 / 0.03)), 20);
  assert.equal(peak(frame(scanner, 21, 1 / 0.03)), 0);
  const sparkle = { ...settings, effect: 'sparkle' };
  assert.deepEqual(frame(sparkle, 40, 12.3), frame(sparkle, 40, 12.3));
  assert.notDeepEqual(frame(sparkle, 40, 12.3), frame(sparkle, 40, 13.3));
});

test('todos os efeitos respeitam desligamento, limites RGB e contagens pequenas', () => {
  for (const effect of effects) for (const count of [0, 1, 2, 60]) for (const speed of [0, 100]) for (const seconds of [0, 0.5, 1.75, 12000]) {
    const config = { ...settings, effect, speed, brightness: 37 };
    const colors = frame(config, count, seconds);
    assert.equal(colors.length, count);
    assert.ok(colors.every(color => Object.values(color).every(value => Number.isInteger(value) && value >= 0 && value <= 94)));
    assert.ok(frame({ ...config, power: false }, count, seconds).every(color => Object.values(color).every(value => value === 0)));
  }
});

test('ativar uma sequência começa na primeira cor e mudar brilho não reinicia o percurso', () => {
  const hardware = new Hardware({ data: {} }); const config = { ...settings, effect: 'sequence' };
  assert.equal(hardware.renderFrame('ram', config, 1, 10000)[0].red, 255);
  assert.equal(hardware.renderFrame('ram', config, 1, 10040)[0].green, 255);
  assert.equal(hardware.renderFrame('ram', { ...config, brightness: 50 }, 1, 10041)[0].green, 128);
  assert.equal(hardware.renderFrame('ram', { ...config, palette: ['#0000ff', '#00ff00'] }, 1, 10042)[0].blue, 255);
});
