param([string]$OutputDirectory=(Join-Path $PSScriptRoot '..\dist\cooling'))
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest=Get-Content -LiteralPath (Join-Path $projectRoot 'dependencies\cooling\manifest.json') -Raw | ConvertFrom-Json
$archivePath=Join-Path $projectRoot 'vendor\LibreHardwareMonitor-0.9.6.zip'
New-Item -ItemType Directory -Path (Split-Path -Parent $archivePath) -Force | Out-Null
if(-not (Test-Path -LiteralPath $archivePath)) { Invoke-WebRequest -Uri $manifest.url -OutFile $archivePath -UseBasicParsing }
if((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256){throw 'Integridade da biblioteca de ventilação divergente.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$output=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
$archive=[IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if($archive.Entries | Where-Object {$_.FullName -match '(?i)winring|\.sys$|(^|/)\.\.(/|$)'}){throw 'Dependência inesperada na biblioteca de ventilação.'}
    foreach($file in $manifest.files) {
        if($file.name -notmatch '^[A-Za-z0-9_.-]+\.dll$'){throw 'Nome de biblioteca inválido.'}
        $entry=$archive.GetEntry($file.name)
        if(-not $entry -or $entry.Length -ne $file.size){throw 'Arquivo da biblioteca ausente ou divergente.'}
        $stream=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create()
        try{$hash=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$sha.Dispose()}
        if($hash -ne $file.sha256){throw 'Hash interno de biblioteca divergente.'}
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $output $file.name),$true)
    }
} finally {$archive.Dispose()}
Copy-Item -LiteralPath (Join-Path $projectRoot 'dependencies\cooling\LICENSE'),(Join-Path $projectRoot 'dependencies\cooling\THIRD-PARTY-NOTICES.txt'),(Join-Path $projectRoot 'dependencies\cooling\manifest.json') -Destination $output -Force
$compiler=Join-Path ([Environment]::GetFolderPath('Windows')) 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /codepage:65001 /target:exe /platform:x64 /optimize+ /reference:System.Web.Extensions.dll ('/reference:'+(Join-Path $output 'LibreHardwareMonitorLib.dll')) ('/out:'+(Join-Path $output 'nexus-cooling.exe')) (Join-Path $projectRoot 'native\NexusCoolingBridge.cs')
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o auxiliar de ventilação.'}
# Compilation does not enumerate sensors, request elevation, install a driver or set RPM.
