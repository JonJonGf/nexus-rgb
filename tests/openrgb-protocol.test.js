'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), net = require('node:net');
const { OpenRGBClient: Client } = require('../server/openrgb-client');
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
function str(text) { const b = Buffer.from(text + '\0'); return Buffer.concat([u16(b.length), b]); }
// Protocol v4 fixture: one GPU, one mode and one LED. Values deliberately
// start nonzero so a requested zero cannot pass by retaining hardware state.
function descriptor(flags = 81) {
  const body = Buffer.concat([u32(2), ...['GPU fixture','Fixture','GPU','1','','PCI:fixture'].map(str),
    u16(1), u32(0), str('Static'), ...[1,flags,0,10,0,99,0,1,3,99,2,2].map(u32), u16(1), Buffer.from([1,2,3,0]),
    u16(0), u16(1), str('Logo'), u32(0), u16(1), Buffer.from([1,2,3,0])]);
  return Buffer.concat([u32(body.length + 4), body]);
}
function packet(device, command, body) { return Buffer.concat([Buffer.from('ORGB'), u32(device), u32(command), u32(body.length), body]); }
test('descoberta SDK aceita capacidades novas de modo sem perder flags conhecidas', async t => {
  const sockets = new Set(), server = net.createServer(socket => {
    sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffered=Buffer.alloc(0);
    socket.on('data',data=>{buffered=Buffer.concat([buffered,data]);while(buffered.length>=16&&buffered.length>=16+buffered.readUInt32LE(12)){
      const size=buffered.readUInt32LE(12),device=buffered.readUInt32LE(4),command=buffered.readUInt32LE(8);buffered=buffered.subarray(16+size);
      if(command===40)socket.write(packet(device,command,u32(4)));
      if(command===1)socket.write(packet(device,command,descriptor(81 | 1024 | 2048 | 0x20000000)));
    }});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const client=new Client('Nexus flags fixture',server.address().port,'127.0.0.1',{forceProtocolVersion:4});
  t.after(async()=>{client.disconnect();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
  await client.connect();const device=await client.getControllerData(0);
  assert.equal(device.modes[0].flags,536874065);
  for(const flag of ['speed','brightness','modeSpecificColor','requiresEntireDevice','directionDiag','direction'])assert.ok(device.modes[0].flagList.includes(flag),flag);
  assert.equal(device.modes[0].direction,2);
  assert.deepEqual(device.colors,[{red:1,green:2,blue:3}]);
});
test('SDK transmite zeros exatos e usa descritor já lido ao trocar modo da GPU', async t => {
  const requests = [], sockets = new Set(); let resolveMode;
  const arrived = new Promise(resolve => { resolveMode = resolve; });
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); let buffered = Buffer.alloc(0);
    socket.on('data', data => {
      buffered = Buffer.concat([buffered, data]);
      while (buffered.length >= 16 && buffered.length >= 16 + buffered.readUInt32LE(12)) {
        const length = buffered.readUInt32LE(12), message = buffered.subarray(0, 16 + length); buffered = buffered.subarray(16 + length);
        const device = message.readUInt32LE(4), command = message.readUInt32LE(8); requests.push(command);
        if (command === 40) socket.write(packet(device, command, u32(4)));
        if (command === 1) socket.write(packet(device, command, descriptor()));
        if (command === 1101) resolveMode(Buffer.from(message));
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const client = new Client('Nexus protocol fixture', server.address().port, '127.0.0.1', { forceProtocolVersion: 4 });
  t.after(async () => { client.disconnect(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  await client.connect(); const raw = await client.getControllerData(7);
  await client.updateMode(7, { ...raw.modes[0], speed: 0, brightness: 0, direction: 0, colorMode: 0, colors: [] });
  const timeout = setTimeout(() => resolveMode(null), 1000); const message = await arrived; clearTimeout(timeout);
  assert.ok(message, 'Servidor deve receber o modo pelo socket real.');
  assert.equal(message.readUInt32LE(4), 7);
  const body = message.subarray(16), fields = 10 + body.readUInt16LE(8);
  assert.equal(body.readUInt32LE(0), body.length);
  assert.equal(body.readUInt32LE(fields + 32), 0, 'Velocidade zero precisa chegar ao controlador.');
  assert.equal(body.readUInt32LE(fields + 36), 0, 'Brilho zero precisa chegar ao controlador.');
  assert.equal(body.readUInt32LE(fields + 40), 0);
  assert.equal(body.readUInt32LE(fields + 44), 0);
  assert.equal(body.readUInt16LE(fields + 48), 0);
  assert.equal(requests.filter(command => command === 1).length, 1, 'Troca de modo não deve reler o descritor no barramento.');
});
