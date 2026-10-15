'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Store } = require('./store');
const { presets, applyPreset } = require('./presets');
const { Security, RateLimiter } = require('./security');
const { Hardware } = require('./hardware');
const { Alexa } = require('./alexa');
const network = require('./network');
const QRCode = require('qrcode');
const VERSION = require('../package.json').version;
const { ports } = require('./ports');
const { Studio } = require('./studio');
function readBody(req, maximum = 8192) {
  return new Promise((resolve, reject) => {
    if (!(req.headers['content-type'] || '').match(/^application\/json(?:;\s*charset=utf-8)?$/i)) return reject(Object.assign(new Error('Use application/json.'), { status: 415 }));
    const declared = Number(req.headers['content-length']);
    if (declared > maximum) { req.resume(); return reject(Object.assign(new Error('Requisição muito grande.'), { status: 413 })); }
    let length = 0; const chunks = []; let done = false;
    const timer = setTimeout(() => { done = true; reject(Object.assign(new Error('Requisição expirou.'), { status: 408 })); }, 10000);
    req.on('data', chunk => {
      if (done) return;
      length += chunk.length;
      if (length > maximum) { done = true; clearTimeout(timer); reject(Object.assign(new Error('Requisição muito grande.'), { status: 413 })); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      clearTimeout(timer); if (done) return;
      try { const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); resolve(body); }
      catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
    });
    const aborted = () => { clearTimeout(timer); if (!done) { done = true; reject(Object.assign(new Error('Conexão interrompida.'), { status: 400 })); } };
    req.on('error', aborted); req.on('aborted', aborted);
  });
}
async function createApp(options = {}) {
  const configuredPorts = ports(options);
  const directory = options.directory || process.env.NEXUS_DATA_DIR || path.join(__dirname, '..', 'data');
  fs.mkdirSync(directory, { recursive: true });
  const getInterfaces = options.getInterfaces || network.adapters;
  const store = options.store || new Store(directory); const security = new Security(directory, getInterfaces);
  const hardware = options.hardware || new Hardware(store, { port: configuredPorts.sdk });
  const localPort = configuredPorts.panel;
  const clients = new Set(); const rate = new RateLimiter(240); const globalRate = new RateLimiter(2000);
  let local, heartbeat;
  const snapshot = () => ({ version: VERSION, master: store.data.master, hardware: hardware.snapshot(), presets, profiles: store.data.profiles.map(({ id, name, master, devices, studio: savedStudio }) => ({ id, name, color: master.color, settings: master, deviceCount: Object.keys(devices || {}).length, spatial: Boolean(savedStudio?.enabled) })), alexa: { enabled: store.data.alexaEnabled, status: alexa.status }, performance: store.data.performance || { fps: 20 }, studio: studio.snapshot() });
  const broadcast = () => {
    const message = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const client of clients) {
      if (!security.session(client.req) || client.res.destroyed || client.res.writableLength > 256 * 1024) { client.res.end(); clients.delete(client); continue; }
      client.res.write(message);
    }
  };
  const alexa = new Alexa(store, hardware, directory, broadcast, { port: configuredPorts.alexa, getInterfaces });
  const studio = new Studio(store, hardware, directory, broadcast); hardware.studio = studio;
  hardware.on('change', broadcast);
  function headers(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=(), payment=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  }
  function json(res, status, data) { if (res.destroyed) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
  const assets = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'application/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']],
    ['/studio.js', ['studio.js', 'application/javascript; charset=utf-8']], ['/studio.css', ['studio.css', 'text/css; charset=utf-8']], ['/spatial.js', ['spatial.js', 'application/javascript; charset=utf-8']],
    ['/manifest.json', ['manifest.json', 'application/manifest+json']], ['/sw.js', ['sw.js', 'application/javascript; charset=utf-8']],
    ['/icon-192.png', ['icon-192.png', 'image/png']], ['/icon-512.png', ['icon-512.png', 'image/png']]
  ]);
  async function request(req, res) {
    headers(res);
    const ip = network.normalize(req.socket.remoteAddress); const isLocal = network.loopback(ip);
    const lport = local?.address()?.port || localPort;
    if (!isLocal && !network.sameSubnet(ip, getInterfaces())) return json(res, 403, { error: 'Este aplicativo atende somente a rede local.' });
    if (!network.allowedHost(req.headers.host, lport, getInterfaces())) return json(res, 403, { error: 'Host inválido.' });
    if (req.headers['x-forwarded-for'] || req.headers.forwarded || req.headers['x-forwarded-host']) return json(res, 403, { error: 'Proxies não são permitidos.' });
    const origin = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
    if (req.headers.origin && req.headers.origin !== origin) return json(res, 403, { error: 'Origem não autorizada.' });
    if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Origem não autorizada.' });
    if (!rate.take(ip) || !globalRate.take('all')) return json(res, 429, { error: 'Muitas requisições. Aguarde um minuto.' });
    const url = new URL(req.url, origin); const route = url.pathname;
    if (route === '/api/health' && req.method === 'GET' && isLocal) return json(res, 200, { ready: true, application: 'nexus-rgb', version: VERSION });
    if (req.method === 'OPTIONS') return json(res, 405, { error: 'Método não permitido.' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.headers.origin !== origin || req.headers['x-nexus-client'] !== 'web') return json(res, 403, { error: 'Requisição sem proteção de origem.' });
    }
    if (route === '/api/session/local' && req.method === 'POST') {
      if (!isLocal) return json(res, 403, { error: 'Apenas no PC.' });
      res.setHeader('Set-Cookie', security.cookie(security.newAdmin(), !!req.socket.encrypted, 8 * 3600));
      return json(res, 200, { admin: true });
    }
    const session = security.session(req);
    if (route.startsWith('/api/')) {
      if (!session) return json(res, 401, { error: 'Abra o painel neste computador para iniciar a sessão local.' });
      const admin = () => { if (!session.admin || !isLocal) throw Object.assign(new Error('Este ajuste só pode ser feito no PC.'), { status: 403 }); };
      if (route === '/api/settings' && req.method === 'POST') { admin(); store.performance(await readBody(req)); hardware.setFps?.(); broadcast(); return json(res, 200, snapshot()); }
      if (route === '/api/studio' && req.method === 'GET') return json(res, 200, studio.snapshot(true));
      if (route === '/api/studio/play' && req.method === 'POST') { const body = await readBody(req); if (!body || Object.keys(body).some(k => !['activeId', 'values', 'enabled'].includes(k))) throw Error('Comando de efeito inválido.'); studio.configure(body); return json(res, 200, studio.snapshot(true)); }
      if (route === '/api/studio' && req.method === 'POST') { admin(); studio.configure(await readBody(req, 128 * 1024)); return json(res, 200, studio.snapshot(true)); }
      if (route === '/api/studio/preview' && req.method === 'GET') { studio.watch(req, res, () => security.session(req)); return; }
      if (route === '/api/studio/import' && req.method === 'POST') { admin(); const body = await readBody(req, 256 * 1024); const id = await studio.import(body.source); return json(res, 200, { id, ...studio.snapshot(true) }); }
      const effectRoute = route.match(/^\/api\/studio\/effects\/([a-f0-9]{24})$/);
      if (effectRoute && req.method === 'DELETE') { admin(); studio.remove(effectRoute[1]); return json(res, 200, studio.snapshot(true)); }
      if (route === '/api/session' && req.method === 'GET') return json(res, 200, { admin: session.admin });
      if (route === '/api/state' && req.method === 'GET') return json(res, 200, snapshot());
      if (route === '/api/events' && req.method === 'GET') {
        if (clients.size >= 16) return json(res, 503, { error: 'Limite de conexões.' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
        res.write(`retry: 3000\ndata: ${JSON.stringify(snapshot())}\n\n`); const client = { req, res }; clients.add(client);
        res.on('close', () => clients.delete(client)); res.on('error', () => clients.delete(client)); return;
      }
      if (route === '/api/control' && req.method === 'POST') { store.master(await readBody(req)); hardware.changed(); broadcast(); return json(res, 200, snapshot()); }
      const presetRoute = route.match(/^\/api\/presets\/([a-z]{1,24})$/);
      if (presetRoute && req.method === 'POST') { await readBody(req); applyPreset(store, presetRoute[1]); hardware.changed(); broadcast(); return json(res, 200, snapshot()); }
      const deviceRoute = route.match(/^\/api\/devices\/([a-f0-9]{24})(\/resize)?$/);
      if (deviceRoute && req.method === 'POST') {
        const device = hardware.snapshot().devices.find(d => d.id === deviceRoute[1]);
        if (!device) return json(res, 404, { error: 'Dispositivo não encontrado.' });
        const body = await readBody(req);
        if (deviceRoute[2]) { admin(); await hardware.resize(device.id, body.zone, body.count); }
        else {
          if (body.effect !== undefined && !device.effects.includes(body.effect)) throw new Error('Efeito não disponível neste dispositivo.');
          if (body.nativeMode !== undefined && !device.modes.some(m => m.id === body.nativeMode)) throw new Error('Modo não disponível neste dispositivo.');
          store.device(device.id, body, hardware.snapshot().devices.map(item => item.id)); hardware.changed();
        }
        broadcast(); return json(res, 200, snapshot());
      }
      if (route === '/api/profiles' && req.method === 'POST') { admin(); const body = await readBody(req); store.profile(body.name, body.settings); broadcast(); return json(res, 200, snapshot()); }
      const profileRoute = route.match(/^\/api\/profiles\/([a-f0-9-]{36})$/);
      if (profileRoute && req.method === 'POST') { store.applyProfile(profileRoute[1]); studio.reset(); hardware.changed(); broadcast(); return json(res, 200, snapshot()); }
      if (profileRoute && req.method === 'PUT') { admin(); const body = await readBody(req); store.updateProfile(profileRoute[1], body.name, body.settings); broadcast(); return json(res, 200, snapshot()); }
      if (profileRoute && req.method === 'DELETE') { admin(); store.data.profiles = store.data.profiles.filter(p => p.id !== profileRoute[1]); store.save(); broadcast(); return json(res, 200, snapshot()); }
      if (route === '/api/network' && req.method === 'GET') {
        admin(); return json(res, 200, { urls: getInterfaces().map(a => ({ name: a.name, address: a.address, url: `http://${a.address}:${lport}` })), ports: { panel: lport, sdk: configuredPorts.sdk, alexa: alexa.port, discovery: 1900 }, alexa: alexa.snapshot(), dataDirectory: directory, uptime: Math.floor(process.uptime()), memoryMB: Math.round(process.memoryUsage().rss / 1048576) });
      }
      if (route === '/api/link' && req.method === 'POST') {
        admin(); const body = await readBody(req); const addresses = getInterfaces(); const chosen = addresses.find(a => a.address === body.address) || addresses[0];
        if (!chosen) throw new Error('Conecte o PC a uma rede privada Wi-Fi ou Ethernet.');
        const link = `http://${chosen.address}:${lport}/`;
        return json(res, 200, { link, qr: await QRCode.toDataURL(link, { width: 260, margin: 2 }) });
      }
      if (route === '/api/alexa' && req.method === 'POST') {
        admin(); const body = await readBody(req);
        if (typeof body.enabled !== 'boolean') throw new Error('enabled inválido.');
        store.data.alexaEnabled = body.enabled; store.save(); if (body.enabled) alexa.start(); else alexa.stop(); broadcast(); return json(res, 200, alexa.snapshot());
      }
      if (route === '/api/alexa/discover' && req.method === 'POST') { admin(); alexa.openDiscovery(); return json(res, 200, alexa.snapshot()); }
      if (route === '/api/alexa/approve' && req.method === 'POST') { admin(); alexa.approve((await readBody(req)).ip); return json(res, 200, alexa.snapshot()); }
      if (route === '/api/alexa/revoke' && req.method === 'POST') { admin(); const body = await readBody(req); alexa.data.peers = alexa.data.peers.filter(ip => ip !== body.ip); alexa.save(); return json(res, 200, alexa.snapshot()); }
      return json(res, 405, { error: 'Rota ou método não disponível.' });
    }
    const asset = assets.get(route);
    if (!asset || !['GET', 'HEAD'].includes(req.method)) return json(res, 404, { error: 'Página não encontrada.' });
    res.writeHead(200, { 'Content-Type': asset[1] });
    if (req.method === 'HEAD') return res.end();
    res.end(fs.readFileSync(path.join(__dirname, '..', 'public', asset[0])));
  }
  const handler = (req, res) => request(req, res).catch(error => {
    if (!res.headersSent) json(res, error.status || 400, { error: error.message }); else res.end();
  });
  local = http.createServer(handler);
  local.requestTimeout = 15000; local.headersTimeout = 10000; local.keepAliveTimeout = 5000; local.maxConnections = 64; local.maxRequestsPerSocket = 100;
  async function start() {
    const listen = (server, port, host) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.removeListener('error', reject); resolve(); }); });
    try { await listen(local, localPort, '0.0.0.0'); }
    catch (error) { await stop(); if (['EADDRINUSE', 'EACCES'].includes(error.code)) error.message = `Não foi possível abrir a porta ${localPort} do painel (${error.code}). No ícone do Nexus perto do relógio, abra Configurar portas, escolha outra porta e aplique.`; throw error; }
    local.on('error', error => console.error('Servidor:', error.code));
    heartbeat = setInterval(() => { for (const client of clients) { if (!security.session(client.req)) { client.res.end(); clients.delete(client); } else client.res.write(': keepalive\n\n'); } }, 15000);
    if (!options.disableHardware && process.env.NEXUS_DISABLE_HARDWARE !== '1') hardware.start();
    if (!options.disableAlexa) alexa.start();
    console.log(`Nexus RGB ${VERSION}: http://127.0.0.1:${local.address().port} | LAN local`);
    return { localPort: local.address().port };
  }
  async function stop() {
    clearInterval(heartbeat); studio.stop(); hardware.stop(); alexa.stop();
    for (const client of clients) client.res.end(); clients.clear();
    local.closeAllConnections(); if (local.listening) await new Promise(resolve => local.close(resolve));
  }
  return { start, stop, local, store, security, hardware, alexa, studio, snapshot };
}
if (require.main === module) {
  let app;
  createApp().then(async value => { app = value; await app.start(); }).catch(error => { console.error(error); process.exitCode = 1; app?.stop(); });
  const shutdown = async () => { await app?.stop(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  process.on('uncaughtException', error => { console.error('Falha fatal:', error.message); process.exit(1); });
  process.on('unhandledRejection', error => { console.error('Falha fatal:', error?.message); process.exit(1); });
}
module.exports = { createApp, readBody };
