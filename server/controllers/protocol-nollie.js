'use strict';

/**
 * Clean-room implementation of Nollie ARGB Controllers (Nollie8, Nollie16, Nollie32).
 * Designed for enthusiast multi-port ARGB hardware setups.
 * 100% original implementation licensed under the MIT License for Nexus RGB Studio.
 */

const crypto = require('node:crypto');

const NOLLIE_MODELS = {
  nollie8: { name: 'Nollie8 ARGB Controller', maxPorts: 8, maxLedsPerPort: 126 },
  nollie16: { name: 'Nollie16 ARGB Controller', maxPorts: 16, maxLedsPerPort: 126 },
  nollie32: { name: 'Nollie32 ARGB Controller', maxPorts: 32, maxLedsPerPort: 126 }
};

/**
 * Encodes an array of {red, green, blue} colors into a 64-byte frame for a Nollie ARGB port.
 * @param {Object} options
 * @param {number} [options.port=1] - 1 to 32
 * @param {number} [options.offset=0] - Starting LED index
 * @param {Array<{red: number, green: number, blue: number}>} options.colors - LED colors
 * @param {number} [options.brightness=100] - 0 to 100
 * @param {boolean} [options.isPowerOff=false]
 * @returns {Buffer} 64-byte Buffer
 */
function encodeNolliePortPacket({
  port = 1,
  offset = 0,
  colors = [],
  brightness = 100,
  isPowerOff = false
} = {}) {
  const buf = Buffer.alloc(64, 0x00);

  // Byte 0: Sync/Opcode (0xB0: Direct Stream Frame)
  buf[0] = 0xB0;
  // Byte 1: Port index (0-based: 0 to 31)
  buf[1] = Math.max(0, Math.min(31, (Number(port) || 1) - 1));
  // Byte 2: Starting LED offset
  buf[2] = Math.max(0, Math.min(125, Number(offset) || 0));
  // Byte 3: Number of LEDs in this packet (up to 20 LEDs per 64-byte chunk)
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
 * Encodes an array of colors into multiple 64-byte packets for a Nollie port.
 * @param {Object} options
 * @returns {Array<Buffer>}
 */
function encodeNolliePortPackets({
  port = 1,
  colors = [],
  brightness = 100,
  isPowerOff = false
} = {}) {
  if (isPowerOff || colors.length === 0) {
    return [encodeNolliePortPacket({ port, offset: 0, colors: [], brightness, isPowerOff: true })];
  }
  const packets = [];
  const chunkSize = 20;
  for (let i = 0; i < colors.length; i += chunkSize) {
    const chunk = colors.slice(i, i + chunkSize);
    packets.push(encodeNolliePortPacket({ port, offset: i, colors: chunk, brightness, isPowerOff: false }));
  }
  return packets;
}

/**
 * Builds a structured Nexus RGB device object for a Nollie controller.
 * @param {Object} options
 * @returns {Object} Structured controller device
 */
function buildNollieDevice({
  id = null,
  name = 'Nollie32 ARGB Controller',
  model = 'nollie32',
  ports = [
    { leds: 24, type: 'fan', name: 'Ventoinhas Frontais' },
    { leds: 24, type: 'fan', name: 'Ventoinhas Topo' },
    { leds: 12, type: 'fan', name: 'Ventoinha Traseira' },
    { leds: 30, type: 'strip', name: 'Fita LED Lateral' }
  ]
} = {}) {
  const modelInfo = NOLLIE_MODELS[model] || NOLLIE_MODELS.nollie32;
  const maxPorts = modelInfo.maxPorts;
  const devId = id || crypto.createHash('sha256').update(`nollie|${name}|${model}`).digest('hex').slice(0, 24);

  let totalLeds = 0;
  const zones = [];
  const componentList = [];

  ports.slice(0, maxPorts).forEach((p, idx) => {
    const portNum = idx + 1;
    const count = Math.max(0, Math.min(modelInfo.maxLedsPerPort, Number(p.leds) || 0));
    if (count > 0) {
      const zoneId = idx;
      const portName = p.name || `Porta ARGB ${portNum}`;
      zones.push({
        id: zoneId,
        name: `Porta ${portNum}: ${portName}`,
        leds: count,
        min: 0,
        max: modelInfo.maxLedsPerPort,
        resizable: true
      });

      const isStrip = p.type === 'strip';
      const compId = crypto.createHash('sha256').update(`${devId}|port${portNum}`).digest('hex').slice(0, 24);
      componentList.push({
        id: compId,
        name: portName,
        kind: isStrip ? 'strip' : 'argb',
        controllerName: name,
        zoneId,
        ledCount: count,
        offset: totalLeds,
        type: isStrip ? 4 : 3, // 4 = Strip, 3 = Cooler/Fan
        busType: 'usb-hid',
        vendor: 'Nollie',
        shape: isStrip ? 'strip' : 'fan',
        zones: [{ id: zoneId, name: `Porta ${portNum}: ${portName}`, leds: count }]
      });

      totalLeds += count;
    }
  });

  if (totalLeds === 0) {
    totalLeds = 32;
    zones.push({ id: 0, name: 'Porta 1 (32 LEDs)', leds: 32, min: 0, max: modelInfo.maxLedsPerPort, resizable: true });
    componentList.push({
      id: crypto.createHash('sha256').update(`${devId}|port1`).digest('hex').slice(0, 24),
      name: 'Ventoinhas Porta 1',
      kind: 'argb',
      controllerName: name,
      zoneId: 0,
      ledCount: 32,
      offset: 0,
      type: 3,
      busType: 'usb-hid',
      vendor: 'Nollie',
      shape: 'fan',
      zones: [{ id: 0, name: 'Porta 1 (32 LEDs)', leds: 32 }]
    });
  }

  const raw = {
    name,
    vendor: 'Nollie',
    type: 3,
    location: `USB: Nollie ${modelInfo.name}`,
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
    vendor: 'Nollie',
    type: 3,
    busType: 'usb-hid',
    ledCount: totalLeds,
    nativeController: true,
    controllerType: 'nollie',
    nollieModel: model,
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
  NOLLIE_MODELS,
  encodeNolliePortPacket,
  encodeNolliePortPackets,
  buildNollieDevice
};
