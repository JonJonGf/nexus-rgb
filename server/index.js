'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Store, readJson, writeJson } = require('./store');
const { presets, applyPreset } = require('./presets');
const { Security, RateLimiter } = require('./security');
const { Hardware } = require('./hardware');
const { Alexa } = require('./alexa');
const network = require('./network');
const QRCode = require('qrcode');
const VERSION = require('../package.json').version;
const { ports } = require('./ports');
const { Studio } = require('./studio');
const { DraftPreview } = require('./draft-preview');
const { FirstUse } = require('./first-use');
const { about } = require('./about');
const { Backups, MAX: BACKUP_MAX } = require('./backup');
const { Resources } = require('./resources');
const { diagnostics } = require('./diagnostics');
const { Conflicts } = require('./conflicts');
const { Experiences } = require('./experiences');
const { Room } = require('./room');
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
  const firstUse=new FirstUse(directory,options.disableWelcome===true);
  const getInterfaces = options.getInterfaces || network.adapters;
  const networkFile = path.join(directory, 'network.json');
  let preferredAddress = '';
  try { const saved = readJson(networkFile, { address: '' }); if (saved && typeof saved.address === 'string' && network.privateIp(saved.address)) preferredAddress = saved.address; } catch {}
  const store = options.store || new Store(directory); const security = new Security(directory, getInterfaces);
  const hardware = options.hardware || new Hardware(store, { port: configuredPorts.sdk });
  const localPort = configuredPorts.panel;
  const clients = new Set();
  const readRate = new RateLimiter(240), writeRate = new RateLimiter(180), signalRate = new RateLimiter(900), liveRate = new RateLimiter(900), heavyRate = new RateLimiter(60), assetRate = new RateLimiter(512), globalRate = new RateLimiter(2000);
  let local, heartbeat;
  const resolveLan = (port = local?.address()?.port || localPort) => {
    const addresses = getInterfaces();
    const chosen = network.selectAdapter(addresses, preferredAddress);
    return { addresses, chosen, selectedAddress: chosen?.address || null, lanUrl: chosen ? `http://${chosen.address}:${port}/` : null };
  };
  const savePreferredAddress = address => {
    if (typeof address !== 'string' || (address !== '' && !network.privateIp(address))) throw new Error('Endereço de rede inválido.');
    const addresses = getInterfaces();
    if (address !== '' && !addresses.some(a => a.address === address)) throw new Error('Endereço de rede indisponível.');
    preferredAddress = address;
    writeJson(networkFile, { address: preferredAddress });
  };
  const snapshot = () => ({ version: VERSION, library: store.data.library || {favorites:[],categories:{},transitionMs:0}, master: store.data.master, hardware: hardware.snapshot(), presets, profiles: store.data.profiles.map(({ id, name, master, devices, studio: savedStudio }) => ({ id, name, color: master.color, settings: master, deviceCount: Object.keys(devices || {}).length, spatial: Boolean(savedStudio?.enabled) })), alexa: { enabled: store.data.alexaEnabled, status: alexa.status }, performance: store.data.performance || { fps: 20 }, studio: studio.snapshot() });
  const broadcast = () => {
    const message = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const client of clients) {
      if (!security.session(client.req) || client.res.destroyed || client.res.writableLength > 256 * 1024) { client.res.end(); clients.delete(client); continue; }
      client.res.write(message);
    }
  };
  const alexa = new Alexa(store, hardware, directory, broadcast, { port: configuredPorts.alexa, getInterfaces });
  const studio = new Studio(store, hardware, directory, broadcast, options.studio); hardware.studio = studio;
  const draftPreview = new DraftPreview(studio);
  const backups = new Backups(store,studio,directory);
  const resources = new Resources();
  const conflicts = options.conflicts || new Conflicts();
  const experiences = new Experiences(store,hardware,studio,directory,broadcast);
  hardware.experiences = experiences; studio.experiences = experiences;
  const room=new Room(hardware,studio,directory,broadcast,{getInterfaces,...options.room});hardware.room=room;
  hardware.on('change', broadcast);
  function headers(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=(), payment=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  }
  function json(res, status, data) { if (res.destroyed) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
  const assets = new Map([
    ['/experiences.js',['experiences.js','application/javascript; charset=utf-8']],
    ['/experiences.css',['experiences.css','text/css; charset=utf-8']],
    ['/live-model.js',['live-model.js','application/javascript; charset=utf-8']],
    ['/help',['help.html','text/html; charset=utf-8']],
    ['/code-preview.js',['code-preview.js','application/javascript; charset=utf-8']],
    ['/recipe.js', ['recipe.js', 'application/javascript; charset=utf-8']],
    ['/effects-guide', ['effects-guide.html', 'text/html; charset=utf-8']], ['/effects-guide.html', ['effects-guide.html', 'text/html; charset=utf-8']],
    ['/effects-guide.css', ['effects-guide.css', 'text/css; charset=utf-8']],
    ['/en.js', ['en.js', 'application/javascript; charset=utf-8']], ['/i18n.js', ['i18n.js', 'application/javascript; charset=utf-8']],
    ['/map-model.js', ['map-model.js', 'application/javascript; charset=utf-8']], ['/workspace.js', ['workspace.js', 'application/javascript; charset=utf-8']],
    ['/calibration.js', ['calibration.js', 'application/javascript; charset=utf-8']],
    ['/backups.js', ['backups.js','application/javascript; charset=utf-8']],
    ['/health.js', ['health.js','application/javascript; charset=utf-8']],
    ['/library.js', ['library.js','application/javascript; charset=utf-8']],
    ['/updates', ['updates.html','text/html; charset=utf-8']], ['/updates.html', ['updates.html','text/html; charset=utf-8']],
    ['/updates.js', ['updates.js','application/javascript; charset=utf-8']], ['/updates.css', ['updates.css','text/css; charset=utf-8']], ['/release-model.js', ['release-model.js','application/javascript; charset=utf-8']],
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
    const url = new URL(req.url, origin); const route = url.pathname;
    const isAsset = ['GET', 'HEAD'].includes(req.method) && assets.has(route);
    const isHeavy = route === '/api/studio/import' || route === '/api/studio/draft' || /^\/api\/studio\/effects\/[a-f0-9]{24}\/duplicate$/.test(route) || route === '/api/backups' || route.startsWith('/api/backups/') || route === '/api/resources' || route === '/api/diagnostics' || route === '/api/conflicts' || route === '/api/link' || route === '/api/alexa/discover';
    const budget = isAsset ? assetRate : route==='/api/experiences/live' ? liveRate : route==='/api/experiences/signal' ? signalRate : isHeavy ? heavyRate : ['GET', 'HEAD'].includes(req.method) ? readRate : writeRate;
    if (!budget.take(ip) || !globalRate.take('all')) return json(res, 429, { error: 'Muitas requisições. Aguarde um minuto.' });
    if (route === '/api/health' && req.method === 'GET' && isLocal) {
      const lan = resolveLan(lport);
      return json(res, 200, { ready: true, application: 'nexus-rgb', version: VERSION, lanUrl: lan.lanUrl, hardware: { connected: hardware.connected, devices: hardware.snapshot().devices.length, ...(typeof hardware.detecting === 'boolean' ? { detecting: hardware.detecting } : {}), ...(hardware.controllerHung ? { controllerHung: true } : {}) } });
    }
    if (req.method === 'OPTIONS') return json(res, 405, { error: 'Método não permitido.' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.headers.origin !== origin || req.headers['x-nexus-client'] !== 'web') return json(res, 403, { error: 'Requisição sem proteção de origem.' });
    }
    if (route === '/api/session/local' && req.method === 'POST') {
      if (!isLocal) return json(res, 403, { error: 'Apenas no PC.' });
      res.setHeader('Set-Cookie', security.cookie(security.newAdmin(), !!req.socket.encrypted, 8 * 3600));
      return json(res, 200, { admin: true, welcome: firstUse.take() });
    }
    const session = security.session(req);
    if (route.startsWith('/api/')) {
      if (!session) return json(res, 401, { error: 'Abra o painel neste computador para iniciar a sessão local.' });
      const admin = () => { if (!session.admin || !isLocal) throw Object.assign(new Error('Este ajuste só pode ser feito no PC.'), { status: 403 }); };
      if(route==='/api/experiences'&&req.method==='GET')return json(res,200,experiences.snapshot(session.admin&&isLocal));
      if(route==='/api/experiences/settings'&&req.method==='POST'){admin();return json(res,200,experiences.configure(await readBody(req)));}
      if(route==='/api/experiences/agent'&&req.method==='GET'){admin();return json(res,200,experiences.agentConfig());}
      if(route==='/api/experiences/signal'&&req.method==='POST'){admin();return json(res,200,experiences.signal(await readBody(req)));}
      if(route==='/api/room'&&req.method==='GET'){admin();return json(res,200,room.snapshot());}
      if(route==='/api/room'&&req.method==='POST'){admin();return json(res,200,await room.put(await readBody(req)));}
      const roomRoute=route.match(/^\/api\/room\/([a-f0-9]{24})$/);
      if(roomRoute&&req.method==='DELETE'){admin();const result=await room.remove(roomRoute[1]);return json(res,200,{...room.snapshot(),...result});}
      if(route==='/api/experiences/live'&&req.method==='POST')return json(res,200,experiences.touch(await readBody(req)));
      if(route==='/api/experiences/recordings'&&req.method==='POST')return json(res,200,experiences.record(await readBody(req,65536)));
      const recordingRoute=route.match(/^\/api\/experiences\/recordings\/([a-f0-9-]{36})(\/play)?$/);
      if(recordingRoute&&req.method==='POST'&&recordingRoute[2])return json(res,200,experiences.replayRecording(recordingRoute[1]));
      if(recordingRoute&&req.method==='DELETE'){admin();experiences.removeRecording(recordingRoute[1]);return json(res,200,experiences.snapshot());}
      if(route==='/api/experiences/scenes'&&req.method==='POST'){admin();return json(res,200,experiences.put(await readBody(req,32768)));}
      const sceneRoute=route.match(/^\/api\/experiences\/scenes\/([a-f0-9-]{36})$/);
      if(sceneRoute&&req.method==='DELETE'){admin();experiences.remove(sceneRoute[1]);return json(res,200,experiences.snapshot());}
      if(route==='/api/experiences/play'&&req.method==='POST'){const body=await readBody(req);if(Object.keys(body).some(k=>k!=='id'))throw Error('Comando inválido.');return json(res,200,experiences.play(body.id));}
      if(route==='/api/experiences/stop'&&req.method==='POST'){await readBody(req);experiences.stop();return json(res,200,experiences.snapshot());}
      if(req.method==='POST'&&(route==='/api/control'||route.startsWith('/api/devices/')||route.startsWith('/api/presets/')||route==='/api/studio'||route==='/api/studio/play'||/^\/api\/profiles\/[a-f0-9-]{36}$/.test(route)||route==='/api/backups/restore'))experiences.cancel();
      if (route === '/api/about' && req.method === 'GET') return json(res,200,about());
      if (route === '/api/resources' && req.method === 'GET') {admin();return json(res,200,await resources.sample());}
      if (route === '/api/diagnostics' && req.method === 'GET') {admin();return json(res,200,diagnostics(hardware,studio,store,resources));}
      if (route === '/api/conflicts' && req.method === 'GET') {admin();return json(res,200,await conflicts.sample());}
      if (route === '/api/backups' && req.method === 'GET') {admin();return json(res,200,backups.export());}
      if (route === '/api/backups/review' && req.method === 'POST') {admin();return json(res,200,await backups.review(await readBody(req,BACKUP_MAX)));}
      if (route === '/api/backups/restore' && req.method === 'POST') {admin();const body=await readBody(req);if(Object.keys(body).length!==1||!Object.hasOwn(body,'token'))throw Error('Comando de restauração inválido.');const result=backups.apply(body.token);experiences.reload();if(store.data.alexaEnabled)alexa.start();else alexa.stop();broadcast();return json(res,200,result);}
      if (route === '/api/settings' && req.method === 'POST') { admin(); store.performance(await readBody(req)); hardware.setFps?.(); broadcast(); return json(res, 200, snapshot()); }
      if(route==='/api/library'&&req.method==='POST'){admin();const keys=[...store.data.profiles.map(p=>'profile:'+p.id),...presets.map(p=>'preset:'+p.id),...require('./store').effects.map(e=>'motion:'+e),...[...studio.effects.keys()].map(e=>'spatial:'+e)];store.library(await readBody(req),keys);broadcast();return json(res,200,snapshot());}
      const cloneEffect=route.match(/^\/api\/studio\/effects\/([a-f0-9]{24})\/duplicate$/);
      if(cloneEffect&&req.method==='POST'){admin();const body=await readBody(req);if(Object.keys(body).some(k=>k!=='name'))throw Error('Comando de cópia inválido.');const id=await studio.duplicate(cloneEffect[1],body.name);return json(res,200,{id,...studio.snapshot(true)});}
      const cloneProfile=route.match(/^\/api\/profiles\/([a-f0-9-]{36})\/duplicate$/);
      if(cloneProfile&&req.method==='POST'){admin();const body=await readBody(req);if(Object.keys(body).some(k=>k!=='name'))throw Error('Comando de cópia inválido.');store.duplicateProfile(cloneProfile[1],body.name);broadcast();return json(res,200,snapshot());}
      const identifyRoute = route.match(/^\/api\/devices\/([a-f0-9]{24})\/identify$/);
      if (identifyRoute && req.method === 'POST') {
        admin(); const body = await readBody(req);
        if (Object.keys(body).some(k => !['led','stop'].includes(k)) || body.stop !== undefined && typeof body.stop !== 'boolean') throw Error('Comando de identificação inválido.');
        hardware.identify(identifyRoute[1],body.led,body.stop); await hardware.tick();
        return json(res,200,{active:hardware.identification || null});
      }
      if (route === '/api/studio' && req.method === 'GET') return json(res, 200, studio.snapshot(true));
      if(route==='/api/studio/draft'&&req.method==='POST'){admin();const body=await readBody(req,256*1024);if(Object.keys(body).some(k=>!['source','values'].includes(k)))throw Error('Comando de prévia inválido.');return json(res,200,await draftPreview.create(body.source,body.values));}
      const draftRoute=route.match(/^\/api\/studio\/draft\/([a-f0-9]{48})$/);
      if(draftRoute&&req.method==='GET'){admin();draftPreview.watch(draftRoute[1],res,()=>security.session(req)?.admin);return;}
      if(draftRoute&&req.method==='DELETE'){admin();draftPreview.remove(draftRoute[1]);return json(res,200,{stopped:true});}
      if (route === '/api/studio/play' && req.method === 'POST') { const body = await readBody(req); if (!body || Object.keys(body).some(k => !['activeId', 'values', 'enabled'].includes(k))) throw Error('Comando de efeito inválido.'); studio.configure(body); return json(res, 200, studio.snapshot(true)); }
      if (route === '/api/studio/recover' && req.method === 'POST') { const body = await readBody(req); if (!body || Object.keys(body).some(k => k !== 'action')) throw Error('Comando de recuperação inválido.'); await studio.recover(body.action); broadcast(); return json(res, 200, studio.snapshot(true)); }
      if (route === '/api/studio' && req.method === 'POST') { admin(); studio.configure(await readBody(req, 128 * 1024)); return json(res, 200, studio.snapshot(true)); }
      if (route === '/api/studio/preview' && req.method === 'GET') { studio.watch(req, res, () => security.session(req)); return; }
      if (route === '/api/studio/import' && req.method === 'POST') { admin(); const body = await readBody(req, 256 * 1024); const id = await studio.import(body.source); return json(res, 200, { id, ...studio.snapshot(true) }); }
      if (route === '/api/studio/profiles' && req.method === 'POST') { admin(); studio.profile(await readBody(req)); broadcast(); return json(res, 200, snapshot()); }
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
      if (route === '/api/control' && req.method === 'POST') { const body = await readBody(req); store.master(body); if (body.power === false) hardware.cancelIdentification?.(); hardware.changed(); broadcast(); return json(res, 200, snapshot()); }
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
          store.device(device.id, body, hardware.snapshot().devices.map(item => item.id)); if (body.power === false) hardware.cancelIdentification?.(device.id); hardware.changed();
        }
        broadcast(); return json(res, 200, snapshot());
      }
      if (route === '/api/profiles' && req.method === 'POST') { admin(); const body = await readBody(req); store.profile(body.name, body.settings); broadcast(); return json(res, 200, snapshot()); }
      const profileRoute = route.match(/^\/api\/profiles\/([a-f0-9-]{36})$/);
      if (profileRoute && req.method === 'POST') { store.applyProfile(profileRoute[1]); hardware.transition?.(store.data.library?.transitionMs||0); studio.reset(); hardware.changed(); broadcast(); return json(res, 200, snapshot()); }
      if (profileRoute && req.method === 'PUT') { admin(); const body = await readBody(req); store.updateProfile(profileRoute[1], body.name, body.settings); broadcast(); return json(res, 200, snapshot()); }
      if (profileRoute && req.method === 'DELETE') { admin();if(experiences.usesProfile(profileRoute[1]))throw Object.assign(Error('Perfil em uso por uma cena ou regra de aplicativo.'),{status:409});store.data.profiles = store.data.profiles.filter(p => p.id !== profileRoute[1]); store.save(); broadcast(); return json(res, 200, snapshot()); }
      if (route === '/api/network' && req.method === 'GET') {
        admin(); const lan = resolveLan(lport);
        return json(res, 200, { urls: lan.addresses.map(a => ({ name: a.name, address: a.address, url: `http://${a.address}:${lport}` })), selectedAddress: lan.selectedAddress, lanUrl: lan.lanUrl, ports: { panel: lport, sdk: configuredPorts.sdk, alexa: alexa.port, discovery: 1900 }, alexa: alexa.snapshot(), dataDirectory: directory, uptime: Math.floor(process.uptime()), memoryMB: Math.round(process.memoryUsage().rss / 1048576) });
      }
      if (route === '/api/network' && req.method === 'POST') {
        admin(); const body = await readBody(req);
        if (Object.keys(body).some(k => k !== 'address')) throw new Error('Configuração inválida.');
        savePreferredAddress(body.address ?? '');
        const lan = resolveLan(lport);
        return json(res, 200, { selectedAddress: lan.selectedAddress, lanUrl: lan.lanUrl });
      }
      if (route === '/api/link' && req.method === 'POST') {
        admin(); const body = await readBody(req); const addresses = getInterfaces();
        if (typeof body.address === 'string' && addresses.some(a => a.address === body.address)) savePreferredAddress(body.address);
        const chosen = addresses.find(a => a.address === body.address) || network.selectAdapter(addresses, preferredAddress);
        if (!chosen) throw new Error('Conecte o PC a uma rede privada Wi-Fi ou Ethernet.');
        const link = `http://${chosen.address}:${lport}/`;
        return json(res, 200, { link, address: chosen.address, qr: await QRCode.toDataURL(link, { width: 260, margin: 2 }) });
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
    if (route === '/updates' || route === '/updates.html') res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' https://api.github.com; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
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
    clearInterval(heartbeat);await room.close(); experiences.close(); draftPreview.close(); studio.stop(); hardware.stop(); alexa.stop();
    for (const client of clients) client.res.end(); clients.clear();
    local.closeAllConnections(); if (local.listening) await new Promise(resolve => local.close(resolve));
  }
  return { start, stop, local, store, security, hardware, alexa, studio, draftPreview, experiences, room, snapshot };
}
if (require.main === module) {
  let app, stopping = false;
  const shutdown = async () => { if (stopping) return; stopping = true; await app?.stop(); process.exit(0); };
  createApp().then(async value => { app = value; if (stopping) { await app.stop(); process.exit(0); } await app.start(); }).catch(error => { console.error(error); process.exitCode = 1; app?.stop(); });
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  if (process.env.NEXUS_SUPERVISED === '1') {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { if (chunk.includes('shutdown')) shutdown(); });
    process.stdin.on('end', shutdown);
    process.stdin.unref?.();
  }
  process.on('uncaughtException', error => { console.error('Falha fatal:', error.message); process.exit(1); });
  process.on('unhandledRejection', error => { console.error('Falha fatal:', error?.message); process.exit(1); });
}
module.exports = { createApp, readBody };
