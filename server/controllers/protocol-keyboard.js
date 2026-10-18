'use strict';

/**
 * Universal RGB Keyboard Protocol & Device Builder for Nexus RGB.
 * Provides clean-room support for USB RGB keyboards (including SinoWealth/Royal Kludge,
 * HID LampArray / Dynamic Lighting, and generic RGB keyboards) under the MIT License.
 */

const crypto = require('node:crypto');

const KEYBOARD_LAYOUTS = {
  '60%': { name: 'Teclado 60%', leds: 61, width: 0.32, height: 0.12, cols: 15, rows: 5 },
  '65%': { name: 'Teclado 65%', leds: 68, width: 0.34, height: 0.12, cols: 16, rows: 5 },
  '75%': { name: 'Teclado 75%', leds: 84, width: 0.35, height: 0.13, cols: 16, rows: 6 },
  'tkl': { name: 'Teclado TKL (80%)', leds: 87, width: 0.38, height: 0.13, cols: 17, rows: 6 },
  'full': { name: 'Teclado Completo (100%)', leds: 104, width: 0.44, height: 0.13, cols: 22, rows: 6 }
};

/**
 * Encodes a SinoWealth / Royal Kludge 65-byte Feature Report packet (Report ID 0x0A).
 * @param {Object} options
 * @param {number} [options.mode=0x11] - 0x11 = Steady, 0x12 = Breathe, 0x01 = Wave, 0x00 = Off
 * @param {number} [options.speed=3] - 1 to 5
 * @param {number} [options.brightness=5] - 0 to 5
 * @param {number} [options.red=0] - 0 to 255
 * @param {number} [options.green=0] - 0 to 255
 * @param {number} [options.blue=0] - 0 to 255
 * @param {boolean} [options.isPowerOff=false]
 * @param {number} [options.sleepTimeout=0x04]
 * @returns {Buffer} 65-byte Buffer
 */
function encodeSinoWealthKeyboardPacket({
  mode = 0x11,
  speed = 3,
  brightness = 5,
  red = 0,
  green = 0,
  blue = 0,
  colorMixing = null,
  isPowerOff = false,
  sleepTimeout = 0x04
} = {}) {
  const buf = Buffer.alloc(65, 0x00);
  buf[0] = 0x0A; // Report ID
  buf[1] = 0x01;
  buf[2] = 0x01;
  buf[3] = 0x02;
  buf[4] = 0x29;

  if (isPowerOff) {
    buf[5] = 0x11; // Steady mode with 0 brightness = blackout
    buf[6] = 0x00;
    buf[7] = 0x01;
    buf[8] = 0x00; // Brightness 0
    buf[9] = 0x00;
    buf[10] = 0x00;
    buf[11] = 0x00;
    buf[12] = 0x00;
    buf[13] = sleepTimeout;
  } else {
    // Convert 0..100 brightness to 0..5 scale if needed
    const bScale = brightness > 5 ? Math.round(Math.max(0, Math.min(100, brightness)) / 20) : Math.max(0, Math.min(5, brightness));
    const sScale = Math.max(1, Math.min(5, Math.round(speed > 5 ? speed / 20 : speed) || 3));

    // Determine color mixing (0x01 = ARGB multicolor/rainbow per key, 0x00 = manual single color)
    const rainbowModes = [0x01, 0x03, 0x04, 0x05, 0x06, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0F, 0x10];
    const isRainbow = colorMixing !== null ? Boolean(colorMixing) : rainbowModes.includes(mode);

    buf[5] = Math.max(0, Math.min(255, mode));
    buf[6] = 0x00; // Separation
    buf[7] = sScale;
    buf[8] = bScale;
    buf[9] = Math.max(0, Math.min(255, Math.round(Number(red) || 0)));
    buf[10] = Math.max(0, Math.min(255, Math.round(Number(green) || 0)));
    buf[11] = Math.max(0, Math.min(255, Math.round(Number(blue) || 0)));
    buf[12] = isRainbow ? 0x01 : 0x00;
    buf[13] = sleepTimeout;
  }

  return buf;
}

const HARDWARE_MODES = [
  { id: 0x11, name: 'Estático (Cor fixa)', flagList: ['perLedColor'] },
  { id: 0x01, name: 'Onda / Arco-íris (Wave)', flagList: [] },
  { id: 0x12, name: 'Respiração (Breathe)', flagList: [] },
  { id: 0x13, name: 'Ciclo de Cores (Neon)', flagList: [] },
  { id: 0x02, name: 'Ondulação (Ripple)', flagList: [] },
  { id: 0x03, name: 'Catavento (Windmill)', flagList: [] },
  { id: 0x04, name: 'Onda Senoidal (Sine)', flagList: [] },
  { id: 0x05, name: 'Roleta Arco-íris', flagList: [] },
  { id: 0x06, name: 'Estrelas (Twinkle)', flagList: [] },
  { id: 0x07, name: 'Em Camadas (Layered)', flagList: [] },
  { id: 0x09, name: 'Letreiro (Marquee)', flagList: [] },
  { id: 0x0A, name: 'Tempestade Giratória', flagList: [] },
  { id: 0x0B, name: 'Corrida de Cavalos', flagList: [] },
  { id: 0x0C, name: 'Cobrinha Retrô', flagList: [] },
  { id: 0x0D, name: 'Diagonal', flagList: [] },
  { id: 0x0F, name: 'Ambilight', flagList: [] },
  { id: 0x10, name: 'Transmissão (Streamer)', flagList: [] },
  { id: 0x14, name: 'Desaparecer na Sombra', flagList: [] },
  { id: 0x15, name: 'Flash Away', flagList: [] },
  { id: 0x00, name: 'Desligado (Off)', flagList: [] }
];

/**
 * Universal keyboard device builder.
 * @param {Object} options
 * @returns {Object} Structured Nexus RGB keyboard device
 */
function buildKeyboardDevice({
  id = null,
  name = 'Teclado Mecânico RGB',
  vendor = 'Universal',
  model = 'Universal RGB Keyboard',
  layout = '60%',
  ledCount = null,
  protocol = 'sinowealth',
  hidPath = null
} = {}) {
  const layoutConfig = KEYBOARD_LAYOUTS[layout] || KEYBOARD_LAYOUTS['60%'];
  const count = Number(ledCount) || layoutConfig.leds;
  const devId = id || crypto.createHash('sha256').update(`keyboard|${vendor}|${name}|${count}`).digest('hex').slice(0, 24);

  const zones = [
    {
      id: 0,
      name: `Teclas (${layoutConfig.name})`,
      leds: count,
      min: count,
      max: count,
      resizable: false
    }
  ];

  const components = [
    {
      id: devId,
      name,
      kind: 'keyboard',
      controllerName: name,
      zoneId: 0,
      ledCount: count,
      offset: 0,
      type: 5, // 5 = Keyboard
      busType: 'usb-hid',
      vendor,
      shape: 'matrix',
      zones
    }
  ];

  const raw = {
    name,
    vendor,
    type: 5, // 5 = Keyboard
    location: hidPath || `USB: ${vendor} RGB Keyboard`,
    description: `${vendor} ${model} (${layoutConfig.name})`,
    colors: Array.from({ length: count }, () => ({ red: 0, green: 0, blue: 0 })),
    modes: HARDWARE_MODES,
    zones
  };

  return {
    id: devId,
    name,
    vendor,
    type: 5, // Keyboard
    busType: 'usb-hid',
    ledCount: count,
    nativeController: true,
    controllerType: 'keyboard',
    keyboardProtocol: protocol,
    hidPath,
    raw,
    direct: raw.modes[0],
    fixed: raw.modes[0],
    off: raw.modes[raw.modes.length - 1],
    error: null,
    effects: ['static', 'rainbow', 'wave', 'breathe', 'pulse', 'strobe'],
    modes: raw.modes.map(m => ({ id: m.id, name: m.name })),
    zones,
    components
  };
}

module.exports = {
  KEYBOARD_LAYOUTS,
  encodeSinoWealthKeyboardPacket,
  buildKeyboardDevice
};
