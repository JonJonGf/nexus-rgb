'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

test('configuration inventory retains panel and SDK ports while collecting firewall rules',{skip:process.platform!=='win32'},()=>{
  const script=String.raw`
$ErrorActionPreference='Stop'
function Get-NetFirewallRule {[pscustomobject]@{DisplayName='Synthetic';Enabled=$true;Direction='Inbound';Action='Allow'}}
function Get-NetFirewallAddressFilter {param([Parameter(ValueFromPipeline)]$InputObject) process{[pscustomobject]@{RemoteAddress='LocalSubnet'}}}
function Get-NetFirewallPortFilter {param([Parameter(ValueFromPipeline)]$InputObject) process{[pscustomobject]@{LocalPort=5050}}}
$ports=@{PanelPort=5151;SDKPort=6743;AlexaPort=80}
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_INVENTORY_SCRIPT,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Syntax error'}
$assignment=$ast.EndBlock.Statements | Where-Object {$_ -is [Management.Automation.Language.AssignmentStatementAst] -and $_.Left.VariablePath.UserPath -eq 'rules'}
if(-not $assignment){throw 'Firewall collector missing'}
. ([scriptblock]::Create($assignment.Extent.Text))
if($ports.PanelPort -ne 5151 -or $ports.SDKPort -ne 6743 -or $ports.AlexaPort -ne 80){throw 'Inventory replaced configured ports'}
if($rules.Count -ne 1 -or $rules[0].LocalPorts[0] -ne 5050){throw 'Firewall inventory lost ports'}
'inventory-ports-preserved'
`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:10000,env:{...process.env,NEXUS_INVENTORY_SCRIPT:path.resolve(__dirname,'../scripts/audit-installed-config.ps1')}});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/inventory-ports-preserved/);
});

test('configurador recusa porta estrangeira antes de parar serviços e restaura após falha', { skip: process.platform !== 'win32' }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ports-fixture-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const script = String.raw`
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
$root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
$dataRoot=$env:NEXUS_PORT_TEST_DATA
. $env:NEXUS_PORT_HELPER
$PanelPort=5200; $SDKPort=7200; $AlexaPort=18081
if($env:NEXUS_PORT_TEST_CASE -eq 'panel-only'){$SDKPort=6743}
$old=$null; $stopped=$false; $original=@{}
$native=Join-Path $root 'NexusRGB.exe'
$fakeServices=@(
  [pscustomobject]@{Name='NexusRGB';PathName=('"'+$native+'" --service');ProcessId=100;State='Running'},
  [pscustomobject]@{Name='NexusRGBHardware';PathName=('"'+$native+'" --hardware-service');ProcessId=200;State='Running'}
)
$fakeProcesses=@(
  [pscustomobject]@{Name='NexusRGB.exe';ProcessId=100;ParentProcessId=1;ExecutablePath=$native},
  [pscustomobject]@{Name='NexusRGB.exe';ProcessId=200;ParentProcessId=1;ExecutablePath=$native},
  [pscustomobject]@{Name='node.exe';ProcessId=101;ParentProcessId=100;ExecutablePath=(Join-Path $root 'runtime\node.exe')},
  [pscustomobject]@{Name='OpenRGB.exe';ProcessId=201;ParentProcessId=200;ExecutablePath=(Join-Path $root 'openrgb\OpenRGB.exe')},
  [pscustomobject]@{Name='Other.exe';ProcessId=900;ParentProcessId=1;ExecutablePath='C:\Other.exe'}
)
$statuses=@{NexusRGB='Running';NexusRGBHardware='Running'}
function Record([string]$Text){Add-Content -LiteralPath (Join-Path $dataRoot 'events.txt') -Value $Text}
function Get-CimInstance([string]$ClassName){if($ClassName -eq 'Win32_Service'){return $fakeServices}; return $fakeProcesses}
function Get-NetTCPConnection {if($env:NEXUS_PORT_TEST_CASE -eq 'occupied'){[pscustomobject]@{LocalPort=5200;OwningProcess=900}}}
function Get-NexusPorts {if($env:NEXUS_PORT_TEST_CASE -eq 'invalid-saved'){throw 'Invalid old settings'}; return @{PanelPort=5050;SDKPort=6743;AlexaPort=80}}
function Set-NexusPorts([int]$PanelPort,[int]$SDKPort,[int]$AlexaPort){Record ('ports:'+$PanelPort+','+$SDKPort+','+$AlexaPort)}
function Set-NexusPortFirewall([string]$NodePath,[int]$PanelPort,[int]$AlexaPort){Record ('firewall:'+$PanelPort+','+$AlexaPort)}
function Assert-NexusPorts([int]$PanelPort,[int]$SDKPort,[int]$AlexaPort){}
function Assert-NexusInstallPath([string]$Directory){if($Directory -ne $root){throw 'Unexpected installation'}}
function Get-NexusRegisteredInstallRoot {return $root}
function Assert-FreePort([int]$Port){Record ('probe:'+$Port)}
function Wait-ConfiguredPanel([int]$Port){if($env:NEXUS_PORT_TEST_CASE -eq 'health-failure'){throw 'Simulated panel failure'}; Record ('ready:'+$Port)}
function Get-Service([string]$Name){[pscustomobject]@{Status=$statuses[$Name]} | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value {} -PassThru}
function Stop-Service([string]$Name){Record ('stop:'+$Name); $statuses[$Name]='Stopped'}
function Start-Service([string]$Name){Record ('start:'+$Name); $statuses[$Name]='Running'}
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_PORT_TEST_SCRIPT,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Invalid script syntax'}
$body=$ast.EndBlock.Statements | Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]} | Select-Object -Last 1
if(-not $body){throw 'Configuration transaction missing'}
. ([scriptblock]::Create($body.Extent.Text))
`;
  const file = path.join(directory, 'fixture.ps1'); fs.writeFileSync(file, '\ufeff' + script);
  for (const mode of ['occupied', 'success', 'health-failure', 'panel-only', 'invalid-saved', 'case-sensitive']) {
    const data = path.join(directory, mode); fs.mkdirSync(data);
    if(mode==='case-sensitive'){fs.mkdirSync(path.join(data,'app'));fs.writeFileSync(path.join(data,'app/settings.json'),JSON.stringify({alexaEnabled:true,studio:{values:{Speed:20,speed:30}}}));}
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { encoding: 'utf8', windowsHide: true, timeout: 15000, env: { ...process.env, NEXUS_PORT_TEST_DATA: data, NEXUS_PORT_TEST_CASE: mode, NEXUS_PORT_TEST_SCRIPT: path.resolve(__dirname, '../scripts/configure-ports.ps1'),NEXUS_PORT_HELPER:path.resolve(__dirname,'../scripts/ports.ps1') } });
    assert.equal(result.status, ['occupied', 'health-failure'].includes(mode) ? 1 : 0, result.stdout + result.stderr);
    const eventsFile = path.join(data, 'events.txt'); const events = fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile, 'utf8') : '';
    if (mode === 'occupied') { assert.equal(events, ''); assert.match(result.stderr, /5200.*Other.exe/); }
    if (mode === 'success') { assert.match(events, /ports:5200,7200,18081/); assert.match(events, /ready:5200/); }
    if (mode === 'health-failure') { assert.match(events, /ports:5050,6743,80/); assert.match(events, /firewall:5050,80/); assert.match(events, /start:NexusRGBHardware/); }
    if (mode === 'panel-only') { assert.doesNotMatch(events, /stop:NexusRGBHardware/); assert.match(events, /ready:5200/); }
    if (mode === 'case-sensitive') {assert.match(events,/probe:18081/);assert.match(events,/ready:5200/);}
  }
});

test('portas persistidas e regras de firewall mantêm validação e escopo LAN', { skip: process.platform !== 'win32' }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ports-rules-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'fixture.ps1');
  fs.writeFileSync(file, '\ufeff' + String.raw`
$ErrorActionPreference='Stop'
. $env:NEXUS_PORT_HELPER
$script:saved=$null
function Get-ItemProperty {return $script:saved}
$ports=Get-NexusPorts
if($ports.PanelPort -ne 5050 -or $ports.SDKPort -ne 6743 -or $ports.AlexaPort -ne 80){throw 'Defaults changed'}
$script:saved=[pscustomobject]@{PanelPort=5200;SDKPort=7200;AlexaPort=8080}
if((Get-NexusPorts).PanelPort -ne 5200){throw 'Saved port ignored'}
foreach($invalid in @('5200',0,65536)) {$script:saved.PanelPort=$invalid; $failed=$false; try {Get-NexusPorts | Out-Null} catch {$failed=$true}; if(-not $failed){throw 'Invalid registry port accepted'}}
$failed=$false; try {Assert-NexusPorts 5200 5200 80} catch {$failed=$true}; if(-not $failed){throw 'Duplicate ports accepted'}
$script:rules=@()
function Get-NetFirewallRule {}
function Remove-NetFirewallRule {}
function New-NetFirewallRule($DisplayName,$Group,$Direction,$Action,$Program,$Protocol,$LocalPort,$Profile,$InterfaceType,$RemoteAddress,$EdgeTraversalPolicy) {
  if($Group -ne 'Nexus RGB' -or $Direction -ne 'Inbound' -or $Action -ne 'Allow' -or $Protocol -ne 'TCP' -or $RemoteAddress -ne 'LocalSubnet' -or $EdgeTraversalPolicy -ne 'Block'){throw 'Firewall scope widened'}
  $script:rules+=@($LocalPort)
}
Set-NexusPortFirewall 'C:\Nexus\node.exe' 5200 8080
if(($script:rules -join ',') -ne '5200,8080'){throw 'Wrong firewall ports'}
'port-rules-safe'
`);
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { encoding: 'utf8', windowsHide: true, env: { ...process.env, NEXUS_PORT_HELPER: path.resolve(__dirname, '../scripts/ports.ps1') } });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /port-rules-safe/);
});

test('persistência real cria e atualiza DWORDs sem substituir a chave', { skip: process.platform !== 'win32' }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-registry-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'registry.ps1');
  fs.writeFileSync(file, '\ufeff' + String.raw`
$ErrorActionPreference='Stop'
. $env:NEXUS_PORT_HELPER
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_PORT_HELPER,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Invalid helper syntax'}
$definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Set-NexusPorts'},$true).Extent.Text
# Run the actual writer against an isolated, disposable current-user key.
$subkey='Software\NexusRGB-Test-'+[Guid]::NewGuid().ToString('N')
if(-not $definition.Contains('::LocalMachine') -or -not $definition.Contains('SOFTWARE\NexusRGB')){throw 'Writer fixture needs updating'}
. ([scriptblock]::Create($definition.Replace('::LocalMachine','::CurrentUser').Replace('SOFTWARE\NexusRGB',$subkey)))
$key=$null
try {
  Set-NexusPorts 5050 6743 80
  $key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($subkey,$true)
  $key.SetValue('Preserve','unchanged'); $key.Dispose(); $key=$null
  Set-NexusPorts 5151 6754 8081
  $failed=$false; try {Set-NexusPorts 5151 5151 80} catch {$failed=$true}
  if(-not $failed){throw 'Invalid write accepted'}
  $key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($subkey)
  foreach($pair in @(@{Name='PanelPort';Value=5151},@{Name='SDKPort';Value=6754},@{Name='AlexaPort';Value=8081})) {
    if($key.GetValue($pair.Name) -ne $pair.Value -or $key.GetValueKind($pair.Name) -ne 'DWord'){throw 'Registry value or type changed'}
  }
  if($key.GetValue('Preserve') -ne 'unchanged'){throw 'Unrelated value lost'}
  'registry-write-passed'
} finally {if($key){$key.Dispose()}; [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($subkey,$false)}
`);
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { encoding: 'utf8', windowsHide: true, timeout: 15000, env: { ...process.env, NEXUS_PORT_HELPER: path.resolve(__dirname, '../scripts/ports.ps1') } });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /registry-write-passed/);
});
