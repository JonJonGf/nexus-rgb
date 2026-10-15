param(
  [ValidateSet('Prepare','Restore')][string]$Mode='Prepare',
  [Parameter(Mandatory=$true)][string]$Root,
  [ValidateRange(0,3)][int]$RestoreMask=0,
  [int]$PanelPort=0,[int]$SDKPort=0
)
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
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
  $expectedRoot=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'))
  if(-not [String]::Equals([IO.Path]::GetFullPath($Root),$expectedRoot,[StringComparison]::OrdinalIgnoreCase)){return 43}
  if(Test-Path -LiteralPath $Root) {
    $rootItem=Get-Item -LiteralPath $Root -Force
    if(-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint)){return 43}
  }
  $services=@(Get-CimInstance Win32_Service | Where-Object Name -in 'NexusRGB','NexusRGBHardware')
  $processes=@(Get-CimInstance Win32_Process)
  try {$owned=Get-NexusOwnedProcessIds $services $processes $Root} catch {return 42}
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
      if(-not $remaining.Count){return $mask}
      Start-Sleep -Milliseconds 100
    }
    throw 'Portas ainda ocupadas após parar os serviços.'
  } catch {
    try {Restore-NexusServices $mask} catch {return 45}
    return 44
  }
}
try {exit (Invoke-NexusPreparation)} catch {Write-Error $_ -ErrorAction Continue; exit 45}
