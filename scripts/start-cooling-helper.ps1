param(
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][ValidatePattern('^NexusRGB\.Cooling\.Dev\.[a-f0-9]{32}$')][string]$Pipe,
    [Parameter(Mandatory=$true)][ValidateRange(1,2147483647)][int]$ParentPid,
    [switch]$Fixture
)
$ErrorActionPreference='Stop'
$resolved=[IO.Path]::GetFullPath($Executable)
if(-not [IO.Path]::IsPathRooted($Executable) -or [IO.Path]::GetFileName($resolved) -ne 'nexus-cooling.exe' -or -not (Test-Path -LiteralPath $resolved -PathType Leaf)){throw 'Invalid cooling helper executable.'}
if($resolved.Contains('"') -or $resolved.Contains("`r") -or $resolved.Contains("`n")){throw 'Invalid cooling helper path.'}
$null=Get-Process -Id $ParentPid -ErrorAction Stop
$mode=if($Fixture){'--fixture'}else{'--hardware'}
$commandLine='"'+$resolved+'" '+$mode+' --pipe '+$Pipe+' --parent '+$ParentPid
$startup=New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}
# WMI creates an independent process outside the network service's kill-on-close
# Job. Its own watchdog can release fan controls when that service dies. Never
# weaken the RGB supervisor's Job policy or force-kill this helper on shutdown.
$result=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$commandLine;CurrentDirectory=[IO.Path]::GetDirectoryName($resolved);ProcessStartupInformation=$startup}
if($result.ReturnValue -ne 0 -or -not $result.ProcessId){throw 'Cooling helper could not be launched.'}
Write-Output ([int]$result.ProcessId)
