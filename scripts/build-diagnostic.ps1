param([string]$OutputDirectory=(Join-Path $PSScriptRoot '..\dist\diagnostics'))
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
$compiler=Join-Path ([Environment]::GetFolderPath('Windows')) 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /codepage:65001 /target:winexe /platform:x64 /optimize+ ('/win32icon:'+(Join-Path $projectRoot 'native\app.ico')) /reference:System.Web.Extensions.dll /reference:System.Management.dll /reference:System.ServiceProcess.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ('/out:'+(Join-Path $output 'NexusRGB-Diagnostic.exe')) (Join-Path $projectRoot 'native\NexusDiagnostic.cs')
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o diagnóstico portátil.'}
$binary=Join-Path $output 'NexusRGB-Diagnostic.exe'
$hash=(Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $output 'SHA256SUMS.txt'),($hash+'  NexusRGB-Diagnostic.exe'+[Environment]::NewLine),[Text.Encoding]::ASCII)
$help=@'
NEXUS RGB - GPU DIAGNOSTICS - DEVELOPMENT CANDIDATE

PORTUGUES
1. Extraia este ZIP e abra NexusRGB-Diagnostic.exe no PC com o problema.
2. Confira a porta do painel Nexus (padrao 5050) e clique em Coletar.
3. Revise o JSON. Resumo dos logs e opcional e vem desmarcado.
4. Salvar grava o relatorio escolhido. Envie o JSON manualmente se desejar.

Nao muda RGB, nao instala drivers, nao reinicia e nao faz upload.
Logs protegidos podem ficar indisponiveis. Administrador e opcional;
o programa nao solicita UAC nem se eleva automaticamente.
Candidato sem assinatura propria: confira o hash e mantenha as protecoes
do Windows. O relatorio nao confirma fisicamente a cor dos LEDs.

ENGLISH
Extract this ZIP. Run NexusRGB-Diagnostic.exe on the affected PC.
Check the panel port (default 5050), select categories and click Collect.
Review the exact JSON before Save. Share the JSON manually if you choose.
No RGB writes, driver installs, restarts or uploads. Log signatures are
optional. Protected logs may be unavailable; elevation is never automatic.
This unsigned development tool does not physically confirm LED colors.

SOURCE AND DOCUMENTATION
https://github.com/JonJonGf/nexus-rgb
native/NexusDiagnostic.cs - scripts/build-diagnostic.ps1
docs/DIAGNOSTICO-GPU.md - docs/en/GPU-DIAGNOSTIC.md
Original Nexus code: MIT. See LICENSE.txt.
'@
[IO.File]::WriteAllText((Join-Path $output 'LEIA-ME-README.txt'),$help,[Text.Encoding]::ASCII)
Copy-Item -LiteralPath (Join-Path $projectRoot 'LICENSE.md') -Destination (Join-Path $output 'LICENSE.txt') -Force
Compress-Archive -LiteralPath $binary,(Join-Path $output 'SHA256SUMS.txt'),(Join-Path $output 'LEIA-ME-README.txt'),(Join-Path $output 'LICENSE.txt') -DestinationPath (Join-Path $output 'NexusRGB-GPU-Diagnostic-dev.zip') -Force
Get-FileHash -LiteralPath $binary,(Join-Path $output 'NexusRGB-GPU-Diagnostic-dev.zip') -Algorithm SHA256 | Select-Object Path,Hash
