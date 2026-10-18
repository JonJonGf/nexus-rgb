# Destructive lifecycle checks: execute only in a fresh GitHub-hosted VM.
param([Parameter(Mandatory=$true)][string]$Installer,[ValidateRange(1024,65535)][int]$PanelPort=5050,[ValidateRange(1024,65535)][int]$SDKPort=6743,[ValidateRange(1,65535)][int]$AlexaPort=80,[switch]$CustomDirectory)
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted'){throw 'Este teste só pode rodar em uma VM descartável hospedada pelo GitHub.'}
$identity=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'O runner precisa estar elevado.'}
$root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'
if($CustomDirectory){$root=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB Custom'}
$data=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'NexusRGB'
if((Test-Path -LiteralPath $root) -or (Test-Path -LiteralPath $data) -or (Get-Service NexusRGB,NexusRGBHardware -ErrorAction SilentlyContinue)){throw 'A VM não está limpa: já existe uma instalação ou dados Nexus.'}
$Installer=(Resolve-Path -LiteralPath $Installer).Path
$workspace=[IO.Path]::GetFullPath($env:GITHUB_WORKSPACE)
if(-not $Installer.StartsWith($workspace+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Instalador fora do checkout de teste.'}
$reports=Join-Path $workspace 'test-results\installation'
New-Item -ItemType Directory -Path $reports -Force | Out-Null
$checks=New-Object 'Collections.Generic.List[string]'
$origin='http://127.0.0.1:'+$PanelPort
$report=[ordered]@{Passed=$false;StartedAt=(Get-Date -Format o);OS=(Get-CimInstance Win32_OperatingSystem).Caption;Build=(Get-CimInstance Win32_OperatingSystem).BuildNumber;InstallerSHA256=(Get-FileHash -LiteralPath $Installer).Hash;Scope='Fresh GitHub-hosted Windows Server VM; no PawnIO installation or physical RGB/Echo tests';Checks=$checks}
function Check([bool]$Condition,[string]$Name){if(-not $Condition){throw ('Check failed: '+$Name)}; $checks.Add($Name); Write-Output ('PASS: '+$Name)}
function Wait-Panel {
  for($attempt=0;$attempt -lt 60;$attempt++) {
    try {$health=Invoke-RestMethod ($origin+'/api/health') -TimeoutSec 1; if($health.ready -eq $true -and $health.application -eq 'nexus-rgb'){return}} catch {}
    Start-Sleep -Seconds 1
  }
  throw 'Panel failed to recover within 60 seconds.'
}
function Session {
  $script:session=New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $sessionResult=Invoke-RestMethod ($origin+'/api/session/local') -Method Post -Headers @{Origin=$origin;'X-Nexus-Client'='web'} -ContentType 'application/json' -Body '{}' -WebSession $script:session
  $script:welcome=[bool]$sessionResult.welcome
}
function State {Invoke-RestMethod ($origin+'/api/state') -WebSession $script:session}
function Setup([string]$Phase) {
  $log=Join-Path $reports ($Phase+'.log')
  $process=Start-Process -FilePath $Installer -ArgumentList ('/SP- /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /TASKS="" /DIR="'+$root+'" /PANELPORT='+$PanelPort+' /SDKPORT='+$SDKPort+' /ALEXAPORT='+$AlexaPort+' /LOG="'+$log+'"') -WindowStyle Hidden -Wait -PassThru
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
    $sdk=@(Get-NetTCPConnection -State Listen -LocalPort $SDKPort -ErrorAction SilentlyContinue)
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
  Check (-not (Test-Path -LiteralPath 'HKLM:\SOFTWARE\Classes\nexusrgb')) 'Local recovery URL registration removed'
}
$sentinel='Nexus installation test sentinel'
try {
  $unrelated=Get-CimInstance Win32_Service -Filter "Name='RpcSs'" | Select-Object Name,State,StartMode,PathName
  New-NetFirewallRule -DisplayName $sentinel -Group $sentinel -Direction Inbound -Action Block -Protocol TCP -LocalPort 59999 | Out-Null
  Setup 'fresh'; VerifyServices; VerifyPermissions
  Check $welcome 'First local visit offers the welcome guide'
  Check ((Invoke-WebRequest ($origin+'/help') -UseBasicParsing).StatusCode -eq 200) 'Offline help is included in the installed payload'
  Check ([IO.File]::ReadAllText((Join-Path $root 'LEIA-ME.txt')).Contains('Configuracoes > Ajuda')) 'Plain-text Notepad guide is included'
  $build=Invoke-RestMethod ($origin+'/api/about') -WebSession $session
  Check ($build.version -eq '0.1.0') 'Installed package exposes its own build metadata'
  if($env:GITHUB_REF_TYPE -eq 'tag') {Check ($build.tag -eq $env:GITHUB_REF_NAME -and $build.commit -eq $env:GITHUB_SHA -and -not $build.development) 'Installed build matches the exact release tag and commit'}
  $resources=Invoke-RestMethod ($origin+'/api/resources') -WebSession $session
  Check (@($resources.processes | Where-Object role -eq 'server').Count -eq 1) 'Resource monitor includes the dedicated server and tolerates partial permission access'
  $diagnostic=Invoke-RestMethod ($origin+'/api/diagnostics') -WebSession $session
  Check ($diagnostic.format -eq 'nexus-diagnostics/1' -and -not ($diagnostic | ConvertTo-Json -Depth 12).Contains($root)) 'Shareable diagnostic omits installation paths'
  $headers=@{Origin=$origin;'X-Nexus-Client'='web'}
  Invoke-RestMethod ($origin+'/api/settings') -Method Post -Headers $headers -ContentType 'application/json' -Body '{"fps":60}' -WebSession $session | Out-Null
  Check ((State).performance.fps -eq 60) 'Installed API saves configurable FPS'
  $draftSource='<title>VM transient preview</title><canvas id="exCanvas" width="320" height="200"></canvas><script>var ctx=document.getElementById("exCanvas").getContext("2d");function run(){ctx.fillStyle="#22aa77";ctx.fillRect(0,0,320,200);window.requestAnimationFrame(run)}window.requestAnimationFrame(run);</script>'
  $draftSettings=Join-Path $data 'app\settings.json';$draftBefore=(Get-FileHash -LiteralPath $draftSettings).Hash
  $draft=Invoke-RestMethod ($origin+'/api/studio/draft') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{source=$draftSource} | ConvertTo-Json -Compress) -WebSession $session
  $draftRequest=[Net.HttpWebRequest]::Create($origin+'/api/studio/draft/'+$draft.token);$draftRequest.CookieContainer=$session.Cookies;$draftRequest.Timeout=15000;$draftResponse=$null
  try{$draftResponse=$draftRequest.GetResponse();$draftStream=$draftResponse.GetResponseStream();$draftStream.ReadTimeout=15000;$draftBuffer=New-Object byte[] 8192;$draftText='';$draftDeadline=[DateTime]::UtcNow.AddSeconds(15);while($draftText -notmatch '"image":"iVBOR' -and [DateTime]::UtcNow -lt $draftDeadline){$draftLength=$draftStream.Read($draftBuffer,0,$draftBuffer.Length);if($draftLength -eq 0){break};$draftText += [Text.Encoding]::UTF8.GetString($draftBuffer,0,$draftLength)};Check ($draftText -match '"image":"iVBOR') 'Installed transient HTML preview returns a PNG without applying'}finally{if($draftResponse){$draftResponse.Close()};$draftRequest.Abort()}
  Check ((Get-FileHash -LiteralPath $draftSettings).Hash -eq $draftBefore -and -not (State).studio.enabled) 'Draft preview preserves settings and the active effect'
  $effectSource='<title>VM Canvas preservation</title><canvas id="exCanvas" width="320" height="200"></canvas><script>var c=document.getElementById("exCanvas").getContext("2d");function frame(){c.fillStyle="#1234ab";c.fillRect(0,0,320,200);requestAnimationFrame(frame)}requestAnimationFrame(frame);</script>'
  $import=Invoke-RestMethod ($origin+'/api/studio/import') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{source=$effectSource} | ConvertTo-Json -Compress) -WebSession $session
  Check ($import.id -match '^[a-f0-9]{24}$') 'Installed LocalService loads QuickJS and native Canvas to validate an import'
  $effectFile=Join-Path $data ('app\effects\'+$import.id+'.json'); $effectHash=(Get-FileHash -LiteralPath $effectFile).Hash
  Invoke-RestMethod ($origin+'/api/studio/play') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{activeId=$import.id;enabled=$true} | ConvertTo-Json -Compress) -WebSession $session | Out-Null
  $previewRequest=[Net.HttpWebRequest]::Create($origin+'/api/studio/preview')
  $previewRequest.CookieContainer=$session.Cookies; $previewRequest.Timeout=15000; $previewResponse=$null
  try {
    $previewResponse=$previewRequest.GetResponse(); $previewStream=$previewResponse.GetResponseStream(); $previewStream.ReadTimeout=15000
    $buffer=New-Object byte[] 8192; $text=''; $deadline=[DateTime]::UtcNow.AddSeconds(15)
    while($text -notmatch '"image":"' -and [DateTime]::UtcNow -lt $deadline){$length=$previewStream.Read($buffer,0,$buffer.Length);if($length -eq 0){break};$text += [Text.Encoding]::UTF8.GetString($buffer,0,$length)}
    Check ($text -match '"image":"iVBOR') 'Installed isolated renderer returns a PNG preview through SSE'
  } finally {if($previewResponse){$previewResponse.Close()};$previewRequest.Abort()}
  Invoke-RestMethod ($origin+'/api/control') -Method Post -Headers $headers -ContentType 'application/json' -Body '{"color":"#22aa77","brightness":61,"power":false}' -WebSession $session | Out-Null
  Invoke-RestMethod ($origin+'/api/profiles') -Method Post -Headers $headers -ContentType 'application/json' -Body '{"name":"VM preservation check"}' -WebSession $session | Out-Null
  $profileKey='profile:'+(State).profiles[0].id
  Invoke-RestMethod ($origin+'/api/library') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{key=$profileKey;favorite=$true;category='VM';transitionMs=300} | ConvertTo-Json -Compress) -WebSession $session | Out-Null
  # A disconnected synthetic component exercises persisted geometry/calibration
  # without depending on physical LEDs in the hosted VM.
  $savedPiece=@{key='vm-calibrated-piece';deviceId=('f'*24);name='VM preserved map';start=0;count=12;x=0.37;y=0.61;width=0.18;height=0.29;rotation=45;shape='fan';columns=8;reverse=$false;rings=@(@{count=12;offset=3;reverse=$true});ledOrder=@(11..0);group='VM calibration'}
  $mapBefore=Invoke-RestMethod ($origin+'/api/studio') -WebSession $session
  $mapBody=@{layout=@($savedPiece);baseLayoutRevision=$mapBefore.layoutRevision}
  Invoke-RestMethod ($origin+'/api/studio') -Method Post -Headers $headers -ContentType 'application/json' -Body ($mapBody | ConvertTo-Json -Depth 8 -Compress) -WebSession $session | Out-Null
  $persistedMap=(Invoke-RestMethod ($origin+'/api/studio') -WebSession $session).layout | ConvertTo-Json -Depth 10 -Compress
  $settings=Join-Path $data 'app\settings.json'; $before=(Get-FileHash -LiteralPath $settings).Hash
  $firstDiagnostic=[IO.File]::ReadAllText((Join-Path $data 'installation.log'))
  # Exercise the same extracted preflight/restore transaction used when setup
  # is cancelled after preparation. No UI cancellation result is inferred.
  $preflightFolder=Join-Path $reports 'cancel-transaction'
  New-Item -ItemType Directory -Path $preflightFolder -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $workspace 'installer\service-preflight.ps1'),(Join-Path $workspace 'installer\backup-before-upgrade.ps1'),(Join-Path $workspace 'scripts\install-path.ps1') -Destination $preflightFolder
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $preflightFolder 'service-preflight.ps1') -Mode Prepare -Root $root -PanelPort $PanelPort -SDKPort $SDKPort -TempDir $preflightFolder
  $resumeMask=$LASTEXITCODE
  Check ($resumeMask -eq 3) 'Setup preparation records both running services for cancellation recovery'
  Check (@(Get-Service NexusRGB,NexusRGBHardware | Where-Object Status -ne 'Stopped').Count -eq 0) 'Setup preparation stops only the owned services'
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $preflightFolder 'service-preflight.ps1') -Mode Restore -Root $root -RestoreMask $resumeMask
  Check ($LASTEXITCODE -eq 0) 'Cancelled-setup transaction restores previously running services'
  Wait-Panel; Session; VerifyServices
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Cancelled-setup transaction preserves settings and calibration byte for byte'
  $trayBefore=Start-Process -FilePath (Join-Path $root 'NexusRGB.exe') -ArgumentList '--tray' -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 2
  Check (-not $trayBefore.HasExited) 'Own tray process is open before upgrade'
  Setup 'upgrade'; VerifyServices
  $trayBefore.Refresh()
  Check $trayBefore.HasExited 'Upgrade closes the previous tray process automatically'
  Check (-not $welcome) 'Upgrade does not repeat the welcome guide'
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Upgrade preserves settings and profiles byte for byte'
  Check ((Get-FileHash -LiteralPath $effectFile).Hash -eq $effectHash) 'Upgrade preserves imported effects byte for byte'
  Check (((Invoke-RestMethod ($origin+'/api/studio') -WebSession $session).layout | ConvertTo-Json -Depth 10 -Compress) -eq $persistedMap) 'Upgrade preserves saved map and calibration'
  $upgradeBackups=@(Get-ChildItem -LiteralPath (Join-Path $data 'app\backups') -Filter 'before-update-*.json')
  Check ($upgradeBackups.Count -ge 1) 'Upgrade creates a complete backup before replacing payload'
  $upgradeBackup=[IO.File]::ReadAllText($upgradeBackups[0].FullName) | ConvertFrom-Json
  Check ($upgradeBackup.format -eq 'nexus-backup/1' -and $upgradeBackup.effects[0].id -eq $import.id -and $upgradeBackup.settings.library.transitionMs -eq 300) 'Automatic backup includes effects and library organization'
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
  Check (-not $welcome) 'Service restart does not repeat the welcome guide'
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Service restart preserves data'
  $hardwareBefore=Get-CimInstance Win32_Service -Filter "Name='NexusRGBHardware'"
  $oldOpenRGB=@(Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq $hardwareBefore.ProcessId -and $_.Name -eq 'OpenRGB.exe'})
  $command=(Get-Item -LiteralPath 'HKLM:\SOFTWARE\Classes\nexusrgb\shell\open\command').GetValue('')
  Check ($command -eq ('"'+(Join-Path $root 'NexusRGB.exe')+'" --restart-rgb "%1"')) 'Recovery URL uses the installed native application with quoted arguments'
  & (Join-Path $root 'scripts\restart-services.ps1')
  Check ($LASTEXITCODE -eq 0) 'Installed recovery restarts Nexus and OpenRGB and verifies controller connection'
  Wait-Panel; Session; VerifyServices
  $hardwareAfter=Get-CimInstance Win32_Service -Filter "Name='NexusRGBHardware'"
  $newOpenRGB=@(Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq $hardwareAfter.ProcessId -and $_.Name -eq 'OpenRGB.exe'})
  Check ($oldOpenRGB.Count -eq 1 -and $newOpenRGB.Count -eq 1 -and $oldOpenRGB[0].ProcessId -ne $newOpenRGB[0].ProcessId) 'Recovery replaces the supervised OpenRGB process'
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before -and (Get-FileHash -LiteralPath $effectFile).Hash -eq $effectHash) 'Recovery preserves settings and effect imports byte for byte'
  Check (((Invoke-RestMethod ($origin+'/api/studio') -WebSession $session).layout | ConvertTo-Json -Depth 10 -Compress) -eq $persistedMap) 'Recovery preserves map and calibration'
  $helper=Start-Process -FilePath (Join-Path $root 'NexusRGB-Uninstall.exe') -ArgumentList '--check' -WindowStyle Hidden -Wait -PassThru
  Check ($helper.ExitCode -eq 0) 'Standalone uninstall helper validates installed registration'
  Uninstall 'first-removal'
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Uninstall preserves user profiles and settings'
  Check ((Get-FileHash -LiteralPath $effectFile).Hash -eq $effectHash) 'Uninstall preserves imported effects'
  Setup 'reinstall'; VerifyServices
  Check (-not $welcome) 'Reinstall with preserved data does not repeat the welcome guide'
  Check ((Get-FileHash -LiteralPath $settings).Hash -eq $before) 'Reinstall restores preserved data'
  Check ((Get-FileHash -LiteralPath $effectFile).Hash -eq $effectHash) 'Reinstall restores imported effect files'
  Check ((State).performance.fps -eq 60) 'Reinstalled API restores selected FPS'
  Check (((Invoke-RestMethod ($origin+'/api/studio') -WebSession $session).layout | ConvertTo-Json -Depth 10 -Compress) -eq $persistedMap) 'Reinstall restores map and calibration'
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
