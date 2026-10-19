'use strict';

/**
 * Clean-room implementation of Corsair Lighting & Commander controller protocol encoder.
 * Designed from hardware wire analysis and standard USB-HID packet specifications.
 * 100% original implementation licensed under the MIT License for Nexus RGB Studio.
 */

const crypto = require('node:crypto');

const CORSAIR_FAN_TYPES = {
  strip: { name: 'Fita LED RGB', ledsPerItem: 10, kind: 'strip', type: 4, shape: 'strip' },
  sp: { name: 'Ventoinha SP RGB', ledsPerItem: 1, kind: 'argb', type: 3, shape: 'fan' },
  hd: { name: 'Ventoinha HD RGB', ledsPerItem: 12, kind: 'argb', type: 3, shape: 'fan' },
  ml: { name: 'Ventoinha ML RGB', ledsPerItem: 4, kind: 'argb', type: 3, shape: 'fan' },
  ll: { name: 'Ventoinha LL RGB', ledsPerItem: 16, kind: 'argb', type: 3, shape: 'fan' },
  ql: { name: 'Ventoinha QL RGB', ledsPerItem: 34, kind: 'argb', type: 3, shape: 'fan' }
};

const CORSAIR_MODELS = {
  commander_pro: { name: 'Corsair Commander Pro', channels: 2, maxLedsPerChannel: 120 },
  commander_core: { name: 'Corsair Commander Core / XT', channels: 6, maxLedsPerChannel: 34 },
  lighting_node_pro: { name: 'Corsair Lighting Node Pro', channels: 2, maxLedsPerChannel: 120 },
  lighting_node_core: { name: 'Corsair Lighting Node Core', channels: 1, maxLedsPerChannel: 204 }
};

/**
 * Encodes an array of {red, green, blue} colors into a 64-byte USB-HID report for Corsair controllers.
 * @param {Object} options
 * @param {number} [options.channel=1] - Channel index (1 to 6)
 * @param {number} [options.offset=0] - Starting LED index
 * @param {Array<{red: number, green: number, blue: number}>} options.colors - LED colors
 * @param {number} [options.brightness=100] - 0 to 100
 * @param {boolean} [options.isPowerOff=false]
 * @returns {Buffer} 64-byte Buffer
 */
function encodeCorsairPacket({
  channel = 1,
  offset = 0,
  colors = [],
  brightness = 100,
  isPowerOff = false
} = {}) {
  const buf = Buffer.alloc(64, 0x00);

  // Byte 0: Command Opcode (0x33: Write LED Stream / Buffer)
  buf[0] = 0x33;
  // Byte 1: Channel (0-indexed in firmware: 0 or 1)
  buf[1] = Math.max(0, Math.min(5, (Number(channel) || 1) - 1));
  // Byte 2: Starting LED offset
  buf[2] = Math.max(0, Math.min(255, Number(offset) || 0));
  // Byte 3: Number of LEDs in this chunk (up to 20 LEDs per 64-byte chunk)
  const count = isPowerOff ? 0 : Math.min(colors.length, 20);
  buf[3] = count;

  // Scale factor for brightness
  const scale = isPowerOff ? 0 : Math.max(0, Math.min(100, Number(brightness) || 0)) / 100;

  // Payload: G, R, B or R, G, B depending on Corsair channel config (standard: RGB)
  if (!isPowerOff) {
    for (let i = 0; i < count; i++) {
      const c = colors[i] || { red: 0, green: 0, blue: 0 };
      const idx = 4 + i * 3;
      buf[idx] = Math.max(0, Math.min(255, Math.round((Number(c.red) || 0) * scale)));
      buf[idx + 1] = Math.max(0, Math.min(255, Math.round((Number(c.green) || 0) * scale)));
      buf[idx + 2] = Math.max(0, Math.min(255, Math.round((Number(c.blue) || 0) * scale)));
    }
  }

  return buf;
}

/**
 * Encodes an array of colors into multiple 64-byte USB-HID packets.
 * @param {Object} options
 * @returns {Array<Buffer>}
 */
function encodeCorsairPackets({
  channel = 1,
  colors = [],
  brightness = 100,
  isPowerOff = false
} = {}) {
  if (isPowerOff || colors.length === 0) {
    return [encodeCorsairPacket({ channel, offset: 0, colors: [], brightness, isPowerOff: true })];
  }
  const packets = [];
  const chunkSize = 20;
  for (let i = 0; i < colors.length; i += chunkSize) {
    const chunk = colors.slice(i, i + chunkSize);
    packets.push(encodeCorsairPacket({ channel, offset: i, colors: chunk, brightness, isPowerOff: false }));
  }
  return packets;
}

/**
 * Constructs a structured Nexus RGB device object for a Corsair controller.
 * @param {Object} options
 * @returns {Object} Structured controller device
 */
function buildCorsairDevice({
  id = null,
  name = 'Corsair Commander Pro',
  model = 'commander_pro',
  channels = [
    { items: 3, type: 'll' }, // Channel 1: 3x LL120 (48 LEDs)
    { items: 2, type: 'strip' } // Channel 2: 2x Strip (20 LEDs)
  ]
} = {}) {
  const modelInfo = CORSAIR_MODELS[model] || CORSAIR_MODELS.commander_pro;
  const devId = id || crypto.createHash('sha256').update(`corsair|${name}|${model}`).digest('hex').slice(0, 24);

  let totalLeds = 0;
  const zones = [];
  const componentList = [];

  channels.forEach((ch, chIdx) => {
    const chNum = chIdx + 1;
    const count = Math.max(0, Math.min(6, Number(ch.items) || 0));
    const fanType = CORSAIR_FAN_TYPES[ch.type] || CORSAIR_FAN_TYPES.ll;
    const ledsPerItem = fanType.ledsPerItem;
    const channelLeds = count * ledsPerItem;

    if (channelLeds > 0) {
      const zoneId = chIdx;
      const zoneName = `Canal ${chNum} (${count}x ${fanType.name})`;
      zones.push({
        id: zoneId,
        name: zoneName,
        leds: channelLeds,
        min: 0,
        max: 204,
        resizable: true
      });

      for (let i = 0; i < count; i++) {
        const compId = crypto.createHash('sha256').update(`${devId}|ch${chNum}|item${i + 1}`).digest('hex').slice(0, 24);
        componentList.push({
          id: compId,
          name: `${fanType.name} ${chNum}.${i + 1}`,
          kind: fanType.kind,
          controllerName: name,
          zoneId,
          ledCount: ledsPerItem,
          offset: totalLeds + i * ledsPerItem,
          type: fanType.type,
          busType: 'usb-hid',
          vendor: 'Corsair',
          shape: fanType.shape,
          zones: [{ id: zoneId, name: zoneName, leds: channelLeds }]
        });
      }

      totalLeds += channelLeds;
    }
  });

  if (totalLeds === 0) {
    totalLeds = 48;
    zones.push({ id: 0, name: 'Canal 1 (3x LL RGB)', leds: 48, min: 0, max: 204, resizable: true });
    for (let i = 0; i < 3; i++) {
      const compId = crypto.createHash('sha256').update(`${devId}|ch1|item${i + 1}`).digest('hex').slice(0, 24);
      componentList.push({
        id: compId,
        name: `Ventoinha LL RGB 1.${i + 1}`,
        kind: 'argb',
        controllerName: name,
        zoneId: 0,
        ledCount: 16,
        offset: i * 16,
        type: 3,
        busType: 'usb-hid',
        vendor: 'Corsair',
        shape: 'fan',
        zones: [{ id: 0, name: 'Canal 1 (3x LL RGB)', leds: 48 }]
      });
    }
  }

  const raw = {
    name,
    vendor: 'Corsair',
    type: 3, // Cooler / Controller
    location: `USB: Corsair ${modelInfo.name}`,
    description: modelInfo.name,
    colors: Array.from({ length: totalLeds }, () => ({ red: 0, green: 0, blue: 0 })),
    modes: [
      { id: 0, name: 'direct', flagList: ['perLedColor'] },
      { id: 1, name: 'static', flagList: ['perLedColor'] },
      { id: 2, name: 'off', flagList: [] }
    ],
    zones
  };

  return {
    id: devId,
    name,
    vendor: 'Corsair',
    type: 3,
    busType: 'usb-hid',
    ledCount: totalLeds,
    nativeController: true,
    controllerType: 'corsair',
    corsairModel: model,
    raw,
    direct: raw.modes[0],
    fixed: raw.modes[1],
    off: raw.modes[2],
    error: null,
    effects: ['static', 'rainbow', 'wave', 'breathe', 'pulse', 'strobe', 'sequence', 'comet'],
    modes: raw.modes.map(m => ({ id: m.id, name: m.name })),
    zones,
    components: componentList
  };
}

module.exports = {
  CORSAIR_FAN_TYPES,
  CORSAIR_MODELS,
  encodeCorsairPacket,
  encodeCorsairPackets,
  buildCorsairDevice
};
