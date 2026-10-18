'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ControllerRegistry,
  buildLianLiDevice,
  encodeLianLiPacket,
  encodeLianLiPackets,
  buildNzxtKrakenDevice,
  encodeNzxtPacket,
  encodeNzxtPackets
} = require('../server/controllers');
const { Hardware } = require('../server/hardware');
const spatial = require('../public/spatial');

const defaults = { power: true, brightness: 100, speed: 50, effect: 'rainbow', color: '#ff0055', palette: 'neon' };

test('Lian Li protocol: packet encoding and fan decomposition', () => {
  // 1. Single packet encoding
  const colors = [
    { red: 255, green: 0, blue: 128 },
    { red: 0, green: 255, blue: 64 }
  ];
  const packet = encodeLianLiPacket({ channel: 2, colors, brightness: 80 });
  assert.equal(packet.length, 64);
  assert.equal(packet[0], 0xE0); // Header
  assert.equal(packet[1], 2);    // Channel 2
  assert.equal(packet[2], 2);    // 2 LEDs
  assert.equal(packet[3], Math.round(80 * 2.55)); // Brightness scale
  assert.equal(packet[4], 255);  // LED 0 R
  assert.equal(packet[5], 0);    // LED 0 G
  assert.equal(packet[6], 128);  // LED 0 B
  assert.equal(packet[7], 0);    // LED 1 R
  assert.equal(packet[8], 255);  // LED 1 G
  assert.equal(packet[9], 64);   // LED 1 B

  // 2. Blackout packet
  const blackout = encodeLianLiPacket({ channel: 1, colors, brightness: 100, isPowerOff: true });
  assert.equal(blackout[0], 0xE0);
  assert.equal(blackout[2], 0); // 0 LEDs lit
  assert.equal(blackout[3], 0); // 0 Brightness

  // 3. Multi-packet chunking (48 LEDs -> 3 packets of 20, 20, 8)
  const fullArray = Array.from({ length: 48 }, (_, i) => ({ red: i, green: i, blue: i }));
  const chunks = encodeLianLiPackets({ channel: 1, colors: fullArray, brightness: 100 });
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0][2], 20);
  assert.equal(chunks[1][2], 20);
  assert.equal(chunks[2][2], 8);

  // 4. Device construction & fan component splitting
  const lianLiDev = buildLianLiDevice({
    name: 'Gabinete Lian Li Uni Hub',
    channels: [
      { fans: 3, type: 'sl120' }, // 3x 16 = 48 LEDs
      { fans: 2, type: 'al120' }, // 2x 32 = 64 LEDs
      { fans: 0, type: 'sl120' },
      { fans: 1, type: 'strimer' } // 120 LEDs
    ]
  });

  assert.equal(lianLiDev.vendor, 'Lian Li');
  assert.equal(lianLiDev.busType, 'usb-hid');
  assert.equal(lianLiDev.nativeController, true);
  assert.equal(lianLiDev.ledCount, 48 + 64 + 120); // 232 LEDs
  assert.equal(lianLiDev.components.length, 3 + 2 + 1); // 6 independent parts

  // Fans have kind: 'argb', busType: 'usb-hid', type: 3 (cooler)
  const fan1 = lianLiDev.components[0];
  assert.equal(fan1.name, 'Ventoinha 1.1 (Uni Fan SL120)');
  assert.equal(fan1.kind, 'argb');
  assert.equal(fan1.ledCount, 16);
  assert.equal(fan1.offset, 0);

  const fan4 = lianLiDev.components[3];
  assert.equal(fan4.name, 'Ventoinha 2.1 (Uni Fan AL120)');
  assert.equal(fan4.ledCount, 32);
  assert.equal(fan4.offset, 48);

  const strimer = lianLiDev.components[5];
  assert.equal(strimer.type, 4); // Strip
  assert.equal(strimer.ledCount, 120);
});

test('NZXT Kraken protocol: packet encoding and AIO component decomposition', () => {
  // 1. Single packet encoding
  const colors = [
    { red: 200, green: 100, blue: 50 },
    { red: 10, green: 20, blue: 30 }
  ];
  const packet = encodeNzxtPacket({ target: 0x10, colors, brightness: 50 });
  assert.equal(packet.length, 64);
  assert.equal(packet[0], 0x22); // Opcode
  assert.equal(packet[1], 0x10); // Target zone
  assert.equal(packet[2], 0x00); // Sub-opcode
  assert.equal(packet[3], 2);    // LED count
  assert.equal(packet[4], Math.round(200 * 0.5)); // LED 0 R scaled
  assert.equal(packet[5], Math.round(100 * 0.5)); // LED 0 G scaled
  assert.equal(packet[6], Math.round(50 * 0.5));  // LED 0 B scaled

  // 2. Blackout
  const blackout = encodeNzxtPacket({ target: 0x10, colors, brightness: 100, isPowerOff: true });
  assert.equal(blackout[0], 0x22);
  assert.equal(blackout[3], 0);

  // 3. Multi-packet chunking
  const fullArray = Array.from({ length: 41 }, (_, i) => ({ red: i, green: i, blue: i }));
  const chunks = encodeNzxtPackets({ target: 0x10, colors: fullArray, brightness: 100 });
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0][3], 20);
  assert.equal(chunks[1][3], 20);
  assert.equal(chunks[2][3], 1);

  // 4. Device construction & AIO component splitting
  const krakenDev = buildNzxtKrakenDevice({
    name: 'NZXT Kraken Elite 360',
    ringLeds: 16,
    hasLogo: true,
    fanLeds: 24
  });

  assert.equal(krakenDev.vendor, 'NZXT');
  assert.equal(krakenDev.busType, 'usb-hid');
  assert.equal(krakenDev.nativeController, true);
  assert.equal(krakenDev.ledCount, 16 + 1 + 24); // 41 LEDs
  assert.equal(krakenDev.components.length, 3);

  const ring = krakenDev.components[0];
  assert.equal(ring.name, 'NZXT Kraken Elite 360 — Anel LED');
  assert.equal(ring.kind, 'argb');
  assert.equal(ring.ledCount, 16);
  assert.equal(ring.offset, 0);

  const logo = krakenDev.components[1];
  assert.equal(logo.name, 'NZXT Kraken Elite 360 — Logo Central');
  assert.equal(logo.ledCount, 1);
  assert.equal(logo.offset, 16);

  const fans = krakenDev.components[2];
  assert.equal(fans.name, 'NZXT Kraken Elite 360 — Ventoinhas ARGB');
  assert.equal(fans.ledCount, 24);
  assert.equal(fans.offset, 17);
});

test('ControllerRegistry: store configuration, lifecycle, transport and privacy summary', async () => {
  const store = {
    data: {
      nativeControllers: {
        lianLi: {
          enabled: true,
          name: 'Lian Li Principal',
          channels: [{ fans: 3, type: 'sl120' }]
        },
        nzxtKraken: {
          enabled: true,
          name: 'Kraken Z73',
          ringLeds: 16,
          hasLogo: true,
          fanLeds: 0
        }
      }
    }
  };

  const registry = new ControllerRegistry({ store });
  const devices = registry.getDevices();
  assert.equal(devices.length, 2);

  // Verify privacy summary contains no sensitive internal details
  const summary = registry.getSummary();
  assert.equal(summary.length, 2);
  assert.deepEqual(summary[0], {
    name: 'Lian Li Principal',
    vendor: 'Lian Li',
    type: 3,
    busType: 'usb-hid',
    ledCount: 48
  });

  // Verify sendLeds and packet tracking
  const devId = devices[0].id;
  const testColors = [{ red: 255, green: 0, blue: 0 }];
  const sent = await registry.sendLeds(devId, testColors, false);
  assert.equal(sent, true);

  const lastPacket = registry.getLastPacket(devId);
  assert(Buffer.isBuffer(lastPacket));
  assert.equal(lastPacket[0], 0xE0);
  assert.equal(lastPacket[4], 255);

  // Removal & Clear
  registry.removeController(devId);
  assert.equal(registry.getDevices().length, 1);
  registry.clear();
  assert.equal(registry.getDevices().length, 0);
});

const { EventEmitter } = require('node:events');

test('Hardware integration: native controllers discovery, snapshot and packet delivery', async (t) => {
  const store = {
    data: {
      master: { ...defaults },
      devices: {},
      nativeControllers: {
        lianLi: {
          enabled: true,
          name: 'Lian Li Uni Hub',
          channels: [{ fans: 2, type: 'sl120' }] // 32 LEDs -> 2 fans
        }
      }
    }
  };

  class MockClient extends EventEmitter {
    constructor() { super(); }
    async connect() {}
    async getControllerCount() { return 1; }
    async getControllerData() {
      return {
        name: 'Placa-Mãe ARGB',
        vendor: 'ASUS',
        type: 0,
        location: 'PCI: Intel i801 SMBus',
        description: 'Motherboard',
        colors: Array.from({ length: 10 }, () => ({ red: 0, green: 0, blue: 0 })),
        modes: [{ id: 0, name: 'direct', flagList: ['perLedColor'] }],
        zones: [{ id: 0, name: 'Header 1', ledsCount: 10, ledsMin: 0, ledsMax: 60, resizable: false }]
      };
    }
    updateLeds() {}
    async updateMode() {}
    disconnect() {}
  }

  const hardware = new Hardware(store, { makeClient: () => new MockClient() });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();

  // Snapshot must contain both OpenRGB motherboard device AND Lian Li split fans
  const snap = hardware.snapshot();
  assert.equal(snap.connected, true);
  assert(snap.busTypes.includes('usb-hid'));
  assert(snap.busTypes.some(b => b.includes('smbus')));
  assert.equal(snap.nativeControllers.length, 1);

  // The devices array should have 3 items: ASUS motherboard + Fan 1.1 + Fan 1.2
  assert.equal(snap.devices.length, 3);
  const fan1 = snap.devices.find(d => d.name.includes('Ventoinha 1.1'));
  const fan2 = snap.devices.find(d => d.name.includes('Ventoinha 1.2'));
  assert(fan1);
  assert(fan2);
  assert.equal(fan1.status, 'online');
  assert.equal(fan1.busType, 'usb-hid');
  assert.equal(fan1.vendor, 'Lian Li');

  // Test Studio spatial fan geometry
  const spatialItems = spatial.defaults(snap.devices);
  const spatialFan = spatialItems.find(item => item.key === fan1.id);
  assert(spatialFan);
  assert.equal(spatialFan.shape, 'fan'); // Lian Li fans automatically map to circular fan shape

  // Test tick and packet dispatching
  await hardware.tick();
  assert(hardware.metrics.framesSent >= 1);

  // Verify the packet sent to the Lian Li controller
  const lianLiDev = hardware.devices.find(d => d.nativeController);
  const lastPacket = hardware.controllerRegistry.getLastPacket(lianLiDev.id);
  assert(Buffer.isBuffer(lastPacket));
  assert.equal(lastPacket[0], 0xE0);
});

test('Standalone native controller operation: works without OpenRGB daemon connected', async (t) => {
  const store = {
    data: {
      master: { ...defaults },
      devices: {},
      nativeControllers: {
        nzxtKraken: {
          enabled: true,
          name: 'NZXT Kraken X73',
          ringLeds: 16,
          hasLogo: true,
          fanLeds: 24
        }
      }
    }
  };

  // Hardware instance without OpenRGB connection
  const hardware = new Hardware(store);
  t.after(() => hardware.stop());
  hardware.stopped = false;

  assert.equal(hardware.connected, false);
  assert.equal(hardware.hasNativeControllers(), true);

  // Snapshot must show connected because native controller is present
  const snap = hardware.snapshot();
  assert.equal(snap.connected, true);
  assert.equal(snap.controllerCount, 1);
  assert.equal(snap.devices.length, 3); // Ring, Logo, Fans

  const ring = snap.devices.find(d => d.name.includes('Anel LED'));
  const logo = snap.devices.find(d => d.name.includes('Logo Central'));
  const fans = snap.devices.find(d => d.name.includes('Ventoinhas ARGB'));

  assert(ring);
  assert(logo);
  assert(fans);
  assert.equal(ring.status, 'online');
  assert.equal(logo.status, 'online');
  assert.equal(fans.status, 'online');

  // Verify spatial geometry
  const spatialItems = spatial.defaults(snap.devices);
  const ringItem = spatialItems.find(i => i.key === ring.id);
  const fanItem = spatialItems.find(i => i.key === fans.id);
  assert.equal(ringItem.shape, 'fan');
  assert.equal(fanItem.shape, 'fan');

  // Verify tick without OpenRGB socket operates and encodes packets
  await hardware.tick();
  assert(hardware.metrics.framesSent >= 1);

  const devId = hardware.devices[0].id;
  const lastPacket = hardware.controllerRegistry.getLastPacket(devId);
  assert(Buffer.isBuffer(lastPacket));
  assert.equal(lastPacket[0], 0x22); // Opcode for NZXT Kraken
});

test('Protocol boundary values: clamping, channel limits, and safe fallbacks', () => {
  // 1. Channel clamping: Channel 0 clamps to 1, Channel 99 clamps to 4
  const p1 = encodeLianLiPacket({ channel: 0, colors: [{ red: 255 }] });
  assert.equal(p1[1], 1);
  const p2 = encodeLianLiPacket({ channel: 99, colors: [{ red: 255 }] });
  assert.equal(p2[1], 4);

  // 2. Brightness clamping: -50 clamps to 0, 999 clamps to 100 (scaled to 255)
  const p3 = encodeLianLiPacket({ channel: 1, brightness: -50, colors: [{ red: 255 }] });
  assert.equal(p3[3], 0);
  const p4 = encodeLianLiPacket({ channel: 1, brightness: 999, colors: [{ red: 255 }] });
  assert.equal(p4[3], 255);

  // 3. Fallback color handling with undefined / NaN properties
  const p5 = encodeLianLiPacket({ channel: 1, colors: [null, undefined, { red: 'invalid', green: 300, blue: -20 }] });
  assert.equal(p5[2], 3); // 3 LEDs
  assert.equal(p5[4], 0); // null LED -> 0
  assert.equal(p5[5], 0);
  assert.equal(p5[6], 0);
  assert.equal(p5[10], 0); // 'invalid' -> 0
  assert.equal(p5[11], 255); // 300 clamped to 255
  assert.equal(p5[12], 0); // -20 clamped to 0

  // 4. Strimer device spatial mapping (Strip, not Fan)
  const strimerHub = buildLianLiDevice({
    name: 'Strimer Controller',
    channels: [{ fans: 1, type: 'strimer' }]
  });
  const strimerSnap = { devices: strimerHub.components };
  const spatialStrimer = spatial.defaults(strimerSnap.devices);
  assert.equal(spatialStrimer[0].shape, 'strip');
});
