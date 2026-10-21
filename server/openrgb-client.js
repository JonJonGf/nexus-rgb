'use strict';
const { Client } = require('openrgb-sdk');
const Device = require('openrgb-sdk/dist/device').default;

function readDescriptor(buffer, deviceId, protocol) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.length > 4 * 1024 * 1024 || buffer.readUInt32LE(0) !== buffer.length) throw Error('Descritor SDK invalido.');
  let cursor = 8, compatible = buffer;
  const extended = [];
  const check = length => { if (cursor + length > buffer.length) throw Error('Descritor SDK incompleto.'); };
  const skipString = () => { check(2);const length=buffer.readUInt16LE(cursor);check(2+length);cursor+=2+length; };
  for (let index=0;index<(protocol>=1?6:5);index++) skipString();
  check(6);const count=buffer.readUInt16LE(cursor);cursor+=6;
  if(count>1024)throw Error('Quantidade de modos SDK acima do limite.');
  for(let index=0;index<count;index++) {
    skipString();const size=protocol>=3?48:36;check(size+2);
    const flags=buffer.readUInt32LE(cursor+4),direction=buffer.readUInt32LE(cursor+(protocol>=3?40:28));
    const colors=buffer.readUInt16LE(cursor+size);check(size+2+colors*4);
    if(colors>4096)throw Error('Quantidade de cores SDK acima do limite.');
    if(flags>0x3ff) {
      if(compatible===buffer)compatible=Buffer.from(buffer);
      compatible.writeUInt32LE(flags&0x3ff,cursor+4);extended.push({index,flags,direction});
    }
    cursor+=size+2+colors*4;
  }
  // SDK 0.6.0 uses an array length derived from a flag's bit width and throws
  // on newer bits. Its pinned v4 geometry parser can still be reused intact.
  const device=new Device(compatible,deviceId,protocol);
  for(const item of extended) {
    const mode=device.modes[item.index];mode.flags=item.flags;
    if(item.flags&1024)mode.flagList.push('requiresEntireDevice');
    if(item.flags&2048){mode.flagList.push('directionDiag');if(!mode.flagList.includes('direction'))mode.flagList.push('direction');mode.direction=item.direction;}
  }
  return device;
}

// Full mode descriptors already come from discovery. The SDK 0.6.0 writer
// rereads them and drops falsy numeric overrides, including brightness zero.
// Encode the documented update-mode payload once, preserving exact values.
class OpenRGBClient extends Client {
  async getControllerData(deviceId) {
    if(!Number.isInteger(deviceId)||deviceId<0||deviceId>=128)throw Error('Controladora SDK invalida.');
    const version=Buffer.alloc(4);version.writeUInt32LE(this.protocolVersion);
    this.sendMessage(1,version,deviceId);
    return readDescriptor(await this.readMessage(1,deviceId),deviceId,this.protocolVersion);
  }
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
