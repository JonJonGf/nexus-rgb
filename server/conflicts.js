'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path');

const KNOWN_CONFLICTING_APPS = [
  { id: 'icue', name: 'Corsair iCUE', exes: ['icue.exe'] },
  { id: 'armoury-crate', name: 'ASUS Armoury Crate / Aura', exes: ['armourycrate.exe', 'armourycrate.usersessionhelper.exe', 'lightingservice.exe', 'auraservice.exe'] },
  { id: 'l-connect', name: 'Lian Li L-Connect', exes: ['l-connect.exe', 'l-connect 3.exe', 'l-connect3.exe'] },
  { id: 'razer-synapse', name: 'Razer Synapse', exes: ['razer synapse 3.exe', 'razersynapse.exe', 'razersynapseservice.exe'] },
  { id: 'rgb-fusion', name: 'Gigabyte RGB Fusion', exes: ['rgbfusion.exe', 'check_fusion.exe'] },
  { id: 'mystic-light', name: 'MSI Mystic Light / Center', exes: ['mysticlight.exe', 'msicenter.exe', 'dragon center.exe'] },
  { id: 'nzxt-cam', name: 'NZXT CAM', exes: ['nzxt cam.exe', 'cam.exe'] },
  { id: 'signal-rgb', name: 'SignalRGB', exes: ['signalrgb.exe', 'signalrgbcontrol.exe'] }
];

class Conflicts {
  constructor({ now = () => performance.now(), queryWindowsDynamicLighting, queryRunningProcesses } = {}) {
    this.now = now;
    this.queryWindowsDynamicLighting = queryWindowsDynamicLighting || (() => this.checkDynamicLightingWindows());
    this.queryRunningProcesses = queryRunningProcesses || (() => this.checkProcessesWindows());
    this.cache = null;
    this.at = 0;
    this.inflight = null;
  }

  checkDynamicLightingWindows() {
    return new Promise(resolve => {
      if (process.platform !== 'win32') {
        return resolve({ supported: false, enabled: false });
      }
      const reg = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
      execFile(reg, ['query', 'HKCU\\Software\\Microsoft\\Lighting', '/v', 'AmbientLightingEnabled'], {
        windowsHide: true,
        timeout: 3000,
        encoding: 'utf8'
      }, (err, stdout) => {
        if (err || !stdout) {
          return resolve({ supported: false, enabled: false });
        }
        const match = /AmbientLightingEnabled\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(stdout);
        if (match) {
          const val = parseInt(match[1], 16);
          return resolve({ supported: true, enabled: val !== 0 });
        }
        resolve({ supported: true, enabled: true });
      });
    });
  }

  checkProcessesWindows() {
    return new Promise(resolve => {
      if (process.platform !== 'win32') {
        return resolve([]);
      }
      const tasklist = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tasklist.exe');
      execFile(tasklist, ['/FO', 'CSV', '/NH'], {
        windowsHide: true,
        timeout: 4000,
        encoding: 'utf8'
      }, (err, stdout) => {
        if (err || !stdout) {
          return resolve([]);
        }
        const activeExes = new Set();
        for (const line of stdout.split(/\r?\n/)) {
          const m = /^"([^"]+)"/.exec(line);
          if (m) {
            activeExes.add(m[1].toLowerCase());
          }
        }
        const detected = [];
        for (const app of KNOWN_CONFLICTING_APPS) {
          const foundExe = app.exes.find(exe => activeExes.has(exe.toLowerCase()));
          if (foundExe) {
            detected.push({ id: app.id, name: app.name, process: foundExe });
          }
        }
        resolve(detected);
      });
    });
  }

  async sample() {
    if (this.cache && (this.now() - this.at) < 15000) {
      return this.cache;
    }
    if (this.inflight) {
      return this.inflight;
    }
    this.inflight = this.measure();
    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }

  async measure() {
    const [dynamicLighting, apps] = await Promise.all([
      this.queryWindowsDynamicLighting().catch(() => ({ supported: false, enabled: false })),
      this.queryRunningProcesses().catch(() => [])
    ]);

    this.at = this.now();
    this.cache = {
      at: new Date().toISOString(),
      dynamicLighting,
      conflicts: apps,
      hasConflicts: Boolean(dynamicLighting.enabled || apps.length > 0)
    };
    return this.cache;
  }
}

module.exports = { Conflicts, KNOWN_CONFLICTING_APPS };
