$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$manifest=Get-Content -LiteralPath vendor-manifest.json -Raw | ConvertFrom-Json
foreach($item in $manifest.files) {
  $target=[IO.Path]::GetFullPath((Join-Path $projectRoot $item.path))
  if(-not $target.StartsWith($projectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Caminho de dependência fora do projeto.'}
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
  if(-not(Test-Path -LiteralPath $target)){Invoke-WebRequest -Uri $item.url -OutFile $target}
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw "A dependência mudou ou foi corrompida: $($item.path). Não será executada."}
}
foreach($file in @('vendor\PawnIO_setup.exe','vendor\vc_redist.x64.exe','runtime\node.exe','tools\inno-installer.exe')) {if((Get-AuthenticodeSignature -LiteralPath $file).Status -ne 'Valid'){throw "Assinatura inválida: $file"}}
. (Join-Path $PSScriptRoot 'openrgb-package.ps1')
Assert-NexusHeadlessArchive (Join-Path $projectRoot 'dependencies\openrgb-headless\windows-x64-18e2c95.zip') (Join-Path $projectRoot 'dependencies\openrgb-headless\provenance.json')
if(-not(Test-Path -LiteralPath 'tools\inno\ISCC.exe')){
  $compilerDirectory=Join-Path $projectRoot 'tools\inno'
  $installer=(Resolve-Path -LiteralPath 'tools\inno-installer.exe').Path
  $process=Start-Process -FilePath $installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CURRENTUSER','/NOICONS',('/DIR="'+$compilerDirectory+'"')) -WindowStyle Hidden -PassThru -Wait
  if($process.ExitCode -ne 0){throw 'Falha ao preparar Inno Setup.'}
}
if(-not(Test-Path -LiteralPath 'tools\inno\ISCC.exe')){throw 'Compilador Inno Setup não encontrado.'}
Write-Output 'Dependências verificadas e preparadas.'
