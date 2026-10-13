'use strict';
const http = require('node:http');
const dgram = require('node:dgram');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('./network');
const { readJson, writeJson } = require('./store');
const { hue } = require('./hardware');
const { RateLimiter } = require('./security');
const xmlEscape = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
function colorState(hex) {
  const values = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = values; const max = Math.max(...values); const min = Math.min(...values); const delta = max - min;
  let h = delta === 0 ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h = ((h / 6) % 1 + 1) % 1;
  const [R, G, B] = values.map(v => v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
  const X = R * 0.664511 + G * 0.154324 + B * 0.162028; const Y = R * 0.283881 + G * 0.668433 + B * 0.047685; const Z = R * 0.000088 + G * 0.07231 + B * 0.986039;
  const sum = X + Y + Z;
  return { hue: Math.round(h * 65535), sat: max ? Math.round(delta / max * 254) : 0, xy: sum ? [X / sum, Y / sum] : [0.3, 0.3] };
}
function huePatch(body) {
  const patch = {};
  if ('on' in body) { if (typeof body.on !== 'boolean') throw new Error('on inválido'); patch.power = body.on; }
  if ('bri' in body) { if (!Number.isInteger(body.bri) || body.bri < 0 || body.bri > 254) throw new Error('bri inválido'); patch.brightness = Math.round(body.bri / 254 * 100); }
  let color;
  if ('hue' in body || 'sat' in body) {
    const h = body.hue ?? 0; const s = body.sat ?? 254;
    if (!Number.isInteger(h) || h < 0 || h > 65535 || !Number.isInteger(s) || s < 0 || s > 254) throw new Error('Cor Hue inválida');
    const c = hue(h / 65535); color = Object.values(c).map(v => Math.round(255 * (1 - s / 254) + v * s / 254));
  }
  if ('xy' in body) {
    if (!Array.isArray(body.xy) || body.xy.length !== 2 || body.xy.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) || body.xy[1] <= 0 || body.xy[0] + body.xy[1] > 1.001) throw new Error('xy inválido');
    const [x, y] = body.xy; const X = x / y; const Z = (1 - x - y) / y;
    let c = [X * 1.656492 - 0.354851 - Z * 0.255038, -X * 0.707196 + 1.655397 + Z * 0.036152, X * 0.051713 - 0.121364 + Z * 1.01153].map(n => Math.max(0, n));
    const max = Math.max(...c, 1); c = c.map(n => n / max);
    color = c.map(n => Math.round(255 * (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055)));
  }
  if (color) { patch.color = '#' + color.map(n => n.toString(16).padStart(2, '0')).join(''); patch.effect = 'static'; }
  if (body.effect === 'colorloop') patch.effect = 'rainbow';
  return patch;
}
class Alexa {
  constructor(store, hardware, directory, onChange, options = {}) {
    this.store = store; this.hardware = hardware; this.onChange = onChange; this.port = options.port || 80;
    this.file = path.join(directory, 'alexa.json'); this.data = readJson(this.file, { uuid: crypto.randomUUID(), peers: [] });
    this.candidates = new Map(); this.discoveryUntil = 0; this.status = 'Desativada'; this.rate = new RateLimiter(60);
  }
  save() { writeJson(this.file, this.data); }
  openDiscovery() { this.discoveryUntil = Date.now() + 120000; this.candidates.clear(); }
  approve(ip) { if (!this.candidates.has(ip) || !net.sameSubnet(ip)) throw new Error('Dispositivo não encontrado na descoberta.'); if (!this.data.peers.includes(ip)) { this.data.peers.push(ip); this.save(); } }
  snapshot() { return { enabled: this.store.data.alexaEnabled, status: this.status, discoveryUntil: this.discoveryUntil, candidates: [...this.candidates.keys()], peers: [...this.data.peers] }; }
  lights() {
    const state = this.store.data.master;
    const common = { type: 'Extended color light', modelid: 'LCT015', manufacturername: 'Philips', swversion: '1.46.13', state: { on: state.power, bri: Math.round(state.brightness * 2.54), ...colorState(state.color), ct: 370, alert: 'none', effect: state.effect === 'rainbow' ? 'colorloop' : 'none', colormode: 'xy', reachable: this.hardware.connected } };
    const lights = { '1': { ...common, name: 'Luzes do PC', uniqueid: `${this.data.uuid}-1` } };
    for (const [i, effect] of ['rainbow', 'wave', 'breathe', 'static', 'pulse'].entries()) {
      lights[String(i + 2)] = { type: 'Dimmable light', modelid: 'LWB010', manufacturername: 'Philips', swversion: '1.0', name: { rainbow: 'Modo Arco Iris', wave: 'Modo Onda', breathe: 'Modo Respiracao', static: 'Modo Estatico', pulse: 'Modo Pulso' }[effect], uniqueid: `${this.data.uuid}-${i + 2}`, state: { on: state.power && state.effect === effect, bri: 254, reachable: this.hardware.connected } };
    }
    return lights;
  }
  description(ip) {
    return `<?xml version="1.0"?><root xmlns="urn:schemas-upnp-org:device-1-0"><specVersion><major>1</major><minor>0</minor></specVersion><URLBase>http://${xmlEscape(ip)}:${this.port}/</URLBase><device><deviceType>urn:schemas-upnp-org:device:Basic:1</deviceType><friendlyName>Nexus RGB (${xmlEscape(ip)})</friendlyName><manufacturer>Royal Philips Electronics</manufacturer><modelDescription>Philips hue Personal Wireless Lighting</modelDescription><modelName>Philips hue bridge 2012</modelName><modelNumber>929000226503</modelNumber><serialNumber>${this.data.uuid.replace(/-/g, '').slice(0, 12)}</serialNumber><UDN>uuid:${this.data.uuid}</UDN></device></root>`;
  }
  async request(req, res) {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Connection': 'close', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    const ip = net.normalize(req.socket.remoteAddress);
    if (!net.sameSubnet(ip) || req.headers.origin || !this.rate.take(ip)) return send(403, { error: 'Acesso negado.' });
    const localIp = net.normalize(req.socket.localAddress);
    if (req.headers.host !== localIp && req.headers.host !== `${localIp}:${this.port}`) return send(403, {});
    const url = new URL(req.url, 'http://nexus.invalid');
    if (url.pathname === '/description.xml' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/xml' }); return res.end(this.description(localIp)); }
    if (!this.data.peers.includes(ip)) {
      if (Date.now() < this.discoveryUntil) this.candidates.set(ip, Date.now());
      return send(403, [{ error: { type: 101, description: 'Approve this Echo in the Nexus RGB PC panel.' } }]);
    }
    if (url.pathname === '/api' && req.method === 'POST') return send(200, [{ success: { username: 'nexus_local' } }]);
    const route = url.pathname.match(/^\/api\/([a-zA-Z0-9_-]{1,80})(?:\/lights(?:\/(\d+)(?:\/(state))?)?|\/(config|groups|scenes))?$/);
    if (!route) return send(404, {});
    const [, , light, change, section] = route;
    if (req.method === 'GET') {
      const lights = this.lights();
      if (section === 'config') return send(200, { name: 'Nexus RGB', bridgeid: this.data.uuid.replace(/-/g, '').slice(0, 16).toUpperCase(), mac: '00:17:88:00:00:01', ipaddress: localIp, modelid: 'BSB001', swversion: '01041302', apiversion: '1.17.0', linkbutton: Date.now() < this.discoveryUntil });
      if (section) return send(200, {});
      if (light) return send(lights[light] ? 200 : 404, lights[light] || {});
      if (/\/lights$/.test(url.pathname)) return send(200, lights);
      return send(200, { lights, config: { name: 'Nexus RGB', bridgeid: this.data.uuid }, groups: {}, scenes: {} });
    }
    if (change && req.method === 'PUT') {
      if (!this.lights()[light]) return send(404, {});
      try {
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 2048) return send(413, {}); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Estado inválido');
        const patch = huePatch(body);
        if (Number(light) > 1) { if (body.on === true) { patch.power = true; patch.effect = ['rainbow', 'wave', 'breathe', 'static', 'pulse'][Number(light) - 2]; } else if (body.on === false) patch.power = false; }
        this.store.master(patch); this.hardware.changed(); this.onChange();
        return send(200, Object.keys(body).map(k => ({ success: { [`/lights/${light}/state/${k}`]: body[k] } })));
      } catch { return send(400, [{ error: { type: 7, description: 'Invalid state' } }]); }
    }
    return send(405, {});
  }
  start() {
    if (this.server || !this.store.data.alexaEnabled) return;
    this.server = http.createServer((req, res) => { this.request(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); });
    this.server.requestTimeout = 10000; this.server.headersTimeout = 8000; this.server.maxConnections = 16;
    this.server.on('error', error => { this.status = error.code === 'EADDRINUSE' ? 'Porta 80 ocupada por outro programa.' : `Falha: ${error.code}`; this.stop(false); this.onChange(); });
    this.server.listen(this.port, '0.0.0.0', () => {
      this.status = 'Ponte local ativa'; this.onChange();
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.socket.on('error', error => { this.status = `Descoberta indisponível: ${error.code}`; this.onChange(); });
      this.socket.on('message', (message, remote) => {
        if (message.length > 4096 || !net.sameSubnet(remote.address) || !this.rate.take(remote.address + ':udp')) return;
        if (!/M-SEARCH \* HTTP\/1\.1/i.test(message.toString()) || !/ssdp:discover/i.test(message.toString())) return;
        const adapter = net.adapters().find(a => net.sameSubnet(remote.address, [a])); if (!adapter) return;
        if (Date.now() < this.discoveryUntil) this.candidates.set(remote.address, Date.now());
        if (Date.now() >= this.discoveryUntil && !this.data.peers.includes(remote.address)) return;
        const response = `HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age=60\r\nEXT:\r\nLOCATION: http://${adapter.address}:${this.port}/description.xml\r\nSERVER: FreeRTOS/7.4.2 UPnP/1.0 IpBridge/1.24.0\r\nST: urn:schemas-upnp-org:device:basic:1\r\nUSN: uuid:${this.data.uuid}::urn:schemas-upnp-org:device:basic:1\r\nhue-bridgeid: ${this.data.uuid.replace(/-/g, '').slice(0, 16).toUpperCase()}\r\n\r\n`;
        this.socket.send(response, remote.port, remote.address);
      });
      this.socket.bind(1900, '0.0.0.0', () => { for (const a of net.adapters()) { try { this.socket.addMembership('239.255.255.250', a.address); } catch { /* Adapter may disappear during startup. */ } } });
    });
  }
  stop(reset = true) { this.server?.closeAllConnections(); this.server?.close(); this.server = null; try { this.socket?.close(); } catch {} this.socket = null; if (reset) this.status = 'Desativada'; }
}
module.exports = { Alexa, huePatch };
