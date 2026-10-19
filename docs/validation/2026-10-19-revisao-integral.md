# Revisão integral do código — 19/10/2026

**Nota posterior:** o conteúdo abaixo preserva a evidência da auditoria antes das alterações. Os quatorze achados confirmados foram posteriormente corrigidos no código local, com regressões e limites registrados no [relatório de implementação](2026-10-19-correcoes-auditoria.md). S01 permanece em investigação; instalação/publicação são etapas distintas.

## Escopo, base e conclusão

Ampliação solicitada pelo usuário após a auditoria inicial: analisar todo o código do Nexus, incluindo servidor, painel, execução de efeitos, transportes, aplicação Windows, instalação e publicação. Base local: `00625c150a431bcb4ccfaa293470d6f3b065594f`, com a correção de hardware `d14be36` já presente. Nenhum arquivo de produto foi alterado nesta ampliação.

Foram inventariados **156 arquivos versionados** de código/configuração/validação. A [matriz de cobertura](2026-10-19-cobertura-revisao.md) lista cada arquivo e diferencia leitura manual do produto/ferramentas, análise de configuração e inventário/verificação dos testes. Não significa auditoria linha a linha das implementações de dependências, binários ou de todos os testes históricos. `node_modules`, `vendor`, `runtime`, `dist`, dados privados e efeitos pessoais não integram a revisão manual de primeira parte.

**Oito novos tipos de defeito foram reproduzidos**, além dos seis pendentes da [auditoria inicial](2026-10-19-auditoria-alpha37.md). São **quatorze pendências confirmadas** no conjunto: doze nos caminhos do produto/processamento, uma na ferramenta de inventário e uma nos encoders experimentais desativados. As duas correções anteriores de entrega/cadência e a correção da simulação SSE permanecem apenas no repositório local. Há também um risco de diagnóstico identificado estaticamente, que precisa de validação no contexto do serviço Windows.

Não houve instalação, publicação, push, UAC, reinício de serviços, alteração de driver/proteção ou comandos RGB físicos. Os experimentos usaram armazenamento descartável, SDK/HID artificiais e navegador isolado. Os executáveis Windows compilados para conferir o código ficaram nos dados privados e não foram instalados nem executados; o teste separado do supervisor executou somente seus filhos artificiais.

## Novas reproduções

### A10 — P1 — Confirmação USB atravessando reconexão pode bloquear o teclado

**Sequência:** enviar um comando ao teclado sintético e manter sua confirmação pendente; reconectar o SDK com sucesso; completar a confirmação anterior; solicitar outra cor; executar mais cinco ciclos. Resultado: somente um envio USB no total, embora o SDK esteja novamente conectado. O comando novo nunca chega.

**Local:** `server/hardware.js`, `sendLeds`/`connect`. O callback retorna ao detectar outra geração antes de retirar a entrada de `nativePending`. A reconexão limpa outros caches, mas não essa entrada; os ciclos seguintes continuam vendo um comando em voo que nunca será finalizado.

**Correção proposta:** definir o ciclo de vida da confirmação nativa independentemente da geração SDK, com descarte/retomada explícitos. Uma confirmação antiga não deve apagar uma entrada nova nem deixar a anterior presa. Regressões precisam cobrir os dois transportes ativos, desconexão durante ACK, remoção do teclado e desligamento. **Pendente; reprodução sem HID real.**

### A11 — P2 — Cor e movimento individuais do teclado são ignorados

**Sequência:** controle geral em Onda/vermelho; definir Estático/azul somente para o teclado; atualizar pelo caminho real de `Hardware.tick` → `ControllerRegistry`. Snapshot passa a indicar Estático/azul, mas o último pacote continua no modo `0x01`/vermelho e não há segundo envio.

**Local:** `server/controllers/index.js`, `addKeyboardController`, ramo sem `nativeMode`. As expressões escolhem `masterSettings.effect` e `masterSettings.color` antes das substituições individuais. O SDK e o painel utilizam a precedência oposta.

**Correção proposta:** centralizar a resolução de ajustes efetivos do teclado, distinguindo sincronização, substituição individual e modo interno explícito. Testar cor, efeito e retorno ao controle geral, sem reintroduzir streaming contínuo. **Pendente.**

### A12 — P2 — Efeito válido impede configurar portas

**Sequência:** arquivo de ajustes JSON válido, com parâmetros de efeito distintos `Speed` e `speed`; executar a instrução de leitura usada pelo configurador no Windows PowerShell 5.1. O parser rejeita o arquivo antes da transação de portas.

**Local:** `scripts/configure-ports.ps1`, leitura de `alexaEnabled` com `ConvertFrom-Json`. O servidor aceita parâmetros que diferem por maiúsculas/minúsculas; o parser do PowerShell 5.1 não representa esse objeto. O backup de atualização já contém uma solução específica para essa classe de entrada, mas o configurador ainda não.

**Correção proposta:** obter somente a preferência necessária por um parser compatível, sem alterar nomes/parâmetros de efeitos nem usar interpretação textual insegura do JSON. Exercitar a transação com esse arquivo e garantir que a falha não pare serviços. A reprodução executou a instrução original sobre arquivo sintético; não abriu o configurador instalado. **Pendente.**

### A13 — P3 — Inventário sobrescreve as portas durante coleta do firewall

**Sequência:** carregar `{PanelPort:5050, SDKPort:6743, AlexaPort:80}`; executar o bloco original de coleta de regras com adaptadores Windows artificiais. Ao terminar, `SDKPort` passa de `6743` para ausente.

**Local:** `scripts/audit-installed-config.ps1`, variável `$ports` dentro de `ForEach-Object`. Ela substitui a configuração carregada no início. A consulta SDK e o relatório posterior passam a receber um filtro de firewall em vez das portas configuradas.

**Correção proposta:** separar a variável do filtro por regra da configuração global e testar o relatório completo com adaptadores de leitura. Não altera o controle RGB em execução; afeta a ferramenta de evidência. **Pendente.**

### A14 — P2 — Conflito de edição do mapa não se recupera em inglês

**Sequência no Edge real:** abrir mapa; salvar uma mudança por outro cliente para `x=0,82`; mover localmente com uma revisão anterior e receber HTTP 409.

| Idioma | Resultado local | Recuperação |
| --- | --- | --- |
| Português | `Mapa atualizado por outro dispositivo`, posição `0,82` | Sincroniza sem botão de repetição |
| Inglês | `Could not save`, posição local `0,81` | Mantém rascunho conflitante e botão de repetição |

**Local:** `public/studio.js`, tratamento de erro em `saveLayout`; `public/app.js`, tradução em `api`. O tratamento reconhece o conflito procurando uma frase em português, mas a mensagem já foi traduzida para inglês. O servidor continua protegendo o mapa contra sobrescrita; o defeito é a recuperação do cliente.

**Correção proposta:** propagar status/código estável no erro da API e tratar 409 sem depender do idioma. Regressão real de navegador nos dois idiomas deve verificar a posição local e a revisão, não apenas o arquivo do servidor. **Pendente.**

### A15 — P1 — Recuperação de mapa inválido descarta o original

**Sequência:** salvar mapa sintético contendo uma posição identificável e contagem inválida; iniciar Studio, que corretamente preserva o arquivo e mostra recuperação de configuração; executar `recover('retry')`. Resultado: ajustes originais substituídos, layout gravado vazio, nenhuma cópia `invalid-studio-*`. A configuração gravada diz `enabled:true`, mas a configuração efetiva continua `enabled:false`.

**Local:** `server/studio.js`, `recoveryConfig`/`recover`. A recuperação grava a configuração sanitizada, sem passar pela preservação implementada em `configure`, e mantém a sobreposição temporária de recuperação. A tentativa pode perder posições recuperáveis de um arquivo parcialmente inválido e ainda não reativar o mapa.

**Correção proposta:** nenhuma ação de recuperação deve substituir o original sem preservação atômica. Unificar a transação de recuperação e configuração, com revisão de layout consistente; se for necessária revisão manual, informar isso sem anunciar retomada. Testar falha de disco, reinício e mapa parcialmente válido. **Pendente. A reprodução não tocou o mapa do usuário.**

### A16 — P2 — Estado Canvas após `restore` diverge do navegador

**Sequência com HTML próprio:** escolher azul; `save()`; escolher vermelho; `restore()`; ler `fillStyle`, atribuir novamente e desenhar. No Canvas do Edge, o pixel é azul `[0,0,255]`; no caminho QuickJS/Canvas do Nexus, vermelho `[255,0,0]`.

**Local:** `server/studio-sandbox.txt`, propriedades de estilo e fila de `save`/`restore`; interação com `server/studio-render.js` e a implementação Canvas utilizada. Os getters locais preservam a última atribuição, sem acompanhar a pilha de estado. A mesma leitura na biblioteca Canvas nativa também divergiu; comparar somente dois caminhos que usam essa biblioteca não seria uma referência independente suficiente.

**Correção proposta:** modelar/restaurar os estados expostos pelo adaptador Canvas e conferir paridade contra navegador real em `save`, `restore` e redefinição de dimensões. Não ampliar os métodos permitidos nem executar HTML no painel. É incompatibilidade com uma combinação de APIs anunciadas, não evidência de escape do sandbox. **Pendente.**

### A17 — P3 — Encoders experimentais interpretam brilho zero como máximo

**Sequência:** chamar os encoders Corsair, Razer, Nollie e Cooler Master com uma cor vermelha e `brightness:0`. Os quatro geram canal vermelho `255` em vez de `0`.

**Local:** `server/controllers/protocol-corsair.js`, `protocol-razer.js`, `protocol-nollie.js`, `protocol-coolermaster.js`; a mesma expressão está nos modelos Gigabyte/MSI de `protocol-motherboard.js`. O fallback `Number(brightness) || 100` troca zero por cem. Os quatro primeiros foram exercitados; a extensão aos outros dois foi identificada por leitura da expressão, sem novo ensaio físico.

**Correção proposta:** distinguir ausência/valor inválido de zero e validar limites de entrada dos modelos antes de futura habilitação física. **Não é um defeito observado no RGB instalado:** o registro impede o envio físico desses protocolos não validados. Manter esse bloqueio e não anunciar compatibilidade com base nos testes de buffers. **Pendente no código experimental.**

## Desempenho: extensão de A07

Além do custo de `Hardware.tick` já medido na auditoria inicial, foi exercitado `Studio.pump` com o mapa ativado, energia geral ligada e todos os componentes individualmente apagados. Nenhum cliente de prévia, worker ou comando físico; quatro LEDs por controladora sintética. Três aquecimentos e 25 chamadas medidas por caso, mesmo processo/máquina da auditoria inicial.

| Controladoras | Snapshots completos por chamada | Mediana de processamento | Máximo observado |
| --- | --- | --- | --- |
| 5 | 11 | 0,203 ms | 0,393 ms |
| 16 | 33 | 1,418 ms | 1,678 ms |
| 32 | 65 | 1,978 ms | 2,490 ms |
| 64 | 129 | 7,793 ms | 10,183 ms |

O timer verifica esse caminho a cada 8 ms; a checagem de atividade refaz layout/snapshots antes de concluir que não há luz ativa. Esse trabalho ocorre mesmo sem renderização. É mais evidência da mesma A07, não outra ocorrência contada separadamente. Não é medição de CPU percentual ou consumo físico a 60 FPS; a ordem crescente e o aquecimento do processo também influenciam os tempos. O número de snapshots e sua repetição são determinísticos no ensaio.

A melhoria deve reduzir reconstruções de topologia por revisão e separar mudanças de configuração de eventos de quadro, preservando detecção gradual, calibração, exclusões e envio do último estado. Primeiro manter ensaios equivalentes; não prometer economia de memória com base na contagem de arquivos/pasta ou na aprovação dos testes.

## Risco identificado por leitura — validação adicional

**Atualização posterior:** S01 foi confirmado pela comparação de leitura da candidata instalada com a conta interativa e recebeu [correção local com regressões](2026-10-19-conflitos-windows.md). O parágrafo seguinte preserva a hipótese original; não representa o estado atual da implementação. Instalação/validação sob LocalService ainda são etapas separadas.

**S01 — contexto de usuário na detecção da Iluminação Dinâmica:** `server/conflicts.js` consulta `HKCU` usando `reg.exe`, enquanto `scripts/install-services.ps1` registra o serviço de rede como `LocalService`. O código não seleciona explicitamente o usuário interativo cuja preferência se pretende apresentar. Isso pode produzir diagnóstico de outro contexto ou um falso negativo. Os testes atuais injetam resultados prontos, e o teste de consulta real verifica apenas os tipos retornados. Confirmar em VM com preferência distinta entre usuário e serviço; não alterar Registro/proteções do PC para demonstrar a hipótese. Não contado entre as quatorze pendências reproduzidas.

## Verificações concluídas e resultados negativos úteis

- **118 fontes JavaScript/bridge:** verificação de sintaxe aprovada, incluindo scripts e testes versionados.
- **13 arquivos PowerShell:** parser de AST sem erros de sintaxe; isso não implica correção de transações ou de APIs Windows.
- **C#:** os três executáveis compilaram em saída privada usando os argumentos do builder; nenhum instalado. O teste real e isolado do supervisor passou: reinício de filho artificial, encerramento gracioso e fallback do Job para filho travado.
- **26 cenários de navegação no Edge:** seis abas em português/inglês, desktop `1366×768` e celular `390×844`, mais Iluminação em paisagem `844×390`. Nenhum erro JavaScript, transbordamento horizontal ou corte da barra de cenas observado nesses casos. Não cobre todos os estados, diálogos, navegadores ou zooms.
- **Erro de gravação da Store:** a reprodução da auditoria inicial recusou a alteração e preservou memória/disco; não foi confirmado o palpite de ajuste fantasma por falha de gravação.
- **Canvas:** uma comparação inicial com a mesma biblioteca nativa reproduziu o comportamento incorreto dos dois lados; a referência foi corrigida para Canvas do Edge antes de confirmar A16.
- **Traduções:** 833 entradas conferidas estruturalmente; chave `cores` repetida com o mesmo valor. Redundância sem alteração de comportamento observada; não contada como defeito funcional.
- **Proteções examinadas:** limites de importação/memória/tempo, whitelist Canvas e de assets HTTP, origem/Host, separação de administração local, SDK loopback, identidades de processos, backups de upgrade, limites de transporte e bloqueio de encoders físicos experimentais. Nenhum novo escape reproduzido nesta ampliação. Isso não certifica ausência de vulnerabilidades.

Os **220 testes gerais e 43 de navegador** aprovados no checkpoint anterior continuam sendo o resultado da suíte existente sobre o mesmo código de produto. Não foram repetidos sem alteração para produzir outro total. Os probes novos falham deliberadamente nos sintomas acima e ainda não foram promovidos a regressões versionadas: isso deve ocorrer antes de cada correção. CodeQL remoto e auditoria de dependências citados no primeiro relatório antecedem esta ampliação; não se apresenta uma nova execução remota como realizada.

## Ordem de correção e limites

1. **Integridade e disponibilidade:** A15 (preservar mapa), A03 (referências/backup), A02/A10 (independência e ciclo de vida dos transportes).
2. **Controles coerentes:** A11/A04 (ajustes e participação do teclado), A05/A06 (perfis e formato), A14 (conflitos nos dois idiomas), A12 (portas com parâmetros válidos).
3. **Processamento e compatibilidade:** A07 (topologia/caminhos ociosos), A16 (estado Canvas), A13 (inventário), A17 (modelos não habilitados). S01 demanda validação de contexto Windows.

Os achados permanecem pendentes; esta etapa ampliou a análise e o registro, sem modificar o produto. A causa inicial do bloqueio físico do OpenRGB continua indeterminada. A correção local anterior para a RAM presa ao trocar efeito ainda exige empacotamento e teste físico autorizado. Release/tag e instalação continuam alpha.37; não foi criada outra versão por esta revisão.

Evidências privadas: `data/audit-20261019-082159/`, arquivos `expanded-results.json`, `powershell-results.json`, `conflict-language-results.json`, `recovery-canvas-results.json`, `idle-map-cost-results.json`, `ui-sweep-results.json`, `expanded-static-results.json`, `expanded-powershell-syntax.json` e respectivos probes. Nenhum dado bruto do computador foi incluído neste relatório público.
