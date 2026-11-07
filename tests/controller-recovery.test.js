'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { ControllerRecovery, requestHardwareRecovery } = require('../server/controller-recovery');

async function broker(t, handle) {
  const server = net.createServer(handle);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return () => net.connect(server.address().port, '127.0.0.1');
}

test('recovery IPC sends only the caller identity and fixed action and handles fragmented replies', async t => {
  const connect = await broker(t, socket => socket.once('data', bytes => {
    assert.deepEqual(JSON.parse(bytes.toString()), { parent: process.pid, recover: 'controller' });
    socket.write('{"status":"ok",');
    setImmediate(() => socket.end('"accepted":true}\n'));
  }));
  await requestHardwareRecovery(new AbortController().signal, connect);
});

test('recovery IPC rejects unaccepted, malformed and oversized replies and aborts cleanly', async t => {
  for (const reply of ['{"status":"ok","accepted":false}\n', 'invalid\n', 'x'.repeat(2049)]) {
    const connect = await broker(t, socket => socket.once('data', () => socket.end(reply)));
    await assert.rejects(requestHardwareRecovery(new AbortController().signal, connect));
  }
  const controller = new AbortController();
  const connect = await broker(t, socket => socket.once('data', () => controller.abort()));
  await assert.rejects(requestHardwareRecovery(controller.signal, connect), /cancelled/);
});

test('controller recovery requires a sustained confirmed hang and preserves a half-hour retry budget', async () => {
  const hardware = { connected: false, controllerHung: false };
  let now = 0, requests = 0;
  const recovery = new ControllerRecovery(hardware, { enabled: true, now: () => now, request: async () => { requests++; } });
  await recovery.check(); now = 120000; await recovery.check();
  assert.equal(requests, 0);
  hardware.controllerHung = true;
  await recovery.check(); now += 59999; await recovery.check(); assert.equal(requests, 0);
  now++; await recovery.check(); assert.equal(requests, 1);
  await recovery.check(); assert.equal(requests, 1);
  now += 300000; await recovery.check(); assert.equal(requests, 2);
  now += 300000; await recovery.check(); assert.equal(requests, 3);
  now += 300000; await recovery.check(); assert.equal(requests, 3);
  assert.equal(recovery.snapshot().state, 'manual');
  hardware.connected = true; await recovery.check();
  assert.equal(recovery.snapshot().state, 'idle');
  hardware.connected = false; await recovery.check(); now += 60000; await recovery.check();
  assert.equal(requests, 3);
  now += 1800000; await recovery.check(); assert.equal(requests, 4);
  recovery.close();
});

test('a healthy response cancels the observation period and concurrent checks share one request', async () => {
  const hardware = { connected: false, controllerHung: true };
  let now = 0, requests = 0, complete;
  const recovery = new ControllerRecovery(hardware, { enabled: true, now: () => now, request: () => { requests++; return new Promise(resolve => { complete = resolve; }); } });
  await recovery.check(); now = 45000;
  hardware.connected = true; await recovery.check();
  hardware.connected = false; await recovery.check(); now = 104999; await recovery.check(); assert.equal(requests, 0);
  now = 105000; const pending = recovery.check(); await recovery.check(); assert.equal(requests, 1);
  complete(); await pending;
  assert.equal(recovery.snapshot().state, 'cooldown');
  recovery.close();
});

test('failed recovery is bounded and closing cancels an in-flight request', async () => {
  const hardware = { connected: false, controllerHung: true };
  let now = 0, requests = 0;
  const recovery = new ControllerRecovery(hardware, { enabled: true, now: () => now, request: async signal => {
    requests++;
    if (requests === 1) throw Error('Service unavailable');
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('Cancelled')), { once: true }));
  } });
  await recovery.check(); now = 60000; await recovery.check();
  assert.equal(recovery.snapshot().state, 'failed');
  now++; await recovery.check(); assert.equal(requests, 1);
  now += 300000; const pending = recovery.check(); recovery.close(); await pending;
  assert.equal(recovery.snapshot().state, 'disabled');
  now += 1800000; await recovery.check(); assert.equal(requests, 2);
});
