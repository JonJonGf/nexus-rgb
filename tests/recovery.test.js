'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { fixture } = require('./helpers/http-app');

test('saude local distingue painel pronto de controlador desconectado sem expor configuracoes', async t => {
  const hardware = { connected: false, on() {}, changed() {}, stop() {}, snapshot() { return { connected: this.connected, devices: this.connected ? [{ id: 'a'.repeat(24), ledCount: 0 }] : [] }; } };
  const f = await fixture(t, { hardware });
  const first = (await f.request('/api/health')).json(); assert.equal(first.ready, true); assert.deepEqual(first.hardware, { connected: false, devices: 0 });
  hardware.connected = true;
  const next = (await f.request('/api/health')).json(); assert.deepEqual(next.hardware, { connected: true, devices: 1 }); assert.equal(next.master, undefined);
});

test('recuperacao reinicia apenas os servicos corretos, preserva arquivos e nao anuncia sucesso sem OpenRGB', { skip: process.platform !== 'win32' }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-recovery-fixture-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = fs.readFileSync(path.join(__dirname, '../scripts/restart-services.ps1'), 'utf8');
  const setup = String.raw`
$ErrorActionPreference='Stop'
$trace=[Collections.Generic.List[string]]::new(); $states=@{NexusRGB='Running';NexusRGBHardware='Running'}
function Get-NexusPorts {return @{PanelPort=5151;SDKPort=6754;AlexaPort=8081}}
function Get-CimInstance([string]$ClassName,[string]$Filter) {
 $name=if($Filter -eq "Name='NexusRGB'"){'NexusRGB'}else{'NexusRGBHardware'}
 $argument=if($name -eq 'NexusRGB'){'--service'}else{'--hardware-service'}
 $path='"'+(Join-Path $env:NEXUS_TEST_ROOT 'NexusRGB.exe')+'" '+$argument
 if($env:NEXUS_TEST_CASE -eq 'foreign' -and $name -eq 'NexusRGBHardware'){$path='"C:\other\app.exe" --service'}
 return [pscustomobject]@{Name=$name;PathName=$path}
}
function Get-Service([string]$Name) {if($Name -notin 'NexusRGB','NexusRGBHardware'){throw 'Foreign service'}; return [pscustomobject]@{Status=$states[$Name]} | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value {} -PassThru}
function Stop-Service([string]$Name) {if($Name -notin 'NexusRGB','NexusRGBHardware'){throw 'Foreign service'}; $trace.Add('stop:'+ $Name); $states[$Name]='Stopped'}
function Start-Service([string]$Name) {if($Name -notin 'NexusRGB','NexusRGBHardware'){throw 'Foreign service'}; $trace.Add('start:'+ $Name); if($env:NEXUS_TEST_CASE -eq 'start-failure' -and $Name -eq 'NexusRGBHardware'){throw 'Simulated startup failure'}; $states[$Name]='Running'}
function Start-Sleep {}
function Invoke-RestMethod([string]$Uri) {if($Uri -ne 'http://127.0.0.1:5151/api/health'){throw 'Unexpected destination'}; return @{ready=$true;application='nexus-rgb';hardware=@{connected=($env:NEXUS_TEST_CASE -ne 'sdk-failure');devices=7}}}
`;
  const script = setup + source
    .replace(". (Join-Path $PSScriptRoot 'ports.ps1')", '')
    .replace("$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\\')", '$root=$env:NEXUS_TEST_ROOT')
    .replace("if(-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))", 'if($false)')
    .replace("if($root -ne (Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'))", 'if($root -ne $env:NEXUS_TEST_ROOT)')
    .replace('Global\\NexusRGB.RestartServices', 'Local\\NexusRGB.RecoveryFixture.' + path.basename(directory))
    .replace('if($mutex){$mutex.Dispose()}', "if($mutex){$mutex.Dispose()}; [IO.File]::WriteAllLines((Join-Path $env:NEXUS_TEST_ROOT 'trace.txt'),$trace)");
  const sentinel = path.join(directory, 'settings.json'); fs.writeFileSync(sentinel, '{"profiles":["preserve"]}');
  for (const scenario of ['success', 'foreign', 'sdk-failure', 'start-failure']) {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 15000, windowsHide: true, env: { ...process.env, NEXUS_TEST_ROOT: directory, NEXUS_TEST_CASE: scenario } });
    assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr + result.stdout);
    const trace = fs.readFileSync(path.join(directory, 'trace.txt'), 'utf8').trim().split(/\r?\n/).filter(Boolean);
    if (scenario === 'foreign') assert.deepEqual(trace, []);
    else assert.deepEqual(trace.slice(0, 3), ['stop:NexusRGB', 'stop:NexusRGBHardware', 'start:NexusRGBHardware']);
    if (scenario === 'success') { assert.equal(trace.at(-1), 'start:NexusRGB'); assert.match(result.stdout, /detectados: 7/); }
    if (scenario === 'sdk-failure') assert.match(result.stdout, /OpenRGB ainda nao confirmou/);
    if (scenario === 'start-failure') assert.ok(trace.includes('start:NexusRGB'), 'Tenta recuperar o painel mesmo se OpenRGB falha.');
    assert.equal(fs.readFileSync(sentinel, 'utf8'), '{"profiles":["preserve"]}');
  }
});
