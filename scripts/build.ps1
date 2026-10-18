$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function Assert-NexusOpenRGBArchive([string]$Archive) {
  Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem
  $zip=[IO.Compression.ZipFile]::OpenRead($Archive)
  try {
    foreach($entry in $zip.Entries) {
      $name=($entry.FullName -split '[\\/]')[-1]
      if($name -match '^WinRing.*\.(sys|dll)$'){throw ('WinRing0 não é permitido no pacote: '+$entry.FullName)}
    }
  } finally {$zip.Dispose()}
}
Set-Location -LiteralPath $projectRoot
$buildRoot=Join-Path $projectRoot 'dist\app'
if(Test-Path -LiteralPath $buildRoot){
  $resolvedBuild=[IO.Path]::GetFullPath($buildRoot)
  if($resolvedBuild -ne [IO.Path]::GetFullPath((Join-Path $projectRoot 'dist\app')) -or -not $resolvedBuild.StartsWith($projectRoot+'\dist\',[StringComparison]::OrdinalIgnoreCase)){throw 'Pasta de build fora do projeto.'}
  Remove-Item -LiteralPath $resolvedBuild -Recurse -Force
}
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
foreach($folder in @('server','public','docs')) { Copy-Item -LiteralPath (Join-Path $projectRoot $folder) -Destination $buildRoot -Recurse -Force }
& node scripts/build-info.cjs $buildRoot
if($LASTEXITCODE -ne 0){throw 'Falha ao identificar a versão do pacote.'}
New-Item -ItemType Directory -Path (Join-Path $buildRoot 'scripts'),(Join-Path $buildRoot 'runtime'),(Join-Path $buildRoot 'licenses'),(Join-Path $buildRoot 'sources') -Force | Out-Null
Copy-Item -LiteralPath 'scripts\install-services.ps1' -Destination (Join-Path $buildRoot 'scripts') -Force
Copy-Item -LiteralPath 'scripts\ports.ps1','scripts\configure-ports.ps1','scripts\restart-services.ps1','scripts\install-path.ps1' -Destination (Join-Path $buildRoot 'scripts') -Force
Copy-Item -LiteralPath 'scripts\measure-resources.ps1' -Destination (Join-Path $buildRoot 'scripts') -Force
Copy-Item -LiteralPath 'package.json','package-lock.json','README.md','LEIA-ME.txt','LICENSE.md','THIRD-PARTY-NOTICES.md' -Destination $buildRoot -Force
Copy-Item -LiteralPath 'native\app.ico' -Destination (Join-Path $buildRoot 'app.ico') -Force
Copy-Item -LiteralPath 'runtime\node.exe' -Destination (Join-Path $buildRoot 'runtime\node.exe') -Force
foreach($dependency in @('vendor\PawnIO_setup.exe','vendor\vc_redist.x64.exe','runtime\node.exe')) {
  $signature=Get-AuthenticodeSignature -LiteralPath $dependency
  if($signature.Status -ne 'Valid'){throw "Assinatura digital inválida: $dependency"}
}
$expected=(Get-Content -LiteralPath 'vendor-manifest.json' -Raw | ConvertFrom-Json)
foreach($item in $expected.files){if((Get-FileHash -LiteralPath $item.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw "Integridade inválida: $($item.path)"}}
Assert-NexusOpenRGBArchive (Join-Path $projectRoot 'vendor\openrgb-1.0.zip')
Expand-Archive -LiteralPath 'vendor\openrgb-1.0.zip' -DestinationPath (Join-Path $buildRoot 'openrgb') -Force
$unpackedRoot=[IO.Path]::GetFullPath((Join-Path $buildRoot 'openrgb\OpenRGB Windows 64-bit'))
if(-not $unpackedRoot.StartsWith([IO.Path]::GetFullPath($buildRoot)+'\openrgb\',[StringComparison]::OrdinalIgnoreCase)){throw 'Diretório OpenRGB fora do pacote.'}
Get-ChildItem -LiteralPath $unpackedRoot -Force | Move-Item -Destination (Join-Path $buildRoot 'openrgb') -Force
Remove-Item -LiteralPath $unpackedRoot
if(Test-Path -LiteralPath (Join-Path $buildRoot 'openrgb\WinRing0x64.sys')){throw 'Driver WinRing0 não é permitido.'}
Copy-Item -LiteralPath 'vendor\openrgb-source-1.0.zip' -Destination (Join-Path $buildRoot 'sources') -Force
Copy-Item -LiteralPath 'vendor\openrgb-source\openrgb\LICENSE' -Destination (Join-Path $buildRoot 'licenses\OpenRGB-GPL-2.0.txt') -Force
Copy-Item -LiteralPath 'tools\inno\License.txt' -Destination (Join-Path $buildRoot 'licenses\Inno-Setup.txt') -Force
Copy-Item -LiteralPath 'vendor\Node-LICENSE.txt' -Destination (Join-Path $buildRoot 'licenses\Node.txt') -Force
Copy-Item -LiteralPath 'vendor-manifest.json' -Destination $buildRoot -Force
Push-Location -LiteralPath $buildRoot
try { & npm.cmd ci --omit=dev --ignore-scripts; if($LASTEXITCODE -ne 0){throw 'Falha ao preparar dependências de produção.'}; & npm.cmd audit --omit=dev --audit-level=moderate; if($LASTEXITCODE -ne 0){throw 'Auditoria de dependências falhou.'} }
finally { Pop-Location }
& (Join-Path $PSScriptRoot 'build-native.ps1') -OutputDirectory $buildRoot
Copy-Item -LiteralPath (Join-Path $buildRoot 'NexusRGB-Uninstall.exe') -Destination (Join-Path $projectRoot 'dist\NexusRGB-Uninstall-0.1.0.exe') -Force
$testProcess=Start-Process -FilePath (Join-Path $buildRoot 'NexusRGB.exe') -ArgumentList '--self-test' -WindowStyle Hidden -PassThru -Wait
if($testProcess.ExitCode -ne 0){throw 'Instalação de teste incompleta.'}
# Include each third-party license shipped in node_modules, without developer dependencies.
& node scripts/licenses.js $buildRoot
if($LASTEXITCODE -ne 0){throw 'Falha ao coletar licenças.'}
& (Join-Path $projectRoot 'tools\inno\ISCC.exe') /Qp installer/NexusRGB.iss
if($LASTEXITCODE -ne 0){throw 'Falha ao gerar instalador.'}
$releaseFiles=@('dist\NexusRGB-Setup-0.1.0.exe','dist\NexusRGB-Uninstall-0.1.0.exe')
$checksums=@(foreach($releaseFile in $releaseFiles){ ((Get-FileHash -LiteralPath $releaseFile -Algorithm SHA256).Hash.ToLowerInvariant())+'  '+[IO.Path]::GetFileName($releaseFile) })
[IO.File]::WriteAllLines((Join-Path $projectRoot 'dist\SHA256SUMS.txt'),$checksums,[Text.UTF8Encoding]::new($false))
Get-FileHash -LiteralPath $releaseFiles -Algorithm SHA256 | Format-List
