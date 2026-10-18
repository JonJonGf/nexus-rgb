'use strict';

/**
 * Clean-room implementation of Lian Li Uni Hub & Strimer protocol encoder.
 * Designed from hardware wire analysis and standard USB-HID packet specifications.
 * 100% original implementation licensed under the MIT License for Nexus RGB Studio.
 */

const crypto = require('node:crypto');

const LIAN_LI_MODELS = {
  sl120: { name: 'Uni Fan SL120', ledsPerFan: 16, maxFansPerChannel: 4 },
  al120: { name: 'Uni Fan AL120', ledsPerFan: 32, maxFansPerChannel: 4 },
  sl_inf: { name: 'Uni Fan SL-Infinity', ledsPerFan: 40, maxFansPerChannel: 4 },
  sl_v2: { name: 'Uni Fan SL-V2', ledsPerFan: 32, maxFansPerChannel: 4 },
  strimer: { name: 'Strimer Plus / V2', ledsPerFan: 120, maxFansPerChannel: 1 }
};

/**
 * Encodes an array of {red, green, blue} colors into a 64-byte USB-HID report for Lian Li controllers.
 * @param {Object} options
 * @param {number} options.channel - Channel index (1 to 4)
 * @param {Array<{red: number, green: number, blue: number}>} options.colors - LED colors
 * @param {number} [options.brightness=100] - 0 to 100 brightness
 * @param {boolean} [options.isPowerOff=false] - Whether power is off (blackout)
 * @returns {Buffer} 64-byte Buffer
 */
function encodeLianLiPacket({ channel = 1, colors = [], brightness = 100, isPowerOff = false } = {}) {
  const buf = Buffer.alloc(64, 0x00);

  // Byte 0: Command Header (0xE0: Direct Per-LED Stream)
  buf[0] = 0xE0;
  // Byte 1: Target Channel (0x00 = All / Sync, 0x01 to 0x04 for individual channels)
  buf[1] = Math.max(1, Math.min(4, Number(channel) || 1));
  // Byte 2: LED Count in this packet (up to 20 LEDs per 64-byte chunk)
  const count = isPowerOff ? 0 : Math.min(colors.length, 20);
  buf[2] = count;
  // Byte 3: Brightness scale (0-255)
  const brightScale = isPowerOff ? 0 : Math.round(Math.max(0, Math.min(100, brightness)) * 2.55);
  buf[3] = brightScale;

  // Bytes 4..63: RGB Color payload (20 LEDs * 3 bytes = 60 bytes)
  if (!isPowerOff) {
    for (let i = 0; i < count; i++) {
      const c = colors[i] || { red: 0, green: 0, blue: 0 };
      const offset = 4 + i * 3;
      buf[offset] = Math.max(0, Math.min(255, Number(c.red) || 0));
      buf[offset + 1] = Math.max(0, Math.min(255, Number(c.green) || 0));
      buf[offset + 2] = Math.max(0, Math.min(255, Number(c.blue) || 0));
    }
  }

  return buf;
}

/**
 * Encodes an array of colors into multiple 64-byte USB-HID report packets (20 LEDs per packet).
 * @param {Object} options
 * @returns {Array<Buffer>} Array of 64-byte Buffers
 */
function encodeLianLiPackets({ channel = 1, colors = [], brightness = 100, isPowerOff = false } = {}) {
  if (isPowerOff || colors.length === 0) {
    return [encodeLianLiPacket({ channel, colors: [], brightness, isPowerOff: true })];
  }
  const packets = [];
  const chunkSize = 20;
  for (let i = 0; i < colors.length; i += chunkSize) {
    const chunk = colors.slice(i, i + chunkSize);
    packets.push(encodeLianLiPacket({ channel, colors: chunk, brightness, isPowerOff: false }));
  }
  return packets;
}

/**
 * Constructs a structured Nexus RGB device object for a Lian Li Uni Hub.
 * @param {Object} descriptor
 * @param {string} [descriptor.id]
 * @param {string} [descriptor.name='Lian Li Uni Hub']
 * @param {Array<{fans: number, type: string}>} [descriptor.channels]
 * @returns {Object} Structured controller device
 */
function buildLianLiDevice({
  id = null,
  name = 'Lian Li Uni Hub',
  channels = [
    { fans: 3, type: 'sl120' },
    { fans: 3, type: 'sl120' },
    { fans: 1, type: 'sl120' },
    { fans: 0, type: 'sl120' }
  ]
} = {}) {
  const devId = id || crypto.createHash('sha256').update(`lian-li|${name}|usb-hid`).digest('hex').slice(0, 24);

  let totalLeds = 0;
  const zones = [];
  const componentList = [];

  channels.forEach((ch, chIdx) => {
    const chNum = chIdx + 1;
    const fanCount = Math.max(0, Math.min(4, Number(ch.fans) || 0));
    const model = LIAN_LI_MODELS[ch.type] || LIAN_LI_MODELS.sl120;
    const ledsPerFan = model.ledsPerFan;
    const channelLeds = fanCount * ledsPerFan;

    if (channelLeds > 0) {
      const zoneId = chIdx;
      const zoneName = `Canal ${chNum} (${fanCount}x ${model.name})`;
      zones.push({
        id: zoneId,
        name: zoneName,
        leds: channelLeds,
        min: 0,
        max: 160,
        resizable: true
      });

      // Split into individual fan components so they can be positioned in Studio
      for (let f = 0; f < fanCount; f++) {
        const compId = crypto.createHash('sha256').update(`${devId}|ch${chNum}|fan${f + 1}`).digest('hex').slice(0, 24);
        const isStrimer = ch.type === 'strimer';
        componentList.push({
          id: compId,
          name: isStrimer ? `Strimer Cabo ${chNum}.${f + 1} (${model.name})` : `Ventoinha ${chNum}.${f + 1} (${model.name})`,
          kind: isStrimer ? 'strip' : 'argb',
          controllerName: name,
          zoneId,
          ledCount: ledsPerFan,
          offset: totalLeds + f * ledsPerFan,
          type: isStrimer ? 4 : 3, // 4 = Strip, 3 = Cooler/Fan
          busType: 'usb-hid',
          vendor: 'Lian Li',
          zones: [{ id: zoneId, name: zoneName, leds: channelLeds }]
        });
      }

      totalLeds += channelLeds;
    }
  });

  // Fallback if all channels are 0
  if (totalLeds === 0) {
    totalLeds = 48;
    zones.push({ id: 0, name: 'Canal 1 (3x Uni Fan SL120)', leds: 48, min: 0, max: 160, resizable: true });
    for (let f = 0; f < 3; f++) {
      const compId = crypto.createHash('sha256').update(`${devId}|ch1|fan${f + 1}`).digest('hex').slice(0, 24);
      componentList.push({
        id: compId,
        name: `Ventoinha 1.${f + 1} (Uni Fan SL120)`,
        kind: 'argb',
        controllerName: name,
        zoneId: 0,
        ledCount: 16,
        offset: f * 16,
        type: 3,
        busType: 'usb-hid',
        vendor: 'Lian Li',
        zones: [{ id: 0, name: 'Canal 1 (3x Uni Fan SL120)', leds: 48 }]
      });
    }
  }

  const raw = {
    name,
    vendor: 'Lian Li',
    type: 3,
    location: 'USB: 0cf2:a100, Lian Li Uni Hub',
    description: 'Lian Li Uni Hub USB Controller',
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
    vendor: 'Lian Li',
    type: 3, // Cooler / Fan
    busType: 'usb-hid',
    ledCount: totalLeds,
    nativeController: true,
    controllerType: 'lian-li',
    raw,
    direct: raw.modes[0],
    fixed: raw.modes[1],
    off: raw.modes[2],
    error: null,
    effects: ['static', 'rainbow', 'wave', 'breathe', 'pulse', 'strobe', 'sequence', 'comet', 'scanner', 'sparkle'],
    modes: raw.modes.map(m => ({ id: m.id, name: m.name })),
    zones,
    components: componentList
  };
}

module.exports = {
  LIAN_LI_MODELS,
  encodeLianLiPacket,
  encodeLianLiPackets,
  buildLianLiDevice
};
