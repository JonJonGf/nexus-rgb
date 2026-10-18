'use strict';

/**
 * Clean-room implementation of NZXT Kraken (X53/X63/X73, Z53/Z63/Z73, Elite)
 * and Smart Device V2 / RGB & Fan Controller USB-HID protocol encoder.
 * 100% original implementation licensed under the MIT License for Nexus RGB Studio.
 */

const crypto = require('node:crypto');

const NZXT_ZONES = {
  ring: { id: 0x10, name: 'Bomba (Anel LED)', leds: 16, type: 3 }, // shape: 'fan'
  logo: { id: 0x11, name: 'Bomba (Logo NZXT)', leds: 1, type: 3 },
  channel1: { id: 0x01, name: 'Canal RGB 1', leds: 24, type: 3 },
  channel2: { id: 0x02, name: 'Canal RGB 2', leds: 24, type: 3 }
};

/**
 * Encodes an array of {red, green, blue} colors into a 64-byte USB-HID report for NZXT Kraken & Smart Device.
 * @param {Object} options
 * @param {number} [options.target=0x10] - Target zone (0x10 = Ring, 0x11 = Logo, 0x01 = Ch1, 0x02 = Ch2)
 * @param {Array<{red: number, green: number, blue: number}>} [options.colors=[]] - LED colors
 * @param {number} [options.brightness=100] - 0 to 100 brightness
 * @param {boolean} [options.isPowerOff=false] - Whether power is off
 * @returns {Buffer} 64-byte Buffer
 */
function encodeNzxtPacket({ target = 0x10, colors = [], brightness = 100, isPowerOff = false } = {}) {
  const buf = Buffer.alloc(64, 0x00);

  // Byte 0: Command opcode (0x22 = Set Channel Direct Colors)
  buf[0] = 0x22;
  // Byte 1: Target channel/zone
  buf[1] = Number(target) || 0x10;
  // Byte 2: Direct control sub-opcode (0x00)
  buf[2] = 0x00;
  // Byte 3: LED count
  const count = isPowerOff ? 0 : Math.min(colors.length, 20);
  buf[3] = count;

  // Bytes 4..63: RGB Color payload
  if (!isPowerOff) {
    const scale = Math.max(0, Math.min(100, brightness)) / 100;
    for (let i = 0; i < count; i++) {
      const c = colors[i] || { red: 0, green: 0, blue: 0 };
      const offset = 4 + i * 3;
      buf[offset] = Math.round(Math.max(0, Math.min(255, Number(c.red) || 0)) * scale);
      buf[offset + 1] = Math.round(Math.max(0, Math.min(255, Number(c.green) || 0)) * scale);
      buf[offset + 2] = Math.round(Math.max(0, Math.min(255, Number(c.blue) || 0)) * scale);
    }
  }

  return buf;
}

/**
 * Encodes an array of colors into multiple 64-byte USB-HID report packets (20 LEDs per packet).
 * @param {Object} options
 * @returns {Array<Buffer>} Array of 64-byte Buffers
 */
function encodeNzxtPackets({ target = 0x10, colors = [], brightness = 100, isPowerOff = false } = {}) {
  if (isPowerOff || colors.length === 0) {
    return [encodeNzxtPacket({ target, colors: [], brightness, isPowerOff: true })];
  }
  const packets = [];
  const chunkSize = 20;
  for (let i = 0; i < colors.length; i += chunkSize) {
    const chunk = colors.slice(i, i + chunkSize);
    packets.push(encodeNzxtPacket({ target, colors: chunk, brightness, isPowerOff: false }));
  }
  return packets;
}

/**
 * Constructs a structured Nexus RGB device object for an NZXT Kraken AIO cooler.
 * @param {Object} descriptor
 * @param {string} [descriptor.id]
 * @param {string} [descriptor.name='NZXT Kraken AIO']
 * @param {number} [descriptor.ringLeds=16]
 * @param {boolean} [descriptor.hasLogo=true]
 * @param {number} [descriptor.fanLeds=24]
 * @returns {Object} Structured controller device
 */
function buildNzxtKrakenDevice({
  id = null,
  name = 'NZXT Kraken AIO',
  ringLeds = 16,
  hasLogo = true,
  fanLeds = 24
} = {}) {
  const devId = id || crypto.createHash('sha256').update(`nzxt|${name}|usb-hid`).digest('hex').slice(0, 24);

  const zones = [];
  const componentList = [];
  let currentOffset = 0;

  // 1. Pump Ring zone (circular fan shape in Studio)
  if (ringLeds > 0) {
    const zoneId = 0;
    const ringCompId = crypto.createHash('sha256').update(`${devId}|pump_ring`).digest('hex').slice(0, 24);
    zones.push({ id: zoneId, name: 'Anel da Bomba', leds: ringLeds, min: ringLeds, max: ringLeds, resizable: false });
    componentList.push({
      id: ringCompId,
      name: `${name} — Anel LED`,
      kind: 'argb',
      controllerName: name,
      zoneId,
      ledCount: ringLeds,
      offset: currentOffset,
      type: 3, // Cooler
      busType: 'usb-hid',
      vendor: 'NZXT',
      zones: [{ id: zoneId, name: 'Anel da Bomba', leds: ringLeds }]
    });
    currentOffset += ringLeds;
  }

  // 2. Pump Logo zone (center point)
  if (hasLogo) {
    const zoneId = 1;
    const logoCompId = crypto.createHash('sha256').update(`${devId}|pump_logo`).digest('hex').slice(0, 24);
    zones.push({ id: zoneId, name: 'Logo NZXT', leds: 1, min: 1, max: 1, resizable: false });
    componentList.push({
      id: logoCompId,
      name: `${name} — Logo Central`,
      kind: 'argb',
      controllerName: name,
      zoneId,
      ledCount: 1,
      offset: currentOffset,
      type: 3,
      busType: 'usb-hid',
      vendor: 'NZXT',
      zones: [{ id: zoneId, name: 'Logo NZXT', leds: 1 }]
    });
    currentOffset += 1;
  }

  // 3. Aer RGB Fans (radiator fan strip/group)
  if (fanLeds > 0) {
    const zoneId = 2;
    const fansCompId = crypto.createHash('sha256').update(`${devId}|aer_fans`).digest('hex').slice(0, 24);
    zones.push({ id: zoneId, name: 'Ventoinhas do Radiador', leds: fanLeds, min: fanLeds, max: fanLeds, resizable: false });
    componentList.push({
      id: fansCompId,
      name: `${name} — Ventoinhas ARGB`,
      kind: 'argb',
      controllerName: name,
      zoneId,
      ledCount: fanLeds,
      offset: currentOffset,
      type: 3,
      busType: 'usb-hid',
      vendor: 'NZXT',
      zones: [{ id: zoneId, name: 'Ventoinhas do Radiador', leds: fanLeds }]
    });
    currentOffset += fanLeds;
  }

  const raw = {
    name,
    vendor: 'NZXT',
    type: 3,
    location: 'USB: 1e71:2007, NZXT Kraken',
    description: 'NZXT Kraken USB AIO Cooler',
    colors: Array.from({ length: currentOffset }, () => ({ red: 0, green: 0, blue: 0 })),
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
    vendor: 'NZXT',
    type: 3, // Cooler
    busType: 'usb-hid',
    ledCount: currentOffset,
    nativeController: true,
    controllerType: 'nzxt-kraken',
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
  NZXT_ZONES,
  encodeNzxtPacket,
  encodeNzxtPackets,
  buildNzxtKrakenDevice
};
