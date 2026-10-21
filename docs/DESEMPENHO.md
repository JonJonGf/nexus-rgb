# Desempenho do Nexus RGB

## Alpha.40 — interface e agrupamento, 21/10/2026

Comparação da interface da tag `v0.1.0-alpha.39` com a candidata, usando o mesmo backend atual e SDK sintético. Duas rodadas em ordem inversa, Edge novo por cenário, três segundos de aquecimento e cinco amostras por rodada. Fixture: três controladoras, cinco zonas, 92 LEDs, quatro perfis e 32 efeitos, mapa a 20 FPS. [Resultados e escopo completos](benchmarks/2026-10-21-alpha40-ui.json).

| Mapa PT-BR, média de duas rodadas | Alpha.39 | Candidata alpha.40 |
| --- | --- | --- |
| CPU da árvore Edge (% da máquina) | 0,610 | 0,613 |
| Working set somado Edge (MiB) | 525,52 | 525,40 |
| Heap V8 da página (MiB) | 4,15 | 4,12 |
| FPS do renderer sintético | 20 | 20 |

Oito cenários/rodadas concluíram sem erros da página. A variação é pequena e as amostras são curtas; não demonstra ganho significativo nem mede o consumo total do aplicativo. O working set soma vários processos Edge e pode contar páginas compartilhadas mais de uma vez. Exclui instalação real, OpenRGB, supervisor, bandeja, driver e o próprio harness. Não é benchmark de GPU física ou comparação de memória dos dois binários OpenRGB.

A primeira tentativa foi descartada: coincidiu com a suíte geral e foi interrompida pela saída de um processo auxiliar Edge entre as consultas de PID. O sampler foi corrigido para enumerar somente os processos ainda vivos, preservando o escopo da árvore Edge; a execução acima foi repetida sem a suíte concorrente. Resultados parciais da tentativa descartada não entram na tabela.

## Experiências opcionais — candidata de 19/10/2026

Comparação de `1a5026b` com a implementação local de Live/cenas/WLED/áudio/contexto. Duas rodadas em ordens opostas, processo novo por cenário, dois segundos de aquecimento e cerca de dez segundos medidos. Servidor real e `Hardware` com SDK sintético: três controladoras e 92 LEDs, incluindo duas RAMs com a proteção de cadência existente. Sem hardware/USB, navegador, OpenRGB, bandeja ou captura de som real neste benchmark. Chamadas HTTP de gestos/bandas estão incluídas no servidor. [Condições e resultados sanitizados](benchmarks/2026-10-19-experiences.json); script `scripts/benchmark-experiences.cjs`.

| Cenário | Servidor anterior (MiB RSS médio) | Candidata (MiB RSS médio) | CPU da candidata (% da máquina) |
| --- | --- | --- | --- |
| Estático, recursos opcionais desligados | 49,30–53,90 | 53,54–53,94 | 0,064–0,130 |
| Onda, 60 FPS solicitados, opcionais desligados | 56,41–56,64 | 56,78–57,04 | 0,012–0,078 |
| Gestos Live, 60 FPS solicitados | — | 59,86–60,05 | 0,128–0,246 |
| Bandas sintéticas via HTTP, 60 FPS solicitados | — | 55,45–59,66 | 0,155–0,207 |

São amostras curtas, sujeitas a JIT, coleta de lixo e atividade do desktop. Não demonstram ganho estatisticamente significativo de CPU, consumo de toda a aplicação, FPS físico, latência da rede ou estabilidade prolongada. Quadros idênticos continuam deduplicados, portanto envios por segundo não equivalem à taxa lógica solicitada. Nenhuma proteção de RAM foi removida.

Um probe separado de WASAPI, em executável temporário isolado, abriu a saída padrão por 4,038 s: 26 resumos de bandas, zero erros, 15,625 ms de CPU acumulada e 19,33 MiB de working set ao final. Não incluiu interface, serviço HTTP ou processo real da bandeja; não é o acréscimo total de memória da integração. Só energias foram calculadas, sem gravar áudio. O medidor foi testado também com tons sintéticos de 60, 800 e 8.000 Hz. A aparência musical e equipamentos/formatos diferentes precisam de testes reais adicionais.

O custo em repouso é limitado: não há processo novo permanente; WLED não abre socket/timer sem controladora ativa; a captura WASAPI só começa quando habilitada; o Live encerra seu stream e desenho ao sair/ocultar a página. A bandeja reutiliza sua consulta de cinco segundos para ativar/desativar a ponte e mantém eventos de primeiro plano somente quando existem regras habilitadas. Composição limita gestos ativos e reaproveita geometria; a prévia desenha no máximo 4.096 marcadores.

## Observação passiva da candidata instalada — 19/10/2026

A candidata `5b3e246` foi acompanhada por **313,6 segundos**, em 61 consultas de estado: os seis componentes permaneceram online, sem estado inesperado, erro de conexão ou indicação de controlador travado nas amostras. Foram feitas somente leituras; a iluminação existente continuou sem comandos de teste ou reinício de serviços. Isso é observação curta por amostragem, sem leitura de retorno das cores físicas, e não garante estabilidade prolongada ou ausência de falhas entre consultas.

Onze consultas de recursos retornaram leitura **parcial**, com somente serviço de rede, servidor e ponte USB presentes: soma de **91,9–93,9 MiB** e **0–0,1% CPU** observados. Esses valores não incluem o OpenRGB e outros processos inacessíveis, não são o consumo total do Nexus e não devem ser somados a medições antigas para formar um total. A coleta coincidiu com testes e compilação no PC; não é comparação controlada de versões nem medição de efeito ativo específico. Evidências brutas ficam privadas na pasta da auditoria, indicada no contexto.

## Custo de processamento do mapa — 19/10/2026

Microbenchmark local do processamento de `Hardware.tick` com SDK sintético, quatro LEDs por controladora e mapa ativo, comparando `00625c1` com as correções locais da auditoria. Duas ordens de cenários, vinte ciclos medidos após três de aquecimento; tamanhos de cinco a 64 controladoras. O renderer, o navegador, o OpenRGB físico e a latência do barramento **não** fazem parte deste ensaio.

Com **64 controladoras**, a mediana de um ciclo passou de **30,771–32,936 ms para 0,146–0,147 ms**, sem reconstruir snapshots completos após aquecer o cache (antes: 384 por ciclo). A geometria é reutilizada até mudança do mapa ou redescoberta; energia, brilho e exclusões continuam consultados no estado atual. A regressão também verifica edição e nova quantidade de LEDs após descoberta.

Com todas as peças individualmente apagadas, sem clientes de prévia nem worker, a mediana de `Studio.pump` passou de **7,793 ms para 0,177 ms**, e os snapshots de **129 para um** por chamada. Nenhum envio físico foi realizado. O teste de regressão também pega o primeiro ciclo sem cache: antes, 640 reconstruções para 64 controladoras.

São amostras curtas sob atividade normal do desktop; a execução final da candidata ocorreu após os testes gerais e de interface. Esses números demonstram redução do trabalho repetido neste caminho, **não** uma redução equivalente no consumo total, uma medida atual de RAM/CPU do aplicativo inteiro ou correção da causa física do travamento do OpenRGB. Os [dados sanitizados e condições](benchmarks/2026-10-19-map-processing.json) preservam os resultados anteriores e posteriores. A limitação de cadência da RAM não foi reduzida.

## Revisão da candidata após alpha.36 — 18/10/2026

Comparação local entre `8a11684` e a candidata corrigida, sem alterar a instalação real. Ryzen 5 3600, 12 processadores lógicos, Node 24.20.0. O mesmo harness do motor usou SDK simulado, três controladoras, cinco componentes e 92 LEDs; os dois descritores de RAM são SMBus e conservam o limite de 20 FPS. Cada cenário teve três segundos de aquecimento e 21 amostras, com janelas medidas de aproximadamente 27–31 segundos. Os sete cenários foram executados primeiro na baseline e depois na candidata, sem outros benchmarks concorrentes.

### Servidor e processo do efeito, sem navegador/OpenRGB

| Cenário | FPS solicitado | RAM anterior / candidata (MiB RSS) | CPU anterior / candidata |
| --- | ---: | ---: | ---: |
| Estático, mapa desativado | 20 | 50,0 / 50,3 | 0,07% / 0,03% |
| Aurora, sem prévia | 20 | 136,4 / 137,4 | 0,38% / 0,65% |
| Aurora, sem prévia | 60 | 167,3 / 171,6 | 1,02% / 1,24% |
| Aurora, com prévia | 60 | 194,5 / 205,7 | 1,55% / 1,69% |
| HTML sintético próprio, sem prévia | 20 | 243,7 / 245,4 | 0,53% / 0,81% |
| HTML sintético próprio, sem prévia | 60 | 252,8 / 254,8 | 1,07% / 1,56% |
| HTML sintético próprio, com prévia | 60 | 261,3 / 268,9 | 1,41% / 1,93% |

CPU é a fração da máquina inteira. O renderizador acompanhou aproximadamente 20 ou 60 FPS conforme o cenário; isso não mede a taxa física dos LEDs. Sem prévia, o motor inclui apenas servidor e filho do efeito. Com prévia, inclui também a produção/transmissão de PNG, mas não o navegador que o exibiria.

A candidata usou mais CPU nas amostras animadas (diferença de 0,14 a 0,51 ponto percentual) e até 11,3 MiB extras de RSS médio. Esses resultados **não demonstram ganho de desempenho**. São amostras curtas de uma única máquina sob atividade normal de fundo; não isolam a causa, não comprovam estabilidade por horas nem permitem atribuir toda diferença à alteração do mapa. Uma comparação mais longa e repetida deve preceder qualquer promessa de otimização.

### Navegador, medido separadamente

O mapa PT-BR no Edge isolado teve média de **502,5 MiB / 0,95% CPU** com os arquivos de interface anteriores e **508,0 MiB / 0,90% CPU** com os novos. Heap JavaScript médio: **4,05 / 3,92 MiB**. Foram oito execuções em duas ordens invertidas, também incluindo inglês e biblioteca; nenhum erro de página foi observado. O backend era o mesmo durante a troca dos arquivos de interface. A apresentação inicial foi encerrada antes de medir.

RSS do navegador soma processos e pode contar páginas compartilhadas mais de uma vez. Não some esse valor ao do motor para anunciar um total exato. OpenRGB, driver, supervisores e bandeja instalados não fazem parte desses escopos. O comparativo não mede SignalRGB e não certifica ausência de vazamento.

Os [resultados e método em JSON](benchmarks/2026-10-18-review.json) permitem conferir os valores sem arredondamento. As correções de preservação de backup e do instalador não alteram o caminho de renderização exercitado neste ensaio.

<a id="alpha24"></a>

## Edição, energia, diagnóstico e recuperação — v0.1.0-alpha.24 a v0.1.0-alpha.26

Ensaios de 17/10/2026 no Ryzen 5 3600 (6 núcleos / 12 processadores lógicos, 31,89 GiB de RAM), Windows 11 Pro build 26300 (`10.0.26300`), Node v24.20.0. Esta seção separa explicitamente:

1. **Comparações entre versões em ambiente isolado** (`v0.1.0-alpha.23`, commit `2414264f8f061e8866f54759686760f8a9265053`, contra o código de `v0.1.0-alpha.24`–`v0.1.0-alpha.26`, commits `f9df27f` / `4b2eaa2`), executadas com SDK simulado e diretórios temporários.
2. **Variações observadas na mesma versão instalada no host** (`v0.1.0-alpha.23`), que permaneceu em execução nos serviços do Windows durante o ciclo de desenvolvimento porque a substituição da instalação física exige autorização explícita do usuário.

### 1. Comparação entre versões — Interface no navegador (`v0.1.0-alpha.23` vs `v0.1.0-alpha.24`–`alpha.26`)

Duas rodadas contrabalanceadas em ordem inversa (`round 0` e `round 1`) executadas por `node scripts/benchmark-ui.cjs v0.1.0-alpha.23`:
- **Configuração do ensaio:** Microsoft Edge sem janela (`headless: true`, viewport 1366 × 900), 3 controladoras / 5 componentes / 92 LEDs simulados, 4 perfis, 32 efeitos (3 nativos + 29 importados), efeito **Aurora espacial** solicitado a **20 FPS** com prévia SSE ativa.
- **Amostragem:** um processo de navegador novo por cenário; **3 s de aquecimento** seguidos de **5 amostras** com intervalo solicitado de **3 s** (4 intervalos + tempo de coleta PowerShell/CDP, resultando em janela efetiva de **13,43 a 13,49 s** por execução).
- **Escopo da comparação:** nas execuções `baseline`, os arquivos estáticos de interface (`index.html`, `app.js`, `studio.js`, `style.css`, `studio.css`, `spatial.js`) são servidos a partir de `git show v0.1.0-alpha.23:public/<arquivo>` (`2414264`), enquanto nas execuções `novo` são servidos da árvore de trabalho (`f9df27f`/`4b2eaa2`). O servidor isolado de fixture (`tests/fixtures/ui-benchmark-worker.js`) é compartilhado entre as rodadas.

| Cenário (média das 2 rodadas; R0 / R1 entre parênteses) | CPU média do navegador¹ | RAM residente média (RSS)² | Pico de RSS² | Memória privada média³ | Heap JS médio⁴ | Ocupação thread principal⁵ | FPS solicitados / renderizados |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mapa `alpha.23` (`2414264`, PT-BR) | 0,61% (0,64% / 0,58%) | 503,65 MiB (506,31 / 501,00) | 524,54 MiB | 356,89 MiB (360,37 / 353,41) | 3,92 MiB | 1,28% | 20 / 20,00 |
| Mapa novo (`f9df27f`, PT-BR) | 0,58% (0,57% / 0,58%) | 505,13 MiB (508,57 / 501,68) | 525,61 MiB | 355,19 MiB (357,47 / 352,91) | 3,95 MiB | 1,27% | 20 / 20,00 |
| Mapa novo (`f9df27f`, EN) | 0,59% (0,59% / 0,60%) | 508,19 MiB (505,32 / 511,06) | 527,91 MiB | 356,23 MiB (354,98 / 357,49) | 4,10 MiB | 1,29% | 20 / 20,00 |
| Biblioteca aberta (`f9df27f`, EN) | 0,66% (0,66% / 0,66%) | 515,37 MiB (516,76 / 513,97) | 535,97 MiB | 377,31 MiB (379,37 / 375,26) | 4,17 MiB | 1,53% | 20 / 20,00 |

**O que compõe os ~505 MiB desta tabela e como a atribuição foi feita:**
- Em cada amostra (`scripts/benchmark-ui.cjs:31-35`), o script consulta `SystemInfo.getProcessInfo` via sessão CDP do navegador (`browser.newBrowserCDPSession()`), obtém os PIDs de **toda a árvore multiprocesso dedicada do Microsoft Edge** (processo principal `browser`, processo `renderer` da aba, processo `GPU` e subprocessos utilitários de rede/armazenamento do Chromium) e consulta `Get-Process -Id <ids>` no PowerShell.
- A coluna **RAM residente média (RSS)** (~503–515 MiB) soma `WorkingSet64` de todos esses processos Edge; páginas de DLLs do Windows e do próprio Edge mapeadas em múltiplos subprocessos são contadas uma vez por subprocesso. A **memória privada média** (`PrivateMemorySize64` somado da mesma árvore Edge) ficou em **355,19 a 377,31 MiB**, enquanto o **Heap JavaScript V8 da página** (`JSHeapUsedSize` no renderer) foi de apenas **3,92 a 4,17 MiB**.
- **Processos excluídos desta soma:** o próprio script Node do benchmark (`scripts/benchmark-ui.cjs`), o processo de automação do Playwright, o servidor Node do mock SDK (`tests/fixtures/ui-benchmark-worker.js`), o filho `studio-worker.js` e todos os serviços instalados do Nexus/OpenRGB no Windows.
- **Por que não comparar diretamente com o SignalRGB:** (a) quando o painel web do Nexus está fechado, o consumo dessa árvore do navegador é **0 MiB** (apenas os serviços de segundo plano permanecem ativos); (b) a soma bruta de `WorkingSet64` de uma árvore Chromium multiprocesso inclui GPU, utilitários e páginas compartilhadas contadas múltiplas vezes; e (c) o SignalRGB não foi medido neste computador sob condições equivalentes de controladoras, quantidade de LEDs, efeito, FPS e critério de soma de processos.
- **Interpretação da variação:** dentro da própria baseline `alpha.23` (PT-BR), a diferença entre a Rodada 0 e a Rodada 1 foi de **0,05 ponto percentual de CPU** (`0,64%` vs `0,58%`) e **5,31 MiB de RSS** (`506,31` vs `501,00 MiB`); no código novo (PT-BR), a variação entre rodadas foi de **6,89 MiB de RSS** (`508,57` vs `501,68 MiB`). Portanto, a diferença média entre `alpha.23` e o código novo (`0,61%` vs `0,58%` de CPU; `503,65` vs `505,13 MiB` de RSS; `356,89` vs `355,19 MiB` privados) **está dentro do ruído normal de amostragem** e não representa ganho nem regressão de desempenho.

### 2. Comparação entre versões — Servidor Node e motor espacial (`v0.1.0-alpha.23` vs `v0.1.0-alpha.24`–`alpha.26`)

Sete cenários sequenciais executados com `node scripts/benchmark-engine.cjs` tanto na baseline `v0.1.0-alpha.23` (commit `2414264f8f061e8866f54759686760f8a9265053`, em worktree isolada temporária) quanto no código novo (`f9df27f` / `4b2eaa2`):
- **Configuração do ensaio:** API HTTP real do Nexus + classe `Hardware` real conectada a SDK simulado (3 controladoras, 5 componentes, 92 LEDs) + processo filho `server/studio-worker.js`.
- **Amostragem:** **3 s de aquecimento** e **21 amostras** com espera solicitada de **1 s** entre amostras (20 intervalos + tempo de execução do coletor PowerShell, resultando em janela efetiva de **26,58 a 26,96 s** por cenário).
- **Processos incluídos:** exclusivamente o processo Node do servidor (`child`) e, quando o efeito espacial está ativo, o processo filho `studio-worker.js` (`state.worker`). **Excluídos:** navegador, OpenRGB, supervisores `NexusRGB.exe`, bandeja, driver e o processo pai do benchmark.

| Cenário · FPS solicitados | CPU `alpha.23` → novo¹ | RSS médio `alpha.23` → novo² | Pico de RSS `alpha.23` → novo² | Privada média `alpha.23` → novo³ | FPS renderizados (`alpha.23` / novo) | Renderização média (`alpha.23` / novo) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mapa desativado, estático · 20 FPS | 0,06% → 0,03% | 49,22 → 49,04 MiB | 51,15 → 51,08 MiB | 25,71 → 24,91 MiB | 0,00 / 0,00 | 0,00 / 0,00 ms |
| Aurora, sem prévia · 20 FPS | 0,43% → 0,40% | 134,60 → 134,63 MiB | 141,38 → 141,18 MiB | 76,73 → 76,45 MiB | 20,04 / 19,98 | 0,35 / 0,32 ms |
| Aurora, sem prévia · 60 FPS | 0,77% → 0,87% | 161,93 → 163,07 MiB | 184,19 → 186,04 MiB | 111,18 → 112,84 MiB | 60,01 / 59,99 | 0,33 / 0,34 ms |
| Aurora, com prévia · 60 FPS | 1,08% → 1,20% | 185,84 → 187,15 MiB | 188,43 → 189,77 MiB | 141,06 → 141,31 MiB | 60,03 / 60,02 | 0,32 / 0,33 ms |
| HTML próprio, sem prévia · 20 FPS | 0,34% → 0,39% | 232,65 → 232,98 MiB | 243,10 → 244,29 MiB | 227,62 → 229,29 MiB | 20,03 / 20,04 | 0,79 / 0,81 ms |
| HTML próprio, sem prévia · 60 FPS | 0,87% → 0,92% | 251,38 → 252,39 MiB | 256,93 → 257,55 MiB | 234,50 → 235,55 MiB | 59,99 / 60,05 | 0,74 / 0,72 ms |
| HTML próprio, com prévia · 60 FPS | 1,11% → 1,08% | 260,70 → 262,16 MiB | 275,63 → 277,21 MiB | 244,43 → 245,26 MiB | 60,02 / 59,96 | 0,76 / 0,72 ms |

**Interpretação:** os sete cenários mantiveram a taxa alvo (20 ou 60 FPS) e tempos médios de renderização equivalentes (`0,32–0,35 ms` em Aurora; `0,72–0,81 ms` no HTML Canvas próprio). As oscilações de `0,03` a `0,12` ponto percentual de CPU e de `0,18` a `1,46 MiB` de RSS/memória privada entre as duas execuções sequenciais ocorrem em ambos os sentidos e estão dentro da variação normal de agendamento do Windows e coleta de lixo do V8.

### 3. Variação observada na mesma versão instalada no host (`v0.1.0-alpha.23`)

Como a instalação física deste PC permaneceu na `v0.1.0-alpha.23` (`2414264f8f061e8866f54759686760f8a9265053`) aguardando autorização do usuário para atualizar o serviço real, as duas leituras pontuais abaixo mostram **apenas a oscilação normal em repouso da própria `v0.1.0-alpha.23` instalada** antes e depois de rodar a bateria de testes isolados — **não medem o consumo da `v0.1.0-alpha.24`–`alpha.26` instalada**:

| Processo instalado (`v0.1.0-alpha.23` / `2414264`) | Leitura inicial em repouso | Leitura após bateria isolada |
| --- | ---: | ---: |
| `NexusRGB.exe --tray` (bandeja, Sessão 1) | 38,22 MiB RSS (27,48 MiB privada) | 41,92 MiB RSS (29,89 MiB privada) |
| `NexusRGB.exe --service` (supervisor do painel, Sessão 0) | 22,29 MiB RSS (17,27 MiB privada) | 22,75 MiB RSS (17,27 MiB privada) |
| `NexusRGB.exe --hardware-service` (supervisor OpenRGB, Sessão 0) | 22,62 MiB RSS (17,18 MiB privada) | 23,06 MiB RSS (17,18 MiB privada) |
| `runtime\node.exe` (servidor do painel, Sessão 0) | 52,98 MiB RSS (32,12 MiB privada) | 56,99 MiB RSS (33,00 MiB privada) |
| `openrgb\OpenRGB.exe` (controlador SDK, Sessão 0) | 26,82 MiB RSS (7,26 MiB privada) | 26,82 MiB RSS (7,26 MiB privada) |

### 4. Definições das métricas e cálculo de CPU

- ¹ **Percentual de CPU (`cpuPercentOfMachine` / `cpuPercent`):** representa a fração da **capacidade total da máquina considerando todos os 12 processadores lógicos** (`os.cpus().length = 12` / `os.availableParallelism() = 12`), onde `100%` equivale aos 12 threads saturados simultaneamente:
  - Em `scripts/benchmark-ui.cjs:39`: `100 * (cpuFinal - cpuInicial) / segundosDecorridos / 12`, onde `cpu` soma `cpuTime` (em segundos) de todos os processos da árvore Edge via `SystemInfo.getProcessInfo`.
  - Em `scripts/benchmark-engine.cjs:75`: `100 * (cpuFinal - cpuInicial) / segundosDecorridos / 12`, onde `cpu` soma `Get-Process.CPU` (tempo acumulado de kernel + usuário em segundos) do servidor Node e do `studio-worker.js`.
  - Em `server/resources.js:19` (painel de saúde em Configurações): `Math.min(100, (ticks - old.ticks) / 10000 / (at - old.at) / processors * 100)`, convertendo `TotalProcessorTime.Ticks` (`10.000` ticks de `100 ns` por milissegundo) pelo intervalo decorrido em `ms` e dividindo pelos processadores lógicos.
- ² **RAM residente / Working Set (`WorkingSet64` / RSS):** páginas atualmente residentes na RAM física (`bytes / 1.048.576`). Quando somada entre múltiplos processos, páginas compartilhadas de DLLs/executáveis podem ser contadas mais de uma vez.
- ³ **Memória privada (`PrivateMemorySize64`):** memória virtual comprometida exclusivamente por cada processo. É uma métrica distinta do *Working Set* e **não deve ser somada** à coluna de RSS.
- ⁴ **Heap JS (`JSHeapUsedSize`):** memória ocupada pelo heap V8 do processo `renderer` da página; já está contida na memória do navegador e **não deve ser somada** ao RSS ou à memória privada.
- ⁵ **Ocupação da thread principal (`mainThreadBusyPercent`):** `100 * (TaskDurationFinal - TaskDurationInicial) / segundosDecorridos` no processo `renderer` da página.

[Dados da interface (`alpha.23` vs novo)](benchmarks/2026-10-17-alpha24-ui.json) · [Dados do motor (`alpha.23`)](benchmarks/2026-10-17-alpha23-engine.json) · [Dados do motor (novo)](benchmarks/2026-10-17-alpha24-engine.json). Limites: ensaios em processos isolados com SDK simulado não comprovam a suavidade física dos LEDs no controlador real.

<a id="alpha15"></a>

## Mapa e motor — v0.1.0-alpha.15

Ensaios de 16/10/2026 no Ryzen 5 3600, 12 processadores lógicos, Windows 10.0.26300, Node v24.20.0. Dados e LEDs simulados em processos dedicados, sem alterar serviços ou luzes da instalação. CPU usa a capacidade total da máquina, não um único núcleo. Memória soma conjuntos de trabalho e pode contar páginas compartilhadas mais de uma vez.

### Navegador

Edge sem janela, 1366 × 900, 3 controladoras/5 componentes/92 LEDs simulados, 4 perfis e 32 efeitos próprios, Aurora a 20 FPS com prévia. Duas rodadas em ordem inversa, navegador novo a cada cenário, aquecimento de 3 segundos e cinco amostras com intervalo solicitado de 3 segundos; janela efetiva próxima de 13,3 segundos. Somente a interface alpha.14 foi substituída na comparação; o backend foi compartilhado e usa o código da candidata.

| Cenário | CPU do navegador | RAM residente média | Pico de RAM | Heap JS médio |
| --- | ---: | ---: | ---: | ---: |
| Mapa alpha.14, português | 0,54% | 486,05 MiB | 504,88 MiB | 3,89 MiB |
| Mapa novo, português | 0,62% | 489,39 MiB | 509,91 MiB | 3,88 MiB |
| Mapa novo, inglês | 0,60% | 493,00 MiB | 510,64 MiB | 4,00 MiB |
| Biblioteca nova, inglês | 0,68% | 503,08 MiB | 522,21 MiB | 3,88 MiB |

O mapa novo acrescentou cerca de 0,08 ponto percentual de CPU e 3,34 MiB residentes em média neste ensaio. A biblioteca tem mais controles e elementos. Não houve erros JavaScript, e a última métrica do motor foi 20 FPS em todas as rodadas. Duas janelas curtas não demonstram estabilidade prolongada nem ausência de vazamentos.

Esta tabela inclui apenas os processos Edge dedicados. Heap JavaScript é uma parte da memória do navegador e não deve ser somado à RAM. Servidor, motor, OpenRGB, serviços, bandeja, driver, coletor e programas em segundo plano estão fora da soma. A central de consumo, que consulta o Windows quando Configurações está aberta, não foi exercitada nestes cenários de mapa/biblioteca.

### Servidor e motor

Sete cenários sequenciais no mesmo servidor, SDK simulado de 92 LEDs e duas fontes próprias: receita Aurora e um HTML Canvas de barras. Cada cenário teve três segundos de aquecimento e 21 amostras, com intervalo solicitado de um segundo; coleta acrescenta tempo e a janela efetiva ficou em cerca de 26 segundos.

| Cenário | CPU de servidor + motor | RAM residente média | Pico de RAM | FPS renderizados |
| --- | ---: | ---: | ---: | ---: |
| Mapa desativado, estático · 20 FPS solicitados | 0,02% | 47,99 MiB | 49,62 MiB | 0,00 |
| Aurora, sem prévia · 20 FPS solicitados | 0,41% | 132,71 MiB | 139,48 MiB | 20,01 |
| Aurora, sem prévia · 60 FPS solicitados | 0,83% | 157,11 MiB | 182,66 MiB | 60,05 |
| Aurora, com prévia · 60 FPS solicitados | 1,06% | 184,41 MiB | 185,62 MiB | 59,98 |
| HTML próprio, sem prévia · 20 FPS solicitados | 0,35% | 209,29 MiB | 243,63 MiB | 20,03 |
| HTML próprio, sem prévia · 60 FPS solicitados | 0,81% | 250,50 MiB | 255,93 MiB | 59,99 |
| HTML próprio, com prévia · 60 FPS solicitados | 1,04% | 260,86 MiB | 277,07 MiB | 59,98 |

O limite de 20/60 FPS foi acompanhado nesses dois efeitos sintéticos. O valor de chamadas ao SDK não mede a taxa física de LEDs: com 60 FPS, são aproximadamente 180 chamadas/s somadas nas três controladoras simuladas. O estático não reenviou LEDs na janela estável. Efeitos importados mais complexos, controladoras lentas e contagens maiores podem reduzir a taxa.

Esta tabela inclui servidor Node e seu processo de efeitos, sem navegador, OpenRGB, supervisores, bandeja, driver ou coletor PowerShell. Como os cenários são sequenciais, retenção de memória, aquecimento e coleta de lixo podem afetar diferenças. Ela não representa o consumo total do aplicativo instalado. Não some os ensaios de datas/escopos diferentes como uma única medição simultânea. GPU, energia, temperatura, inicialização, suspensão e uso durante horas não foram medidos.

[Dados da interface](benchmarks/2026-10-16-improvements-ui.json) · [Dados do motor](benchmarks/2026-10-16-improvements-engine.json). Reprodução: `node scripts/benchmark-ui.cjs v0.1.0-alpha.14 data/ui-benchmark.json` e `node scripts/benchmark-engine.cjs data/engine-benchmark.json`. Ambos usam dados temporários e SDK simulado.


## Interface do mapa e inglês — v0.1.0-alpha.13

Comparativo de 15/10/2026 no Ryzen 5 3600, 12 processadores lógicos, Windows 10.0.26300, Node v24.20.0 e Edge sem janela, em 1366 × 900. A aplicação usou SDK simulado com 3 controladoras, 5 componentes, 92 LEDs, 4 perfis e 32 efeitos próprios. Aurora espacial solicitada a 20 FPS, com prévia ativa. Os dois idiomas usam tradução local.

| Cenário | CPU média do navegador¹ | RAM residente média² | Pico de RAM residente² | Heap JavaScript médio³ |
| --- | ---: | ---: | ---: | ---: |
| Mapa anterior (alpha.12, português) | 0,58% | 520,53 MiB | 538,11 MiB | 3,54 MiB |
| Mapa novo (português) | 0,53% | 519,43 MiB | 537,36 MiB | 3,74 MiB |
| Mapa novo (inglês) | 0,54% | 523,68 MiB | 539,38 MiB | 3,78 MiB |
| Biblioteca aberta (inglês) | 0,60% | 525,54 MiB | 544,82 MiB | 3,91 MiB |

¹ Percentual da capacidade total dos 12 processadores lógicos, somando os processos do navegador dedicado. Não é o percentual de um único núcleo. ² Soma dos conjuntos residentes dos processos Edge; páginas compartilhadas podem ser contadas mais de uma vez. O navegador inteiro ocupa muito mais que o heap JavaScript da página. ³ Memória do V8 do renderizador, sem imagens, GPU e outras alocações; não deve ser somada à coluna de RAM.

Cada cenário teve duas rodadas, em ordem inversa na segunda, com navegador novo por rodada, aquecimento de 3 segundos e 5 amostras separadas por 3 segundos solicitados. A coleta acrescentou tempo: cada janela medida durou cerca de 13,3 segundos. O servidor e o processo de efeitos foram compartilhados entre cenários; as fontes da interface anterior foram lidas da tag alpha.12. Não houve erros JavaScript e a última métrica do motor foi 20 FPS em todas as rodadas; isso não mede a taxa física dos LEDs.

O mapa novo ficou próximo do anterior nesse ensaio curto. A diferença pequena de CPU/RAM não demonstra um ganho garantido: são apenas duas rodadas, com coleta de lixo, agendamento e variação de memória do navegador. A biblioteca e o inglês acrescentaram pouco consumo observado. O heap oscilou e terminou abaixo do início em cada janela, mas isso não prova ausência de vazamentos durante horas.

**Esta tabela inclui apenas o navegador. Não inclui servidor, motor, OpenRGB, supervisores, bandeja, driver nem o processo de coleta.** Os ensaios abaixo medem outros escopos e datas; não devem ser somados a esta tabela como se fossem uma única medição simultânea. Edge sem janela e SDK simulado não reproduzem exatamente uma janela visível, o celular ou o acesso remoto. GPU, energia, temperatura, inicialização e longa duração não foram medidos.

[Dados das duas rodadas](benchmarks/2026-10-15-map-ui.json). Para repetir no Windows com Edge e dependências de desenvolvimento: `node scripts/benchmark-ui.cjs v0.1.0-alpha.12 data/ui-benchmark.json`. O ensaio cria dados temporários e usa apenas um SDK simulado; não se conecta à instalação ou às luzes reais.


## Prévia compartilhada — v0.1.0-alpha.10

Ensaio de 15/10/2026 com Arco-íris comum, limite solicitado de 60 FPS, SDK simulado de 3 controladoras/5 componentes/92 LEDs, Ryzen 5 3600 e Node 24.20.0. A soma inclui somente o servidor Node. Assistir ao controle comum não iniciou um processo Canvas.

| Cenário | CPU média da máquina | RAM residente média | Pico de RAM residente | Tráfego da prévia |
| --- | ---: | ---: | ---: | ---: |
| Arco-íris sem prévia | 0,065% | 51,27 MiB | 51,38 MiB | — |
| Arco-íris com prévia | 0,104% | 54,45 MiB | 55,75 MiB | 17,91 KiB/s |

Cada linha teve aquecimento de 3 segundos e 21 amostras, com janela efetiva de aproximadamente 26 segundos. CPU é a diferença do contador cumulativo dividida pelo tempo efetivo e pelos 12 processadores lógicos. Os cenários ocorreram na ordem da tabela, no mesmo processo; retenção de memória e ruído de amostragem impedem atribuir toda diferença exclusivamente à prévia.

O controlador simulado recebeu aproximadamente 37–39 atualizações por segundo por controladora, apesar do limite solicitado de 60. Isso mede chamadas de software, sem medir LEDs físicos. O motor espacial permaneceu sem quadros renderizados porque a visualização apenas transmitiu o cache das cores que o efeito comum já enviava.

**OpenRGB, supervisores, bandeja, navegador e driver não estão incluídos.** Desenhar as peças no navegador acrescenta consumo, não medido aqui. Não é uma medição do aplicativo completo ou garantia para outros PCs. O [JSON do ensaio](benchmarks/2026-10-15-common-preview.json) registra os valores sem arredondamento.

## Motor espacial — medição de 15/10/2026

Ensaio isolado do motor espacial em desenvolvimento em 15/10/2026, no Ryzen 5 3600 com 12 processadores lógicos, 31,89 GiB de RAM, Windows 11 build 26300 e Node 24.20.0. A coleta antecede as alterações de edição ao vivo da v0.1.0-alpha.9.

Esta tabela inclui **servidor Node e processo de efeitos**. A classe de hardware é a mesma da aplicação, conectada a um SDK simulado com 3 controladoras, 5 componentes e 92 LEDs. **OpenRGB, serviços, bandeja, navegador e driver ficam fora da soma.** Portanto, os valores não representam o consumo total do aplicativo instalado.

| Cenário | FPS solicitados | FPS renderizados¹ | CPU média² | RAM residente média³ | Pico de RAM residente³ | Renderização média |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mapa desativado, cor estática | 20 | 0 | 0,015% | 48,01 MiB | 49,51 MiB | — |
| Aurora espacial, sem prévia | 20 | 20,06 | 0,372% | 132,82 MiB | 139,90 MiB | 0,34 ms |
| Aurora espacial, sem prévia | 60 | 60,06 | 0,593% | 156,97 MiB | 182,45 MiB | 0,30 ms |
| Aurora espacial, com prévia | 60 | 60,04 | 0,969% | 184,58 MiB | 185,69 MiB | 0,31 ms |
| HTML próprio de barras, sem prévia | 20 | 20,00 | 0,339% | 197,86 MiB | 220,74 MiB | 0,78 ms |
| HTML próprio de barras, sem prévia | 60 | 59,87 | 1,055% | 250,24 MiB | 255,24 MiB | 0,71 ms |
| HTML próprio de barras, com prévia | 60 | 60,13 | 1,100% | 254,10 MiB | 258,34 MiB | 0,71 ms |

¹ Quadros concluídos divididos pelo tempo medido; pequenas diferenças acima de 60 decorrem dos limites da janela e dos relógios de amostragem. A taxa física dos LEDs **não foi medida**. O SDK simulado não reproduz atrasos USB/SMBus, congestionamento ou limites do OpenRGB.

² Percentual da capacidade total dos 12 processadores lógicos. Não é a porcentagem de um único núcleo.

³ Soma dos conjuntos residentes do servidor e do filho. Pode contar páginas compartilhadas mais de uma vez; a memória privada é outra métrica, disponível no relatório JSON.

### Método e interpretação

Cada cenário teve aquecimento de 3 segundos e 21 amostras, com espera solicitada de 1 segundo entre elas. A consulta de processos acrescentou tempo: as janelas efetivas ficaram entre 26,11 e 26,53 segundos. A CPU usa a diferença do contador cumulativo de CPU dos processos dividida pelo tempo efetivo e por 12. RAM média e pico usam as mesmas amostras; o tempo de renderização é a média dos últimos quadros observados em cada consulta.

Os cenários foram executados na ordem da tabela, no mesmo servidor; o processo de efeitos foi recriado ao trocar o efeito/configuração. O servidor pode reter memória alocada, e o coletor de lixo pode agir em momentos diferentes. A diferença entre linhas não isola somente o custo do efeito. Estes números não demonstram ausência de vazamentos.

O HTML usado no ensaio é um exemplo próprio, com 64 barras coloridas desenhadas a cada quadro, sem arquivos externos ou áudio. A prévia usa PNG 320 × 200 e as últimas cores enviadas por LED, por SSE, com limite de 10 FPS; nesses cenários, o tráfego medido ficou em aproximadamente 27–28 KiB/s. O navegador que apresenta a imagem e desenha os marcadores acrescenta seu próprio consumo, não medido aqui.

O processamento de 60 FPS foi viável nesses dois efeitos e nesse ambiente. O envio ao SDK simulado acompanhou a renderização: cerca de 60 chamadas de LEDs por segundo no total a 20 FPS, e 180 a 60 FPS, distribuídas pelas três controladoras. Isso não comprova que um controlador físico processe essa taxa. Efeitos mais complexos podem atingir o orçamento de execução, e controladoras reais podem entregar menos atualizações. O padrão permanece **20 FPS**. Aumentar FPS implica mais CPU e comandos; reduza-o se o equipamento apresentar atraso.

Uma sondagem local separada verificou 28 arquivos HTML fornecidos para compatibilidade: 25 renderizaram 20 quadros sem erro; 2 exigiam áudio do SignalRGB, não suportado, e 1 excedeu o orçamento de desenho. Esse ensaio curto não comprova equivalência visual, funcionamento de todas as opções ou estabilidade prolongada. Os arquivos desses criadores não foram redistribuídos.

O [resumo em JSON](benchmarks/2026-10-15-studio.json) registra os valores e o escopo. A coleta inclui envio imediato de quadros e dados de saída por LED; antecede ajustes posteriores de diagnóstico, atualização de status em prévias estáticas/pausadas e espera do envio antes de publicar a imagem. Não é uma nova aferição de cada linha do código final. GPU, energia elétrica, temperatura, inicialização e horas/dias de uso não foram medidos.

### Edição ao vivo do mapa

O arraste move a peça apenas no navegador até soltar; nesse momento, envia e salva a posição. Edições por teclado e campos são agrupadas em até uma requisição a cada 350 ms. Cada envio aceito salva a configuração de forma atômica. Mudar a geometria preserva o processo e a fase do efeito espacial e atualiza a amostragem no próximo quadro disponível; efeitos estáticos recalculam a amostra quando as posições mudam. Os testes confirmam a troca de cores sem recriar o processo e a preservação do efeito comum ao editar posições. O custo de um arraste prolongado não foi aferido separadamente nas tabelas acima.

## Aplicativo completo — referência histórica de 13/10/2026

Medição real realizada em **13/10/2026**, na versão instalada **0.1.0**, com os serviços do Nexus RGB, OpenRGB e ícone da bandeja em execução. Os números abaixo representam este equipamento e estas configurações; não são requisitos mínimos nem uma garantia para todos os PCs.

A medição é de 13/10/2026 e antecede as alterações posteriores de recuperação de conexão, instalação, perfis e portas. Os valores não representam uma nova aferição de cada prévia publicada.

## Identificar processos no Windows

O Nexus usa serviços que iniciam antes do login, além de um ícone executado na sessão do usuário. Eles podem aparecer separados no Gerenciador de Tarefas. O supervisor já mantém seus filhos em Job Objects para encerrar processos corretamente; isso não determina um grupo visual único no Gerenciador.

| Parte | Processo esperado |
| --- | --- |
| Serviço do painel | `NexusRGB.exe --service`, serviço `NexusRGB`, com um filho `runtime\node.exe` executando `server\index.js` |
| Acesso ao RGB | `NexusRGB.exe --hardware-service`, serviço `NexusRGBHardware`, com um filho `openrgb\OpenRGB.exe` |
| Ícone perto do relógio | `NexusRGB.exe --tray`, na sessão do usuário |
| Motor espacial | Um filho Node executando `server\studio-worker.js`, enquanto um efeito espacial está ativo e há luzes ou clientes de prévia; observar efeitos comuns não abre esse processo. Uma validação de importação pode abrir outro processo temporário |
| Janela do painel | Processos do navegador escolhido pelo Windows/Nexus |

Na aba **Serviços**, localize `NexusRGB` e `NexusRGBHardware` e use **Ir para detalhes** para identificar seus PIDs. Na aba **Detalhes**, habilite as colunas **PID** e **Linha de comando**; alguns dados de serviços exigem abrir o Gerenciador como administrador. PIDs mudam ao reiniciar. Confira o caminho da instalação para distinguir esses filhos de outros programas que também usam Node.

Processos Node pertencentes ao Codex, editores ou outras aplicações não devem ser somados ao consumo do Nexus. O título `Node.js` sozinho não identifica qual aplicativo o iniciou. Renomear o executável ou definir `process.title` não garante um nome/grupo no Gerenciador; a [documentação do Node](https://nodejs.org/api/process.html#processtitle) também registra essa limitação. AppUserModelIDs controlam [agrupamento de janelas na barra de tarefas](https://learn.microsoft.com/en-us/windows/win32/shell/appids), sem oferecer por si só a árvore solicitada de serviços no Gerenciador.

## Equipamento e configuração

| Item | Configuração medida |
| --- | --- |
| Processador | AMD Ryzen 5 3600, 6 núcleos / 12 processadores lógicos |
| Memória informada pelo Windows | 31,89 GiB |
| Sistema | Windows 11 Pro, versão 10.0.26300, build 26300 |
| Controladoras físicas | 3: duas ENE DRAM e uma ASUS TUF GAMING A520M-PLUS II |
| Componentes no painel | 5: duas memórias RAM, iluminação da placa-mãe, ARGB 1 e ARGB 2 |
| LEDs configurados | 92: RAM 8 + 8, placa-mãe 4, ARGB 36 + 36 |
| Cor de referência | `#00ff7c` |
| Brilho / ritmo | 100% / 17% |
| Integração Alexa | Habilitada |

Nos cenários ligados, o RGB foi controlado pelo Nexus. A onda é um efeito calculado pelo aplicativo; a cor de referência, brilho e ritmo foram mantidos. O efeito muda as cores dos LEDs ao longo do tempo.

## Consumo total

Os totais incluem o servidor Node, o OpenRGB, os dois supervisores dos serviços e a bandeja. **O navegador não está incluído.**

| Cenário | Janela | CPU média | Pico de CPU¹ | RAM residente média² | Pico de RAM residente² | Memória privada média³ | Pico de memória privada³ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Luzes desligadas, sem animação | 40 s | 0,065% | 0,395% | 187,38 MiB | 187,41 MiB | 136,61 MiB | 136,66 MiB |
| Estático, luzes ligadas | 30 s | 0,035% | 0,393% | 187,68 MiB | 187,71 MiB | 136,89 MiB | 136,96 MiB |
| Onda, luzes ligadas | 30 s | 0,468% | 1,037% | 187,86 MiB | 188,03 MiB | 137,18 MiB | 137,58 MiB |

¹ Pico observado entre as amostras de aproximadamente 1 segundo, e não um máximo instantâneo.

² Soma dos *working sets*: páginas residentes em RAM dos processos. Bibliotecas compartilhadas podem aparecer em mais de um processo; o total pode contar essas páginas mais de uma vez.

³ Memória privada comprometida de cada processo. É uma métrica diferente do *working set* e **não deve ser somada** à RAM residente.

A diferença pequena de CPU entre desligado e estático está sujeita ao ruído de uma janela curta, à resolução dos contadores e a tarefas periódicas. Ela não demonstra que ligar os LEDs melhora o desempenho. Na onda, o aumento veio principalmente do processo OpenRGB, que recebeu as atualizações de animação.

## Consumo por processo

Valores médios durante cada cenário ligado. A CPU está expressa como porcentagem da capacidade total dos **12 processadores lógicos**.

| Processo | CPU estático | RAM residente estático | Privada estático | CPU onda | RAM residente onda | Privada onda |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Servidor Node / painel LAN | 0,004% | 69,05 MiB | 67,62 MiB | 0,056% | 69,20 MiB | 67,79 MiB |
| OpenRGB / controle do hardware | 0,030% | 26,21 MiB | 7,21 MiB | 0,412% | 26,21 MiB | 7,21 MiB |
| Supervisor do serviço de rede | 0,000% | 22,27 MiB | 16,96 MiB | 0,000% | 22,28 MiB | 17,01 MiB |
| Supervisor do serviço de hardware | 0,000% | 21,86 MiB | 16,96 MiB | 0,000% | 21,86 MiB | 16,97 MiB |
| Ícone da bandeja | 0,000% | 48,29 MiB | 28,15 MiB | 0,000% | 48,30 MiB | 28,21 MiB |

`0,000%` significa que não houve aumento mensurável do contador de CPU nessa janela. Não significa que um processo sempre consome zero CPU.

## Como foi medido

1. Os processos foram identificados pelo registro dos serviços do Windows, pela relação entre processos pai e filho e pelo executável da bandeja. Processos de compilação, ferramentas de medição e outros programas ficaram fora do grupo.
2. Em cada amostra, `Win32_Process` forneceu `KernelModeTime`, `UserModeTime`, `WorkingSetSize` e `PrivatePageCount`. O tempo cumulativo de CPU foi obtido pela soma dos tempos de kernel e usuário fornecidos pelo CIM.
3. A CPU foi calculada pela diferença desse tempo cumulativo entre amostras. A média usa a janela inteira; o pico usa cada intervalo observado.
4. O cenário desligado teve 41 amostras em 40 segundos. Estático e onda tiveram aquecimento de 3 segundos, seguido por 31 amostras em 30 segundos. O intervalo solicitado foi de 1 segundo e o tempo efetivamente decorrido foi usado no cálculo.
5. A configuração principal e os ajustes individuais foram guardados em um perfil temporário e restaurados ao terminar a coleta. O perfil temporário foi removido. Os serviços, as zonas e as autorizações da Alexa permaneceram inalterados.

```text
tempo_CPU = (KernelModeTime + UserModeTime) / 10.000.000
CPU_% = 100 × diferença(tempo_CPU) / segundos_decorridos / 12
memória_MiB = bytes / 1.048.576
```

Para repetir a análise em outro PC, identifique os processos instalados por serviço e árvore, use a quantidade de processadores lógicos daquele equipamento e registre a quantidade de LEDs, brilho, ritmo e efeito. Preserve os ajustes antes de alternar os cenários. Uma mudança do usuário durante a coleta deve invalidar o cenário, em vez de ser sobrescrita pelo teste.

## Limites da análise

- É uma amostra curta de um único PC, com 92 LEDs configurados. Mais LEDs, outros protocolos/controladoras e outros efeitos podem mudar o consumo.
- CPU e memória do navegador, ferramentas de compilação/medição e alocações do driver no kernel não foram contabilizadas.
- GPU, consumo elétrico em watts, temperatura e duração de bateria não foram medidos.
- Os picos dependem da frequência e da resolução das amostras. A análise não comprova ausência de vazamento de memória nem estabilidade por horas ou dias.
- Na versão histórica medida, a agenda usava intervalos de 50 ms. A versão atual permite 5–60 FPS; a taxa efetiva do hardware não foi medida neste ensaio histórico.

O [resumo em JSON](benchmarks/2026-10-13.json) contém os valores sem arredondamento para consulta e comparação.

## Desenho dos doze padrões — 16/10/2026

Uma medição isolada do desenho nativo e da leitura de pixels 320 × 200, com Node 24.20.0 em um Ryzen 5 3600, usou dez quadros de aquecimento e cem amostras por padrão. Os quatro padrões anteriores tiveram médias de 0,648 a 0,688 ms; os oito novos, de 1,410 a 1,729 ms. O percentil 95 dos novos ficou entre 1,460 e 1,990 ms. Os novos campos são calculados em uma superfície 80 × 50 reutilizada e ampliados com suavização.

Os [resultados brutos](validation/2026-10-16-patterns.json) medem somente esse trecho do motor. Excluem IPC, compressão PNG, navegador, amostragem do mapa, tráfego SDK, OpenRGB e drivers; não são uma nova medição da CPU ou memória total do aplicativo. Os efeitos HTML importados têm custo próprio e podem exceder os orçamentos do motor.

A prévia JSON é local ao navegador e para ao fechar. A prévia HTML usa um processo temporário separado, acompanha a taxa configurada para o motor e transmite até dez imagens por segundo. Assim, scripts que avançam por quadro não são executados apenas a 10 FPS por causa da taxa de exibição. Há somente uma prévia HTML por servidor; pausar, fechar, perder autorização ou exceder os limites encerra o processo. Testar um HTML pesado pode aumentar temporariamente o consumo.
