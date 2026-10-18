'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ControllerRegistry,
  buildKeyboardDevice,
  encodeSinoWealthKeyboardPacket,
  KEYBOARD_LAYOUTS,
  buildNollieDevice,
  encodeNolliePortPacket,
  encodeNolliePortPackets,
  buildCorsairDevice,
  encodeCorsairPacket,
  encodeCorsairPackets,
  buildRazerChromaDevice,
  encodeRazerChromaPacket,
  encodeRazerChromaPackets,
  buildCoolerMasterDevice,
  encodeCoolerMasterPacket,
  encodeCoolerMasterPackets,
  buildMotherboardDevice,
  encodeGigabytePacket,
  encodeMsiPacket
} = require('../server/controllers');
const { Hardware } = require('../server/hardware');
const spatial = require('../public/spatial');

const defaults = { power: true, brightness: 100, speed: 50, effect: 'rainbow', color: '#ff0055', palette: 'neon' };

test('Universal Keyboard: layout calculations and SinoWealth feature report encoding', () => {
  // 1. Layout verification
  assert.equal(KEYBOARD_LAYOUTS['60%'].leds, 61);
  assert.equal(KEYBOARD_LAYOUTS['75%'].leds, 84);
  assert.equal(KEYBOARD_LAYOUTS['tkl'].leds, 87);
  assert.equal(KEYBOARD_LAYOUTS['full'].leds, 104);

  // 2. Build Royal Kludge RK61 keyboard device
  const rk61 = buildKeyboardDevice({
    name: 'Royal Kludge RK61',
    vendor: 'Royal Kludge',
    layout: '60%',
    hidPath: '\\\\?\\HID#VID_258A&PID_00EC&MI_01&Col05'
  });

  assert.equal(rk61.vendor, 'Royal Kludge');
  assert.equal(rk61.type, 5); // Keyboard
  assert.equal(rk61.busType, 'usb-hid');
  assert.equal(rk61.nativeController, true);
  assert.equal(rk61.ledCount, 61);
  assert.equal(rk61.components.length, 1);
  assert.equal(rk61.components[0].type, 5);
  assert.equal(rk61.components[0].shape, 'matrix');

  // 3. SinoWealth Feature Report packet encoding
  const pkt = encodeSinoWealthKeyboardPacket({
    mode: 0x11, // Steady
    speed: 3,
    brightness: 5,
    red: 0,
    green: 255,
    blue: 128
  });

  assert.equal(pkt.length, 65);
  assert.equal(pkt[0], 0x0A); // Report ID
  assert.equal(pkt[1], 0x01);
  assert.equal(pkt[2], 0x01);
  assert.equal(pkt[3], 0x02);
  assert.equal(pkt[4], 0x29);
  assert.equal(pkt[5], 0x11); // Mode steady
  assert.equal(pkt[6], 0x00); // Separation
  assert.equal(pkt[7], 3);    // Speed
  assert.equal(pkt[8], 5);    // Brightness
  assert.equal(pkt[9], 0);    // Red
  assert.equal(pkt[10], 255); // Green
  assert.equal(pkt[11], 128); // Blue
  assert.equal(pkt[12], 0x00);

  // 4. Power off / Blackout packet
  const blackout = encodeSinoWealthKeyboardPacket({ isPowerOff: true });
  assert.equal(blackout[0], 0x0A);
  assert.equal(blackout[5], 0x11);
  assert.equal(blackout[8], 0); // Brightness 0
  assert.equal(blackout[9], 0);
  assert.equal(blackout[10], 0);
  assert.equal(blackout[11], 0);

  // 5. Spatial geometry for keyboard
  const spatialItems = spatial.defaults([rk61]);
  assert.equal(spatialItems[0].key, rk61.id);
  assert.equal(spatialItems[0].count, 61);
});

test('Nollie Controllers: multi-port decomposition and packet chunking', () => {
  // 1. Build Nollie32 controller
  const nollie = buildNollieDevice({
    name: 'Nollie32 Principal',
    model: 'nollie32',
    ports: [
      { leds: 24, type: 'fan', name: '3x Ventoinhas Frontais' },
      { leds: 24, type: 'fan', name: '3x Ventoinhas Topo' },
      { leds: 12, type: 'fan', name: '1x Ventoinha Traseira' },
      { leds: 60, type: 'strip', name: 'Fita LED RGB Inferior' }
    ]
  });

  assert.equal(nollie.vendor, 'Nollie');
  assert.equal(nollie.busType, 'usb-hid');
  assert.equal(nollie.nativeController, true);
  assert.equal(nollie.ledCount, 24 + 24 + 12 + 60); // 120 LEDs
  assert.equal(nollie.components.length, 4);

  // Fans vs Strip
  assert.equal(nollie.components[0].name, '3x Ventoinhas Frontais');
  assert.equal(nollie.components[0].type, 3);
  assert.equal(nollie.components[0].shape, 'fan');

  assert.equal(nollie.components[3].name, 'Fita LED RGB Inferior');
  assert.equal(nollie.components[3].type, 4); // Strip
  assert.equal(nollie.components[3].shape, 'strip');

  // 2. Packet encoding
  const colors = [{ red: 255, green: 50, blue: 0 }];
  const pkt = encodeNolliePortPacket({ port: 2, offset: 0, colors, brightness: 80 });
  assert.equal(pkt.length, 64);
  assert.equal(pkt[0], 0xB0); // Nollie opcode
  assert.equal(pkt[1], 1);    // Port 2 (0-based = 1)
  assert.equal(pkt[2], 0);    // Offset 0
  assert.equal(pkt[3], 1);    // 1 LED
  assert.equal(pkt[4], Math.round(255 * 0.8)); // Scaled R
  assert.equal(pkt[5], Math.round(50 * 0.8));  // Scaled G
  assert.equal(pkt[6], 0);

  // 3. Multi-packet chunking (50 LEDs -> 3 packets)
  const fullColors = Array.from({ length: 50 }, (_, i) => ({ red: i, green: i, blue: i }));
  const chunks = encodeNolliePortPackets({ port: 1, colors: fullColors, brightness: 100 });
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0][3], 20);
  assert.equal(chunks[1][3], 20);
  assert.equal(chunks[2][3], 10);
});

test('Corsair Controllers: Commander Pro & Lighting Node encoding and decomposition', () => {
  const corsair = buildCorsairDevice({
    name: 'Corsair Commander Core XT',
    model: 'commander_core',
    channels: [
      { items: 3, type: 'ql' },   // 3x QL120 (34 LEDs each = 102 LEDs)
      { items: 2, type: 'strip' } // 2x Strip (10 LEDs each = 20 LEDs)
    ]
  });

  assert.equal(corsair.vendor, 'Corsair');
  assert.equal(corsair.ledCount, 102 + 20); // 122 LEDs
  assert.equal(corsair.components.length, 5); // 3 QL fans + 2 strips

  const qlFan1 = corsair.components[0];
  assert.equal(qlFan1.ledCount, 34);
  assert.equal(qlFan1.type, 3);
  assert.equal(qlFan1.shape, 'fan');

  const strip1 = corsair.components[3];
  assert.equal(strip1.ledCount, 10);
  assert.equal(strip1.type, 4);
  assert.equal(strip1.shape, 'strip');

  // Packet encoding
  const colors = [{ red: 200, green: 100, blue: 50 }];
  const pkt = encodeCorsairPacket({ channel: 2, offset: 0, colors, brightness: 50 });
  assert.equal(pkt.length, 64);
  assert.equal(pkt[0], 0x33); // Corsair opcode
  assert.equal(pkt[1], 1);    // Channel 2 (0-based)
  assert.equal(pkt[3], 1);    // 1 LED
  assert.equal(pkt[4], Math.round(200 * 0.5));
  assert.equal(pkt[5], Math.round(100 * 0.5));
  assert.equal(pkt[6], Math.round(50 * 0.5));

  // Chunking
  const fullColors = Array.from({ length: 45 }, () => ({ red: 255, green: 255, blue: 255 }));
  const chunks = encodeCorsairPackets({ channel: 1, colors: fullColors, brightness: 100 });
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0][3], 20);
  assert.equal(chunks[1][3], 20);
  assert.equal(chunks[2][3], 5);
});

test('Razer Chroma ARGB & Cooler Master ARGB controllers', () => {
  // 1. Razer Chroma
  const razer = buildRazerChromaDevice({
    name: 'Razer Chroma Hub',
    ports: [
      { leds: 36, type: 'fan', name: 'Fans Frontais' },
      { leds: 24, type: 'strip', name: 'Fita Underglow' }
    ]
  });

  assert.equal(razer.vendor, 'Razer');
  assert.equal(razer.ledCount, 60);
  assert.equal(razer.components.length, 2);

  const rPkt = encodeRazerChromaPacket({ port: 2, offset: 0, colors: [{ red: 255, green: 0, blue: 0 }] });
  assert.equal(rPkt.length, 64);
  assert.equal(rPkt[0], 0x00);
  assert.equal(rPkt[3], 0x0F);
  assert.equal(rPkt[4], 0x02);
  assert.equal(rPkt[5], 1); // Port 2 (0-indexed)
  assert.equal(rPkt[7], 1);
  assert.equal(rPkt[8], 255);

  const rChunks = encodeRazerChromaPackets({ port: 1, colors: Array(40).fill({ red: 10, green: 20, blue: 30 }) });
  assert.equal(rChunks.length, 3); // 18 + 18 + 4

  // 2. Cooler Master ARGB
  const cm = buildCoolerMasterDevice({
    name: 'Cooler Master A1',
    ports: [
      { leds: 24, type: 'fan', name: 'MasterFan 1' },
      { leds: 24, type: 'fan', name: 'MasterFan 2' }
    ]
  });

  assert.equal(cm.vendor, 'Cooler Master');
  assert.equal(cm.ledCount, 48);
  assert.equal(cm.components.length, 2);

  const cmPkt = encodeCoolerMasterPacket({ port: 1, colors: [{ red: 0, green: 255, blue: 0 }] });
  assert.equal(cmPkt.length, 64);
  assert.equal(cmPkt[0], 0x51);
  assert.equal(cmPkt[1], 0x28); // Port 1
  assert.equal(cmPkt[2], 1);
  assert.equal(cmPkt[5], 255); // Green

  const cmChunks = encodeCoolerMasterPackets({ port: 1, colors: Array(45).fill({ red: 0, green: 0, blue: 255 }) });
  assert.equal(cmChunks.length, 3);
});

test('Multi-brand Motherboards: ASUS, Gigabyte, MSI, ASRock header decomposition', () => {
  // 1. Gigabyte AORUS
  const aorus = buildMotherboardDevice({ brand: 'gigabyte' });
  assert.equal(aorus.vendor, 'Gigabyte');
  assert.equal(aorus.type, 0); // Motherboard
  assert(aorus.components.length >= 4);

  const gPkt = encodeGigabytePacket({ header: 1, colors: [{ red: 255, green: 200, blue: 0 }] });
  assert.equal(gPkt.length, 64);
  assert.equal(gPkt[0], 0xCC);
  assert.equal(gPkt[4], 255);

  // 2. MSI Mystic Light
  const msi = buildMotherboardDevice({ brand: 'msi' });
  assert.equal(msi.vendor, 'MSI');
  const mPkt = encodeMsiPacket({ header: 1, colors: [{ red: 100, green: 50, blue: 25 }] });
  assert.equal(mPkt.length, 64);
  assert.equal(mPkt[0], 0x52);

  // 3. ASRock Polychrome
  const asrock = buildMotherboardDevice({ brand: 'asrock' });
  assert.equal(asrock.vendor, 'ASRock');
});

test('ControllerRegistry: store configuration and dispatch across all controller types', () => {
  const store = {
    data: {
      nativeControllers: {
        keyboard: {
          enabled: true,
          name: 'Royal Kludge RK61',
          vendor: 'Royal Kludge',
          layout: '60%'
        },
        nollie: {
          enabled: true,
          name: 'Nollie16 Setup',
          model: 'nollie16',
          ports: [{ leds: 24, type: 'fan' }]
        },
        corsair: {
          enabled: true,
          name: 'Commander Pro',
          model: 'commander_pro',
          channels: [{ items: 2, type: 'll' }]
        },
        razerChroma: {
          enabled: true,
          name: 'Razer Chroma Box',
          ports: [{ leds: 24, type: 'fan' }]
        },
        coolerMaster: {
          enabled: true,
          name: 'Cooler Master Box',
          ports: [{ leds: 24, type: 'fan' }]
        },
        motherboard: {
          enabled: true,
          brand: 'gigabyte'
        }
      }
    }
  };

  const registry = new ControllerRegistry({ store });
  const devices = registry.getDevices();
  assert.equal(devices.length, 6); // All 6 controllers instantiated

  // Test sendLeds to Keyboard
  const kbDev = devices.find(d => d.type === 5);
  assert(kbDev);
  const kbSent = registry.sendLeds(kbDev.id, [{ red: 0, green: 255, blue: 100 }]);
  assert.equal(kbSent, true);
  const kbPkt = registry.getLastPacket(kbDev.id);
  assert.equal(kbPkt[0], 0x0A); // Report ID 0x0A for SinoWealth

  // Test sendLeds to Nollie
  const nollieDev = devices.find(d => d.controllerType === 'nollie');
  assert(nollieDev);
  const nollieSent = registry.sendLeds(nollieDev.id, [{ red: 255, green: 0, blue: 0 }]);
  assert.equal(nollieSent, true);
  const nolliePkt = registry.getLastPacket(nollieDev.id);
  assert.equal(nolliePkt[0], 0xB0);

  // Summary verification
  const summary = registry.getSummary();
  assert.equal(summary.length, 6);
  assert(summary.some(s => s.name === 'Royal Kludge RK61' && s.type === 5));
});

test('Hardware integration with Keyboard and Nollie: snapshot, categories and tick', async (t) => {
  const store = {
    data: {
      master: { ...defaults },
      devices: {},
      nativeControllers: {
        keyboard: {
          enabled: true,
          name: 'Royal Kludge RK61',
          vendor: 'Royal Kludge',
          layout: '60%'
        },
        nollie: {
          enabled: true,
          name: 'Nollie32 Controller',
          model: 'nollie32',
          ports: [{ leds: 24, type: 'fan', name: 'Ventoinhas Frontais' }]
        }
      }
    }
  };

  const hardware = new Hardware(store);
  t.after(() => hardware.stop());
  hardware.stopped = false;

  const snap = hardware.snapshot();
  assert.equal(snap.connected, true);
  assert.equal(snap.controllerCount, 2);

  // Verify devices list includes keyboard (type 5) and nollie fan (type 3)
  const kb = snap.devices.find(d => d.type === 5);
  const fan = snap.devices.find(d => d.type === 3);
  assert(kb);
  assert(fan);
  assert.equal(kb.name, 'Royal Kludge RK61');
  assert.equal(kb.ledCount, 61);
  assert.equal(fan.name, 'Ventoinhas Frontais');

  // Test tick and frame delivery
  await hardware.tick();
  assert(hardware.metrics.framesSent >= 2);

  const kbLast = hardware.controllerRegistry.getLastPacket(kb.id);
  const fanLast = hardware.controllerRegistry.getLastPacket(hardware.devices.find(d => d.controllerType === 'nollie').id);
  assert(Buffer.isBuffer(kbLast));
  assert(Buffer.isBuffer(fanLast));
  assert.equal(kbLast[0], 0x0A);
  assert.equal(fanLast[0], 0xB0);
});

test('Keyboard syncWithPc and event-driven proprietary hardware effects', () => {
  const store = {
    data: {
      master: { power: true, color: '#ff0055', brightness: 90, speed: 60, effect: 'wave' },
      devices: {}
    }
  };

  const registry = new ControllerRegistry({ store });
  const kb = registry.addKeyboardController({
    name: 'Royal Kludge RK61 Test',
    vendor: 'Royal Kludge',
    layout: '60%'
  });

  // 1. Initial send with master effect = wave -> mode 0x01 (Wave/Rainbow) with colorMixing = 0x01
  const sent1 = registry.sendLeds(kb.id, []);
  assert.equal(sent1, true);
  const pkt1 = registry.getLastPacket(kb.id);
  assert.equal(pkt1[5], 0x01); // Mode 0x01 Wave
  assert.equal(pkt1[12], 0x01); // colorMixing 0x01 (multicolor)

  // 2. Second send with identical state -> 0 packets sent (event-driven deduplication)
  const transport = registry.transports.get(kb.id);
  const sent2 = transport.send([], false);
  assert.equal(sent2, pkt1); // Returns cached packet without re-encoding or sending

  // 3. Switch master to breathe -> mode 0x12 (Breathing)
  store.data.master.effect = 'breathe';
  const sent3 = transport.send([], false);
  assert.equal(sent3[5], 0x12);
  assert.equal(sent3[12], 0x00); // Single color mixing
  assert.equal(sent3[9], 255); // Red 255 from #ff0055
  assert.equal(sent3[10], 0);   // Green 0
  assert.equal(sent3[11], 85);  // Blue 85

  // 4. Switch master to static -> mode 0x11
  store.data.master.effect = 'static';
  store.data.master.color = '#00ff88';
  const sent4 = transport.send([], false);
  assert.equal(sent4[5], 0x11);
  assert.equal(sent4[9], 0);
  assert.equal(sent4[10], 255);
  assert.equal(sent4[11], 136);

  // 5. Decouple keyboard: syncWithPc = false without custom settings
  // It must return cached/lastSent without sending anything
  store.data.devices[kb.id] = { syncWithPc: false };
  const lastBeforeDecouple = registry.getLastPacket(kb.id);
  // Master changes, but decoupled keyboard should ignore it completely
  store.data.master.effect = 'scanner';
  store.data.master.color = '#ffffff';
  const sentDecoupled = transport.send([], false);
  assert.equal(sentDecoupled, lastBeforeDecouple);

  // 6. Decoupled keyboard with individual setting (e.g. nativeMode 0x03)
  store.data.devices[kb.id] = { syncWithPc: false, nativeMode: 0x03, color: '#ffff00' };
  const sentCustom = transport.send([], false);
  assert.equal(sentCustom[5], 0x03); // Windmill
  assert.equal(sentCustom[9], 255);
  assert.equal(sentCustom[10], 255);
  assert.equal(sentCustom[11], 0);
});

