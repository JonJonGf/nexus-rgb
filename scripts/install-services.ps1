param([ValidateSet('Install','Uninstall')][string]$Mode='Install',[int]$PanelPort=0,[int]$SDKPort=0,[int]$AlexaPort=0)
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
. (Join-Path $PSScriptRoot 'ports.ps1')
$dataRoot=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'NexusRGB'
$stage='Verificar instalação'
function Invoke-NexusSc([string[]]$Arguments) {
  & "$env:SystemRoot\System32\sc.exe" @Arguments | Out-Null
  if($LASTEXITCODE -ne 0){throw "Falha no gerenciador de serviços: $($Arguments[0]) ($LASTEXITCODE)"}
}
function Get-NexusDirectoryTree([string]$Directory) {
  # Enumerate each directory explicitly; never follow a junction or symbolic link.
  $root=Get-Item -LiteralPath $Directory -Force
  if(-not $root.PSIsContainer -or ($root.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw "Pasta normal esperada: $Directory"}
  $pending=New-Object 'Collections.Generic.Queue[string]'
  $pending.Enqueue($root.FullName)
  while($pending.Count -gt 0) {
    foreach($item in Get-ChildItem -LiteralPath $pending.Dequeue() -Force) {
      if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Link de sistema de arquivos não permitido: $($item.FullName)"}
      $item
      if($item.PSIsContainer){$pending.Enqueue($item.FullName)}
    }
  }
}
function Set-NexusDirectoryPermissions([string]$Directory,[hashtable]$Grants,[bool]$ResetChildren=$false) {
  $descendants=@(Get-NexusDirectoryTree $Directory)
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
    # Protect parents before their children, with no recursive command crossing links.
    # /L keeps the operation on the link itself if a path changes after validation.
    foreach($child in $descendants) {
      $current=Get-Item -LiteralPath $child.FullName -Force
      if($current.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Link de sistema de arquivos não permitido: $($current.FullName)"}
      & "$env:SystemRoot\System32\icacls.exe" $current.FullName /setowner '*S-1-5-32-544' /L /Q | Out-Null
      if($LASTEXITCODE -ne 0){throw "Falha ao definir proprietário: $($current.FullName)"}
      & "$env:SystemRoot\System32\icacls.exe" $current.FullName /reset /L /Q | Out-Null
      if($LASTEXITCODE -ne 0){throw "Falha ao proteger arquivos: $($current.FullName)"}
    }
  }
}
function Write-NexusDiagnostic([string]$FileName,[string]$Message) {
  if(Test-Path -LiteralPath $dataRoot) {
    $root=Get-Item -LiteralPath $dataRoot -Force
    if(-not $root.PSIsContainer -or ($root.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Pasta de diagnóstico inválida.'}
  }
  New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
  $file=Join-Path $dataRoot $FileName
  if((Test-Path -LiteralPath $file) -and ((Get-Item -LiteralPath $file -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Arquivo de diagnóstico inválido.'}
  $temporary=Join-Path $dataRoot ($FileName+'.'+[Guid]::NewGuid().ToString('N')+'.tmp')
  try {
    [IO.File]::WriteAllText($temporary,$Message,[Text.UTF8Encoding]::new($true))
    # Replace the directory entry rather than overwriting a preexisting hard link.
    # Windows PowerShell 5.1 converts $null to an empty string for this .NET
    # overload. NullString supplies a real null backup path during upgrades.
    if([IO.File]::Exists($file)){[IO.File]::Replace($temporary,$file,[NullString]::Value)}else{[IO.File]::Move($temporary,$file)}
  } finally { if([IO.File]::Exists($temporary)){[IO.File]::Delete($temporary)} }
  & "$env:SystemRoot\System32\icacls.exe" $file /grant:r '*S-1-5-32-545:R' /Q | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Falha ao disponibilizar diagnóstico de instalação.'}
}
function Wait-NexusPanel([string]$Url='http://127.0.0.1:5050/api/health',[int]$TimeoutSeconds=30) {
  $deadline=[DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while([DateTime]::UtcNow -lt $deadline) {
    $response=$null; $reader=$null
    try {
      $request=[Net.HttpWebRequest]::Create($Url)
      $request.Proxy=$null; $request.Timeout=1500; $request.ReadWriteTimeout=1500
      $response=$request.GetResponse()
      $reader=[IO.StreamReader]::new($response.GetResponseStream())
      $health=$reader.ReadToEnd() | ConvertFrom-Json
      if($health.ready -is [bool] -and $health.ready -and $health.application -eq 'nexus-rgb'){return}
    } catch { # The worker may be starting Node; retry within the deadline.
    } finally {if($reader){$reader.Dispose()}; if($response){$response.Dispose()}}
    Start-Sleep -Milliseconds 250
  }
  throw 'O serviço foi iniciado, mas o painel não respondeu em 30 segundos. Consulte ProgramData\NexusRGB\app\service.log.'
}
try {
$installRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedRoot=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'))
if($installRoot -ne $expectedRoot){throw 'Os serviços só podem ser registrados na pasta protegida Program Files\Nexus RGB.'}
if($Mode -eq 'Install') {
  $ports=if($PanelPort -eq 0 -or $SDKPort -eq 0 -or $AlexaPort -eq 0){Get-NexusPorts}else{@{PanelPort=$PanelPort;SDKPort=$SDKPort;AlexaPort=$AlexaPort}}
  if($PanelPort -eq 0){$PanelPort=$ports.PanelPort}; if($SDKPort -eq 0){$SDKPort=$ports.SDKPort}; if($AlexaPort -eq 0){$AlexaPort=$ports.AlexaPort}
  Assert-NexusPorts $PanelPort $SDKPort $AlexaPort
}
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
# Replace DACLs and owners, including data created before installation. /grant:r
# alone would retain another user's explicit permissions and ownership.
Set-NexusDirectoryPermissions $dataRoot @{
  'S-1-5-18'=@{Rights='FullControl';Inherit=$true}
  'S-1-5-32-544'=@{Rights='FullControl';Inherit=$true}
  'S-1-5-19'=@{Rights='ReadAndExecute';Inherit=$false}
  'S-1-5-32-545'=@{Rights='ReadAndExecute';Inherit=$false}
} $true
Set-NexusDirectoryPermissions (Join-Path $dataRoot 'app') @{
  'S-1-5-18'=@{Rights='FullControl';Inherit=$true}
  'S-1-5-32-544'=@{Rights='FullControl';Inherit=$true}
  'S-1-5-19'=@{Rights='Modify';Inherit=$true}
  'S-1-5-32-545'=@{Rights='ReadAndExecute';Inherit=$true}
} $true
Set-NexusDirectoryPermissions (Join-Path $dataRoot 'hardware') @{
  'S-1-5-18'=@{Rights='FullControl';Inherit=$true}
  'S-1-5-32-544'=@{Rights='FullControl';Inherit=$true}
} $true
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
$stage='Salvar portas'
Set-NexusPorts $PanelPort $SDKPort $AlexaPort
$stage='Configurar firewall local'
Get-NetFirewallRule -Group 'Nexus RGB' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Set-NexusPortFirewall $nodePath $PanelPort $AlexaPort
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
$stage='Verificar painel local'
Wait-NexusPanel -Url ('http://127.0.0.1:'+$PanelPort+'/api/health')
Write-NexusDiagnostic 'installation.log' ((Get-Date -Format o)+"`r`nServiços instalados e iniciados.")
} catch {
  $failure=(Get-Date -Format o)+"`r`nEtapa: $stage`r`n"+$_.ToString()+"`r`n"+$_.InvocationInfo.PositionMessage
  try {Write-NexusDiagnostic $(if($Mode -eq 'Install'){'installation-error.log'}else{'uninstallation-error.log'}) $failure} catch {Write-Error $_ -ErrorAction Continue}
  Write-Error $failure -ErrorAction Continue
  exit 1
}
