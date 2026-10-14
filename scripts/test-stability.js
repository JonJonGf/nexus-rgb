'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { fork } = require('node:child_process');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { setTimeout: sleep } = require('node:timers/promises');
const root = path.resolve(__dirname, '..');
const seconds = Number(process.env.NEXUS_STABILITY_SECONDS || 600);
if (!Number.isInteger(seconds) || seconds < 60 || seconds > 86400) throw new Error('Duração permitida: 60 a 86400 segundos.');
const output = path.resolve(process.env.NEXUS_STABILITY_REPORT || path.join(root, 'data', 'validation', 'stability.json'));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-stability-'));
let child, origin, cookie, streams = [], requests = 0, writes = 0, reconnects = 0;
const samples = [], latencies = [];
async function launch() {
  child = fork(path.join(root, 'tests', 'fixtures', 'stability-worker.js'), [], { env: { ...process.env, NEXUS_TEST_DATA: directory }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  child.stdout.resume(); child.stderr.on('data', data => process.stderr.write(data));
  const workerProcess = child;
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(Error('Worker startup timed out.')); }, 15000);
    const cleanup = () => { clearTimeout(timer); workerProcess.off('message', onReady); workerProcess.off('exit', onExit); workerProcess.off('error', onError); };
    const onReady = message => { cleanup(); resolve(message); };
    const onExit = code => { cleanup(); reject(Error('Worker exited: ' + code)); };
    const onError = error => { cleanup(); reject(error); };
    workerProcess.once('message', onReady); workerProcess.once('exit', onExit); workerProcess.once('error', onError);
  });
  assert.equal(ready.type, 'ready'); origin = `http://127.0.0.1:${ready.port}`;
  const session = await call('/api/session/local', {}); cookie = session.headers.get('set-cookie').split(';')[0];
}
async function call(route, body) {
  const started = performance.now();
  const response = await fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(5000), headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { origin, 'x-nexus-client': 'web', 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  latencies.push(performance.now() - started); requests++;
  assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
  return response;
}
async function openStreams() {
  for (let i = 0; i < 8; i++) {
    const request = http.get(origin + '/api/events', { headers: { cookie }, agent: false }); streams.push(request);
    await new Promise((resolve, reject) => {
      request.once('error', reject); request.once('response', response => { response.on('error', () => {}); response.resume(); if (response.statusCode !== 200) reject(Error('Stream HTTP ' + response.statusCode)); else resolve(); });
      request.setTimeout(20000, () => request.destroy(Error('Stream timed out.')));
    }); requests++;
  }
}
function closeStreams() { for (const request of streams) request.destroy(); streams = []; }
async function sample(elapsed) {
  const pending = once(child, 'message'); child.send('sample'); const [message] = await pending;
  assert.equal(message.type, 'sample'); samples.push({ elapsedSeconds: elapsed, ...message, type: undefined });
}
async function killWorker() {
  closeStreams(); const process = child; const ended = once(process, 'exit'); process.kill('SIGKILL'); await ended; child = null;
}
async function main() {
  const startedAt = new Date().toISOString(); await launch(); await openStreams();
  await call('/api/profiles', { name: 'Perfil de estabilidade' });
  const started = performance.now(); let nextWrite = 0, nextSample = 0, nextReconnect = 30, nextProgress = 60;
  let color = '#00f0ff';
  while ((performance.now() - started) / 1000 < seconds) {
    const elapsed = (performance.now() - started) / 1000;
    if (elapsed >= nextWrite) { color = writes % 2 ? '#aa22ff' : '#00ffaa'; await call('/api/control', { color, power: true, effect: 'static' }); writes++; nextWrite += 10; }
    const state = await (await call('/api/state')).json(); assert.equal(state.master.color, color); assert.equal(state.profiles.length, 1); assert.equal(state.hardware.devices.length, 0);
    if (elapsed >= nextSample) { await sample(elapsed); nextSample += 15; }
    if (elapsed >= nextReconnect) { closeStreams(); await sleep(100); await openStreams(); reconnects++; nextReconnect += 30; }
    if (elapsed >= nextProgress) { console.log(`Stability: ${Math.floor(elapsed)}s, ${requests} requests, ${reconnects} stream reconnect cycles`); nextProgress += 60; }
    await sleep(500);
  }
  await sample((performance.now() - started) / 1000);
  // Abrupt exits touch only the dedicated fork, never an installed service.
  const before = JSON.parse(fs.readFileSync(path.join(directory, 'settings.json'), 'utf8'));
  for (let i = 0; i < 10; i++) {
    await killWorker(); await launch();
    const restored = await (await call('/api/state')).json(); assert.deepEqual(restored.master, before.master); assert.equal(restored.profiles.length, 1);
    const oldCookie = cookie; const session = await call('/api/session/local', {}); cookie = session.headers.get('set-cookie').split(';')[0]; assert.notEqual(cookie, oldCookie);
  }
  const values = key => samples.map(s => s.memory[key] / 1048576);
  const ordered = latencies.toSorted((a, b) => a - b), last = samples.at(-1), first = samples[0];
  const report = { startedAt, finishedAt: new Date().toISOString(), durationSeconds: (performance.now() - started) / 1000, requestedDurationSeconds: seconds, passed: true, scope: 'Isolated Node API; hardware/Alexa disabled; temporary data; no installed service modifications', node: process.version, requests, controlWrites: writes, concurrentStreams: 8, reconnectCycles: reconnects, abruptProcessRestarts: 10, memoryMiB: { rssInitial: values('rss')[0], rssFinal: values('rss').at(-1), rssPeak: Math.max(...values('rss')), heapInitial: values('heapUsed')[0], heapFinal: values('heapUsed').at(-1), heapPeak: Math.max(...values('heapUsed')) }, workerCpuPercentOfMachine: 100 * ((last.cpu.user + last.cpu.system - first.cpu.user - first.cpu.system) / 1e6) / (last.elapsedSeconds - first.elapsedSeconds) / os.cpus().length, latencyMs: { median: ordered[Math.floor(ordered.length * .5)], p95: ordered[Math.floor(ordered.length * .95)], max: ordered.at(-1) }, eventLoopP99PeakMs: Math.max(...samples.map(s => s.eventLoopP99Ms)), samples };
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: output, passed: true, requests, abruptProcessRestarts: 10, memoryMiB: report.memoryMiB }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (child) await killWorker();
  assert.ok(path.basename(directory).startsWith('nexus-stability-') && path.dirname(directory) === os.tmpdir());
  fs.rmSync(directory, { recursive: true, force: true });
});
