'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('teste destrutivo de instalação recusa execução fora de runner descartável', { skip: process.platform !== 'win32' }, () => {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.resolve(__dirname, '..', 'scripts', 'test-installed-package.ps1'), '-Installer', 'does-not-exist.exe'], {
    encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'false', RUNNER_ENVIRONMENT: 'local' }
  });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /VM descart/);
});

test('build rejeita qualquer biblioteca ou driver WinRing no ZIP antes de extrair arquivos', { skip: process.platform !== 'win32' }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-archive-check-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const script = String.raw`
    $ErrorActionPreference='Stop'; $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_BUILD_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    $function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-NexusOpenRGBArchive'},$true)
    . ([scriptblock]::Create($function.Extent.Text))
    Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem
    foreach($name in @('OpenRGB/OpenRGB.exe','OpenRGB/nested/WinRing0x64.sys','OpenRGB/WINRING0.DLL','OpenRGB/nested\\WinRing0x64.dll')) {
      $file=Join-Path $env:NEXUS_TEST_DATA ([Guid]::NewGuid().ToString('N')+'.zip')
      $zip=[IO.Compression.ZipFile]::Open($file,[IO.Compression.ZipArchiveMode]::Create)
      try {$zip.CreateEntry($name) | Out-Null} finally {$zip.Dispose()}
      $rejected=$false
      try {Assert-NexusOpenRGBArchive $file} catch {$rejected=$true}
      if($rejected -eq ($name -eq 'OpenRGB/OpenRGB.exe')){throw ('Resultado inesperado: '+$name)}
      [IO.File]::Delete($file)
    }
    'archive-validated'
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', env: { ...process.env, NEXUS_TEST_BUILD_SCRIPT: path.resolve(__dirname, '..', 'scripts', 'build.ps1'), NEXUS_TEST_DATA: directory }
  });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'archive-validated');
});

test('diagnósticos são criados e substituídos em atualizações no Windows PowerShell 5.1 sem modificar hard links', { skip: process.platform !== 'win32' }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-install-log-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const script = String.raw`
    $ErrorActionPreference='Stop'; $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_INSTALL_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    $function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Write-NexusDiagnostic'},$true)
    . ([scriptblock]::Create($function.Extent.Text))
    $dataRoot=$env:NEXUS_TEST_DATA
    if($PSVersionTable.PSVersion.Major -ne 5){throw 'O teste precisa usar Windows PowerShell 5.1.'}
    Write-NexusDiagnostic 'installation.log' 'primeira instalação'
    Write-NexusDiagnostic 'installation.log' 'atualização concluída'
    Write-NexusDiagnostic 'installation-error.log' 'erro antigo'
    Write-NexusDiagnostic 'installation-error.log' 'erro atual'
    'diagnostics-updated'
  `;
  const inspect = () => spawnSync(path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', env: { ...process.env, NEXUS_TEST_INSTALL_SCRIPT: path.resolve(__dirname, '..', 'scripts', 'install-services.ps1'), NEXUS_TEST_DATA: directory }
  });
  let result = inspect(); assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(directory, 'installation.log'), 'utf8'), '\ufeffatualização concluída');
  assert.equal(fs.readFileSync(path.join(directory, 'installation-error.log'), 'utf8'), '\ufefferro atual');
  const linked = path.join(directory, 'untouched.txt');
  fs.writeFileSync(path.join(directory, 'installation.log'), 'arquivo externo preservado');
  fs.linkSync(path.join(directory, 'installation.log'), linked);
  result = inspect(); assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(linked, 'utf8'), 'arquivo externo preservado');
  assert.deepEqual(fs.readdirSync(directory).sort(), ['installation-error.log', 'installation.log', 'untouched.txt']);
});

test('validação do instalador rejeita junções sem enumerar dados fora da pasta do produto', { skip: process.platform !== 'win32' }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-install-tree-'));
  t.after(() => {
    const link = path.join(directory, 'product', 'outside-link');
    if (fs.existsSync(link)) fs.unlinkSync(link);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const product = path.join(directory, 'product'), outside = path.join(directory, 'outside');
  fs.mkdirSync(product); fs.mkdirSync(outside);
  fs.mkdirSync(path.join(product, 'normal')); fs.writeFileSync(path.join(product, 'normal', 'settings.json'), '{}');
  fs.writeFileSync(path.join(outside, 'untouched.txt'), 'outside');
  const script = String.raw`
    $ErrorActionPreference='Stop'
    $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_INSTALL_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    $function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-NexusDirectoryTree'},$true)
    . ([scriptblock]::Create($function.Extent.Text))
    try { @(Get-NexusDirectoryTree $env:NEXUS_TEST_TREE).Count; exit 0 }
    catch { $_.Exception.Message; exit 2 }
  `;
  const inspect = () => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', env: { ...process.env, NEXUS_TEST_INSTALL_SCRIPT: path.resolve(__dirname, '..', 'scripts', 'install-services.ps1'), NEXUS_TEST_TREE: product }
  });
  const normal = inspect(); assert.equal(normal.status, 0, normal.stderr); assert.equal(normal.stdout.trim(), '2');
  fs.symlinkSync(outside, path.join(product, 'outside-link'), 'junction');
  const rejected = inspect(); assert.equal(rejected.status, 2, rejected.stderr); assert.match(rejected.stdout, /outside-link/);
  assert.equal(fs.readFileSync(path.join(outside, 'untouched.txt'), 'utf8'), 'outside');
});

test('preparação identifica somente filhos dos serviços Nexus e preserva serviços diante de conflitos', { skip: process.platform !== 'win32' }, () => {
  const script = String.raw`
    $ErrorActionPreference='Stop'
    $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_PREFLIGHT_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    foreach($function in $ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true)) { . ([scriptblock]::Create($function.Extent.Text)) }
    function Assert-NexusInstallPath { param([string]$Directory,[switch]$Prepare) } # OS path policy tested separately
    $definitions=@(@{Name='NexusRGBHardware';Argument='--hardware-service';Bit=2},@{Name='NexusRGB';Argument='--service';Bit=1})
    $Root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
    $native=Join-Path $Root 'NexusRGB.exe'; $node=Join-Path $Root 'runtime\node.exe'; $rgb=Join-Path $Root 'openrgb\OpenRGB.exe'
    $mockServices=@(
      [pscustomobject]@{Name='NexusRGB';PathName=('"'+$native+'" --service');ProcessId=100;State='Running'},
      [pscustomobject]@{Name='NexusRGBHardware';PathName=('"'+$native+'" --hardware-service');ProcessId=200;State='Stopped'}
    )
    $mockProcesses=@(
      [pscustomobject]@{ProcessId=100;ParentProcessId=1;ExecutablePath=$native;Name='NexusRGB.exe'},
      [pscustomobject]@{ProcessId=101;ParentProcessId=100;ExecutablePath=$node;Name='node.exe'},
      [pscustomobject]@{ProcessId=200;ParentProcessId=1;ExecutablePath=$native;Name='NexusRGB.exe'},
      [pscustomobject]@{ProcessId=201;ParentProcessId=200;ExecutablePath=$rgb;Name='OpenRGB.exe'},
      [pscustomobject]@{ProcessId=900;ParentProcessId=1;ExecutablePath=$rgb;Name='OpenRGB.exe'},
      [pscustomobject]@{ProcessId=901;ParentProcessId=100;ExecutablePath='C:\other\node.exe';Name='node.exe'}
    )
    $owned=Get-NexusOwnedProcessIds $mockServices $mockProcesses $Root
    if($owned.Count -ne 4 -or $owned.ContainsKey(900) -or $owned.ContainsKey(901)){throw 'Ownership escaped service trees.'}
    $mockServices[0].PathName='"C:\unrelated.exe" --service'
    $denied=$false; try {Get-NexusOwnedProcessIds $mockServices $mockProcesses $Root | Out-Null} catch {$denied=$true}
    if(-not $denied){throw 'Foreign service accepted.'}
    $mockServices[0].PathName='"'+$native+'" --service'
    $script:stops=0; $script:starts=@()
    function Get-CimInstance([string]$ClassName) {if($ClassName -eq 'Win32_Service'){return $mockServices}; return $mockProcesses}
    function Get-NetTCPConnection {return [pscustomobject]@{LocalPort=5050;OwningProcess=900}}
    function Stop-Service {$script:stops++; throw 'No real service operations allowed in test.'}
    function Start-Service([string]$Name) {$script:starts+=$Name}
    function Get-Service {return [pscustomobject]@{} | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value {} -PassThru}
    $Mode='Prepare'
    if((Invoke-NexusPreparation) -ne 40 -or $script:stops -ne 0 -or $script:starts.Count -ne 0){throw 'Conflict stopped a service.'}
    function Get-NetTCPConnection {return @()}
    if((Invoke-NexusPreparation) -ne 41 -or $script:stops -ne 0){throw 'Foreign OpenRGB stopped a service.'}
    $Mode='Restore'; $RestoreMask=1
    if((Invoke-NexusPreparation) -ne 0 -or $script:starts.Count -ne 1 -or $script:starts[0] -ne 'NexusRGB'){throw 'Restore started a previously stopped service.'}
    'preflight-safe'
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', env: { ...process.env, NEXUS_TEST_PREFLIGHT_SCRIPT: path.resolve(__dirname, '..', 'installer', 'service-preflight.ps1') }
  });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'preflight-safe');
});

test('instalação aguarda ready booleano do painel e limita espera quando Node não fica pronto', { skip: process.platform !== 'win32' }, async t => {
  const http = require('node:http'), { promisify } = require('node:util'), { execFile } = require('node:child_process');
  let requests = 0, ready = true;
  const server = http.createServer((req, res) => {
    requests++; res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: ready ? requests >= 2 ? true : 'true' : false, application: 'nexus-rgb' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const script = String.raw`
    $ErrorActionPreference='Stop'; $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_INSTALL_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    $function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-NexusPanel'},$true)
    . ([scriptblock]::Create($function.Extent.Text))
    try {Wait-NexusPanel -Url $env:NEXUS_TEST_HEALTH_URL -TimeoutSeconds ([int]$env:NEXUS_TEST_HEALTH_TIMEOUT); 'panel-ready'; exit 0}
    catch {'panel-unavailable'; exit 9}
  `;
  const args = ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
  // A fresh Windows runner may initialize ConvertFrom-Json modules on the first
  // response; allow that cold start without weakening the short failure deadline.
  const options = { timeout: 15000, env: { ...process.env, NEXUS_TEST_INSTALL_SCRIPT: path.resolve(__dirname, '..', 'scripts', 'install-services.ps1'), NEXUS_TEST_HEALTH_URL: `http://127.0.0.1:${server.address().port}/api/health`, NEXUS_TEST_HEALTH_TIMEOUT: '10' } };
  const success = await promisify(execFile)('powershell.exe', args, options);
  assert.equal(success.stdout.trim(), 'panel-ready'); assert.equal(requests, 2);
  ready = false;
  options.env.NEXUS_TEST_HEALTH_TIMEOUT = '1';
  await assert.rejects(promisify(execFile)('powershell.exe', args, options), error => error.code === 9 && error.stdout.trim() === 'panel-unavailable');
});

test('preparação encerra o aplicativo de bandeja e registra retorno pós-atualização', { skip: process.platform !== 'win32' }, t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-preflight-tray-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const script = String.raw`
    $ErrorActionPreference='Stop'
    $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_PREFLIGHT_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    foreach($function in $ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true)) { . ([scriptblock]::Create($function.Extent.Text)) }
    function Assert-NexusInstallPath { param([string]$Directory,[switch]$Prepare) } # OS path policy tested separately
    $Root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
    $native=Join-Path $Root 'NexusRGB.exe'
    $mockServices=@()
    $mockProcesses=@(
      [pscustomobject]@{ProcessId=777;ParentProcessId=1;ExecutablePath=$native;Name='NexusRGB.exe';SessionId=1;CreationDate='20261017120000.000000+000';CommandLine='"C:\Program Files\Nexus RGB\NexusRGB.exe" --tray'}
    )
    $script:stoppedPids=@()
    $script:polled=$false
    function Get-CimInstance([string]$ClassName) {
      if($ClassName -eq 'Win32_Service'){return $mockServices}
      if($script:polled){return @()}
      $script:polled=$true
      return $mockProcesses
    }
    function Get-NetTCPConnection {return @()}
    function Stop-Process([int]$Id,$Force,$ErrorAction) {$script:stoppedPids+=$Id}
    $Mode='Prepare'
    $SessionId=1
    $TempDir=$env:NEXUS_TEST_TEMP
    $exitCode=Invoke-NexusPreparation
    if(-not (Test-Path (Join-Path $TempDir 'nexus-tray-resume.txt'))){throw 'Tray resume marker not created.'}
    'tray-preflight-success'
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', env: { ...process.env, NEXUS_TEST_PREFLIGHT_SCRIPT: path.resolve(__dirname, '..', 'installer', 'service-preflight.ps1'), NEXUS_TEST_TEMP: tempDir }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'tray-preflight-success');
});

test('preparação rejeita atualização com código 47 quando outra sessão de usuário executa o aplicativo', { skip: process.platform !== 'win32' }, t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-preflight-foreign-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const script = String.raw`
    $ErrorActionPreference='Stop'
    $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_PREFLIGHT_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    foreach($function in $ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true)) { . ([scriptblock]::Create($function.Extent.Text)) }
    function Assert-NexusInstallPath { param([string]$Directory,[switch]$Prepare) } # OS path policy tested separately
    $Root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
    $native=Join-Path $Root 'NexusRGB.exe'
    $mockServices=@()
    $mockProcesses=@(
      [pscustomobject]@{ProcessId=888;ParentProcessId=1;ExecutablePath=$native;Name='NexusRGB.exe';SessionId=2;CreationDate='20261017120000.000000+000';CommandLine='"C:\Program Files\Nexus RGB\NexusRGB.exe" --tray'}
    )
    $script:stoppedPids=@()
    function Get-CimInstance([string]$ClassName) {
      if($ClassName -eq 'Win32_Service'){return $mockServices}
      return $mockProcesses
    }
    function Get-NetTCPConnection {return @()}
    function Stop-Process([int]$Id,$Force,$ErrorAction) {$script:stoppedPids+=$Id}
    $Mode='Prepare'
    $SessionId=1
    $TempDir=$env:NEXUS_TEST_TEMP
    $exitCode=Invoke-NexusPreparation
    if($exitCode -ne 47){throw "Exit code esperado 47, recebido $exitCode"}
    if(Test-Path (Join-Path $TempDir 'nexus-tray-resume.txt')){throw 'Marcador não deveria ser criado.'}
    if($script:stoppedPids.Count -ne 0){throw 'Processos de outra sessão não podem ser encerrados.'}
    'foreign-session-isolated'
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', env: { ...process.env, NEXUS_TEST_PREFLIGHT_SCRIPT: path.resolve(__dirname, '..', 'installer', 'service-preflight.ps1'), NEXUS_TEST_TEMP: tempDir }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'foreign-session-isolated');
});

test('preparação rejeita com código 48 quando janelas interativas de configuração ou recuperação estão abertas', { skip: process.platform !== 'win32' }, t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-preflight-dialog-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const script = String.raw`
    $ErrorActionPreference='Stop'
    $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_PREFLIGHT_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    foreach($function in $ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true)) { . ([scriptblock]::Create($function.Extent.Text)) }
    function Assert-NexusInstallPath { param([string]$Directory,[switch]$Prepare) } # OS path policy tested separately
    $Root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
    $native=Join-Path $Root 'NexusRGB.exe'
    $mockServices=@()
    $mockProcesses=@(
      [pscustomobject]@{ProcessId=999;ParentProcessId=1;ExecutablePath=$native;Name='NexusRGB.exe';SessionId=1;CreationDate='20261017120000.000000+000';CommandLine='"C:\Program Files\Nexus RGB\NexusRGB.exe" --restart-rgb'}
    )
    $script:stoppedPids=@()
    function Get-CimInstance([string]$ClassName) {
      if($ClassName -eq 'Win32_Service'){return $mockServices}
      return $mockProcesses
    }
    function Get-NetTCPConnection {return @()}
    function Stop-Process([int]$Id,$Force,$ErrorAction) {$script:stoppedPids+=$Id}
    $Mode='Prepare'
    $SessionId=1
    $TempDir=$env:NEXUS_TEST_TEMP
    $exitCode=Invoke-NexusPreparation
    if($exitCode -ne 48){throw "Exit code esperado 48, recebido $exitCode"}
    if($script:stoppedPids.Count -ne 0){throw 'Janela interativa não pode ser encerrada à força.'}
    'dialog-mode-protected'
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', env: { ...process.env, NEXUS_TEST_PREFLIGHT_SCRIPT: path.resolve(__dirname, '..', 'installer', 'service-preflight.ps1'), NEXUS_TEST_TEMP: tempDir }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'dialog-mode-protected');
});

test('preparação em sessão 0 não cria marcador de bandeja e revalida processo antes de encerrar', { skip: process.platform !== 'win32' }, t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-preflight-session0-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const script = String.raw`
    $ErrorActionPreference='Stop'
    $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($env:NEXUS_TEST_PREFLIGHT_SCRIPT,[ref]$tokens,[ref]$errors)
    if($errors.Count){throw 'Falha ao analisar script.'}
    foreach($function in $ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true)) { . ([scriptblock]::Create($function.Extent.Text)) }
    function Assert-NexusInstallPath { param([string]$Directory,[switch]$Prepare) } # OS path policy tested separately
    $Root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
    $native=Join-Path $Root 'NexusRGB.exe'
    $mockServices=@()
    # Tray running in Session 0 (service account), but PID was recycled with different CreationDate
    $initialProcess = [pscustomobject]@{ProcessId=555;ParentProcessId=1;ExecutablePath=$native;Name='NexusRGB.exe';SessionId=0;CreationDate='20261017120000.000000+000';CommandLine='"C:\Program Files\Nexus RGB\NexusRGB.exe" --tray'}
    $recycledProcess = [pscustomobject]@{ProcessId=555;ParentProcessId=1;ExecutablePath=$native;Name='NexusRGB.exe';SessionId=0;CreationDate='20261017120005.999999+000';CommandLine='"C:\Program Files\Nexus RGB\NexusRGB.exe" --tray'}
    $script:stoppedPids=@()
    $script:pollCount=0
    function Get-CimInstance([string]$ClassName,[string]$Filter) {
      if($ClassName -eq 'Win32_Service'){return $mockServices}
      if($Filter -match 'ProcessId = 555'){
        # Return recycled process with different CreationDate
        return $recycledProcess
      }
      return @($initialProcess)
    }
    function Get-NetTCPConnection {return @()}
    function Stop-Process([int]$Id,$Force,$ErrorAction) {$script:stoppedPids+=$Id}
    $Mode='Prepare'
    $SessionId=0
    $TempDir=$env:NEXUS_TEST_TEMP
    $exitCode=Invoke-NexusPreparation
    if(Test-Path (Join-Path $TempDir 'nexus-tray-resume.txt')){throw 'Marcador de bandeja não pode ser criado na sessão 0.'}
    if($script:stoppedPids.Count -ne 0){throw 'Processo reciclado não pode ser encerrado.'}
    'session0-and-pid-revalidation-success'
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', env: { ...process.env, NEXUS_TEST_PREFLIGHT_SCRIPT: path.resolve(__dirname, '..', 'installer', 'service-preflight.ps1'), NEXUS_TEST_TEMP: tempDir }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'session0-and-pid-revalidation-success');
});
