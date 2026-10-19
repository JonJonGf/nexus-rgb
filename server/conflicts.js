'use strict';
const { execFile } = require('node:child_process');

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

  async checkDynamicLightingWindows() {
    if (process.platform !== 'win32') return { supported: false, enabled: false };
    const scope = 'loaded-user-profiles', deadline = performance.now() + 3000;
    const query = args => new Promise(resolve => {
      const remaining = Math.ceil(deadline - performance.now());
      if (remaining <= 0) return resolve(null);
      execFile('reg.exe', ['query', ...args], { windowsHide: true, timeout: remaining, maxBuffer: 256 * 1024, encoding: 'utf8' }, (err, stdout) => resolve(err ? null : stdout));
    });
    // HKCU belongs to LocalService in the installed server, not to the person
    // using the PC. Query loaded local/domain/Entra user hives without names
    // or SIDs in the result. Loaded profiles need not be active sessions.
    const listing = await query(['HKU']);
    if (listing === null) return { supported: false, enabled: false, scope, checkedProfiles: 0, partial: true };
    const profiles = [...new Set(listing.split(/\r?\n/).map(line => /^HKEY_USERS\\(S-1-(?:5-21|12-1)-\d+-\d+-\d+-\d+)$/i.exec(line.trim())?.[1]).filter(Boolean))];
    const values = [];
    // Bound both the work and total wall time; never launch one process per
    // profile without a limit on a multi-user PC.
    for (let offset = 0; offset < Math.min(profiles.length, 16); offset += 4) {
      const batch = await Promise.all(profiles.slice(offset, Math.min(offset + 4, 16)).map(async sid => {
        const stdout = await query(['HKU\\' + sid + '\\Software\\Microsoft\\Lighting', '/v', 'AmbientLightingEnabled']);
        const match = stdout && /AmbientLightingEnabled\s+REG_DWORD\s+0x([0-9a-f]+)\b/i.exec(stdout);
        return match ? parseInt(match[1], 16) !== 0 : null;
      }));
      values.push(...batch);
    }
    const checkedProfiles = values.filter(value => value !== null).length;
    return { supported: checkedProfiles > 0, enabled: values.includes(true), scope, checkedProfiles, partial: !profiles.length || checkedProfiles !== profiles.length };
  }

  checkProcessesWindows() {
    return new Promise(resolve => {
      if (process.platform !== 'win32') {
        return resolve([]);
      }
      execFile('tasklist.exe', ['/FO', 'CSV', '/NH'], {
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
      this.queryWindowsDynamicLighting().catch(() => ({ supported: false, enabled: false, scope: 'loaded-user-profiles', checkedProfiles: 0, partial: true })),
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
