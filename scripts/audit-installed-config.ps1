# Read-only configuration inventory. No scan, removal or security setting changes.
param([string]$ReportPath=(Join-Path $PSScriptRoot '..\data\validation\installed-config.json'))
$ErrorActionPreference='Stop'
$root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
$services=@(Get-CimInstance Win32_Service | Where-Object Name -in 'NexusRGB','NexusRGBHardware' | Select-Object Name,State,StartMode,StartName)
$defender=Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,BehaviorMonitorEnabled,RebootRequired
$threats=@(Get-MpThreat)
$drivers=@(Get-CimInstance Win32_SystemDriver | Where-Object {$_.Name -match 'WinRing|PawnIO'} | Select-Object Name,State)
$rules=@(Get-NetFirewallRule -Group 'Nexus RGB' | ForEach-Object {
  $addresses=$_ | Get-NetFirewallAddressFilter
  $ports=$_ | Get-NetFirewallPortFilter
  [pscustomobject]@{Name=$_.DisplayName;Enabled=$_.Enabled.ToString();Direction=$_.Direction.ToString();Action=$_.Action.ToString();RemoteAddresses=@($addresses.RemoteAddress);LocalPorts=@($ports.LocalPort)}
})
$permissions=@(foreach($relative in @('','runtime\node.exe','server\index.js','scripts\install-services.ps1')) {
  $file=if($relative){Join-Path $root $relative}else{$root}
  $acl=Get-Acl -LiteralPath $file
  $unsafe=@($acl.Access | Where-Object {
    $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -in 'S-1-1-0','S-1-5-11','S-1-5-32-545' -and (($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]'Write,Delete,ChangePermissions,TakeOwnership') -ne 0)
  })
  [pscustomobject]@{File=if($relative){$relative}else{'installation-root'};OwnerSID=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value;OrdinaryUsersCanWrite=($unsafe.Count -gt 0)}
})
$sdk=@(Get-NetTCPConnection -State Listen -LocalPort 6743 -ErrorAction SilentlyContinue)
$webSession=New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod http://127.0.0.1:5050/api/session/local -Method Post -Headers @{Origin='http://127.0.0.1:5050';'X-Nexus-Client'='web'} -ContentType 'application/json' -Body '{}' -WebSession $webSession | Out-Null
$state=Invoke-RestMethod http://127.0.0.1:5050/api/state -WebSession $webSession
$report=[ordered]@{
  CollectedAt=(Get-Date -Format o)
  Scope='Read-only snapshot of this installed PC; no malware scan or independent audit'
  BootAt=(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToString('o')
  Defender=$defender
  ActiveThreatCount=@($threats | Where-Object IsActive).Count
  WinRingHistoricalAlertActive=@($threats | Where-Object {$_.ThreatName -match 'Winring' -and $_.IsActive}).Count -gt 0
  RGBDrivers=$drivers
  Services=$services
  FirewallProfiles=@(Get-NetFirewallProfile | Select-Object Name,Enabled)
  NexusFirewallRules=$rules
  Permissions=$permissions
  SDKLoopbackOnly=($sdk.Count -gt 0 -and @($sdk | Where-Object LocalAddress -ne '127.0.0.1').Count -eq 0)
  Hardware=@{Connected=$state.hardware.connected;Controllers=$state.hardware.controllerCount;Components=@($state.hardware.devices).Count;LEDs=($state.hardware.devices | Measure-Object ledCount -Sum).Sum}
  DeliberateLANPolicy='HTTP without authentication for RGB controls; administration restricted to local PC'
  Remaining='Code signing; external security audit; physical hardware/phone/Echo matrix; clean Windows 10/11 tests'
}
$fullReport=[IO.Path]::GetFullPath($ReportPath)
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($fullReport)) -Force | Out-Null
[IO.File]::WriteAllText($fullReport,($report | ConvertTo-Json -Depth 7),[Text.UTF8Encoding]::new($true))
Write-Output ('Configuration snapshot saved: '+$fullReport)
