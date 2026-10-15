param([Parameter(Mandatory=$true)][int]$PanelPort,[Parameter(Mandatory=$true)][int]$SDKPort,[Parameter(Mandatory=$true)][int]$AlexaPort)
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
. (Join-Path $PSScriptRoot 'ports.ps1')
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dataRoot=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'NexusRGB'
$old=$null; $stopped=$false; $original=@{}
function Wait-ConfiguredPanel([int]$Port) {
  for($attempt=0;$attempt -lt 40;$attempt++) {
    try { $value=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$Port+'/api/health') -TimeoutSec 1; if($value.ready -eq $true -and $value.application -eq 'nexus-rgb'){return} } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw 'O painel não iniciou na porta escolhida.'
}
function Assert-FreePort([int]$Port) {
  for($attempt=0;$attempt -lt 20;$attempt++) {
    $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Any,$Port)
    try {$listener.ExclusiveAddressUse=$true; $listener.Start(); return} catch {if($attempt -eq 19){throw ('Porta '+$Port+' ocupada ou reservada pelo Windows. Escolha outra.')}} finally {$listener.Stop()}
    Start-Sleep -Milliseconds 100
  }
}
try {
  if($root -ne (Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB')){throw 'Execute somente a cópia instalada em Program Files\Nexus RGB.'}
  Assert-NexusPorts $PanelPort $SDKPort $AlexaPort
  try {$old=Get-NexusPorts} catch {$old=@{PanelPort=5050;SDKPort=6743;AlexaPort=80}}
  $services=@(Get-CimInstance Win32_Service | Where-Object Name -in 'NexusRGB','NexusRGBHardware')
  if($services.Count -ne 2){throw 'Instale os serviços Nexus antes de configurar portas.'}
  $processes=@(Get-CimInstance Win32_Process); $owned=@{}
  foreach($service in $services) {
    $argument=if($service.Name -eq 'NexusRGB'){'--service'}else{'--hardware-service'}
    if($service.PathName.Trim() -ne ('"'+(Join-Path $root 'NexusRGB.exe')+'" '+$argument)){throw 'A identidade de um serviço Nexus não corresponde à instalação.'}
    $original[$service.Name]=$service.State -eq 'Running'
    if($service.ProcessId -gt 0){
      $process=$processes | Where-Object ProcessId -eq $service.ProcessId | Select-Object -First 1
      if($process.ExecutablePath -ne (Join-Path $root 'NexusRGB.exe')){throw 'Processo de serviço inválido.'}
      $owned[[int]$service.ProcessId]=$true
    }
  }
  foreach($process in $processes){if($owned.ContainsKey([int]$process.ParentProcessId) -and $process.ExecutablePath -in @((Join-Path $root 'runtime\node.exe'),(Join-Path $root 'openrgb\OpenRGB.exe'))){$owned[[int]$process.ProcessId]=$true}}
  $alexaEnabled=$false; $settings=Join-Path $dataRoot 'app\settings.json'
  if(Test-Path -LiteralPath $settings){$alexaEnabled=((Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json).alexaEnabled -eq $true)}
  $required=@($PanelPort,$SDKPort); if($alexaEnabled){$required+=$AlexaPort}
  $conflict=Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -in $required -and -not $owned.ContainsKey([int]$_.OwningProcess)} | Select-Object -First 1
  if($conflict){$process=$processes | Where-Object ProcessId -eq $conflict.OwningProcess | Select-Object -First 1; throw ('Porta '+$conflict.LocalPort+' ocupada por '+$process.Name+' (PID '+$conflict.OwningProcess+'). Escolha outra porta.')}
  $changeSDK=$SDKPort -ne $old.SDKPort; $stopped=$true
  if((Get-Service NexusRGB).Status -ne 'Stopped'){Stop-Service NexusRGB; (Get-Service NexusRGB).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))}
  if($changeSDK -and (Get-Service NexusRGBHardware).Status -ne 'Stopped'){Stop-Service NexusRGBHardware; (Get-Service NexusRGBHardware).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))}
  foreach($port in $required) {
    if($port -eq $SDKPort -and -not $changeSDK -and (Get-Service NexusRGBHardware).Status -eq 'Running'){continue}
    Assert-FreePort $port
  }
  Set-NexusPorts $PanelPort $SDKPort $AlexaPort
  Set-NexusPortFirewall (Join-Path $root 'runtime\node.exe') $PanelPort $AlexaPort
  if((Get-Service NexusRGBHardware).Status -ne 'Running'){Start-Service NexusRGBHardware}
  Start-Service NexusRGB
  Wait-ConfiguredPanel $PanelPort
  exit 0
} catch {
  $failure=$_.Exception.Message
  if($stopped -and $old) {
    try {
      if((Get-Service NexusRGB).Status -ne 'Stopped'){Stop-Service NexusRGB; (Get-Service NexusRGB).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))}
      if($changeSDK -and (Get-Service NexusRGBHardware).Status -ne 'Stopped'){Stop-Service NexusRGBHardware; (Get-Service NexusRGBHardware).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))}
      Set-NexusPorts @old; Set-NexusPortFirewall (Join-Path $root 'runtime\node.exe') $old.PanelPort $old.AlexaPort
      foreach($name in @('NexusRGBHardware','NexusRGB')) {if($original[$name]){Start-Service $name}elseif((Get-Service $name).Status -ne 'Stopped'){Stop-Service $name}}
      if($original['NexusRGB']){Wait-ConfiguredPanel $old.PanelPort}
      $failure+=' As portas e os serviços anteriores foram restaurados.'
    } catch {$failure+=' Falha ao restaurar: '+$_.Exception.Message}
  }
  try {[IO.File]::WriteAllText((Join-Path $dataRoot 'ports-error.log'),((Get-Date).ToString('o')+"`r`n"+$failure),[Text.UTF8Encoding]::new($true))} catch {}
  Write-Error $failure -ErrorAction Continue
  exit 1
}
