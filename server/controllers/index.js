'use strict';

/**
 * Native USB-HID Controller Registry for Nexus RGB Studio.
 * Clean-room architecture enabling out-of-the-box support for popular USB ARGB controllers,
 * enthusiast Nollie controllers, multi-brand motherboards, and universal RGB keyboards
 * with zero third-party copyleft/GPL code under the MIT License.
 */

const { buildLianLiDevice, encodeLianLiPacket, encodeLianLiPackets } = require('./protocol-lianli');
const { buildNzxtKrakenDevice, encodeNzxtPacket, encodeNzxtPackets } = require('./protocol-nzxt');
const { buildCorsairDevice, encodeCorsairPacket, encodeCorsairPackets } = require('./protocol-corsair');
const { buildRazerChromaDevice, encodeRazerChromaPacket, encodeRazerChromaPackets } = require('./protocol-razer');
const { buildCoolerMasterDevice, encodeCoolerMasterPacket, encodeCoolerMasterPackets } = require('./protocol-coolermaster');
const { buildNollieDevice, encodeNolliePortPacket, encodeNolliePortPackets } = require('./protocol-nollie');
const { buildMotherboardDevice, encodeGigabytePacket, encodeMsiPacket } = require('./protocol-motherboard');
const { buildKeyboardDevice, encodeSinoWealthKeyboardPacket, KEYBOARD_LAYOUTS } = require('./protocol-keyboard');
const { HidBridge } = require('./hid-bridge');

class ControllerRegistry {
  constructor({ store = null, hidBridge = null } = {}) {
    this.store = store;
    this.hidBridge = hidBridge || new HidBridge();
    this.controllers = new Map();
    this.transports = new Map();
    this.lastPackets = new Map();

    // Check store settings for configured native/virtual controllers
    this.initFromStore();
  }

  initFromStore() {
    const nativeConfig = this.store?.data?.nativeControllers;
    if (nativeConfig && typeof nativeConfig === 'object') {
      if (nativeConfig.lianLi?.enabled) {
        this.addLianLiController(nativeConfig.lianLi);
      }
      if (nativeConfig.nzxtKraken?.enabled) {
        this.addNzxtKrakenController(nativeConfig.nzxtKraken);
      }
      if (nativeConfig.corsair?.enabled) {
        this.addCorsairController(nativeConfig.corsair);
      }
      if (nativeConfig.razerChroma?.enabled) {
        this.addRazerChromaController(nativeConfig.razerChroma);
      }
      if (nativeConfig.coolerMaster?.enabled) {
        this.addCoolerMasterController(nativeConfig.coolerMaster);
      }
      if (nativeConfig.nollie?.enabled) {
        this.addNollieController(nativeConfig.nollie);
      }
      if (nativeConfig.motherboard?.enabled) {
        this.addMotherboardController(nativeConfig.motherboard);
      }
      if (nativeConfig.keyboard?.enabled) {
        this.addKeyboardController(nativeConfig.keyboard);
      }
    }
  }

  registerController(device, transport = null) {
    this.controllers.set(device.id, device);
    if (transport) {
      this.transports.set(device.id, transport);
    }
    return device;
  }

  addLianLiController(options = {}) {
    const dev = buildLianLiDevice(options);
    this.controllers.set(dev.id, dev);
    const transport = options.transport || {
      send: (colors, isPowerOff) => {
        const packet = encodeLianLiPacket({
          channel: 1,
          colors,
          isPowerOff,
          brightness: options.brightness || 100
        });
        this.lastPackets.set(dev.id, packet);
        if (dev.hidPath) {
          this.hidBridge.writeOutputReport(dev.hidPath, packet);
        }
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  addNzxtKrakenController(options = {}) {
    const dev = buildNzxtKrakenDevice(options);
    this.controllers.set(dev.id, dev);
    const transport = options.transport || {
      send: (colors, isPowerOff) => {
        const packet = encodeNzxtPacket({
          target: 0x10,
          colors,
          isPowerOff,
          brightness: options.brightness || 100
        });
        this.lastPackets.set(dev.id, packet);
        if (dev.hidPath) {
          this.hidBridge.writeOutputReport(dev.hidPath, packet);
        }
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  addCorsairController(options = {}) {
    const dev = buildCorsairDevice(options);
    this.controllers.set(dev.id, dev);
    const transport = options.transport || {
      send: (colors, isPowerOff) => {
        const packet = encodeCorsairPacket({
          channel: 1,
          offset: 0,
          colors,
          isPowerOff,
          brightness: options.brightness || 100
        });
        this.lastPackets.set(dev.id, packet);
        if (dev.hidPath) {
          this.hidBridge.writeOutputReport(dev.hidPath, packet);
        }
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  addRazerChromaController(options = {}) {
    const dev = buildRazerChromaDevice(options);
    this.controllers.set(dev.id, dev);
    const transport = options.transport || {
      send: (colors, isPowerOff) => {
        const packet = encodeRazerChromaPacket({
          port: 1,
          offset: 0,
          colors,
          isPowerOff,
          brightness: options.brightness || 100
        });
        this.lastPackets.set(dev.id, packet);
        if (dev.hidPath) {
          this.hidBridge.writeOutputReport(dev.hidPath, packet);
        }
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  addCoolerMasterController(options = {}) {
    const dev = buildCoolerMasterDevice(options);
    this.controllers.set(dev.id, dev);
    const transport = options.transport || {
      send: (colors, isPowerOff) => {
        const packet = encodeCoolerMasterPacket({
          port: 1,
          colors,
          isPowerOff,
          brightness: options.brightness || 100
        });
        this.lastPackets.set(dev.id, packet);
        if (dev.hidPath) {
          this.hidBridge.writeOutputReport(dev.hidPath, packet);
        }
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  addNollieController(options = {}) {
    const dev = buildNollieDevice(options);
    this.controllers.set(dev.id, dev);
    const transport = options.transport || {
      send: (colors, isPowerOff) => {
        const packet = encodeNolliePortPacket({
          port: 1,
          offset: 0,
          colors,
          isPowerOff,
          brightness: options.brightness || 100
        });
        this.lastPackets.set(dev.id, packet);
        if (dev.hidPath) {
          this.hidBridge.writeOutputReport(dev.hidPath, packet);
        }
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  addMotherboardController(options = {}) {
    const dev = buildMotherboardDevice(options);
    this.controllers.set(dev.id, dev);
    const transport = options.transport || {
      send: (colors, isPowerOff) => {
        const packet = dev.motherboardBrand === 'gigabyte'
          ? encodeGigabytePacket({ header: 1, colors, isPowerOff, brightness: options.brightness || 100 })
          : encodeMsiPacket({ header: 1, colors, isPowerOff, brightness: options.brightness || 100 });
        this.lastPackets.set(dev.id, packet);
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  addKeyboardController(options = {}) {
    const dev = buildKeyboardDevice(options);
    this.controllers.set(dev.id, dev);
    let lastSent = null;
    let lastEffectSignature = '';

    const hexToRgb = hex => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#00FFFF');
      return m ? { red: parseInt(m[1], 16), green: parseInt(m[2], 16), blue: parseInt(m[3], 16) } : { red: 0, green: 255, blue: 255 };
    };

    const transport = options.transport || {
      send: (colors, isPowerOff) => {
        const devSettings = this.store?.data?.devices?.[dev.id] || {};
        const masterSettings = this.store?.data?.master || {};
        const isSynced = devSettings.syncWithPc !== false; // Default: true

        if (!isSynced && devSettings.nativeMode === undefined && !devSettings.effect && !devSettings.color && devSettings.power === undefined) {
          // Keyboard is decoupled from PC sync: do not send any packets, allowing the keyboard's internal hardware memory/Fn-key presets to run undisturbed.
          return lastSent;
        }

        const power = isPowerOff ? false : (isSynced ? (masterSettings.power && (devSettings.power !== false)) : (devSettings.power !== false));
        const brightness = devSettings.brightness !== undefined ? devSettings.brightness : (isSynced ? (masterSettings.brightness ?? 100) : 100);
        const speed = devSettings.speed !== undefined ? devSettings.speed : (isSynced ? (masterSettings.speed ?? 50) : 50);
        const nativeMode = devSettings.nativeMode !== undefined ? devSettings.nativeMode : undefined;

        let mode = 0x11;
        let colorMixing = 0x00;
        let red = 0, green = 255, blue = 255;

        if (nativeMode !== undefined) {
          mode = nativeMode;
          const hex = devSettings.color || (isSynced ? masterSettings.color : undefined) || '#00FFFF';
          const rgb = hexToRgb(hex);
          red = rgb.red; green = rgb.green; blue = rgb.blue;
          const rainbowModes = [0x01, 0x03, 0x04, 0x05, 0x06, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0F, 0x10];
          colorMixing = rainbowModes.includes(mode) ? 0x01 : 0x00;
        } else {
          // Use proprietary native hardware effects of the keyboard
          const eff = (isSynced ? (masterSettings.effect || devSettings.effect) : devSettings.effect) || 'wave';
          const hex = (isSynced ? (masterSettings.color || devSettings.color) : devSettings.color) || '#00FFFF';
          const rgb = hexToRgb(hex);
          red = rgb.red; green = rgb.green; blue = rgb.blue;

          switch (eff) {
            case 'rainbow':
            case 'wave':
              mode = 0x01; // Native Hardware Wave / Rainbow (proprietary 60 FPS internal animation)
              colorMixing = 0x01; // ARGB multicolor per-key
              break;
            case 'breathe':
            case 'pulse':
              mode = 0x12; // Native Hardware Breathing
              colorMixing = 0x00;
              break;
            case 'scanner':
            case 'comet':
              mode = 0x03; // Native Hardware Rotating Windmill
              colorMixing = 0x01;
              break;
            case 'strobe':
            case 'sparkle':
              mode = 0x06; // Native Hardware Twinkle / Stars
              colorMixing = 0x01;
              break;
            case 'sequence':
              mode = 0x13; // Native Hardware Color Cycle / Neon
              colorMixing = 0x00;
              break;
            case 'static':
            default:
              mode = 0x11; // Native Hardware Steady (solid color)
              colorMixing = 0x00;
              break;
          }
        }

        const signature = JSON.stringify({ power, brightness, speed, mode, colorMixing, red, green, blue });
        if (signature === lastEffectSignature) {
          // 100% Event-driven: ZERO USB packets sent when state is unchanged!
          // Completely eliminates typing delay / input lag and flickering.
          return lastSent;
        }

        lastEffectSignature = signature;

        const packet = encodeSinoWealthKeyboardPacket({
          mode: power ? mode : 0x11,
          speed,
          brightness: power ? brightness : 0,
          red,
          green,
          blue,
          colorMixing,
          isPowerOff: !power
        });

        this.lastPackets.set(dev.id, packet);
        lastSent = packet;

        if (dev.hidPath) {
          this.hidBridge.sendFeatureReport(dev.hidPath, packet);
        }
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  /**
   * Auto-detects connected USB-HID hardware (Royal Kludge / SinoWealth keyboards, Lian Li, NZXT, Corsair, Razer, Cooler Master, Nollie).
   */
  async autoDetectHardware() {
    const devices = await this.hidBridge.enumerate();
    if (!Array.isArray(devices) || devices.length === 0) return [];

    const detected = [];

    for (const dev of devices) {
      const vid = (dev.vid || '').toUpperCase();
      const pid = (dev.pid || '').toUpperCase();
      const pathStr = dev.path || '';

      // 1. Royal Kludge RK61 / SinoWealth Keyboards (VID: 0x258A, PID: 0x00EC or other SinoWealth MCUs)
      if (vid === '0X258A' && (pid === '0X00EC' || pid === '0X0090' || pid === '0X0084') && dev.featLen === 65) {
        const kbDev = this.addKeyboardController({
          name: pid === '0X00EC' ? 'Royal Kludge RK61' : 'Teclado Mecânico SinoWealth',
          vendor: 'Royal Kludge',
          layout: '60%',
          ledCount: 61,
          hidPath: pathStr
        });
        detected.push(kbDev);
      }

      // 2. Lian Li Uni Hub (VID: 0x0CF2)
      if (vid === '0X0CF2' && dev.outLen >= 64) {
        const lianLiDev = this.addLianLiController({
          name: 'Lian Li Uni Hub (Detectado)',
          hidPath: pathStr
        });
        detected.push(lianLiDev);
      }

      // 3. NZXT Kraken (VID: 0x1E71)
      if (vid === '0X1E71' && dev.outLen >= 64) {
        const nzxtDev = this.addNzxtKrakenController({
          name: 'NZXT Kraken (Detectado)',
          hidPath: pathStr
        });
        detected.push(nzxtDev);
      }

      // 4. Corsair Commander / Lighting Node (VID: 0x1B1C)
      if (vid === '0X1B1C' && dev.outLen >= 64) {
        const corsairDev = this.addCorsairController({
          name: 'Corsair Controller (Detectado)',
          hidPath: pathStr
        });
        detected.push(corsairDev);
      }

      // 5. Razer Chroma ARGB (VID: 0x1532, PID: 0x0F1F)
      if (vid === '0X1532' && pid === '0X0F1F') {
        const razerDev = this.addRazerChromaController({
          name: 'Razer Chroma ARGB (Detectado)',
          hidPath: pathStr
        });
        detected.push(razerDev);
      }

      // 6. Cooler Master ARGB (VID: 0x2516)
      if (vid === '0X2516' && dev.outLen >= 64) {
        const cmDev = this.addCoolerMasterController({
          name: 'Cooler Master ARGB (Detectado)',
          hidPath: pathStr
        });
        detected.push(cmDev);
      }
    }

    return detected;
  }

  removeController(id) {
    this.controllers.delete(id);
    this.transports.delete(id);
    this.lastPackets.delete(id);
  }

  clear() {
    this.controllers.clear();
    this.transports.clear();
    this.lastPackets.clear();
  }

  getDevices() {
    return Array.from(this.controllers.values());
  }

  sendLeds(deviceId, colors, isPowerOff = false) {
    const transport = this.transports.get(deviceId);
    if (!transport) return false;
    try {
      const res = transport.send(colors, isPowerOff);
      if (Buffer.isBuffer(res)) {
        this.lastPackets.set(deviceId, res);
      }
      return true;
    } catch {
      return false;
    }
  }

  getLastPacket(deviceId) {
    return this.lastPackets.get(deviceId) || null;
  }

  getSummary() {
    return Array.from(this.controllers.values()).map(c => ({
      name: c.name,
      vendor: c.vendor,
      type: c.type,
      busType: c.busType,
      ledCount: c.ledCount
    }));
  }

  destroy() {
    this.clear();
    if (this.hidBridge) {
      this.hidBridge.stop();
    }
  }
}

module.exports = {
  ControllerRegistry,
  buildLianLiDevice,
  encodeLianLiPacket,
  encodeLianLiPackets,
  buildNzxtKrakenDevice,
  encodeNzxtPacket,
  encodeNzxtPackets,
  buildCorsairDevice,
  encodeCorsairPacket,
  encodeCorsairPackets,
  buildRazerChromaDevice,
  encodeRazerChromaPacket,
  encodeRazerChromaPackets,
  buildCoolerMasterDevice,
  encodeCoolerMasterPacket,
  encodeCoolerMasterPackets,
  buildNollieDevice,
  encodeNolliePortPacket,
  encodeNolliePortPackets,
  buildMotherboardDevice,
  encodeGigabytePacket,
  encodeMsiPacket,
  buildKeyboardDevice,
  encodeSinoWealthKeyboardPacket,
  KEYBOARD_LAYOUTS,
  HidBridge
};
