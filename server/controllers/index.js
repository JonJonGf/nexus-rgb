'use strict';

/**
 * Native USB-HID Controller Registry for Nexus RGB Studio.
 * Clean-room architecture enabling out-of-the-box support for popular USB ARGB controllers
 * (Lian Li Uni Hub, Strimer, NZXT Kraken) with zero third-party copyleft/GPL code.
 */

const { buildLianLiDevice, encodeLianLiPacket, encodeLianLiPackets } = require('./protocol-lianli');
const { buildNzxtKrakenDevice, encodeNzxtPacket, encodeNzxtPackets } = require('./protocol-nzxt');

class ControllerRegistry {
  constructor({ store = null } = {}) {
    this.store = store;
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
        // Encode packet cleanly
        const packet = encodeLianLiPacket({
          channel: 1,
          colors,
          isPowerOff,
          brightness: options.brightness || 100
        });
        this.lastPackets.set(dev.id, packet);
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
        // Encode packet cleanly
        const packet = encodeNzxtPacket({
          target: 0x10,
          colors,
          isPowerOff,
          brightness: options.brightness || 100
        });
        this.lastPackets.set(dev.id, packet);
        return packet;
      }
    };
    this.transports.set(dev.id, transport);
    return dev;
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
}

module.exports = {
  ControllerRegistry,
  buildLianLiDevice,
  encodeLianLiPacket,
  encodeLianLiPackets,
  buildNzxtKrakenDevice,
  encodeNzxtPacket,
  encodeNzxtPackets
};
