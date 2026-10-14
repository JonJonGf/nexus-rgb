# Destructive lifecycle checks: execute only in a fresh GitHub-hosted VM.
param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted'){throw 'Este teste só pode rodar em uma VM descartável hospedada pelo GitHub.'}
$identity=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'O runner precisa estar elevado.'}
$root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
$data=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'NexusRGB'
if((Test-Path -LiteralPath $root) -or (Test-Path -LiteralPath $data) -or (Get-Service NexusRGB,NexusRGBHardware -ErrorAction SilentlyContinue)){throw 'A VM não está limpa: já existe uma instalação ou dados Nexus.'}
$Installer=(Resolve-Path -LiteralPath $Installer).Path
$workspace=[IO.Path]::GetFullPath($env:GITHUB_WORKSPACE)
if(-not $Installer.StartsWith($workspace+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Instalador fora do checkout de teste.'}
$reports=Join-Path $workspace 'test-results\installation'
New-Item -ItemType Directory -Path $reports -Force | Out-Null
$checks=New-Object 'Collections.Generic.List[string]'
$report=[ordered]@{Passed=$false;StartedAt=(Get-Date -Format o);OS=(Get-CimInstance Win32_OperatingSystem).Caption;Build=(Get-CimInstance Win32_OperatingSystem).BuildNumber;InstallerSHA256=(Get-FileHash -LiteralPath $Installer).Hash;Scope='Fresh GitHub-hosted Windows Server VM; no PawnIO installation or physical RGB/Echo tests';Checks=$checks}
function Check([bool]$Condition,[string]$Name){if(-not $Condition){throw ('Check failed: '+$Name)}; $checks.Add($Name); Write-Output ('PASS: '+$Name)}
function Wait-Panel {
  for($attempt=0;$attempt -lt 60;$attempt++) {
    try {if((Invoke-RestMethod http://127.0.0.1:5050/api/health -TimeoutSec 1).ready -eq $true){return}} catch {}
    Start-Sleep -Seconds 1
  }
  throw 'Panel failed to recover within 60 seconds.'
}
function Session {
  $script:session=New-Object Microsoft.PowerShell.Commands.WebRequestSession
  Invoke-RestMethod http://127.0.0.1:5050/api/session/local -Method Post -Headers @{Origin='http://127.0.0.1:5050';'X-Nexus-Client'='web'} -ContentType 'application/json' -Body '{}' -WebSession $script:session | Out-Null
}
function State {Invoke-RestMethod http://127.0.0.1:5050/api/state -WebSession $script:session}
function Setup([string]$Phase) {
  $log=Join-Path $reports ($Phase+'.log')
  $process=Start-Process -FilePath $Installer -ArgumentList ('/SP- /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /TASKS="" /LOG="'+$log+'"') -WindowStyle Hidden -Wait -PassThru
  Check ($process.ExitCode -in 0,3010) ('Installer '+$Phase+' exited successfully')
  Wait-Panel; Session
}
function VerifyServices {
  $network=Get-CimInstance Win32_Service -Filter "Name='NexusRGB'"
  $hardware=Get-CimInstance Win32_Service -Filter "Name='NexusRGBHardware'"
  Check ($network.State -eq 'Running' -and $network.StartMode -eq 'Auto' -and $network.StartName -eq 'NT AUTHORITY\LocalService') 'Network service runs automatically as LocalService'
  Check ($hardware.State -eq 'Running' -and $hardware.StartMode -eq 'Auto' -and $hardware.StartName -eq 'LocalSystem') 'Hardware service runs automatically as SYSTEM'
  $sdk=@()
  for($attempt=0;$attempt -lt 30 -and $sdk.Count -eq 0;$attempt++) {
    $sdk=@(Get-NetTCPConnection -State Listen -LocalPort 6743 -ErrorAction SilentlyContinue)
    if($sdk.Count -eq 0){Start-Sleep -Seconds 1}
  }
  Check ($sdk.Count -gt 0 -and @($sdk | Where-Object LocalAddress -ne '127.0.0.1').Count -eq 0) 'OpenRGB SDK listens only on loopback'
}
function VerifyPermissions {
  foreach($path in @($root,(Join-Path $root 'runtime\node.exe'),(Join-Path $root 'server\index.js'),(Join-Path $root 'scripts\install-services.ps1'),(Join-Path $data 'app'))) {
    $acl=Get-Acl -LiteralPath $path
    Check ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq 'S-1-5-32-544') ('Administrators own '+[IO.Path]::GetFileName($path))
    $unsafe=@($acl.Access | Where-Object {
      $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -in 'S-1-1-0','S-1-5-11','S-1-5-32-545' -and (($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]'Write,Delete,ChangePermissions,TakeOwnership') -ne 0)
    })
    Check ($unsafe.Count -eq 0) ('Ordinary users cannot write '+[IO.Path]::GetFileName($path))
  }
  $appAcl=Get-Acl -LiteralPath (Join-Path $data 'app')
  Check (@($appAcl.Access | Where-Object {$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq 'S-1-5-19' -and ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::Modify) -eq [Security.AccessControl.FileSystemRights]::Modify}).Count -gt 0) 'LocalService can save app data'
}
function Uninstall([string]$Phase) {
  $entry=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{BEFFBF04-40A0-4E59-87C0-223B51E92B84}_is1'
  $uninstaller=$entry.UninstallString.Trim('"')
  Check ($uninstaller.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($uninstaller) -match '^unins\d+\.exe$') 'Uninstall registration points inside Nexus installation'
  $process=Start-Process -FilePath $uninstaller -ArgumentList ('/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="'+(Join-Path $reports ($Phase+'.log'))+'"') -WindowStyle Hidden -Wait -PassThru
  Check ($process.ExitCode -eq 0) ('Uninstall '+$Phase+' exited successfully')
  Check (@(Get-Service NexusRGB,NexusRGBHardware -ErrorAction SilentlyContinue).Count -eq 0) 'Nexus services removed'
  Check (@(Get-NetFirewallRule -Group 'Nexus RGB' -ErrorAction SilentlyContinue).Count -eq 0) 'Only Nexus firewall group removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $root 'NexusRGB.exe'))) 'Nexus executable removed'
}
$sentinel='Nexus installation test sentinel'
try {
  $unrelated=Get-CimInstance Win32_Service -Filter "Name='RpcSs'" | Select-Object Name,State,StartMode,PathName
  New-NetFirewallRule -DisplayName $sentinel -Group $sentinel -Direction Inbound -Action Block -Protocol TCP -LocalPort 59999 | Out-Null
  Setup 'fresh'; VerifyServices; VerifyPermissions
  $headers=@{Origin='http://127.0.0.1:5050';'X-Nexus-Client'='web'}
  Invoke-RestMethod http://127.0.0.1:5050/api/control -Method Post -Headers $headers -ContentType 'application/json' -Body '{"color":"#22aa77","brightness":61,"power":false}' -WebSession $session | Out-Null
  Invoke-RestMethod http://127.0.0.1:5050/api/profiles -Method Post -Headers $headers -ContentType 'application/json' -Body '{"name":"VM preservation check"}' -WebSession $session | Out-Null
  $settings=Join-Path $data 'app\settings.json'; $before=(Get-FileHash -LiteralPath $settings).Hash
  $firstDiagnostic=[IO.File]::ReadAllText((Join-Path $data 'installation.log'))
  Setup 'upgrade'; VerifyServices
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Upgrade preserves settings and profiles byte for byte'
  Check ([IO.File]::ReadAllText((Join-Path $data 'installation.log')) -ne $firstDiagnostic) 'Upgrade replaces the existing diagnostic'
  $service=Get-CimInstance Win32_Service -Filter "Name='NexusRGB'"
  $children=@(Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq $service.ProcessId -and $_.ExecutablePath -eq (Join-Path $root 'runtime\node.exe')})
  Check ($children.Count -eq 1) 'Network service owns exactly one dedicated Node child'
  Stop-Process -Id $children[0].ProcessId -Force; Wait-Panel; Session
  $recovered=Get-CimInstance Win32_Service -Filter "Name='NexusRGB'"
  Check ($recovered.ProcessId -eq $service.ProcessId) 'Supervisor recovers killed Node without restarting its service'
  $newChildren=@(Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq $recovered.ProcessId -and $_.ExecutablePath -eq (Join-Path $root 'runtime\node.exe')})
  Check ($newChildren.Count -eq 1 -and $newChildren[0].ProcessId -ne $children[0].ProcessId) 'Recovered Node is a new process belonging to the service'
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Worker recovery preserves data'
  Stop-Service NexusRGB; (Get-Service NexusRGB).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
  Start-Service NexusRGB; Wait-Panel; Session
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Service restart preserves data'
  $helper=Start-Process -FilePath (Join-Path $root 'NexusRGB-Uninstall.exe') -ArgumentList '--check' -WindowStyle Hidden -Wait -PassThru
  Check ($helper.ExitCode -eq 0) 'Standalone uninstall helper validates installed registration'
  Uninstall 'first-removal'
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Uninstall preserves user profiles and settings'
  Setup 'reinstall'; VerifyServices
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Reinstall restores preserved data'
  Uninstall 'final-removal'
  Check (@(Get-NetFirewallRule -DisplayName $sentinel).Count -eq 1) 'Unrelated firewall rule preserved'
  $after=Get-CimInstance Win32_Service -Filter "Name='RpcSs'" | Select-Object Name,State,StartMode,PathName
  Check (($unrelated | ConvertTo-Json -Compress) -eq ($after | ConvertTo-Json -Compress)) 'Unrelated Windows service preserved'
  $report.Passed=$true
} catch {$report.Error=$_.ToString()+"`r`n"+$_.InvocationInfo.PositionMessage; Write-Error $report.Error -ErrorAction Continue}
finally {
  Get-NetFirewallRule -Group $sentinel -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  $report.FinishedAt=(Get-Date -Format o)
  [IO.File]::WriteAllText((Join-Path $reports 'report.json'),($report | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($true))
}
if(-not $report.Passed){exit 1}
