$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
. (Join-Path $PSScriptRoot 'ports.ps1')
. (Join-Path $PSScriptRoot 'install-path.ps1')
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$mutex=$null; $locked=$false; $started=$false
try {
  $identity=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
  if(-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Autorize o pedido de administrador para reiniciar os servicos.'}
  Assert-NexusInstallPath $root
  if($root -ne (Get-NexusRegisteredInstallRoot)){throw 'Use a copia registrada pelo instalador do Nexus RGB.'}
  $mutex=[Threading.Mutex]::new($false,'Global\NexusRGB.RestartServices')
  try {$locked=$mutex.WaitOne(0)} catch [Threading.AbandonedMutexException] {$locked=$true}
  if(-not $locked){throw 'Ja existe uma recuperacao em andamento. Aguarde a janela anterior.'}
  # Validate both services before stopping either one. SCM/Job Objects stop
  # only the OpenRGB and Node children supervised by this installation.
  foreach($name in @('NexusRGB','NexusRGBHardware')) {
    $service=Get-CimInstance Win32_Service -Filter ("Name='"+$name+"'")
    $argument=if($name -eq 'NexusRGB'){'--service'}else{'--hardware-service'}
    if(-not $service -or $service.PathName.Trim() -ne ('"'+(Join-Path $root 'NexusRGB.exe')+'" '+$argument)){throw ('Servico nao corresponde a esta instalacao: '+$name)}
  }
  $ports=Get-NexusPorts
  $started=$true
  foreach($name in @('NexusRGB','NexusRGBHardware')) {
    $service=Get-Service $name
    if($service.Status -ne 'Stopped'){Stop-Service $name; $service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))}
  }
  foreach($name in @('NexusRGBHardware','NexusRGB')) {Start-Service $name; (Get-Service $name).WaitForStatus('Running',[TimeSpan]::FromSeconds(20))}
  $health=$null; $stable=0; $lastDevices=-1
  for($attempt=0;$attempt -lt 45;$attempt++) {
    try {
      $value=Invoke-RestMethod ('http://127.0.0.1:'+$ports.PanelPort+'/api/health') -TimeoutSec 1
      if($value.ready -is [bool] -and $value.ready -eq $true -and $value.application -eq 'nexus-rgb'){
        $health=$value
        if($value.hardware.connected -is [bool] -and $value.hardware.connected -eq $true){
          $detecting=($value.hardware.detecting -is [bool] -and $value.hardware.detecting -eq $true)
          if($value.hardware.devices -eq $lastDevices -and $value.hardware.devices -gt 0){$stable++}else{$stable=0}
          $lastDevices=$value.hardware.devices
          if(-not $detecting -and (($value.hardware.devices -gt 0 -and $stable -ge 1) -or $attempt -ge 10)){break}
        }
      }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  if(-not $health){throw 'Os servicos iniciaram, mas o painel nao confirmou retorno. Confira as portas e os diagnosticos.'}
  if($health.hardware.connected -isnot [bool] -or $health.hardware.connected -ne $true){throw 'O painel voltou, mas o OpenRGB ainda nao confirmou conexao. Confira os diagnosticos; seus ajustes foram preservados.'}
  if($health.hardware.detecting -is [bool] -and $health.hardware.detecting -eq $true){
    Write-Output ('Painel pronto e OpenRGB conectado; deteccao ainda em andamento (componentes detectados ate agora: '+$health.hardware.devices+'). Perfis, efeitos e configuracoes foram preservados.')
    exit 0
  }
  Write-Output ('Servicos e OpenRGB reiniciados. Componentes detectados: '+$health.hardware.devices+'. Perfis, efeitos e configuracoes foram preservados.')
  exit 0
} catch {
  $failure=$_.Exception.Message
  if($started) {
    # A failed restart must not deliberately leave the other service stopped.
    foreach($name in @('NexusRGBHardware','NexusRGB')) {try {if((Get-Service $name).Status -eq 'Stopped'){Start-Service $name}} catch {}}
  }
  Write-Output $failure
  exit 1
} finally {if($locked){$mutex.ReleaseMutex()}; if($mutex){$mutex.Dispose()}}
