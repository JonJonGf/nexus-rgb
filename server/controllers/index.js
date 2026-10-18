'use strict';

/**
 * Registry for the supported keyboard transport and experimental controller encoders.
 * Physical auto-detection is restricted to descriptors exercised on available hardware.
 * Other controllers continue to use OpenRGB until their native transports are validated.
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
  constructor({ store = null, hidBridge = null, now = () => Date.now() } = {}) {
    this.store = store;
    this.hidBridge = hidBridge || new HidBridge();
    this.controllers = new Map();
    this.transports = new Map();
    this.lastPackets = new Map();
    this.failures = new Map(); this.now = now;

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
      send: async (colors, isPowerOff) => {
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
        if (signature === lastEffectSignature && (this.hidBridge.isTest || this.hidBridge.ready !== false)) {
          // 100% Event-driven: ZERO USB packets sent when state is unchanged!
          // Completely eliminates typing delay / input lag and flickering.
          return lastSent;
        }

        const packet = encodeSinoWealthKeyboardPacket({
          mode: power ? mode : 0x11,
          speed,
          brightnessPercent: power ? brightness : 0,
          red,
          green,
          blue,
          colorMixing,
          isPowerOff: !power
        });

        if (dev.hidPath) {
          if (!await this.hidBridge.sendFeatureReport(dev.hidPath, packet)) return false;
        } else if (!this.hidBridge.isTest) return false;
        lastEffectSignature = signature;
        this.lastPackets.set(dev.id, packet);
        lastSent = packet;
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
  }

  /**
   * Detects supported USB lighting interfaces without claiming a whole vendor family.
   */
  async autoDetectHardware({force=false}={}) {
    if (this.scanning) return this.scanning;
    if (!force && this.lastScan && Date.now()-this.lastScan < 30000) return this.getDevices();
    this.scanning = (async () => {
      const devices = await this.hidBridge.enumerate();
      if (!Array.isArray(devices)) throw Error('Lista USB inválida.');
      const present = new Set();
      // Only the RK61 USB descriptor exercised on real hardware is enabled here.
      // A vendor ID alone is not sufficient evidence of a compatible protocol.
      for (const descriptor of devices) {
        if (String(descriptor.vid).toLowerCase() !== '0x258a' || String(descriptor.pid).toLowerCase() !== '0x00ec' || descriptor.featLen !== 65 || descriptor.usagePage !== 0xff00 || typeof descriptor.path !== 'string' || !descriptor.path) continue;
        const options = {name:'Royal Kludge RK61',vendor:'Royal Kludge',layout:'60%',ledCount:61,hidPath:descriptor.path};
        const id = buildKeyboardDevice(options).id;
        present.add(id);
        if (!this.controllers.has(id)) { const dev=this.addKeyboardController(options); dev.autoDetected=true; }
        this.controllers.get(id).nativeConnected=true;
      }
      for (const dev of this.getDevices()) if (dev.autoDetected && !present.has(dev.id)) this.removeController(dev.id);
      this.lastScan=Date.now(); this.discoveryError=null;
      return this.getDevices();
    })();
    try { return await this.scanning; }
    catch(error) { this.discoveryError='Não foi possível detectar os dispositivos USB.'; throw error; }
    finally { this.scanning=null; }
  }
  removeController(id) {
    this.controllers.delete(id);
    this.transports.delete(id);
    this.lastPackets.delete(id);
    this.failures.delete(id);
  }

  clear() {
    this.controllers.clear();
    this.transports.clear();
    this.lastPackets.clear();
    this.failures.clear();
    this.lastScan = 0;
  }

  getDevices() {
    return Array.from(this.controllers.values());
  }
  isConnected(id) {
    const device=this.controllers.get(id);
    if (!device || device.error) return false;
    if (this.hidBridge.isTest) return true;
    if (this.hidBridge instanceof HidBridge && !this.hidBridge.ready) return false;
    return Boolean(device.nativeConnected);
  }

  async sendLeds(deviceId, colors, isPowerOff = false) {
    const transport = this.transports.get(deviceId);
    if (!transport) return false;
    const device = this.controllers.get(deviceId);
    // The other encoders are reference models, not validated physical transports.
    // Do not send truncated or guessed packets to arbitrary vendor hardware.
    if (!this.hidBridge.isTest && device.controllerType !== 'keyboard') {
      device.error = 'Este controlador deve ser usado pelo OpenRGB; o protocolo USB nativo ainda não foi validado.';
      return false;
    }
    const state = JSON.stringify([isPowerOff,this.store?.data?.master,this.store?.data?.devices?.[deviceId]]);
    const failed = this.failures.get(deviceId);
    if (failed?.state === state && this.now() < failed.retryAt) return false;
    try {
      const res = await transport.send(colors, isPowerOff);
      if (res === false) throw Error('USB acknowledgement missing');
      if (Buffer.isBuffer(res)) {
        this.lastPackets.set(deviceId, res);
      }
      this.controllers.get(deviceId).error = null;
      this.controllers.get(deviceId).nativeConnected = true;
      this.failures.delete(deviceId);
      return true;
    } catch {
      const attempts = failed?.state === state ? failed.attempts + 1 : 1;
      this.failures.set(deviceId,{state,attempts,retryAt:this.now()+Math.min(15000,500*2**Math.min(attempts-1,5))});
      if (this.controllers.has(deviceId)) this.controllers.get(deviceId).error = 'Não foi possível enviar o comando ao dispositivo USB.';
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
