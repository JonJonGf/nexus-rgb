'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { Security, RateLimiter } = require('../server/security'); const network = require('../server/network');
const interfaces = [{ name: 'Wi-Fi', address: '192.168.3.46', netmask: '255.255.255.0' }];
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
test('DNS rebinding, VPNs e endereços públicos não viram destinos locais', () => {
  assert.equal(network.allowedHost('attacker.example:5050', 5050, interfaces), false);
  assert.equal(network.allowedHost('192.168.3.46:5050', 5050, interfaces), true);
  assert.equal(network.sameSubnet('::ffff:192.168.3.7', interfaces), true);
  assert.equal(network.sameSubnet('192.168.30.7', interfaces), false);
  assert.deepEqual(network.adapters({ VPN: [{ family: 'IPv4', internal: false, address: '10.0.0.1', netmask: '255.255.255.0' }], Ethernet: [{ family: 'IPv4', internal: false, address: '8.8.8.8' }] }), []);
});
