'use strict';
const { Client } = require('openrgb-sdk');

// Full mode descriptors already come from discovery. The SDK 0.6.0 writer
// rereads them and drops falsy numeric overrides, including brightness zero.
// Encode the documented update-mode payload once, preserving exact values.
class OpenRGBClient extends Client {
  async updateMode(deviceId, mode) {
    if (!Number.isInteger(deviceId) || deviceId < 0 || deviceId >= 128) throw Error('Controladora SDK inválida.');
    if (!mode || typeof mode !== 'object' || !Number.isInteger(mode.id) || mode.id < 0 || mode.id > 65535 || typeof mode.name !== 'string') throw Error('Descritor de modo SDK inválido.');
    if (!Number.isInteger(this.protocolVersion) || this.protocolVersion < 0 || this.protocolVersion > 4) throw Error('Versão de protocolo SDK incompatível.');
    const name = Buffer.from(mode.name + '\0', 'utf8'), colors = mode.colors;
    if (mode.name.includes('\0') || name.length > 4096 || !Array.isArray(colors) || colors.length > 4096) throw Error('Descritor de modo SDK acima do limite.');
    const fields = this.protocolVersion >= 3
      ? ['value','flags','speedMin','speedMax','brightnessMin','brightnessMax','colorMin','colorMax','speed','brightness','direction','colorMode']
      : ['value','flags','speedMin','speedMax','colorMin','colorMax','speed','direction','colorMode'];
    const payload = Buffer.alloc(4 + 4 + 2 + name.length + fields.length * 4 + 2 + colors.length * 4);
    payload.writeUInt32LE(payload.length, 0); payload.writeUInt32LE(mode.id, 4); payload.writeUInt16LE(name.length, 8); name.copy(payload, 10);
    let offset = 10 + name.length;
    for (const key of fields) {
      const value = mode[key];
      if (!Number.isInteger(value) || value < (key === 'value' ? -2147483648 : 0) || value > 0xffffffff) throw Error('Parâmetro de modo SDK inválido: ' + key);
      payload.writeUInt32LE(value >>> 0, offset); offset += 4;
    }
    payload.writeUInt16LE(colors.length, offset); offset += 2;
    for (const color of colors) {
      for (const key of ['red','green','blue']) {
        if (!Number.isInteger(color?.[key]) || color[key] < 0 || color[key] > 255) throw Error('Cor de modo SDK inválida.');
        payload[offset++] = color[key];
      }
      offset++; // RGBColor's unused fourth byte remains zero.
    }
    this.sendMessage(1101, payload, deviceId);
  }
}
module.exports = { OpenRGBClient };
