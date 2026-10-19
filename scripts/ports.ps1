# Shared, administrator-owned HKLM configuration. No writable app data controls SYSTEM arguments.
function Assert-NexusPorts([int]$PanelPort,[int]$SDKPort,[int]$AlexaPort) {
  if($PanelPort -lt 1024 -or $PanelPort -gt 65535 -or $SDKPort -lt 1024 -or $SDKPort -gt 65535 -or $AlexaPort -lt 1 -or $AlexaPort -gt 65535){throw 'Painel e SDK: 1024 a 65535. Alexa: 1 a 65535.'}
  if(@(@($PanelPort,$SDKPort,$AlexaPort) | Select-Object -Unique).Count -ne 3){throw 'Use três portas TCP diferentes.'}
}
function Set-NexusPortFirewall([string]$NodePath,[int]$PanelPort,[int]$AlexaPort) {
  foreach($rule in @(@{Name='Nexus RGB — Painel LAN';Port=$PanelPort},@{Name='Nexus RGB — Alexa LAN';Port=$AlexaPort})) {
    Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $rule.Name -Group 'Nexus RGB' -Direction Inbound -Action Allow -Program $NodePath -Protocol TCP -LocalPort $rule.Port -Profile Any -InterfaceType Wired,Wireless -RemoteAddress LocalSubnet -EdgeTraversalPolicy Block | Out-Null
  }
}
function Get-NexusPorts {
  $saved=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\NexusRGB' -ErrorAction SilentlyContinue
  $result=@{PanelPort=5050;SDKPort=6743;AlexaPort=80}
  foreach($name in @('PanelPort','SDKPort','AlexaPort')) {
    if($saved -and $null -ne $saved.$name){if($saved.$name -isnot [int]){throw ('Porta inválida no registro: '+$name)}; $result[$name]=$saved.$name}
  }
  Assert-NexusPorts @result
  return $result
}
function Set-NexusPorts([int]$PanelPort,[int]$SDKPort,[int]$AlexaPort) {
  Assert-NexusPorts $PanelPort $SDKPort $AlexaPort
  # New-Item -Force failed on an existing protected key during a real upgrade.
  # Open/create it directly and update only our values, without replacing it.
  $key=[Microsoft.Win32.Registry]::LocalMachine.CreateSubKey('SOFTWARE\NexusRGB')
  try {
    foreach($item in @(@{Name='PanelPort';Value=$PanelPort},@{Name='SDKPort';Value=$SDKPort},@{Name='AlexaPort';Value=$AlexaPort})) {
      $key.SetValue($item.Name,[int]$item.Value,[Microsoft.Win32.RegistryValueKind]::DWord)
    }
    $key.Flush()
  } finally {if($key){$key.Dispose()}}
}
function Get-NexusAlexaEnabled([string]$SettingsPath) {
  if(-not (Test-Path -LiteralPath $SettingsPath)){return $false}
  $json=[IO.File]::ReadAllText($SettingsPath)
  # Effect parameters are case-sensitive JSON keys. PS 5.1 PSCustomObject
  # conversion rejects valid documents containing both Speed and speed.
  if($PSVersionTable.PSVersion.Major -ge 6) {
    $settings=$json | ConvertFrom-Json -AsHashtable
  } else {
    Add-Type -AssemblyName System.Web.Extensions
    $parser=New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $parser.MaxJsonLength=8*1024*1024
    $settings=$parser.DeserializeObject($json)
  }
  return ($settings -is [Collections.IDictionary] -and $settings['alexaEnabled'] -is [bool] -and $settings['alexaEnabled'])
}
