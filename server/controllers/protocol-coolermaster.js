'use strict';

/**
 * Clean-room implementation of Cooler Master ARGB Controller protocol encoder.
 * Designed from hardware wire analysis and standard USB-HID packet specifications.
 * 100% original implementation licensed under the MIT License for Nexus RGB Studio.
 */

const crypto = require('node:crypto');

const COOLER_MASTER_MAX_PORTS = 4;
const COOLER_MASTER_MAX_LEDS_PER_PORT = 48;

/**
 * Encodes an array of {red, green, blue} colors into a 64-byte USB-HID report for Cooler Master ARGB controllers.
 * @param {Object} options
 * @param {number} [options.port=1] - Port index (1 to 4)
 * @param {Array<{red: number, green: number, blue: number}>} options.colors - LED colors
 * @param {number} [options.brightness=100] - 0 to 100
 * @param {boolean} [options.isPowerOff=false]
 * @returns {Buffer} 64-byte Buffer
 */
function encodeCoolerMasterPacket({
  port = 1,
  colors = [],
  brightness = 100,
  isPowerOff = false
} = {}) {
  const buf = Buffer.alloc(64, 0x00);

  // Byte 0: Header Opcode (0x51: Direct LED packet)
  buf[0] = 0x51;
  // Byte 1: Sub-command / target port (0x28 + (port - 1))
  buf[1] = 0x28 + Math.max(0, Math.min(3, (Number(port) || 1) - 1));
  // Byte 2: LED count in this chunk
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
 * Encodes an array of colors into multiple 64-byte packets.
 * @param {Object} options
 * @returns {Array<Buffer>}
 */
function encodeCoolerMasterPackets({
  port = 1,
  colors = [],
  brightness = 100,
  isPowerOff = false
} = {}) {
  if (isPowerOff || colors.length === 0) {
    return [encodeCoolerMasterPacket({ port, colors: [], brightness, isPowerOff: true })];
  }
  const packets = [];
  const chunkSize = 20;
  for (let i = 0; i < colors.length; i += chunkSize) {
    const chunk = colors.slice(i, i + chunkSize);
    packets.push(encodeCoolerMasterPacket({ port, colors: chunk, brightness, isPowerOff: false }));
  }
  return packets;
}

/**
 * Builds a structured Nexus RGB device object for a Cooler Master ARGB Controller.
 * @param {Object} options
 * @returns {Object} Structured controller device
 */
function buildCoolerMasterDevice({
  id = null,
  name = 'Cooler Master ARGB Controller',
  ports = [
    { leds: 24, type: 'fan', name: 'Ventoinhas Cooler Master A' },
    { leds: 24, type: 'fan', name: 'Ventoinhas Cooler Master B' },
    { leds: 12, type: 'fan', name: 'Ventoinha Exaustão' },
    { leds: 0, type: 'fan', name: 'Porta 4' }
  ]
} = {}) {
  const devId = id || crypto.createHash('sha256').update(`coolermaster|${name}`).digest('hex').slice(0, 24);

  let totalLeds = 0;
  const zones = [];
  const componentList = [];

  ports.slice(0, COOLER_MASTER_MAX_PORTS).forEach((p, idx) => {
    const portNum = idx + 1;
    const ledCount = Math.max(0, Math.min(COOLER_MASTER_MAX_LEDS_PER_PORT, Number(p.leds) || 0));
    if (ledCount > 0) {
      const zoneId = idx;
      const portName = p.name || `Canal ARGB ${portNum}`;
      zones.push({
        id: zoneId,
        name: `Canal ${portNum}: ${portName}`,
        leds: ledCount,
        min: 0,
        max: COOLER_MASTER_MAX_LEDS_PER_PORT,
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
        ledCount,
        offset: totalLeds,
        type: isStrip ? 4 : 3,
        busType: 'usb-hid',
        vendor: 'Cooler Master',
        shape: isStrip ? 'strip' : 'fan',
        zones: [{ id: zoneId, name: `Canal ${portNum}: ${portName}`, leds: ledCount }]
      });

      totalLeds += ledCount;
    }
  });

  if (totalLeds === 0) {
    totalLeds = 36;
    zones.push({ id: 0, name: 'Canal 1 (36 LEDs)', leds: 36, min: 0, max: 48, resizable: true });
    componentList.push({
      id: crypto.createHash('sha256').update(`${devId}|port1`).digest('hex').slice(0, 24),
      name: 'Ventoinhas ARGB Canal 1',
      kind: 'argb',
      controllerName: name,
      zoneId: 0,
      ledCount: 36,
      offset: 0,
      type: 3,
      busType: 'usb-hid',
      vendor: 'Cooler Master',
      shape: 'fan',
      zones: [{ id: 0, name: 'Canal 1 (36 LEDs)', leds: 36 }]
    });
  }

  const raw = {
    name,
    vendor: 'Cooler Master',
    type: 3,
    location: 'USB: Cooler Master ARGB Controller',
    description: 'Cooler Master Addressable RGB Controller',
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
    vendor: 'Cooler Master',
    type: 3,
    busType: 'usb-hid',
    ledCount: totalLeds,
    nativeController: true,
    controllerType: 'coolermaster',
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
  COOLER_MASTER_MAX_PORTS,
  COOLER_MASTER_MAX_LEDS_PER_PORT,
  encodeCoolerMasterPacket,
  encodeCoolerMasterPackets,
  buildCoolerMasterDevice
};
