'use strict';

/**
 * Universal Motherboard ARGB Protocol & Architecture Builder for Nexus RGB.
 * Provides clean-room models and zone decomposition for ASUS, Gigabyte/AORUS,
 * MSI Mystic Light, and ASRock Polychrome RGB motherboards under the MIT License.
 */

const crypto = require('node:crypto');

const MOTHERBOARD_PROFILES = {
  asus: {
    vendor: 'ASUS',
    name: 'Placa-Mãe ASUS ROG/TUF Aura',
    busType: 'smbus/usb',
    defaultHeaders: [
      { name: 'Header ARGB 1 (Gen 2)', leds: 60, type: 'fan' },
      { name: 'Header ARGB 2 (Gen 2)', leds: 60, type: 'fan' },
      { name: 'Header RGB 12V', leds: 1, type: 'strip' },
      { name: 'Iluminação Onboard (IO / PCH)', leds: 8, type: 'strip' }
    ]
  },
  gigabyte: {
    vendor: 'Gigabyte',
    name: 'Placa-Mãe Gigabyte/AORUS RGB Fusion 2.0',
    busType: 'usb-hid',
    defaultHeaders: [
      { name: 'D_LED1 (ARGB 3-pin)', leds: 60, type: 'fan' },
      { name: 'D_LED2 (ARGB 3-pin)', leds: 60, type: 'fan' },
      { name: 'LED_CPU (12V RGB)', leds: 1, type: 'strip' },
      { name: 'AORUS PCH & IO Shield', leds: 6, type: 'strip' }
    ]
  },
  msi: {
    vendor: 'MSI',
    name: 'Placa-Mãe MSI Mystic Light',
    busType: 'usb-hid',
    defaultHeaders: [
      { name: 'JARGB_V2_1 (Rainbow)', leds: 60, type: 'fan' },
      { name: 'JARGB_V2_2 (Rainbow)', leds: 60, type: 'fan' },
      { name: 'JRGB1 (12V 4-pin)', leds: 1, type: 'strip' },
      { name: 'MSI Dragon & Chipset', leds: 8, type: 'strip' }
    ]
  },
  asrock: {
    vendor: 'ASRock',
    name: 'Placa-Mãe ASRock Polychrome RGB',
    busType: 'usb-hid',
    defaultHeaders: [
      { name: 'ADDR_LED1 (ARGB)', leds: 60, type: 'fan' },
      { name: 'ADDR_LED2 (ARGB)', leds: 60, type: 'fan' },
      { name: 'RGB_HEADER1 (12V)', leds: 1, type: 'strip' },
      { name: 'Polychrome PCH Heatsink', leds: 4, type: 'strip' }
    ]
  }
};

/**
 * Encodes an array of colors into a 64-byte frame for Gigabyte ITE8297 USB ARGB headers.
 * @param {Object} options
 * @returns {Buffer}
 */
function encodeGigabytePacket({ header = 1, colors = [], brightness = 100, isPowerOff = false } = {}) {
  const buf = Buffer.alloc(64, 0x00);
  buf[0] = 0xCC; // Gigabyte ITE custom frame header
  buf[1] = Math.max(0, Math.min(3, (Number(header) || 1) - 1));
  const count = isPowerOff ? 0 : Math.min(colors.length, 20);
  buf[2] = count;
  const scale = isPowerOff ? 0 : Math.max(0, Math.min(100, Number(brightness) || 100)) / 100;
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
 * Encodes an array of colors into a 64-byte frame for MSI Mystic Light USB controllers.
 * @param {Object} options
 * @returns {Buffer}
 */
function encodeMsiPacket({ header = 1, colors = [], brightness = 100, isPowerOff = false } = {}) {
  const buf = Buffer.alloc(64, 0x00);
  buf[0] = 0x52; // MSI report header
  buf[1] = 0x2A; // Direct RGB command
  buf[2] = Math.max(0, Math.min(3, (Number(header) || 1) - 1));
  const count = isPowerOff ? 0 : Math.min(colors.length, 20);
  buf[3] = count;
  const scale = isPowerOff ? 0 : Math.max(0, Math.min(100, Number(brightness) || 100)) / 100;
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
 * Builds a structured Nexus RGB device object for a motherboard.
 * @param {Object} options
 * @returns {Object} Structured controller device
 */
function buildMotherboardDevice({
  id = null,
  brand = 'asus',
  name = null,
  headers = null
} = {}) {
  const profileKey = (brand || 'asus').toLowerCase();
  const profile = MOTHERBOARD_PROFILES[profileKey] || MOTHERBOARD_PROFILES.asus;
  const devName = name || profile.name;
  const devId = id || crypto.createHash('sha256').update(`motherboard|${profile.vendor}|${devName}`).digest('hex').slice(0, 24);

  const headerList = Array.isArray(headers) && headers.length > 0 ? headers : profile.defaultHeaders;
  let totalLeds = 0;
  const zones = [];
  const componentList = [];

  headerList.forEach((h, idx) => {
    const count = Math.max(1, Math.min(120, Number(h.leds) || 1));
    const zoneId = idx;
    const zoneName = h.name || `Header ${idx + 1}`;
    zones.push({
      id: zoneId,
      name: zoneName,
      leds: count,
      min: 0,
      max: 120,
      resizable: true
    });

    const isStrip = h.type === 'strip' || count <= 12;
    const compId = crypto.createHash('sha256').update(`${devId}|zone${zoneId}`).digest('hex').slice(0, 24);
    componentList.push({
      id: compId,
      name: `${devName} — ${zoneName}`,
      kind: isStrip ? 'strip' : 'argb',
      controllerName: devName,
      zoneId,
      ledCount: count,
      offset: totalLeds,
      type: 0, // 0 = Motherboard
      busType: profile.busType,
      vendor: profile.vendor,
      shape: isStrip ? 'strip' : 'fan',
      zones: [{ id: zoneId, name: zoneName, leds: count }]
    });

    totalLeds += count;
  });

  const raw = {
    name: devName,
    vendor: profile.vendor,
    type: 0, // Motherboard
    location: `${profile.busType}: ${profile.vendor} Motherboard`,
    description: `${profile.vendor} Motherboard RGB Controller`,
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
    name: devName,
    vendor: profile.vendor,
    type: 0,
    busType: profile.busType,
    ledCount: totalLeds,
    nativeController: true,
    controllerType: `motherboard-${profileKey}`,
    motherboardBrand: profileKey,
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
  MOTHERBOARD_PROFILES,
  encodeGigabytePacket,
  encodeMsiPacket,
  buildMotherboardDevice
};
