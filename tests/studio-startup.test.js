'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const path = require('node:path');
const { fixture } = require('./helpers/http-app');

test('a valid effect survives slow worker startup and its backup remains restorable', async t => {
  const { app, request, cookie } = await fixture(t);
  const spawnNormally = app.studio.spawn.bind(app.studio);
  app.studio.spawn = () => fork(path.join(__dirname, 'fixtures/slow-studio-worker.cjs'), [], {
    execArgv: ['--max-old-space-size=64'], windowsHide: true,
    serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', DISABLE_SYSTEM_FONTS_LOADING: '1' }
  });
  const source = JSON.stringify({ format: 'nexus-effect/1', name: 'Cold start', pattern: 'gradient', palette: ['#123456'], speed: 0, angle: 0, scale: 1 });
  const imported = await request('/api/studio/import', { method: 'POST', cookie, body: { source } });
  assert.equal(imported.status, 200, imported.text);
  app.studio.spawn = spawnNormally;
  const exported = (await request('/api/backups', { cookie })).json();
  const reviewed = await request('/api/backups/review', { method: 'POST', cookie, body: exported });
  assert.equal(reviewed.status, 200, reviewed.text);
  assert.equal(reviewed.json().summary.imports, 1);
});

test('a worker that never announces startup is terminated and its effect is not saved', async t => {
  const { app, request, cookie } = await fixture(t);
  let child;
  app.studio.spawn = () => {
    child = fork(path.join(__dirname, 'fixtures/silent-studio-worker.cjs'), [], {
      execArgv: ['--max-old-space-size=64'], windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    return child;
  };
  const source = JSON.stringify({ format: 'nexus-effect/1', name: 'Never ready', pattern: 'gradient', palette: ['#123456'], speed: 0, angle: 0, scale: 1 });
  await assert.rejects(app.studio.import(source), /motor demorou para iniciar/);
  await new Promise(resolve => child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve));
  const library = (await request('/api/studio', { cookie })).json();
  assert.equal(library.effects.some(effect => effect.name === 'Never ready'), false);
});
