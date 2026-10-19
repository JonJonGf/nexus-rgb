'use strict';
const http = require('node:http');
const dgram = require('node:dgram');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('./network');
const { readJson, writeJson } = require('./store');
const { RateLimiter } = require('./security');
const xmlEscape = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const LIGHT_NAME = 'Iluminação Nexus';
const HUE_DEVICE_TYPE = 'urn:schemas-upnp-org:device:basic:1';
function bridgeIdentity(uuid) {
  const suffix = crypto.createHash('sha256').update(uuid).digest('hex').slice(0, 6);
  const hex = '001788' + suffix;
  return { mac: hex.match(/.{2}/g).join(':'), bridgeId: (hex.slice(0, 6) + 'fffe' + hex.slice(6)).toUpperCase(), serial: hex };
}
function lightIdentity(uuid, id) {
  const tail = crypto.createHash('sha256').update(`${uuid}|light|${id}`).digest('hex').slice(0, 8);
  return '00:17:88:01:' + tail.match(/.{2}/g).join(':') + '-0b';
}
function searchTargets(message, uuid) {
  if (!/^M-SEARCH \* HTTP\/1\.1\r?\n/i.test(message) || !/^MAN:\s*"ssdp:discover"\s*$/im.test(message)) return [];
  const target = message.match(/^ST:\s*([^\r\n]+)\s*$/im)?.[1].trim().toLowerCase();
  const supported = ['upnp:rootdevice', HUE_DEVICE_TYPE, `uuid:${uuid}`];
  return target === 'ssdp:all' ? supported : supported.filter(value => value.toLowerCase() === target);
}
function huePatch(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || !Object.keys(body).length) throw new Error('Estado inválido');
  if (Object.hasOwn(body, 'on') && typeof body.on !== 'boolean') throw new Error('on inválido');
  if (Object.hasOwn(body, 'bri') && (!Number.isInteger(body.bri) || body.bri < 0 || body.bri > 254)) throw new Error('bri inválido');
  return Object.hasOwn(body, 'on') ? { power: body.on } : {};
}
class Alexa {
  constructor(store, hardware, directory, onChange, options = {}) {
    this.store = store; this.hardware = hardware; this.onChange = onChange; this.port = options.port ?? 80;
    this.getInterfaces = options.getInterfaces || net.adapters;
    this.file = path.join(directory, 'alexa.json'); this.data = readJson(this.file, { uuid: crypto.randomUUID(), peers: [] });
    this.identity = bridgeIdentity(this.data.uuid);
    // Hue compatibility state is separate from the user's RGB brightness.
    // A brightness-only request must never turn an explicitly off setup on.
    this.hueBrightness = 254;
    this.diagnostics = { lastSearch: null, lastHttp: null, lastCommand: null, recent: [] };
    this.candidates = new Map(); this.discoveryUntil = 0; this.status = 'Desativada'; this.rate = new RateLimiter(60);
    this.multicastInterfaces = new Set();
  }
  save() { writeJson(this.file, this.data); }
  openDiscovery() { this.discoveryUntil = Date.now() + 120000; this.candidates.clear(); this.advertise(); }
  ownAddress(ip) { return this.getInterfaces().some(adapter => adapter.address === ip); }
  approve(ip) { if (this.ownAddress(ip) || !this.candidates.has(ip) || !net.sameSubnet(ip, this.getInterfaces())) throw new Error('Dispositivo não encontrado na descoberta.'); if (!this.data.peers.includes(ip)) { this.data.peers.push(ip); this.save(); } }
  snapshot() { return { enabled: this.store.data.alexaEnabled, status: this.status, lightName: LIGHT_NAME, discoveryUntil: this.discoveryUntil, candidates: [...this.candidates.keys()].filter(ip => !this.ownAddress(ip)), peers: [...this.data.peers], diagnostics: structuredClone(this.diagnostics) }; }
  lights() {
    const state = this.store.data.master;
    // Retain the dimmable descriptor used for discovery, but keep its virtual
    // brightness coherent between PUT and GET without changing RGB settings.
    const lights = { '1': { type: 'Dimmable light', modelid: 'HASS123', manufacturername: 'Philips', swversion: '1.0', name: LIGHT_NAME, uniqueid: lightIdentity(this.data.uuid, 1), state: { on: state.power, bri: this.hueBrightness, mode: 'homeautomation', alert: 'none', reachable: this.hardware.connected } } };
    for(const scene of this.hardware.experiences?.data.scenes||[])if(scene.alexa){const id=this.sceneLightId(scene.id);lights[id]={...lights[1],name:scene.name,uniqueid:lightIdentity(this.data.uuid,scene.id),state:{...lights[1].state,on:this.hardware.experiences.active?.scene.id===scene.id,bri:254}};}
    return lights;
  }
  sceneLightId(id) {return String(parseInt(crypto.createHash('sha256').update('nexus-scene:'+id).digest('hex').slice(0,7),16)+2);}
  description(ip) {
    return `<?xml version="1.0"?><root xmlns="urn:schemas-upnp-org:device-1-0"><specVersion><major>1</major><minor>0</minor></specVersion><URLBase>http://${xmlEscape(ip)}:${this.port}/</URLBase><device><deviceType>${HUE_DEVICE_TYPE}</deviceType><friendlyName>Nexus RGB (${xmlEscape(ip)})</friendlyName><manufacturer>Royal Philips Electronics</manufacturer><modelDescription>Philips hue Personal Wireless Lighting</modelDescription><modelName>Philips hue bridge 2012</modelName><modelNumber>929000226503</modelNumber><serialNumber>${this.identity.serial}</serialNumber><UDN>uuid:${this.data.uuid}</UDN><presentationURL>http://${xmlEscape(ip)}:${this.port}/</presentationURL></device></root>`;
  }
  config(ip) { return { name: 'Nexus RGB', bridgeid: this.identity.bridgeId, mac: this.identity.mac, ipaddress: ip, modelid: 'BSB001', swversion: '01041302', apiversion: '1.17.0', factorynew: false, linkbutton: Date.now() < this.discoveryUntil }; }
  ssdp(target, address, notify = false) {
    const usn = target.startsWith('uuid:') ? target : `uuid:${this.data.uuid}::${target}`;
    return `${notify ? 'NOTIFY * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\n' : 'HTTP/1.1 200 OK\r\nEXT:\r\n'}CACHE-CONTROL: max-age=60\r\nLOCATION: http://${address}:${this.port}/description.xml\r\nSERVER: FreeRTOS/7.4.2 UPnP/1.0 IpBridge/1.24.0\r\n${notify ? `NT: ${target}\r\nNTS: ssdp:alive` : `ST: ${target}`}\r\nUSN: ${usn}\r\nhue-bridgeid: ${this.identity.bridgeId}\r\n\r\n`;
  }
  advertise() {
    if (!this.socket || !this.udpReady || Date.now() >= this.discoveryUntil) return;
    for (const adapter of this.getInterfaces()) {
      try {
        this.socket.setMulticastInterface(adapter.address);
        for (const target of ['upnp:rootdevice', HUE_DEVICE_TYPE]) this.socket.send(this.ssdp(target, adapter.address, true), 1900, '239.255.255.250');
      } catch { /* Interface may disappear during discovery. */ }
    }
  }
  syncInterfaces() {
    if (!this.socket || !this.udpReady) return false;
    const current = new Set(this.getInterfaces().map(adapter => adapter.address));
    let changed = false;
    for (const address of this.multicastInterfaces) {
      if (current.has(address)) continue;
      try { this.socket.dropMembership('239.255.255.250', address); } catch { /* Old IP may already be gone. */ }
      this.multicastInterfaces.delete(address); changed = true;
    }
    for (const address of current) {
      if (this.multicastInterfaces.has(address)) continue;
      try {
        this.socket.addMembership('239.255.255.250', address);
        this.multicastInterfaces.add(address); changed = true;
      } catch { /* DHCP may precede interface readiness. Retry next interval. */ }
    }
    return changed;
  }
  async request(req, res) {
    const started = performance.now();
    let recordHttp = () => {};
    const send = (status, value) => {
      const payload = Buffer.from(JSON.stringify(value));
      recordHttp(status, value);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': payload.length, 'Connection': 'close', 'X-Content-Type-Options': 'nosniff' });
      res.end(payload);
    };
    const ip = net.normalize(req.socket.remoteAddress);
    if (!net.sameSubnet(ip, this.getInterfaces()) || req.headers.origin || !this.rate.take(ip)) return send(403, { error: 'Acesso negado.' });
    const localIp = net.normalize(req.socket.localAddress);
    if (req.headers.host !== localIp && req.headers.host !== `${localIp}:${this.port}`) return send(403, {});
    const url = new URL(req.url, 'http://nexus.invalid');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    // Fixed labels keep Hue usernames and arbitrary request text out of diagnostics.
    const resource = pathname === '/description.xml' ? 'Descrição da ponte' : /\/lights\/\d+\/state$/.test(pathname) ? 'Estado da luz' : /\/lights\/\d+$/.test(pathname) ? 'Luz individual' : /\/lights$/.test(pathname) ? 'Lista de luzes' : pathname === '/api' ? 'Cadastro Hue' : 'Configuração da ponte';
    recordHttp = (status, value) => {
      if (this.ownAddress(ip)) return;
      const event = { at: Date.now(), ip, resource, status, method: ['GET', 'POST', 'PUT'].includes(req.method) ? req.method : 'OTHER' };
      const state = value?.state || value?.['1']?.state || value?.lights?.['1']?.state;
      if (req.method === 'GET' && typeof state?.on === 'boolean') { event.power = state.on; event.reachable = state.reachable; }
      if (req.method === 'GET' && Number.isInteger(state?.bri)) event.hueBrightness = state.bri;
      const acceptedPower = value?.[0]?.success?.['/lights/1/state/on'];
      if (typeof acceptedPower === 'boolean') event.power = acceptedPower;
      const acceptedBrightness = Array.isArray(value) ? value.find(item => Object.hasOwn(item.success || {}, '/lights/1/state/bri'))?.success['/lights/1/state/bri'] : undefined;
      if (Number.isInteger(acceptedBrightness)) event.hueBrightness = acceptedBrightness;
      res.once('finish', () => { event.finished = true; event.responseMs = Math.round(performance.now() - started); });
      this.diagnostics.lastHttp = event; this.diagnostics.recent.push(event);
      if (this.diagnostics.recent.length > 32) this.diagnostics.recent.shift();
    };
    if (pathname === '/description.xml' && req.method === 'GET') { if (Date.now() < this.discoveryUntil && !this.ownAddress(ip)) this.candidates.set(ip, Date.now()); recordHttp(200); res.writeHead(200, { 'Content-Type': 'text/xml' }); return res.end(this.description(localIp)); }
    // Hue discovery reads public bridge metadata before creating a user.
    if (pathname === '/api/config' && req.method === 'GET') { if (Date.now() < this.discoveryUntil && !this.ownAddress(ip)) this.candidates.set(ip, Date.now()); return send(200, this.config(localIp)); }
    if (!this.data.peers.includes(ip)) {
      if (Date.now() < this.discoveryUntil && !this.ownAddress(ip)) this.candidates.set(ip, Date.now());
      return send(403, [{ error: { type: 101, description: 'Approve this Echo in the Nexus RGB PC panel.' } }]);
    }
    if (pathname === '/api' && req.method === 'POST') return send(200, [{ success: { username: 'nexus_local' } }]);
    const route = pathname.match(/^\/api\/([a-zA-Z0-9_-]{1,80})(?:\/lights(?:\/(\d+)(?:\/(state))?)?|\/(config|groups|scenes))?$/);
    if (!route) return send(404, {});
    const [, , light, change, section] = route;
    if (req.method === 'GET') {
      const lights = this.lights();
      if (section === 'config') return send(200, this.config(localIp));
      if (section) return send(200, {});
      if (light) return send(lights[light] ? 200 : 404, lights[light] || {});
      if (/\/lights$/.test(pathname)) return send(200, lights);
      return send(200, { lights, config: this.config(localIp), groups: {}, scenes: {} });
    }
    if (change && req.method === 'PUT') {
      if (!this.lights()[light]) return send(404, {});
      try {
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 2048) return send(413, {}); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const patch = huePatch(body);
        const hasPower = Object.hasOwn(patch, 'power'), hasBrightness = Object.hasOwn(body, 'bri');
        if (hasPower || hasBrightness) {
          if (hasPower) {
            if(light!=='1'){
              const experiences=this.hardware.experiences,scene=experiences?.data.scenes.find(s=>s.alexa&&this.sceneLightId(s.id)===light);
              if(!scene)return send(404,{});
              if(patch.power)experiences.play(scene.id);else if(experiences.active?.scene.id===scene.id)experiences.cancel();
              return send(200,[{success:{[`/lights/${light}/state/on`]:patch.power}},...(hasBrightness?[{success:{[`/lights/${light}/state/bri`]:body.bri}}]:[])]);
            }
            this.hardware.experiences?.cancel();
            if (!patch.power) this.hardware.cancelIdentification?.();
            if (this.store.power(patch.power)) { this.hardware.changed(); this.onChange(); }
          }
          if (hasBrightness) this.hueBrightness = body.bri;
          const known = ['on', 'bri', 'hue', 'sat', 'ct', 'xy', 'effect', 'alert', 'transitiontime'];
          this.diagnostics.lastCommand = { at: Date.now(), ip, name: LIGHT_NAME, power: this.store.data.master.power, hueBrightness: this.hueBrightness, powerRequested: hasPower, fields: known.filter(key => Object.hasOwn(body, key)), otherFieldCount: Object.keys(body).filter(key => !known.includes(key)).length, responseMs: Math.round(performance.now() - started) };
          const accepted = [];
          if (hasPower) accepted.push({ success: { [`/lights/${light}/state/on`]: this.store.data.master.power } });
          if (hasBrightness) accepted.push({ success: { [`/lights/${light}/state/bri`]: this.hueBrightness } });
          // Only the accepted on/bri properties are acknowledged. Other Hue
          // attributes never alter the stored color, effects, or brightness.
          return send(200, accepted);
        }
        return send(200, Object.keys(body).map(k => ({ error: { type: 6, address: `/lights/${light}/state/${k}`, description: 'Only on/off is supported.' } })));
      } catch { return send(400, [{ error: { type: 7, description: 'Invalid state' } }]); }
    }
    return send(405, {});
  }
  start() {
    if (this.server || !this.store.data.alexaEnabled) return;
    this.server = http.createServer((req, res) => { this.request(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); });
    this.server.requestTimeout = 10000; this.server.headersTimeout = 8000; this.server.maxConnections = 16;
    this.server.on('error', error => { this.status = error.code === 'EADDRINUSE' ? `Porta ${this.port} da Alexa ocupada. Use Configurar portas no ícone do Nexus.` : `Falha na porta ${this.port}: ${error.code}`; this.stop(false); this.onChange(); });
    this.server.listen(this.port, '0.0.0.0', () => {
      this.port = this.server.address().port;
      this.status = 'Ponte local ativa'; this.onChange();
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.socket.on('error', error => { this.status = `Descoberta indisponível: ${error.code}`; this.onChange(); });
      this.socket.on('message', (message, remote) => {
        if (message.length > 4096 || this.ownAddress(remote.address) || !net.sameSubnet(remote.address, this.getInterfaces()) || !this.rate.take(remote.address + ':udp')) return;
        const targets = searchTargets(message.toString(), this.data.uuid); if (!targets.length) return;
        const adapter = this.getInterfaces().find(a => net.sameSubnet(remote.address, [a])); if (!adapter) return;
        this.diagnostics.lastSearch = { at: Date.now(), ip: remote.address };
        if (Date.now() < this.discoveryUntil) this.candidates.set(remote.address, Date.now());
        if (Date.now() >= this.discoveryUntil && !this.data.peers.includes(remote.address)) return;
        for (const target of targets) this.socket.send(this.ssdp(target, adapter.address), remote.port, remote.address);
      });
      this.socket.bind(1900, '0.0.0.0', () => {
        this.udpReady = true; this.socket.setMulticastTTL(1);
        this.syncInterfaces();
        this.interfaceTimer = setInterval(() => { if (this.syncInterfaces()) this.advertise(); }, 5000); this.interfaceTimer.unref();
        this.advertise(); this.notifyTimer = setInterval(() => this.advertise(), 30000); this.notifyTimer.unref();
      });
    });
  }
  stop(reset = true) { clearInterval(this.notifyTimer); clearInterval(this.interfaceTimer); this.multicastInterfaces.clear(); this.udpReady = false; this.server?.closeAllConnections(); this.server?.close(); this.server = null; try { this.socket?.close(); } catch {} this.socket = null; if (reset) this.status = 'Desativada'; }
}
module.exports = { Alexa, huePatch, bridgeIdentity, searchTargets };
