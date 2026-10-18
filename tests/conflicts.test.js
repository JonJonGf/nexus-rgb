'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Conflicts, KNOWN_CONFLICTING_APPS } = require('../server/conflicts');

test('conflicts: identifica quando Windows Dynamic Lighting está ativo ou desativado', async () => {
  let simulatedStdout = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Lighting\r\n    AmbientLightingEnabled    REG_DWORD    0x1';
  let conflicts = new Conflicts({
    queryWindowsDynamicLighting: async () => {
      const match = /AmbientLightingEnabled\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(simulatedStdout);
      return { supported: true, enabled: match ? parseInt(match[1], 16) !== 0 : false };
    },
    queryRunningProcesses: async () => []
  });

  let res = await conflicts.sample();
  assert.equal(res.dynamicLighting.supported, true);
  assert.equal(res.dynamicLighting.enabled, true);
  assert.equal(res.hasConflicts, true);

  // Simular desativado (0x0)
  simulatedStdout = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Lighting\r\n    AmbientLightingEnabled    REG_DWORD    0x0';
  conflicts = new Conflicts({
    queryWindowsDynamicLighting: async () => {
      const match = /AmbientLightingEnabled\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(simulatedStdout);
      return { supported: true, enabled: match ? parseInt(match[1], 16) !== 0 : false };
    },
    queryRunningProcesses: async () => []
  });

  res = await conflicts.sample();
  assert.equal(res.dynamicLighting.supported, true);
  assert.equal(res.dynamicLighting.enabled, false);
  assert.equal(res.hasConflicts, false);
});

test('conflicts: identifica processos concorrentes conhecidos via allowlist', async () => {
  const simulatedProcesses = [
    { id: 'icue', name: 'Corsair iCUE', process: 'icue.exe' },
    { id: 'armoury-crate', name: 'ASUS Armoury Crate / Aura', process: 'lightingservice.exe' }
  ];

  const conflicts = new Conflicts({
    queryWindowsDynamicLighting: async () => ({ supported: true, enabled: false }),
    queryRunningProcesses: async () => simulatedProcesses
  });

  const res = await conflicts.sample();
  assert.equal(res.conflicts.length, 2);
  assert.equal(res.conflicts[0].id, 'icue');
  assert.equal(res.conflicts[0].name, 'Corsair iCUE');
  assert.equal(res.conflicts[1].id, 'armoury-crate');
  assert.equal(res.hasConflicts, true);
});

test('conflicts: reutiliza cache dentro de 15 segundos sem nova consulta', async () => {
  let calls = 0;
  let nowTime = 1000;
  const conflicts = new Conflicts({
    now: () => nowTime,
    queryWindowsDynamicLighting: async () => { calls++; return { supported: true, enabled: false }; },
    queryRunningProcesses: async () => []
  });

  await conflicts.sample();
  assert.equal(calls, 1);

  // 5 segundos depois
  nowTime += 5000;
  await conflicts.sample();
  assert.equal(calls, 1, 'Cache deve ser reutilizado');

  // 16 segundos depois
  nowTime += 11000;
  await conflicts.sample();
  assert.equal(calls, 2, 'Nova consulta deve ser feita após 15 segundos');
});

test('conflicts: consulta real no sistema Windows executa sem erros', async () => {
  const conflicts = new Conflicts();
  const res = await conflicts.sample();
  assert.equal(typeof res.hasConflicts, 'boolean');
  assert.equal(typeof res.dynamicLighting.supported, 'boolean');
  assert.equal(typeof res.dynamicLighting.enabled, 'boolean');
  assert.ok(Array.isArray(res.conflicts));
});
