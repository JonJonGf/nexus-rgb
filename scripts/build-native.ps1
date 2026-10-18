param([string]$OutputDirectory=(Join-Path $PSScriptRoot '..\dist\native'))
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
# These are the same two entry points, references and compiler options used by the installer build.
$compiler=Join-Path ([Environment]::GetFolderPath('Windows')) 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$native=Join-Path $projectRoot 'native'
$common=@('/nologo','/codepage:65001','/target:winexe','/platform:x64','/optimize+',('/win32icon:'+(Join-Path $native 'app.ico')))
& $compiler @common ('/out:'+(Join-Path $output 'NexusRGB.exe')) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.ServiceProcess.dll (Join-Path $native 'NexusRGB.cs') (Join-Path $native 'AppInfo.cs') (Join-Path $native 'Locale.cs')
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o executável nativo.'}
& $compiler @common ('/out:'+(Join-Path $output 'NexusRGB-Uninstall.exe')) /reference:System.Windows.Forms.dll (Join-Path $native 'NexusRGBUninstall.cs') (Join-Path $native 'AppInfo.cs') (Join-Path $native 'Locale.cs')
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o assistente de desinstalação.'}
& $compiler /nologo /codepage:65001 /target:exe /platform:x64 /optimize+ ('/out:'+(Join-Path $output 'nexus-hid.exe')) (Join-Path $native 'NexusHidBridge.cs')
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o executável de ponte HID.'}
