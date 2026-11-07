'use strict';
const net = require('node:net');

// The service broker authenticates the installed Node PID. The request cannot
// select a command, service, process ID to kill or executable to launch.
function requestHardwareRecovery(signal, connect = net.connect) {
  return new Promise((resolve, reject) => {
    const socket = connect('\\\\.\\pipe\\NexusRGB.Cooling.Launch.v1');
    let reply = '', settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(Error('Recovery cancelled.'));
    socket.once('error', finish);
    socket.once('close', () => finish(Error('Hardware service closed the request.')));
    socket.setTimeout(5000, () => finish(Error('Hardware service did not respond.')));
    socket.once('connect', () => socket.write(JSON.stringify({ parent: process.pid, recover: 'controller' }) + '\n'));
    socket.on('data', chunk => {
      reply += chunk.toString('utf8');
      if (Buffer.byteLength(reply) > 2048) return finish(Error('Invalid recovery response.'));
      if (!reply.includes('\n')) return;
      try {
        const value = JSON.parse(reply.trim());
        finish(value.status === 'ok' && value.accepted === true ? null : Error('Hardware recovery was declined.'));
      } catch { finish(Error('Invalid recovery response.')); }
    });
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

class ControllerRecovery {
  constructor(hardware, { enabled = false, now = Date.now, request = requestHardwareRecovery } = {}) {
    this.hardware = hardware;
    this.enabled = enabled;
    this.now = now;
    this.request = request;
    this.attempts = [];
    this.unhealthySince = null;
    this.nextAttempt = 0;
    this.pending = null;
    this.closed = false;
    this.state = enabled ? 'idle' : 'disabled';
  }
  async check() {
    if (!this.enabled || this.closed || this.pending) return;
    const now = this.now();
    if (this.hardware.connected || !this.hardware.controllerHung) {
      this.unhealthySince = null;
      this.state = 'idle';
      return;
    }
    if (this.unhealthySince === null) this.unhealthySince = now;
    if (now - this.unhealthySince < 60000) { this.state = 'observing'; return; }
    this.attempts = this.attempts.filter(at => now - at < 1800000);
    if (this.attempts.length >= 3) { this.state = 'manual'; return; }
    if (now < this.nextAttempt) return;
    this.attempts.push(now);
    this.nextAttempt = now + 300000;
    this.state = 'recovering';
    const pending = this.pending = new AbortController();
    try {
      await this.request(pending.signal);
      if (!this.closed) this.state = 'cooldown';
    } catch {
      if (!this.closed) this.state = 'failed';
    } finally { if (this.pending === pending) this.pending = null; }
  }
  snapshot() {
    return { state: this.state, attempts: this.attempts.length, limit: 3, retryInMs: Math.max(0, this.nextAttempt - this.now()) };
  }
  close() {
    this.closed = true;
    this.state = 'disabled';
    this.pending?.abort();
  }
}
module.exports = { ControllerRecovery, requestHardwareRecovery };
