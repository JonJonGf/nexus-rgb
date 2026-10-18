'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { spawnSync } = require('node:child_process');
test('pasta personalizada aceita ACL protegida e recusa permissões de substituição e caminhos inseguros', { skip: process.platform !== 'win32' }, () => {
  const script = String.raw`
    $ErrorActionPreference='Stop'
    . $env:NEXUS_PATH_HELPER
    $trusted='S-1-5-32-544'; $users='S-1-5-32-545'
    $acl=[Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner([Security.Principal.SecurityIdentifier]::new($trusted))
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($users),'ReadAndExecute','Allow'))
    Assert-NexusInstallAcl $acl $false
    Assert-NexusInstallAcl $acl $true
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($users),'DeleteSubdirectoriesAndFiles','Allow'))
    $denied=$false; try {Assert-NexusInstallAcl $acl $false} catch {$denied=$true}
    if(-not $denied){throw 'User-replaceable parent accepted'}
    $acl=[Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-21-1-2-3-1001'))
    $denied=$false; try {Assert-NexusInstallAcl $acl $false} catch {$denied=$true}
    if(-not $denied){throw 'User-owned parent accepted'}
    foreach($candidate in @('\\server\share\Nexus','relative\Nexus','C:\','C:\Apps\Nexus.','C:\Apps\Nexus:ads')) {
      $denied=$false; try {Assert-NexusInstallPath $candidate} catch {$denied=$true}
      if(-not $denied){throw ('Unsafe path accepted: '+$candidate)}
    }
    # Exercise full path validation with filesystem/registry adapters, no host ACL writes.
    $acl=[Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner([Security.Principal.SecurityIdentifier]::new($trusted))
    function Get-ItemProperty {return $null}
    function Get-Acl {return $acl}
    function Test-Path {return $true}
    function Get-Item {return [pscustomobject]@{PSIsContainer=$true;Attributes=[IO.FileAttributes]::Directory}}
    function Get-ChildItem {return @()}
    Assert-NexusInstallPath ($env:SystemDrive+'\NexusCustomTest')
    function Get-ChildItem {return [pscustomobject]@{Name='personal-file.txt'}}
    $denied=$false; try {Assert-NexusInstallPath ($env:SystemDrive+'\NexusCustomTest')} catch {$denied=$true}
    if(-not $denied){throw 'Occupied unregistered folder accepted'}
    function Get-ItemProperty {return [pscustomobject]@{InstallLocation=($env:SystemDrive+'\ExistingNexus')}}
    $denied=$false; try {Assert-NexusInstallPath ($env:SystemDrive+'\NexusCustomTest')} catch {$denied=$true}
    if(-not $denied){throw 'Upgrade relocation accepted'}
    'custom-path-safe'
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', env: { ...process.env, NEXUS_PATH_HELPER: path.resolve(__dirname, '../scripts/install-path.ps1') } });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'custom-path-safe');
});
