param([ValidateSet('Install','Uninstall')][string]$Mode='Install')
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
$dataRoot=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'NexusRGB'
$stage='Verificar instalação'
function Invoke-NexusSc([string[]]$Arguments) {
  & "$env:SystemRoot\System32\sc.exe" @Arguments | Out-Null
  if($LASTEXITCODE -ne 0){throw "Falha no gerenciador de serviços: $($Arguments[0]) ($LASTEXITCODE)"}
}
function Set-NexusDirectoryPermissions([string]$Directory,[hashtable]$Grants,[bool]$ResetChildren=$false) {
  $directoryItem=Get-Item -LiteralPath $Directory -Force
  $descendants=@(Get-ChildItem -LiteralPath $Directory -Recurse -Force)
  if(($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or ($descendants | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })){throw "Link de sistema de arquivos não permitido: $Directory"}
  $acl=New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true,$false)
  $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
  foreach($sid in $Grants.Keys) {
    $grant=$Grants[$sid]
    $inheritance=if($grant.Inherit){[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),[Security.AccessControl.FileSystemRights]$grant.Rights,$inheritance,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
  }
  Set-Acl -LiteralPath $Directory -AclObject $acl
  if($ResetChildren) {
    foreach($child in Get-ChildItem -LiteralPath $Directory -Force) {
      & "$env:SystemRoot\System32\icacls.exe" $child.FullName /reset /T /Q | Out-Null
      if($LASTEXITCODE -ne 0){throw "Falha ao proteger arquivos: $($child.FullName)"}
    }
    & "$env:SystemRoot\System32\icacls.exe" $Directory /setowner '*S-1-5-32-544' /T /Q | Out-Null
    if($LASTEXITCODE -ne 0){throw "Falha ao definir proprietário: $Directory"}
  }
}
function Write-NexusDiagnostic([string]$FileName,[string]$Message) {
  New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
  $file=Join-Path $dataRoot $FileName
  [IO.File]::WriteAllText($file,$Message,[Text.UTF8Encoding]::new($true))
  & "$env:SystemRoot\System32\icacls.exe" $file /grant:r '*S-1-5-32-545:R' /Q | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Falha ao disponibilizar diagnóstico de instalação.'}
}
try {
$installRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedRoot=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'))
if($installRoot -ne $expectedRoot){throw 'Os serviços só podem ser registrados na pasta protegida Program Files\Nexus RGB.'}
foreach($name in @('NexusRGB','NexusRGBHardware')) {
  $service=Get-Service -Name $name -ErrorAction SilentlyContinue
  if($service){ if($service.Status -ne 'Stopped'){Stop-Service -Name $name -Force; $service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))}; if($Mode -eq 'Uninstall'){Invoke-NexusSc @('delete',$name)} }
}
if($Mode -eq 'Uninstall') {
  Get-NetFirewallRule -Group 'Nexus RGB' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  exit 0
}
if(-not (Test-Path -LiteralPath (Join-Path $installRoot 'NexusRGB.exe'))){throw 'Instalação incompleta.'}
$stage='Proteger executáveis'
# Some Windows installations use a relocated Program Files with permissive ACLs.
# Replace its inherited permissions before registering any SYSTEM service.
Set-NexusDirectoryPermissions $installRoot @{
  'S-1-5-18'=@{Rights='FullControl';Inherit=$true}
  'S-1-5-32-544'=@{Rights='FullControl';Inherit=$true}
  'S-1-5-19'=@{Rights='ReadAndExecute';Inherit=$true}
  'S-1-5-32-545'=@{Rights='ReadAndExecute';Inherit=$true}
} $true
$stage='Proteger dados'
New-Item -ItemType Directory -Path $dataRoot,(Join-Path $dataRoot 'app'),(Join-Path $dataRoot 'hardware') -Force | Out-Null
# Locale-independent Windows SIDs. No executable content is loaded from writable data.
& icacls.exe $dataRoot /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-19:(RX)' '*S-1-5-32-545:(RX)' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Falha ao proteger a pasta de dados.'}
& icacls.exe (Join-Path $dataRoot 'app') /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-19:(OI)(CI)M' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Falha ao proteger dados do serviço.'}
& icacls.exe (Join-Path $dataRoot 'hardware') /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Falha ao proteger configuração do hardware.'}
foreach($definition in @(@{Name='NexusRGBHardware';Argument='--hardware-service';Account='LocalSystem';Display='Nexus RGB — Hardware'},@{Name='NexusRGB';Argument='--service';Account='NT AUTHORITY\LocalService';Display='Nexus RGB — Rede local'})) {
  $stage='Registrar '+$definition.Name
  $binary='"'+(Join-Path $installRoot 'NexusRGB.exe')+'" '+$definition.Argument
  $existing=Get-CimInstance -ClassName Win32_Service -Filter ("Name='"+$definition.Name+"'")
  if($existing){$changed=Invoke-CimMethod -InputObject $existing -MethodName Change -Arguments @{PathName=$binary;StartMode='Automatic';StartName=$definition.Account;DisplayName=$definition.Display}}
  else{$changed=Invoke-CimMethod -ClassName Win32_Service -MethodName Create -Arguments @{Name=$definition.Name;DisplayName=$definition.Display;PathName=$binary;ServiceType=[byte]16;ErrorControl=[byte]1;StartMode='Automatic';DesktopInteract=$false;StartName=$definition.Account}}
  if($changed.ReturnValue -ne 0){throw "Falha ao registrar o serviço $($definition.Name): $($changed.ReturnValue)"}
  Invoke-NexusSc @('failure',$definition.Name,'reset=','86400','actions=','restart/5000/restart/10000/restart/30000')
  Invoke-NexusSc @('failureflag',$definition.Name,'1')
}
$nodePath=Join-Path $installRoot 'runtime\node.exe'
$stage='Configurar firewall local'
Get-NetFirewallRule -Group 'Nexus RGB' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'Nexus RGB — Painel LAN' -Group 'Nexus RGB' -Direction Inbound -Action Allow -Program $nodePath -Protocol TCP -LocalPort 5050 -Profile Any -InterfaceType Wired,Wireless -RemoteAddress LocalSubnet -EdgeTraversalPolicy Block | Out-Null
New-NetFirewallRule -DisplayName 'Nexus RGB — Alexa LAN' -Group 'Nexus RGB' -Direction Inbound -Action Allow -Program $nodePath -Protocol TCP -LocalPort 80 -Profile Any -InterfaceType Wired,Wireless -RemoteAddress LocalSubnet -EdgeTraversalPolicy Block | Out-Null
New-NetFirewallRule -DisplayName 'Nexus RGB — Descoberta Alexa' -Group 'Nexus RGB' -Direction Inbound -Action Allow -Program $nodePath -Protocol UDP -LocalPort 1900 -Profile Any -InterfaceType Wired,Wireless -RemoteAddress LocalSubnet -EdgeTraversalPolicy Block | Out-Null
# Enforce offline operation for the two dedicated executables; no global firewall settings.
# Windows Firewall rejects a /0 prefix. The two /1 prefixes cover IPv6.
$allIPv6=@('::/1','8000::/1')
$outsidePrivate=@('0.0.0.0-9.255.255.255','11.0.0.0-126.255.255.255','128.0.0.0-172.15.255.255','172.32.0.0-192.167.255.255','192.169.0.0-223.255.255.255','240.0.0.0-255.255.255.255')+$allIPv6
New-NetFirewallRule -DisplayName 'Nexus RGB — Sem saída à internet' -Group 'Nexus RGB' -Direction Outbound -Action Block -Program $nodePath -RemoteAddress $outsidePrivate -Profile Any | Out-Null
New-NetFirewallRule -DisplayName 'Nexus RGB — Hardware somente neste PC' -Group 'Nexus RGB' -Direction Outbound -Action Block -Program (Join-Path $installRoot 'openrgb\OpenRGB.exe') -RemoteAddress (@('0.0.0.0-126.255.255.255','128.0.0.0-255.255.255.255')+$allIPv6) -Profile Any | Out-Null
$stage='Iniciar controlador RGB'
Start-Service -Name NexusRGBHardware
$stage='Iniciar painel local'
Start-Service -Name NexusRGB
Write-NexusDiagnostic 'installation.log' ((Get-Date -Format o)+"`r`nServiços instalados e iniciados.")
} catch {
  $failure=(Get-Date -Format o)+"`r`nEtapa: $stage`r`n"+$_.ToString()+"`r`n"+$_.InvocationInfo.PositionMessage
  try {Write-NexusDiagnostic $(if($Mode -eq 'Install'){'installation-error.log'}else{'uninstallation-error.log'}) $failure} catch {Write-Error $_ -ErrorAction Continue}
  Write-Error $failure -ErrorAction Continue
  exit 1
}
