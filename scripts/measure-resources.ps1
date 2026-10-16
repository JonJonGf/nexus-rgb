param([Parameter(Mandatory=$true)][string]$InstallRoot)
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
$rootPath=[IO.Path]::GetFullPath($InstallRoot)
$native=Join-Path $rootPath 'NexusRGB.exe'
$paths=@{Panel=(Join-Path $rootPath 'runtime\node.exe');Controller=(Join-Path $rootPath 'openrgb\OpenRGB.exe')}
$processes=@(Get-CimInstance Win32_Process)
$services=@(Get-CimInstance Win32_Service -Filter "Name='NexusRGB' OR Name='NexusRGBHardware'")
$owned=@{};$partial=$false
foreach($definition in @(@{Name='NexusRGB';Argument='--service';Role='network-service'},@{Name='NexusRGBHardware';Argument='--hardware-service';Role='hardware-service'})) {
  $service=$services | Where-Object Name -eq $definition.Name | Select-Object -First 1
  if(-not $service -or $service.ProcessId -le 0){continue}
  $expected='"'+$native+'" '+$definition.Argument
  if(-not [String]::Equals($service.PathName.Trim(),$expected,[StringComparison]::OrdinalIgnoreCase)){continue}
  $owned[[int]$service.ProcessId]=$definition.Role
}
foreach($item in $processes) {if([String]::Equals($item.ExecutablePath,$native,[StringComparison]::OrdinalIgnoreCase) -and -not $owned.ContainsKey([int]$item.ProcessId)){$owned[[int]$item.ProcessId]='tray'}}
do {
  $added=$false
  foreach($item in $processes) {
    if(-not $owned.ContainsKey([int]$item.ParentProcessId) -or $owned.ContainsKey([int]$item.ProcessId)){continue}
    $role=if([String]::Equals($item.ExecutablePath,$paths.Controller,[StringComparison]::OrdinalIgnoreCase)){'openrgb'}elseif([String]::Equals($item.ExecutablePath,$paths.Panel,[StringComparison]::OrdinalIgnoreCase)){if($owned[[int]$item.ParentProcessId] -eq 'network-service'){'server'}else{'effect-worker'}}else{$null}
    if($role){$owned[[int]$item.ProcessId]=$role;$added=$true}elseif(-not $item.ExecutablePath){$partial=$true}
  }
}while($added)
$records=@(foreach($number in $owned.Keys) {
  try{$p=[Diagnostics.Process]::GetProcessById($number);try{[pscustomobject]@{pid=$number;role=$owned[$number];start=$p.StartTime.ToUniversalTime().Ticks.ToString();cpuTicks=$p.TotalProcessorTime.Ticks.ToString();memoryBytes=$p.WorkingSet64}}finally{$p.Dispose()}}
  catch{$partial=$true}
})
[pscustomobject]@{partial=$partial;processes=$records} | ConvertTo-Json -Depth 5 -Compress
