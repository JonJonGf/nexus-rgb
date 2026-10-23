# Alpha.41 — revisão dos alertas de segurança

## Cobertura e resultado inicial

O commit `562b3ee` ampliou a compilação acompanhada pelo CodeQL para incluir `NexusCoolingBridge.cs` e `NexusDiagnostic.cs`, além do supervisor/broker. As três análises mantêm `security-extended` e modelo de ameaça local. Doze alertas novos foram examinados individualmente no SARIF, incluindo origem, sink e chamadas; não foram removidas regras, arquivos ou testes, nem alterada formatação para perder fingerprints.

## Fluxos examinados

| Alertas | Origem e operação | Avaliação |
| --- | --- | --- |
| #105–107 | `NEXUS_BENCH_ROOT`, `scripts/benchmark-cooling.cjs`, carregamento dos módulos para comparação | O pai do benchmark fixa raiz atual ou arquivo Git extraído para pasta privada. É uma ferramenta local de execução deliberada do código comparado, não uma rota ou função do serviço instalado. Quem controla o ambiente dessa ferramenta já controla o código que manda executar. Falso positivo no escopo do produto. |
| #108–110 | `NEXUS_UI_EVIDENCE_DIR`, `tests/ui/cooling.spec.js`, diretório opcional das capturas | O executor local escolhe onde salvar evidências de teste. Não entra no produto instalado, não recebe texto do navegador/rede e não cruza privilégio. Falso positivo; não é sanitização de entrada remota. |
| #111–112 | `SystemRoot` nos executores de fixtures nativas | Caminho do compilador Framework do Windows usado pelo operador de testes. `spawnSync` sem shell, argumentos próprios, sem rota HTTP. Ambiente local é configurado por quem executa o teste; sem elevação ou fronteira de segurança nova. Falso positivo. |
| #113–114 | `SystemRoot`, `server/cooling-bridge.js`, executável PowerShell | Origem do alerta é o caminho do executável do Windows, não comando recebido pela API. No pacote instalado, as opções são obtidas do marcador/arquivos protegidos e caminho fixo; o caminho oficial usa broker do serviço. Nos modos locais, `execFile` usa vetor sem shell; ramo elevado usa literais PowerShell escapados. A API não escolhe shell, script ou binário. Falso positivo desse fluxo, não uma dispensa genérica de processos. |
| #115 | `CommonApplicationData`, leitura fixa de `app/service.log` e `hardware/service.log` | Origem SARIF é o diretório de dados do Windows, com nomes literais fixos. Coletor lê no máximo 256 KiB e só exporta contagens permitidas; não escreve, executa ou eleva privilégios. Fixture de log é invocação local explícita. Falso positivo de path injection; logs continuam protegidos por ACL. |
| #116 | `SpecialFolder.Windows`, PowerShell no broker nativo | Origem SARIF é o diretório do Windows. O serviço SYSTEM escolhe script/binário fixos sob raiz protegida. Antes do lançamento confere processo cliente real do pipe, PID/parent da instância instalada, schema e pipe aleatório por regex; argumentos numéricos e pipe não aceitam texto arbitrário. Sem seletor de executável ou comando vindo do HTTP. Falso positivo desse fluxo. |

As dispensas específicas como **false positive** são revisão manual documentada, não correções de código anunciadas. Alertas novos/diferentes devem continuar bloqueando a release até revisão. Exemplos hostis de schema, PID, pipe, executable extra e JSON inválido são recusados nas fixtures do broker; nenhuma prova simulada é anunciada como resposta mecânica.

## Defeito real encontrado no CI

O teste de delegação esperava auxiliar compilado, presente neste checkout mas ausente no runner limpo. O CI falhou antes de atingir o broker. A preparação foi corrigida: compilar a dependência fixada antes de `npm test`, tanto no workflow comum quanto na validação do instalador. Não foi pulado o teste nem flexibilizada sua expectativa. Nova execução remota obrigatória antes da publicação.
