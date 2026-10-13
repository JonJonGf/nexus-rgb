'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { Store, validatePatch } = require('../server/store');
test('restaura cores, desligamento, modos individuais e perfis de um novo processo', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-state-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir); store.master({ color: '#ff0055', power: false, brightness: 33 }); store.device('device-real', { nativeMode: 7 }); const profile = store.profile('Minha luz');
  store.master({ color: '#00ff00', power: true }); store.applyProfile(profile.id);
  const restored = new Store(dir); assert.equal(restored.data.master.power, false); assert.equal(restored.data.master.color, '#ff0055'); assert.equal(restored.data.devices['device-real'].nativeMode, 7);
});
test('tipos ambíguos, números não finitos e campos arbitrários não são aceitos', () => {
  for (const bad of [{ power: 'true' }, { brightness: '50' }, { speed: NaN }, { color: '<script>' }, { effect: 'audio-fake' }, { command: 'calc' }, null]) assert.throws(() => validatePatch(bad));
});
test('arquivo corrompido falha explicitamente sem sobrescrever configuração', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-corrupt-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'settings.json'), 'broken'); assert.throws(() => new Store(dir), /inválida/); assert.equal(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'), 'broken');
});

test('cenas prontas persistem paletas e ajuste manual de cor sai da paleta', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-scenes-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { presets, applyPreset } = require('../server/presets'); const store = new Store(dir);
  for (const preset of presets) { applyPreset(store, preset.id); assert.doesNotThrow(() => validatePatch(store.data.master)); }
  applyPreset(store, 'aurora'); assert.equal(new Store(dir).data.master.palette.length, 3);
  store.master({ brightness: 42 }); assert.equal(store.data.master.palette.length, 3);
  store.master({ color: '#ff0055' }); assert.equal(store.data.master.palette, undefined);
  assert.throws(() => applyPreset(store, 'missing')); assert.throws(() => validatePatch({ palette: ['not-a-color'] }));
});
