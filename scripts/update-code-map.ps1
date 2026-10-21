# Development-only: no Nexus endpoint, service or device is accessed.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolRoot = (& uv tool dir)
if ($LASTEXITCODE -ne 0) { throw 'uv indisponível. Consulte docs/agents/graphify.md.' }
$python = Join-Path $toolRoot 'graphifyy\Scripts\python.exe'
$graphify = Join-Path $toolRoot 'graphifyy\Scripts\graphify.exe'
if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath $graphify)) {
    throw 'Graphify não está instalada no uv. Consulte docs/agents/graphify.md.'
}
& $python -c "import importlib.metadata,sys; sys.exit(0 if importlib.metadata.version('graphifyy') == '0.9.93' else 1)"
if ($LASTEXITCODE -ne 0) { throw 'Versão Graphify diferente de 0.9.93; revise o adaptador antes de atualizar.' }
$outputRoot = Join-Path $projectRoot 'graphify-out'
$rawRoot = Join-Path $outputRoot 'raw'
$backupRoot = Join-Path $outputRoot ('history\' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss') + '-' + [Guid]::NewGuid().ToString('N'))
foreach ($name in @('graph.json', 'graph.html', 'GRAPH_REPORT.md', 'MAP_AUDIT.json')) {
    $source = Join-Path $outputRoot $name
    if (Test-Path -LiteralPath $source) {
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination (Join-Path $backupRoot $name)
    }
}
$previousBackend = [Environment]::GetEnvironmentVariable('GRAPHIFY_BACKEND', 'Process')
Push-Location -LiteralPath $projectRoot
try {
    $env:GRAPHIFY_BACKEND = 'none'
    & $graphify extract $projectRoot --out $rawRoot --code-only --max-workers 2
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar a extração original; veja o diagnóstico acima.' }
    & $python (Join-Path $PSScriptRoot 'refine-code-map.py') --root $projectRoot --input (Join-Path $rawRoot 'graphify-out\graph.json') --out $outputRoot
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao refinar o mapa; cópia anterior preservada em history.' }
    & $graphify cluster-only $projectRoot
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar relatório/visualização; cópia anterior preservada em history.' }
    $audit = Get-Content -LiteralPath (Join-Path $outputRoot 'MAP_AUDIT.json') -Raw | ConvertFrom-Json
    $note = @"

## Nexus: escopo e relações pendentes

Mapa de navegação conservador: $($audit.pending_edges) relações não confirmadas foram
separadas em MAP_AUDIT.json, não apagadas da extração original em raw/graphify-out/graph.json.
O selo EXTRACTED não prova execução ou resolução completa. Autorrelações restantes
podem ser recursões reais. HTML/CSS têm cobertura de arquivos e referências explícitas,
não de comportamento completo de DOM/estilos. Testes e benchmarks estão fora desta vista.
Atualize com scripts/update-code-map.ps1 para preservar essas regras.
"@
    Add-Content -LiteralPath (Join-Path $outputRoot 'GRAPH_REPORT.md') -Value $note -Encoding utf8
} finally {
    Pop-Location
    [Environment]::SetEnvironmentVariable('GRAPHIFY_BACKEND', $previousBackend, 'Process')
}
