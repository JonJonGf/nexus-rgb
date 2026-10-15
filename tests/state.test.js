'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { Store, validatePatch } = require('../server/store');

test('perfil guarda efeito espacial e parâmetros sem substituir o mapa compartilhado', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-spatial-profile-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new Store(directory), layout = [{ key: 'position' }];
  store.data.studio = { enabled: true, activeId: 'a'.repeat(24), values: { ink: '#1234ab' }, excluded: ['b'.repeat(24)], layout };
  store.save(); const saved = store.profile('Mapa azul');
  store.master({ color: '#fe7621' }); assert.equal(store.data.studio.enabled, false);
  store.data.studio.layout = [{ key: 'moved' }]; store.applyProfile(saved.id);
  assert.equal(store.data.studio.enabled, true); assert.equal(store.data.studio.activeId, saved.studio.activeId);
  assert.deepEqual(store.data.studio.layout, [{ key: 'moved' }]); assert.deepEqual(store.data.studio.values, { ink: '#1234ab' });
  assert.deepEqual(new Store(directory).data.studio, store.data.studio);
  const sequence = store.profile('Outra sequência', { palette: ['#ff0000'], effect: 'comet' });
  store.applyProfile(sequence.id); assert.equal(store.data.studio.enabled, false);
});
test('ligar um componente libera o geral mantendo todos os outros apagados', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-individual-power-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new Store(directory);
  store.master({ power: true, color: '#1234ab', effect: 'wave', brightness: 37 });
  store.device('ram-two', { color: '#fe7621', nativeMode: 7, power: true });
  store.device('argb', { power: false, effect: 'breathe' });
  store.power(false);
  store.device('ram-one', { power: true }, ['ram-one', 'ram-two', 'argb', 'board']);
  assert.equal(store.data.master.power, true);
  assert.equal(store.data.master.color, '#1234ab');
  assert.equal(store.data.devices['ram-one'].power, true);
  for (const id of ['ram-two', 'argb', 'board']) assert.equal(store.data.devices[id].power, false);
  assert.equal(store.data.devices['ram-two'].nativeMode, 7);
  assert.equal(store.data.devices['ram-two'].color, '#fe7621');
  assert.deepEqual(new Store(directory).data, store.data);
  const before = structuredClone(store.data);
  store.power(false); store.power(true);
  assert.deepEqual(store.data, before);
});
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

test('falha de escrita não deixa ajustes ou perfis fantasmas na memória', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-write-fail-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir); store.master({ color: '#123456' });
  const originalFile = store.file, previous = structuredClone(store.data);
  const blocked = path.join(dir, 'directory-not-file'); fs.mkdirSync(blocked); store.file = blocked;
  assert.throws(() => store.master({ color: '#ff0000' })); assert.deepEqual(store.data, previous);
  assert.throws(() => store.profile('Não foi salvo')); assert.deepEqual(store.data, previous);
  store.file = originalFile; assert.deepEqual(new Store(dir).data, previous);
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

test('perfis criados e editados guardam a sequência sem alterar a iluminação atual', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-profile-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir); store.device('ram', { color: '#abcdef', nativeMode: 7 });
  const before = structuredClone({ master: store.data.master, devices: store.data.devices });
  const settings = { palette: ['#ff0000', '#00ff00', '#0000ff'], effect: 'comet', brightness: 32, speed: 17 };
  const profile = store.profile('Meu cometa', settings); settings.palette[0] = '#ffffff';
  assert.deepEqual({ master: store.data.master, devices: store.data.devices }, before);
  const restored = new Store(dir); assert.deepEqual(restored.data.profiles[0].master.palette, ['#ff0000', '#00ff00', '#0000ff']);
  const edited = restored.updateProfile(profile.id, 'Vai e vem', { ...profile.master, palette: ['#0000ff', '#ff0000'], effect: 'scanner' });
  assert.equal(edited.id, profile.id); assert.equal(restored.data.profiles.length, 1);
  assert.deepEqual({ master: restored.data.master, devices: restored.data.devices }, before);
  restored.applyProfile(profile.id); const applied = new Store(dir);
  assert.equal(applied.data.master.color, '#0000ff'); assert.equal(applied.data.master.effect, 'scanner'); assert.deepEqual(applied.data.devices, {});
  const saved = fs.readFileSync(restored.file, 'utf8');
  for (const invalid of [{ palette: [] }, { palette: Array(9).fill('#000000') }, { palette: ['javascript:alert(1)'] }, { palette: ['#000000'], nativeMode: 1 }, { palette: ['#000000'], effect: 'shell' }]) {
    assert.throws(() => restored.updateProfile(profile.id, 'Inválido', invalid)); assert.equal(fs.readFileSync(restored.file, 'utf8'), saved);
  }
});
