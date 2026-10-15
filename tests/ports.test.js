'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { ports } = require('../server/ports');
const { createApp } = require('../server');
const { fixture } = require('./helpers/http-app');

test('configuração de portas recusa números ambíguos, fora do limite e colisões internas', () => {
  assert.deepEqual(ports({}, {}), { panel: 5050, sdk: 6743, alexa: 80 });
  for (const value of ['', 'NaN', ' 5050', '5050x', '1e3', '-1', '65536', '0', 1.5, null, true]) assert.throws(() => ports({}, { NEXUS_PORT: value === null ? 'null' : value }));
  assert.throws(() => ports({}, { NEXUS_PORT: '6743' }), /diferentes/);
  assert.deepEqual(ports({ localPort: 0, rgbPort: 7001, alexaPort: 8080 }, {}), { panel: 0, sdk: 7001, alexa: 8080 });
});

test('porta do painel ocupada produz diagnóstico e preserva o aplicativo que a utiliza', async t => {
  const server = http.createServer((req, res) => res.end('outro aplicativo'));
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-port-conflict-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const occupied = server.address().port;
  const app = await createApp({ directory, localPort: occupied, disableHardware: true, disableAlexa: true });
  await assert.rejects(app.start(), error => error.code === 'EADDRINUSE' && error.message.includes(String(occupied)) && error.message.includes('Configurar portas'));
  assert.equal(await (await fetch(`http://127.0.0.1:${occupied}`)).text(), 'outro aplicativo');
});

test('API, links e validação de Host acompanham a porta realmente utilizada', async t => {
  const { app, request, cookie, localPort } = await fixture(t, { rgbPort: 7001, alexaPort: 8080 });
  const network = await request('/api/network', { cookie }); assert.equal(network.status, 200);
  assert.deepEqual(network.json().ports, { panel: localPort, sdk: 7001, alexa: 8080, discovery: 1900 });
  for (const item of network.json().urls) assert.equal(new URL(item.url).port, String(localPort));
  assert.equal((await request('/api/health', { headers: { Host: '127.0.0.1:5050' } })).status, 403);
  assert.equal((await request('/api/health')).json().application, 'nexus-rgb');
  assert.equal(app.hardware.port, 7001);
});

test('conflito da ponte Alexa informa a porta certa sem derrubar o painel', async t => {
  const server = http.createServer((req, res) => res.end('outro aplicativo'));
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const occupied = server.address().port;
  const { app, request } = await fixture(t, { alexaPort: occupied });
  app.store.data.alexaEnabled = true; app.alexa.start();
  for (let attempt = 0; attempt < 100 && !app.alexa.status.includes('ocupada'); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.match(app.alexa.status, new RegExp(`Porta ${occupied}.*ocupada`));
  assert.equal((await request('/api/health')).status, 200);
});
