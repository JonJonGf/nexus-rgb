'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('coletor não soma outros Node/OpenRGB, exige árvore própria e marca acesso parcial',{skip:process.platform!=='win32'},()=>{
  const script=String.raw`
$ErrorActionPreference='Stop'
$root='C:\NexusResourceFixture'
$parentId=[int]$env:NEXUS_TEST_PARENT_ID
function Get-CimInstance([string]$ClassName) {
 if($ClassName -eq 'Win32_Service'){return @([pscustomobject]@{Name='NexusRGB';PathName=('"'+(Join-Path $root 'NexusRGB.exe')+'" --service');ProcessId=$parentId},[pscustomobject]@{Name='NexusRGBHardware';PathName='"C:\other\NexusRGB.exe" --hardware-service';ProcessId=999900})}
 return @(
  [pscustomobject]@{ProcessId=$PID;ParentProcessId=$parentId;ExecutablePath=(Join-Path $root 'runtime\node.exe')},
  [pscustomobject]@{ProcessId=999901;ParentProcessId=$parentId;ExecutablePath='C:\other\node.exe'},
  [pscustomobject]@{ProcessId=999902;ParentProcessId=$parentId;ExecutablePath='C:\other\OpenRGB.exe'},
  [pscustomobject]@{ProcessId=999903;ParentProcessId=777777;ExecutablePath=(Join-Path $root 'runtime\node.exe')},
  [pscustomobject]@{ProcessId=999904;ParentProcessId=$PID;ExecutablePath=$null}
 )
}
& $env:NEXUS_RESOURCE_SCRIPT -InstallRoot $root
`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:10000,env:{...process.env,NEXUS_TEST_PARENT_ID:String(process.pid),NEXUS_RESOURCE_SCRIPT:path.resolve('scripts/measure-resources.ps1')}});assert.equal(result.status,0,result.stderr);const report=JSON.parse(result.stdout);assert.equal(report.partial,true);assert.equal(report.processes.length,2);assert.deepEqual(report.processes.map(r=>r.role).sort(),['network-service','server']);assert.ok(report.processes.every(r=>r.pid<999900));
});
