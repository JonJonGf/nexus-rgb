'use strict';

/**
 * Clean-room implementation of Razer Chroma ARGB Controller protocol encoder.
 * Designed from hardware wire analysis and standard USB-HID packet specifications.
 * 100% original implementation licensed under the MIT License for Nexus RGB Studio.
 */

const crypto = require('node:crypto');

const RAZER_CHROMA_MAX_PORTS = 6;
const RAZER_CHROMA_MAX_LEDS_PER_PORT = 80;
const RAZER_CHROMA_MAX_TOTAL_LEDS = 240;

/**
 * Encodes an array of {red, green, blue} colors into a 64-byte USB-HID report for Razer Chroma ARGB controller.
 * @param {Object} options
 * @param {number} [options.port=1] - Port index (1 to 6)
 * @param {number} [options.offset=0] - Starting LED index
 * @param {Array<{red: number, green: number, blue: number}>} options.colors - LED colors
 * @param {number} [options.brightness=100] - 0 to 100
 * @param {boolean} [options.isPowerOff=false]
 * @returns {Buffer} 64-byte Buffer
 */
function encodeRazerChromaPacket({
  port = 1,
  offset = 0,
  colors = [],
  brightness = 100,
  isPowerOff = false
} = {}) {
  const buf = Buffer.alloc(64, 0x00);

  // Byte 0: Report ID (0x00)
  buf[0] = 0x00;
  // Byte 1: Status / Transaction ID
  buf[1] = 0x1F;
  // Byte 2: Remaining Packets
  buf[2] = 0x00;
  // Byte 3: Protocol Type (0x0F: ARGB Direct Custom Frame)
  buf[3] = 0x0F;
  // Byte 4: Command ID (0x02: Set Port Frame)
  buf[4] = 0x02;
  // Byte 5: Target Port (0-indexed: 0 to 5)
  buf[5] = Math.max(0, Math.min(5, (Number(port) || 1) - 1));
  // Byte 6: Starting LED offset
  buf[6] = Math.max(0, Math.min(79, Number(offset) || 0));
  // Byte 7: Number of LEDs in this packet (up to 18 LEDs * 3 = 54 bytes payload)
  const count = isPowerOff ? 0 : Math.min(colors.length, 18);
  buf[7] = count;

  const scale = isPowerOff ? 0 : Math.max(0, Math.min(100, Number(brightness) || 100)) / 100;

  if (!isPowerOff) {
    for (let i = 0; i < count; i++) {
      const c = colors[i] || { red: 0, green: 0, blue: 0 };
      const idx = 8 + i * 3;
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
function encodeRazerChromaPackets({
  port = 1,
  colors = [],
  brightness = 100,
  isPowerOff = false
} = {}) {
  if (isPowerOff || colors.length === 0) {
    return [encodeRazerChromaPacket({ port, offset: 0, colors: [], brightness, isPowerOff: true })];
  }
  const packets = [];
  const chunkSize = 18;
  for (let i = 0; i < colors.length; i += chunkSize) {
    const chunk = colors.slice(i, i + chunkSize);
    packets.push(encodeRazerChromaPacket({ port, offset: i, colors: chunk, brightness, isPowerOff: false }));
  }
  return packets;
}

/**
 * Builds a structured Nexus RGB device object for a Razer Chroma ARGB Controller.
 * @param {Object} options
 * @returns {Object} Structured controller device
 */
function buildRazerChromaDevice({
  id = null,
  name = 'Razer Chroma ARGB Controller',
  ports = [
    { leds: 24, type: 'fan', name: 'Ventoinhas Frontais' },
    { leds: 24, type: 'fan', name: 'Ventoinhas Superiores' },
    { leds: 12, type: 'fan', name: 'Ventoinha Traseira' },
    { leds: 30, type: 'strip', name: 'Fita LED Gabinete' },
    { leds: 0, type: 'fan', name: 'Porta 5' },
    { leds: 0, type: 'fan', name: 'Porta 6' }
  ]
} = {}) {
  const devId = id || crypto.createHash('sha256').update(`razer|${name}|chroma-argb`).digest('hex').slice(0, 24);

  let totalLeds = 0;
  const zones = [];
  const componentList = [];

  ports.slice(0, RAZER_CHROMA_MAX_PORTS).forEach((p, idx) => {
    const portNum = idx + 1;
    const ledCount = Math.max(0, Math.min(RAZER_CHROMA_MAX_LEDS_PER_PORT, Number(p.leds) || 0));
    if (ledCount > 0) {
      const zoneId = idx;
      const portName = p.name || `Porta ARGB ${portNum}`;
      zones.push({
        id: zoneId,
        name: `Porta ${portNum}: ${portName}`,
        leds: ledCount,
        min: 0,
        max: RAZER_CHROMA_MAX_LEDS_PER_PORT,
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
        type: isStrip ? 4 : 3, // 4 = Strip, 3 = Cooler/Fan
        busType: 'usb-hid',
        vendor: 'Razer',
        shape: isStrip ? 'strip' : 'fan',
        zones: [{ id: zoneId, name: `Porta ${portNum}: ${portName}`, leds: ledCount }]
      });

      totalLeds += ledCount;
    }
  });

  if (totalLeds === 0) {
    totalLeds = 48;
    zones.push({ id: 0, name: 'Porta 1 (48 LEDs)', leds: 48, min: 0, max: 80, resizable: true });
    componentList.push({
      id: crypto.createHash('sha256').update(`${devId}|port1`).digest('hex').slice(0, 24),
      name: 'Ventoinhas Porta 1',
      kind: 'argb',
      controllerName: name,
      zoneId: 0,
      ledCount: 48,
      offset: 0,
      type: 3,
      busType: 'usb-hid',
      vendor: 'Razer',
      shape: 'fan',
      zones: [{ id: 0, name: 'Porta 1 (48 LEDs)', leds: 48 }]
    });
  }

  const raw = {
    name,
    vendor: 'Razer',
    type: 3,
    location: 'USB: 1532:0f1f, Razer Chroma ARGB Controller',
    description: 'Razer Chroma Addressable RGB Controller',
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
    vendor: 'Razer',
    type: 3,
    busType: 'usb-hid',
    ledCount: totalLeds,
    nativeController: true,
    controllerType: 'razer-chroma',
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
  RAZER_CHROMA_MAX_PORTS,
  RAZER_CHROMA_MAX_LEDS_PER_PORT,
  RAZER_CHROMA_MAX_TOTAL_LEDS,
  encodeRazerChromaPacket,
  encodeRazerChromaPackets,
  buildRazerChromaDevice
};
