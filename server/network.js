'use strict';
const os = require('node:os');
const net = require('node:net');
const { execFile } = require('node:child_process');
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
function sameMask(ip, entry) {
  const mask = ipv4(entry?.netmask), address = ipv4(entry?.address), target = ipv4(ip);
  if (target === null || mask === null || mask === 0 || !privateIp(entry?.address)) return false;
  const inverse = (~mask) >>> 0;
  if ((inverse & (inverse + 1)) !== 0) return false;
  return ((target & mask) >>> 0) === ((address & mask) >>> 0);
}
function parseRoutes(input = '') {
  if (Array.isArray(input)) return input;
  if (typeof input !== 'string') return [];
  const routes = [];
  for (const line of input.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5 && parts[0] === '0.0.0.0' && parts[1] === '0.0.0.0' && net.isIP(parts[2]) === 4 && net.isIP(parts[3]) === 4 && /^\d+$/.test(parts[4])) {
      routes.push({ destination: parts[0], netmask: parts[1], gateway: parts[2], interface: parts[3], metric: Number(parts[4]) });
    }
  }
  return routes;
}
let cachedRoutes = [], cachedRoutesAt = 0, loadingRoutes = false;
function systemRoutes() {
  if (process.platform !== 'win32') return [];
  const now = Date.now();
  if (loadingRoutes || now - cachedRoutesAt < 15000) return cachedRoutes;
  loadingRoutes = true;
  execFile('route.exe', ['print', '-4'], { encoding: 'utf8', timeout: 1500, maxBuffer: 256*1024, windowsHide: true }, (error, output) => {
    if (!error) cachedRoutes = parseRoutes(output);
    cachedRoutesAt = Date.now(); loadingRoutes = false;
  });
  return cachedRoutes;
}
const EXCLUDED_ADAPTER = /vpn|hamachi|radmin|tailscale|zerotier|wireguard|tunnel|wsl|tap|tun|wintun|nordlynx|openvpn|anyconnect|fortinet|pangp|warp|default switch|docker|vboxnet|vmnet|host-only|loopback|teredo|isatap|bluetooth|vethernet\s*\((?:default switch|wsl|nat|internal|host-only)/i;
const VIRTUAL_ADAPTER = /virtual|vethernet|hyper-v/i;
function adapters(interfaces, routes) {
  const source = interfaces || os.networkInterfaces();
  const routeTable = routes !== undefined ? parseRoutes(routes) : (interfaces ? [] : systemRoutes());
  const candidates = [];
  for (const [name, items] of Object.entries(source)) {
    if (EXCLUDED_ADAPTER.test(name) || !Array.isArray(items)) continue;
    const isVirtual = VIRTUAL_ADAPTER.test(name);
    for (const i of items) {
      if (i.family !== 'IPv4' || i.internal || !privateIp(i.address)) continue;
      const entry = { name, address: i.address, netmask: i.netmask };
      const matchingRoutes = routeTable.filter(r => r.interface === i.address && privateIp(r.gateway) && sameMask(r.gateway, entry));
      const directGateway = typeof i.gateway === 'string' && privateIp(i.gateway) && sameMask(i.gateway, entry) ? i.gateway : null;
      const hasGateway = Boolean(directGateway || matchingRoutes.length);
      if (isVirtual && !hasGateway) continue;
      const routeMetric = matchingRoutes.length ? Math.min(...matchingRoutes.map(r => Number.isFinite(r.metric) ? r.metric : 9999)) : (Number.isFinite(i.metric) ? i.metric : 9999);
      candidates.push({ entry, hasGateway, metric: routeMetric, isVirtual });
    }
  }
  candidates.sort((a, b) => (Number(b.hasGateway) - Number(a.hasGateway)) || (a.metric - b.metric) || (Number(a.isVirtual) - Number(b.isVirtual)));
  return candidates.map(c => c.entry);
}
function selectAdapter(interfaces = adapters(), preferredAddress = '') {
  if (typeof preferredAddress === 'string' && preferredAddress) {
    const matched = interfaces.find(a => a.address === preferredAddress);
    if (matched) return matched;
  }
  return interfaces[0] || null;
}
function sameSubnet(ip, interfaces = adapters()) {
  ip = normalize(ip);
  if (!privateIp(ip)) return false;
  return interfaces.some(i => sameMask(ip, i));
}
function allowedHost(host, localPort, interfaces = adapters()) {
  const allowed = new Set([`127.0.0.1:${localPort}`, `localhost:${localPort}`,
    ...interfaces.map(i => `${i.address}:${localPort}`)]);
  return typeof host === 'string' && allowed.has(host.toLowerCase());
}
module.exports = { normalize, loopback, ipv4, privateIp, parseRoutes, adapters, selectAdapter, sameSubnet, allowedHost };
