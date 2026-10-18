param(
  [ValidateSet('Prepare','Restore')][string]$Mode='Prepare',
  [Parameter(Mandatory=$true)][string]$Root,
  [ValidateRange(0,3)][int]$RestoreMask=0,
  [int]$PanelPort=0,[int]$SDKPort=0,
  [int]$SessionId=-1,
  [string]$TempDir=''
)
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
. (Join-Path $PSScriptRoot 'install-path.ps1')
$definitions=@(
  @{Name='NexusRGBHardware';Argument='--hardware-service';Bit=2},
  @{Name='NexusRGB';Argument='--service';Bit=1}
)
function Get-NexusOwnedProcessIds($Services,$Processes,[string]$InstallRoot) {
  $native=Join-Path $InstallRoot 'NexusRGB.exe'
  $allowed=@{}
  foreach($definition in $definitions) {
    $service=$Services | Where-Object Name -eq $definition.Name | Select-Object -First 1
    if(-not $service){continue}
    $expected='"'+$native+'" '+$definition.Argument
    if(-not [String]::Equals($service.PathName.Trim(),$expected,[StringComparison]::OrdinalIgnoreCase)){throw 'ServiceIdentityConflict'}
    if($service.ProcessId -gt 0) {
      $process=$Processes | Where-Object ProcessId -eq $service.ProcessId | Select-Object -First 1
      if(-not $process -or -not [String]::Equals($process.ExecutablePath,$native,[StringComparison]::OrdinalIgnoreCase)){throw 'ServiceIdentityConflict'}
      $allowed[[int]$service.ProcessId]=$true
    }
  }
  $executables=@($native,(Join-Path $InstallRoot 'runtime\node.exe'),(Join-Path $InstallRoot 'openrgb\OpenRGB.exe'))
  do {
    $added=$false
    foreach($process in $Processes) {
      if($allowed.ContainsKey([int]$process.ParentProcessId) -and -not $allowed.ContainsKey([int]$process.ProcessId) -and $executables -contains $process.ExecutablePath) {
        $allowed[[int]$process.ProcessId]=$true; $added=$true
      }
    }
  } while($added)
  return $allowed
}
function Restore-NexusServices([int]$Mask) {
  foreach($definition in $definitions) {
    if(($Mask -band $definition.Bit) -ne 0) {
      Start-Service -Name $definition.Name
      (Get-Service -Name $definition.Name).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
    }
  }
}
function Invoke-NexusPreparation {
  $saved=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\NexusRGB' -ErrorAction SilentlyContinue
  $panel=if($PanelPort -gt 0){$PanelPort}elseif($saved.PanelPort){$saved.PanelPort}else{5050}
  $sdk=if($SDKPort -gt 0){$SDKPort}elseif($saved.SDKPort){$saved.SDKPort}else{6743}
  if($panel -lt 1024 -or $panel -gt 65535 -or $sdk -lt 1024 -or $sdk -gt 65535 -or $panel -eq $sdk){return 46}
  $services=@(Get-CimInstance Win32_Service | Where-Object Name -in 'NexusRGB','NexusRGBHardware')
  $processes=@(Get-CimInstance Win32_Process)
  try {$owned=Get-NexusOwnedProcessIds $services $processes $Root} catch {return 42}
  try {Assert-NexusInstallPath $Root -Prepare:($Mode -eq 'Prepare')} catch {return 43}
  if($Mode -eq 'Restore') {Restore-NexusServices $RestoreMask; return 0}
  # Reject unrelated listeners/controllers before stopping any installed service.
  $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -in $panel,$sdk)
  if($listeners | Where-Object {-not $owned.ContainsKey([int]$_.OwningProcess)}){return 40}
  if($processes | Where-Object {$_.Name -eq 'OpenRGB.exe' -and -not $owned.ContainsKey([int]$_.ProcessId)}){return 41}
  $mask=0
  foreach($definition in $definitions) {
    $service=$services | Where-Object Name -eq $definition.Name | Select-Object -First 1
    if($service.State -eq 'Running'){$mask=$mask -bor $definition.Bit}
  }
  $targetSessionId = if ($SessionId -ge 0) { $SessionId } else {
    try { [System.Diagnostics.Process]::GetCurrentProcess().SessionId } catch { 1 }
  }
  # Gracefully close running tray processes in target session before stopping services
  $native=Join-Path $Root 'NexusRGB.exe'
  $unownedProcesses=@($processes | Where-Object {
    $_.ExecutablePath -and [String]::Equals($_.ExecutablePath,$native,[StringComparison]::OrdinalIgnoreCase) -and -not $owned.ContainsKey([int]$_.ProcessId)
  })

  # Reject if other Windows user sessions have Nexus RGB processes open
  $foreignProcesses = @($unownedProcesses | Where-Object { $_.SessionId -ne $targetSessionId })
  if ($foreignProcesses.Count -gt 0) {
    return 47
  }

  # Reject if interactive configuration or recovery dialogs are open
  $dialogProcesses = @($unownedProcesses | Where-Object {
    $cmd = $_.CommandLine
    $cmd -and ($cmd -match '--(restart-rgb|configure-ports)')
  })
  if ($dialogProcesses.Count -gt 0) {
    return 48
  }

  $trayProcesses = @($unownedProcesses | Where-Object {
    $cmd = $_.CommandLine
    -not ($cmd -and ($cmd -match '--(restart-rgb|configure-ports|service|hardware-service|self-test)'))
  })

  if($trayProcesses.Count -gt 0) {
    if ($targetSessionId -ne 0) {
      $targetDir = if ($TempDir -and (Test-Path -LiteralPath $TempDir)) { $TempDir } elseif (Test-Path -LiteralPath $env:TEMP) { $env:TEMP } else { $null }
      if ($targetDir) {
        try { Set-Content -LiteralPath (Join-Path $targetDir 'nexus-tray-resume.txt') -Value '1' -Encoding ASCII -Force } catch {}
      }
    }

    $normRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\').ToUpperInvariant()
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($normRoot)
    $hashBytes = $hasher.ComputeHash($bytes)
    $sb = New-Object System.Text.StringBuilder(16)
    for ($i = 0; $i -lt 8; $i++) { [void]$sb.Append($hashBytes[$i].ToString('X2')) }
    $pathHash = $sb.ToString()
    $scopedEvent = "Local\NexusRGB.Tray.Exit.$pathHash"

    foreach ($evtName in @($scopedEvent, 'Local\NexusRGB.Tray.Exit')) {
      try {
        $handle = [System.Threading.EventWaitHandle]::OpenExisting($evtName)
        [void]$handle.Set()
        $handle.Dispose()
      } catch {}
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(3)
    while ([DateTime]::UtcNow -lt $deadline) {
      $remaining = @(Get-CimInstance Win32_Process | Where-Object {
        $_.ExecutablePath -and [String]::Equals($_.ExecutablePath,$native,[StringComparison]::OrdinalIgnoreCase) -and -not $owned.ContainsKey([int]$_.ProcessId)
      })
      if (-not $remaining.Count) { break }
      Start-Sleep -Milliseconds 100
    }
    $remaining = @(Get-CimInstance Win32_Process | Where-Object {
      $_.ExecutablePath -and [String]::Equals($_.ExecutablePath,$native,[StringComparison]::OrdinalIgnoreCase) -and -not $owned.ContainsKey([int]$_.ProcessId)
    })
    foreach ($p in $remaining) {
      $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($p.ProcessId)" -ErrorAction SilentlyContinue
      if ($current -and
          [String]::Equals($current.ExecutablePath, $native, [StringComparison]::OrdinalIgnoreCase) -and
          $current.SessionId -eq $targetSessionId -and
          $current.CreationDate -eq $p.CreationDate) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
      }
    }
  }
  try {
    foreach($definition in $definitions) {
      $service=Get-Service -Name $definition.Name -ErrorAction SilentlyContinue
      if($service -and $service.Status -ne 'Stopped') {
        Stop-Service -Name $definition.Name -Force
        $service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
      }
    }
    # Job shutdown can briefly precede TCP teardown. Never terminate a foreign PID.
    for($attempt=0; $attempt -lt 20; $attempt++) {
      $remaining=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -in $panel,$sdk)
      if(-not $remaining.Count){
        . (Join-Path $PSScriptRoot 'backup-before-upgrade.ps1')
        Save-NexusUpgradeBackup (Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'NexusRGB\app')
        return $mask
      }
      Start-Sleep -Milliseconds 100
    }
    throw 'Portas ainda ocupadas após parar os serviços.'
  } catch {
    try {Restore-NexusServices $mask} catch {return 45}
    return 44
  }
}
try {exit (Invoke-NexusPreparation)} catch {Write-Error $_ -ErrorAction Continue; exit 45}
