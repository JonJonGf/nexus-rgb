'use strict';
// Compile the real post-install event with inert process/diagnostic adapters.
// This fixture installs no files, services, drivers, rules or uninstall entries.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const compiler = path.join(root, 'tools', 'inno', 'ISCC.exe');
if (process.platform !== 'win32' || !fs.existsSync(compiler)) throw new Error('Este teste exige Windows e o compilador Inno Setup em tools/inno.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-setup-fixture-'));
try {
  const source = fs.readFileSync(path.join(root, 'installer', 'NexusRGB.iss'), 'utf8');
  const variables = source.slice(source.indexOf('[Code]') + '[Code]'.length, source.indexOf('function PowerShellPath'));
  const exit = source.slice(source.indexOf('function GetCustomSetupExitCode'), source.indexOf('procedure CurPageChanged'));
  const postInstall = source.slice(source.indexOf('procedure CurStepChanged'), source.indexOf('procedure CurUninstallStepChanged'))
    .replace(/\bExec\(/g, 'FixtureExec(').replace(/\bLoadStringFromFile\(/g, 'FixtureLoad(');
  const fixture = `[Setup]
AppId=NexusRGBInstallerRegressionFixture
AppName=Nexus installer regression fixture
AppVersion=1
DefaultDirName={tmp}\\NexusInstallerRegressionFixture
CreateAppDir=no
Uninstallable=no
PrivilegesRequired=lowest
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=${directory}
OutputBaseFilename=fixture
[Code]
${variables}
var DiagnosticReads: Integer;
function PowerShellPath: String;
begin Result := 'fixture-only'; end;
function FixtureExec(Filename, Params, WorkingDir: String; ShowCmd: Integer; Wait: TExecWait; var ResultCode: Integer): Boolean;
begin
  Result := True; ResultCode := 0;
  if Pos('vc_redist', Filename) > 0 then begin
    if ExpandConstant('{param:mode|success}') = 'restart' then ResultCode := 3010;
    if ExpandConstant('{param:mode|success}') = 'runtime-failure' then ResultCode := 1603;
  end else if Pos('-Mode Install', Params) > 0 then begin
    if (ExpandConstant('{param:mode|success}') = 'stale') or (ExpandConstant('{param:mode|success}') = 'fresh') then ResultCode := 1;
    if ExpandConstant('{param:mode|success}') = 'launch-failure' then Result := False;
  end;
end;
function FixtureLoad(Filename: String; var Content: AnsiString): Boolean;
begin
  DiagnosticReads := DiagnosticReads + 1;
  Content := 'OLD-NEXUS-DIAGNOSTIC';
  if (DiagnosticReads > 1) and (ExpandConstant('{param:mode|success}') = 'fresh') then Content := 'CURRENT-NEXUS-DIAGNOSTIC';
  Result := True;
end;
${exit}
${postInstall}
`;
  const filename = path.join(directory, 'fixture.iss'); fs.writeFileSync(filename, '\ufeff' + fixture);
  const compiled = spawnSync(compiler, ['/Q', filename], { encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  for (const [mode, expected] of [['success', 0], ['stale', 1], ['fresh', 1], ['restart', 3010], ['runtime-failure', 1], ['launch-failure', 1]]) {
    const log = path.join(directory, mode + '.log');
    const result = spawnSync(path.join(directory, 'fixture.exe'), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/LOG=' + log, '/mode=' + mode], { timeout: 20000 });
    assert.equal(result.status, expected, `mode=${mode}, status=${result.status}, error=${result.error || ''}`);
    const output = fs.readFileSync(log, 'utf8');
    if (mode === 'stale') { assert.doesNotMatch(output, /OLD-NEXUS-DIAGNOSTIC/); assert.match(output, /diagnóstico novo/); }
    if (mode === 'fresh') assert.match(output, /CURRENT-NEXUS-DIAGNOSTIC/);
    console.log(`Installer fixture: ${mode} returned ${expected}`);
  }
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
