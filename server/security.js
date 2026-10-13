'use strict';
const crypto = require('node:crypto');
const { loopback, sameSubnet } = require('./network');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const random = () => crypto.randomBytes(32).toString('base64url');
class RateLimiter {
  constructor(limit = 60, period = 60000) { this.limit = limit; this.period = period; this.entries = new Map(); }
  take(key, now = Date.now()) {
    const old = this.entries.get(key);
    if (this.entries.size > 512) for (const [k, v] of this.entries) if (now >= v.until) this.entries.delete(k);
    if (!old || now >= old.until) {
      if (this.entries.size >= 1024 && !old) return false;
      this.entries.set(key, { until: now + this.period, count: 1 }); return true;
    }
    return ++old.count <= this.limit;
  }
}
class Security {
  constructor(directory, getInterfaces) { this.admins = new Map(); this.getInterfaces = getInterfaces; }
  cookie(token, secure, expires) {
    return `nexus_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${expires}${secure ? '; Secure' : ''}`;
  }
  newAdmin() {
    const token = random();
    if (this.admins.size >= 32) this.admins.delete(this.admins.keys().next().value);
    this.admins.set(hash(token), Date.now() + 8 * 3600000); return token;
  }
  session(req) {
    const cookies = req.headers.cookie || '';
    const token = cookies.match(/(?:^|;\s*)nexus_session=([a-zA-Z0-9_-]{43})(?:;|$)/)?.[1];
    if (!token) return !loopback(req.socket.remoteAddress) && sameSubnet(req.socket.remoteAddress, this.getInterfaces?.()) ? { admin: false, id: 'lan' } : null;
    const fingerprint = hash(token);
    if (loopback(req.socket.remoteAddress) && this.admins.get(fingerprint) > Date.now()) return { admin: true, id: 'pc' };
    return !loopback(req.socket.remoteAddress) && sameSubnet(req.socket.remoteAddress, this.getInterfaces?.()) ? { admin: false, id: 'lan' } : null;
  }
}
module.exports = { Security, RateLimiter, hash };
