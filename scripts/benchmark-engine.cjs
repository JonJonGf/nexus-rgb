'use strict';
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http'), { fork, execFile } = require('node:child_process'), { promisify } = require('node:util');
const sleep = ms => new Promise(r => setTimeout(r, ms)), run = promisify(execFile);
const root = path.resolve(__dirname, '..'), reportPath = path.resolve(process.argv[2] && process.argv[2] !== 'child' ? process.argv[2] : path.join(root, 'data', 'engine-benchmark.json'));
if (process.argv[2] === 'child') {
  const { EventEmitter } = require('node:events'), { Store } = require('../server/store'), { Hardware } = require('../server/hardware'), { createApp } = require('../server');
  const store = new Store(process.env.BENCH_DATA);
  const controller = (name, count, zones = []) => ({ name, location: name, vendor: 'Nexus benchmark', type: 2, serial: '', colors: Array(count).fill({ red: 0, green: 0, blue: 0 }), zones, modes: [{ id: 0, name: 'Direct', flagList: ['perLedColor'] }] });
  const devices = [controller('RAM 1', 8), controller('RAM 2', 8), controller('Board', 76, [4,36,36].map((n,id) => ({ id, name: id ? 'ARGB ' + id : 'LED interno', ledsCount: n, ledsMin: n, ledsMax: n, resizable: false })))];
  let writes = 0;
  class Mock extends EventEmitter { async connect() {} async getControllerCount() { return devices.length; } async getControllerData(i) { return devices[i]; } async updateMode() {} updateLeds() { writes++; } disconnect() {} }
  const hardware = new Hardware(store, { makeClient: () => new Mock() });
  createApp({ directory: process.env.BENCH_DATA, store, hardware, localPort: 0, disableAlexa: true, getInterfaces: () => [] }).then(async app => {
    const { localPort } = await app.start();
    process.send({ ready: true, port: localPort });
    process.on('message', async m => {
      if (m === 'sample') process.send({ kind: 'sample', pid: process.pid, worker: app.studio.worker?.pid, frames: app.studio.revision, writes, metrics: app.studio.snapshot().metrics, error: app.studio.error });
      if (m === 'stop') { await app.stop(); process.exit(0); }
    });
    process.on('disconnect', async () => { await app.stop(); process.exit(0); });
  }).catch(e => { console.error(e); process.exit(1); });
} else {
  (async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-studio-bench-'));
    const child = fork(__filename, ['child'], { env: { ...process.env, BENCH_DATA: directory }, windowsHide: true, stdio: ['ignore','ignore','inherit','ipc'] });
    let stream, previewBytes = 0;
    try {
      const ready = await new Promise((resolve,reject) => { child.once('message',resolve); child.once('error',reject); });
      const origin = 'http://127.0.0.1:' + ready.port;
      let cookie;
      async function api(route, body) {
        const response = await fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: { origin, 'x-nexus-client': 'web', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        if (!response.ok) throw Error(route + ': ' + await response.text());
        if (route === '/api/session/local') cookie = response.headers.get('set-cookie').split(';')[0];
        return response.json();
      }
      async function info() { return new Promise(resolve => { child.once('message', resolve); child.send('sample'); }); }
      async function sample() {
        const state = await info(), ids = [state.pid, ...(state.worker ? [state.worker] : [])];
        const cmd = 'Get-Process -Id ' + ids.join(',') + ' | Select-Object Id,CPU,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress';
        const result = await run('powershell.exe', ['-NoProfile','-Command',cmd], { windowsHide: true, timeout: 10000 });
        const processes = JSON.parse(result.stdout);
        return { at: performance.now(), ...state, previewBytes, processes: Array.isArray(processes) ? processes : [processes] };
      }
      await api('/api/session/local', {});
      const library = await api('/api/studio');
      // Owned synthetic Canvas source. No downloaded creator effect is redistributed.
      const html = '<title>Barras de teste Nexus</title><canvas id="exCanvas" width="320" height="200"></canvas><script>var ctx=document.getElementById("exCanvas").getContext("2d"),phase=0;function tick(){phase+=0.01;ctx.clearRect(0,0,320,200);for(var i=0;i<64;i++){ctx.fillStyle="hsl("+(i*6+phase*100)+",100%,50%)";ctx.fillRect(i*5,0,5,200)}requestAnimationFrame(tick)}requestAnimationFrame(tick);</script>';
      const imported = await api('/api/studio/import', { source: html });
      const cases = [
        { name: 'Mapa desativado, estático', fps: 20, enabled: false, activeId: library.activeId },
        { name: 'Aurora, sem prévia', fps: 20, enabled: true, activeId: library.activeId },
        { name: 'Aurora, sem prévia', fps: 60, enabled: true, activeId: library.activeId },
        { name: 'Aurora, com prévia', fps: 60, enabled: true, activeId: library.activeId, preview: true },
        { name: 'HTML próprio, sem prévia', fps: 20, enabled: true, activeId: imported.id },
        { name: 'HTML próprio, sem prévia', fps: 60, enabled: true, activeId: imported.id },
        { name: 'HTML próprio, com prévia', fps: 60, enabled: true, activeId: imported.id, preview: true }
      ];
      const report = { date: new Date().toISOString(), node: process.version, cpu: os.cpus()[0].model, logicalProcessors: os.cpus().length, memoryGiB: os.totalmem()/1073741824, platform: os.platform() + ' ' + os.release(), scope: 'Isolated production API + real Hardware class with simulated SDK (3 controllers, 5 components, 92 LEDs) + Studio child. Excludes OpenRGB, supervisors, tray, browser, driver and benchmark harness. Preview uses real SSE/PNG; no physical LED rate measured.', scenarios: [] };
      for (const entry of cases) {
        stream?.destroy(); stream = null;
        await api('/api/settings', { fps: entry.fps });
        await api('/api/studio/play', { activeId: entry.activeId, enabled: entry.enabled });
        if (entry.preview) {
          stream = http.get(origin + '/api/studio/preview', { headers: { cookie } }, res => res.on('data', chunk => { previewBytes += chunk.length; }));
          stream.on('error', () => {});
        }
        await sleep(3000);
        const samples = [await sample()];
        for (let i=0;i<20;i++) { await sleep(1000); samples.push(await sample()); }
        const first=samples[0], last=samples.at(-1), seconds=(last.at-first.at)/1000;
        if (samples.some(s => s.error)) throw Error('Renderer failure: ' + samples.find(s => s.error).error);
        const totalCpu = s => s.processes.reduce((n,p) => n+p.CPU,0), resident=s => s.processes.reduce((n,p) => n+p.WorkingSet64,0)/1048576, privateMB=s => s.processes.reduce((n,p) => n+p.PrivateMemorySize64,0)/1048576;
        const mean = values => values.reduce((n,v)=>n+v,0)/values.length;
        const result = { ...entry, durationSeconds: seconds, cpuPercentOfMachine:100*(totalCpu(last)-totalCpu(first))/seconds/os.cpus().length, rssMeanMiB:mean(samples.map(resident)), rssPeakMiB:Math.max(...samples.map(resident)), privateMeanMiB:mean(samples.map(privateMB)), renderedFps:(last.frames-first.frames)/seconds, simulatedLedWritesPerSecond:(last.writes-first.writes)/seconds, renderMeanMs:mean(samples.map(s=>s.metrics.renderMs)), previewKiBPerSecond:(last.previewBytes-first.previewBytes)/seconds/1024 };
        report.scenarios.push(result);
        fs.writeFileSync(reportPath, JSON.stringify(report,null,2));
        console.log(JSON.stringify(result));
      }
    } finally {
      stream?.destroy(); if (child.connected) child.send('stop');
      await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit',resolve); });
      if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith('nexus-studio-bench-')) throw Error('Invalid temporary path');
      fs.rmSync(directory, { recursive:true,force:true });
    }
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
