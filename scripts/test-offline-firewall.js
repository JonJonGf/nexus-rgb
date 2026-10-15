'use strict';
// Compare a control runtime with Nexus's dedicated runtime. TCP handshakes only.
const net = require('node:net'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
async function probe(host, port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port }); let done = false;
    const finish = result => { if (done) return; done = true; socket.destroy(); resolve(result); };
    socket.setTimeout(3000, () => finish({ connected: false, reason: 'timeout' }));
    socket.once('connect', () => finish({ connected: true }));
    socket.once('error', error => finish({ connected: false, reason: error.code }));
  });
}
async function main() {
  if (process.argv[2] === '--probe') {
    const port = require('../server/ports').port(process.argv[3], 'do painel');
    console.log(JSON.stringify({ internet: await probe('1.1.1.1', 443), loopback: await probe('127.0.0.1', port) })); return;
  }
  if (process.platform !== 'win32') throw Error('Este teste exige Nexus instalado no Windows.');
  const programs = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); [Environment]::GetFolderPath('ProgramFiles')"], { encoding: 'utf8' }).trim();
  const installed = path.join(programs, 'Nexus RGB', 'runtime', 'node.exe');
  if (!fs.existsSync(installed)) throw Error('Runtime dedicado não encontrado.');
  const configuredPort = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$value=Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\NexusRGB' -ErrorAction SilentlyContinue; if($null -ne $value.PanelPort){$value.PanelPort}else{5050}"], { encoding: 'utf8', windowsHide: true }).trim();
  const port = require('../server/ports').port(configuredPort, 'do painel');
  const run = executable => JSON.parse(execFileSync(executable, [__filename, '--probe', String(port)], { encoding: 'utf8', timeout: 10000, windowsHide: true }));
  const controlRuntime = run(process.execPath), nexusDedicatedRuntime = run(installed);
  const report = { collectedAt: new Date().toISOString(), scope: 'TCP handshakes only; no application data sent; IPv4 1.1.1.1:443 and loopback 127.0.0.1:' + port, controlRuntime, nexusDedicatedRuntime, internetBlockVerified: controlRuntime.internet.connected && !nexusDedicatedRuntime.internet.connected && nexusDedicatedRuntime.loopback.connected };
  const output = path.resolve(__dirname, '..', 'data', 'validation', 'firewall-live.json'); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.internetBlockVerified) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
