'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { Security, RateLimiter } = require('../server/security'); const network = require('../server/network');
const interfaces = [{ name: 'Wi-Fi', address: '192.168.3.46', netmask: '255.255.255.0' }];

test('metadados de rede incompletos ou máscara inválida não ampliam autorização LAN', () => {
  for (const netmask of [undefined, '', 'invalid', '255.255.0', '0.0.0.0', '255.0.255.0']) {
    assert.equal(network.sameSubnet('192.168.99.7', [{ address: '192.168.3.46', netmask }]), false);
    assert.equal(network.sameSubnet('192.168.3.7', [{ address: '192.168.3.46', netmask }]), false);
  }
  assert.equal(network.sameSubnet('192.168.3.7', [{ address: '8.8.8.8', netmask: '255.255.255.0' }]), false);
  assert.equal(network.sameSubnet('192.168.3.7', interfaces), true);
});

test('sessões vencidas, tokens forjados e sessões removidas pelo limite não recebem administração', () => {
  const { hash } = require('../server/security');
  const security = new Security('', () => interfaces);
  const request = token => ({ socket: { remoteAddress: '127.0.0.1' }, headers: { cookie: `nexus_session=${token}` } });
  const first = security.newAdmin(); security.admins.set(hash(first), Date.now() - 1);
  assert.equal(security.session(request(first)), null);
  assert.equal(security.session(request('a'.repeat(43))), null);
  assert.equal(security.session(request('invalid')), null);
  const oldest = security.newAdmin();
  for (let i = 0; i < 32; i++) security.newAdmin();
  assert.equal(security.admins.size, 32); assert.equal(security.session(request(oldest)), null);
});
test('LAN acessa sem token; IP externo e outra sub-rede são recusados', () => {
  const security = new Security('', () => interfaces);
  assert.equal(security.session({ socket: { remoteAddress: '192.168.3.7' }, headers: {} }).admin, false);
  for (const ip of ['8.8.8.8', '192.168.4.7', '10.0.0.7', '::1', '127.0.0.1']) assert.equal(security.session({ socket: { remoteAddress: ip }, headers: {} }), null);
});
test('sessão administrativa exige token E origem de socket loopback', () => {
  const security = new Security('', () => interfaces); const token = security.newAdmin();
  const req = { socket: { remoteAddress: '127.0.0.1' }, headers: { cookie: `nexus_session=${token}` } };
  assert.equal(security.session(req).admin, true);
  req.socket.remoteAddress = '192.168.3.7'; assert.equal(security.session(req).admin, false);
  req.socket.remoteAddress = '8.8.8.8'; assert.equal(security.session(req), null);
});
test('limites de requisições expiram e tabela não cresce indefinidamente', () => {
  const rate = new RateLimiter(2, 100); assert.equal(rate.take('a', 0), true); assert.equal(rate.take('a', 1), true); assert.equal(rate.take('a', 2), false); assert.equal(rate.take('a', 100), true);
  for (let i = 0; i < 1500; i++) rate.take(String(i), 101);
  assert.ok(rate.entries.size <= 1024);
});
test('DNS rebinding, VPNs e endereços públicos não viram destinos locais, e seleção prioriza gateway real sem depender da Internet', async t => {
  const { fixture } = require('./helpers/http-app');
  assert.equal(network.allowedHost('attacker.example:5050', 5050, interfaces), false);
  assert.equal(network.allowedHost('192.168.3.46:5050', 5050, interfaces), true);
  assert.equal(network.sameSubnet('::ffff:192.168.3.7', interfaces), true);
  assert.equal(network.sameSubnet('192.168.30.7', interfaces), false);
  const routes = network.parseRoutes([
    '0.0.0.0          0.0.0.0      192.168.15.1    192.168.15.20     35',
    '0.0.0.0          0.0.0.0      192.168.3.1     192.168.3.46      20',
    '0.0.0.0          0.0.0.0      10.8.0.1        10.8.0.2           5',
    '0.0.0.0          0.0.0.0      172.22.16.1     172.22.16.1       15'
  ].join('\n'));
  const raw = {
    'WireGuard Tunnel': [{ family: 'IPv4', internal: false, address: '10.8.0.2', netmask: '255.255.255.0' }],
    'Tailscale': [{ family: 'IPv4', internal: false, address: '10.99.0.5', netmask: '255.255.0.0' }],
    'vEthernet (WSL)': [{ family: 'IPv4', internal: false, address: '172.22.16.1', netmask: '255.255.240.0' }],
    'vEthernet (Default Switch)': [{ family: 'IPv4', internal: false, address: '172.19.0.1', netmask: '255.255.240.0' }],
    'vEthernet (Sem Gateway)': [{ family: 'IPv4', internal: false, address: '192.168.88.1', netmask: '255.255.255.0' }],
    'vEthernet (Bridge LAN)': [{ family: 'IPv4', internal: false, address: '192.168.15.20', netmask: '255.255.255.0' }],
    'Ethernet Sem Rota': [{ family: 'IPv4', internal: false, address: '192.168.50.10', netmask: '255.255.255.0' }],
    'Wi-Fi': [{ family: 'IPv4', internal: false, address: '192.168.3.46', netmask: '255.255.255.0' }],
    'Pública': [{ family: 'IPv4', internal: false, address: '8.8.8.8', netmask: '255.255.255.0' }]
  };
  const list = network.adapters(raw, routes);
  assert.deepEqual(list.map(i => i.address), ['192.168.3.46', '192.168.15.20', '192.168.50.10']);
  assert.equal(network.selectAdapter(list, '192.168.50.10').address, '192.168.50.10');
  assert.equal(network.selectAdapter(list, '10.8.0.2').address, '192.168.3.46');
  const offline = network.adapters({ 'Wi-Fi Local': [{ family: 'IPv4', internal: false, address: '192.168.3.46', netmask: '255.255.255.0' }] }, []);
  assert.equal(offline.length, 1); assert.equal(offline[0].address, '192.168.3.46');

  const real = network.adapters();
  if (real.length) {
    const f = await fixture(t);
    const chosen = real.at(-1).address;
    const res = await f.request('/api/network', { method: 'POST', cookie: f.cookie, body: { address: chosen } });
    assert.equal(res.status, 200); assert.equal(res.json().selectedAddress, chosen);
    assert.equal(res.json().lanUrl, `http://${chosen}:${f.localPort}/`);
    assert.equal((await f.request('/api/health')).json().lanUrl, `http://${chosen}:${f.localPort}/`);
    assert.equal((await f.request('/api/link', { method: 'POST', cookie: f.cookie, body: {} })).json().link, `http://${chosen}:${f.localPort}/`);
    assert.equal((await f.request('/api/network', { method: 'POST', cookie: f.cookie, body: { address: '10.255.255.1' } })).status, 400);
    assert.equal((await f.request('/api/network', { method: 'POST', cookie: f.cookie, body: { address: 'invalido' } })).status, 400);
  }
});
