'use strict';
const os = require('node:os');
const net = require('node:net');
function normalize(ip = '') { return ip.startsWith('::ffff:') ? ip.slice(7) : ip; }
function loopback(ip) { return ['127.0.0.1', '::1'].includes(normalize(ip)); }
function ipv4(ip) {
  if (net.isIP(ip) !== 4) return null;
  return ip.split('.').reduce((n, part) => ((n << 8) | Number(part)) >>> 0, 0);
}
function privateIp(ip) {
  const n = ipv4(ip);
  return n !== null && ((n >>> 24) === 10 || (n >>> 20) === 0xac1 || (n >>> 16) === 0xc0a8);
}
function adapters(interfaces = os.networkInterfaces()) {
  return Object.entries(interfaces).flatMap(([name, items]) =>
    /virtual|vethernet|wsl|vpn|hamachi|radmin|tailscale|zerotier|wireguard|tunnel/i.test(name) ? [] :
    items.filter(i => i.family === 'IPv4' && !i.internal && privateIp(i.address))
      .map(i => ({ name, address: i.address, netmask: i.netmask })));
}
function sameSubnet(ip, interfaces = adapters()) {
  ip = normalize(ip);
  if (!privateIp(ip)) return false;
  return interfaces.some(i => {
    const mask = ipv4(i.netmask), address = ipv4(i.address);
    if (mask === null || mask === 0 || !privateIp(i.address)) return false;
    const inverse = (~mask) >>> 0;
    if ((inverse & (inverse + 1)) !== 0) return false;
    return ((ipv4(ip) & mask) >>> 0) === ((address & mask) >>> 0);
  });
}
function allowedHost(host, localPort, interfaces = adapters()) {
  const allowed = new Set([`127.0.0.1:${localPort}`, `localhost:${localPort}`,
    ...interfaces.map(i => `${i.address}:${localPort}`)]);
  return typeof host === 'string' && allowed.has(host.toLowerCase());
}
module.exports = { normalize, loopback, ipv4, privateIp, adapters, sameSubnet, allowedHost };
