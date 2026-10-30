# Retomada da ventilação após iniciar — alpha.42

## Pedido e reprodução

Em 30/10 o usuário pediu que canais, sensores, curva e ativação voltem após iniciar o PC, sem repetir detecção e configuração. A regra anterior de sempre iniciar desligado foi substituída por essa decisão explícita.

Reprodução inicial pelo HTTP: ativar curva manual, parar toda a aplicação e criar outra instância usando a mesma pasta. As associações eram carregadas, mas o controle permanecia off e não abria o auxiliar. A ativação não era persistida e o ciclo start do app não retomava Cooling. O arquivo instalado lido nessa sessão tinha zero associações/perfis, o que não permite reconstruir escolhas não presentes nele; nenhum estado instalado foi escrito durante a investigação.

## Implementação

- `Cooling.start()` inicia a retomada em segundo plano; não bloqueia HTTP, Alexa ou RGB. A intenção é persistida somente depois de uma aplicação bem-sucedida. Nenhum write de configuração por tick/quadro foi adicionado.
- Associações e curvas continuam no arquivo privado separado `cooling.json`. Registro do perfil aplicado é independente do banco editável: uma edição ainda não aplicada não muda o próximo boot nem o gráfico apresentado como curva em uso.
- Antes de escrever na retomada, confere IDs, nomes e modelo informados dos canais/sensores e uma amostra recente de temperatura. O hash de identidade não mede ligação física nem distingue universalmente duas peças idênticas. Não adivinha nem reassocia por índice.
- Dependências tardias são aguardadas com recuo limitado a oito tentativas. Falta de leituras válidas não apaga as curvas nem assume controle. Incompatibilidade de identidade bloqueia a retomada para revisão.
- Desligar módulo salva a escolha off, cancela timer e invalida operações pendentes antes de emitirem comandos antigos. Encerrar o serviço libera o controle para o firmware e mantém a escolha salva para o próximo start.
- Encerrar monitoramento somente leitura não cancela a escolha salva; possui comando próprio. Navegar durante uma retomada não é interpretado como desligar o controle.
- Metadados de retomada danificados deixam o controle desarmado e as configurações básicas válidas visíveis, sem sobrescrever o arquivo original ao carregar.
- Interface PT/EN mostra retomada salva, pendente ou bloqueada. Novas instalações continuam off. Arquivos antigos sem intenção persistida exigem uma ativação/aplicação no build novo; não se presume autorização de controlar hardware a partir de um arquivo legado.

## Regressões e limites

Onze regressões HTTP exercitam novo start com a mesma pasta: curva manual; banco editado sem aplicar; serviço tardio; temperatura inválida; identidade de outra placa; cancelamento no meio da amostra; aplicação recusada; escolha off; tentativas esgotadas; metadado danificado; encerramento de monitoramento sem perder intenção. Falhas foram observadas antes das correções correspondentes. O limite de fila, pisos de controle, proteção térmica e watchdog existentes foram preservados.

O teste Edge reinicia o servidor inteiro na mesma origem e verifica sensores/RPM, ponto editado, traçado Suave e controle ativo sem detectar novamente; também cobre perfil pendente/aplicado, espera, cancelamento, tradução e 390 px. Capturas desktop/celular inspecionadas. A expectativa antiga de sempre voltar off foi atualizada nos testes conforme a decisão do usuário, mantendo novos testes de off explícito e bloqueios.

Antes do commit: **305/305** testes gerais e **68/68** Edge passaram sem retries na revisão final; 28 contratos direcionados e oito Edge de ventilação também passaram após ajustes. Pacote/gates serão registrados no fechamento. Nenhum teste físico de reboot, RPM real ou sensor real foi executado. Não reiniciar o Windows automaticamente para completar uma simulação.

## Desempenho

Benchmark isolado com duas repetições inversas, base `981fa7b`, SDK simulado (três controladoras, cinco componentes, 92 LEDs), Aurora a 20 FPS e auxiliar C# fixture. Soma Node + worker + auxiliar quando ativo; sem navegador, OpenRGB real ou I/O físico. Não mede watts, ruído, refrigeração ou consumo total instalado.

| Cenário | CPU média total | RSS médio | Memória privada | FPS |
| --- | --- | --- | --- | --- |
| Base off | 0,395% | 131,75 MiB | 68,81 MiB | 20,04 |
| Candidata off | 0,362% | 134,13 MiB | 69,07 MiB | 20,04 |
| Monitoramento simulado | 0,405% | 164,72 MiB | 90,57 MiB | 20,05 |
| Equilibrado simulado | 0,418% | 166,33 MiB | 92,78 MiB | 20,02 |
| TURBO simulado | 0,362% | 165,15 MiB | 91,12 MiB | 20,06 |

Auxiliar ausente off. Custo observado de Equilibrado sobre off: ~32,19 MiB RSS / 23,71 MiB privados. Working sets podem duplicar páginas compartilhadas; duas repetições não demonstram ganho de CPU. Não foi adicionado processo permanente por fan/sensor. [Dados sem identificadores pessoais](../benchmarks/2026-10-30-cooling-startup.json).

## Git e entrega

Código, pacote publicado e instalação real devem ser diferenciados no contexto. Até este registro inicial, trabalho ainda local na branch `codex/cooling-startup`, sem nova tag/release/instalação. A base instalada observada foi alpha.41; guias e notas alpha.42 foram preparados. Confirmação atual do proprietário é necessária antes de UAC/instalação. Fontes nativas e dependências de hardware não foram alteradas nesta correção.


### Preparação da tag e processo separado

Código/runtime `8fc5d48ba592464b1b00b74c50b83f0a32244754`, tag `v0.1.0-alpha.42`. Build local carimbou a tag/development false e passou na auditoria de produção, contrato do pacote off/sem auxiliar e 12 cenários Inno PT/EN. Uma validação privada adicional iniciou três processos Node independentes: retomada da curva suave em 55% no segundo, off persistente e zero aberturas do auxiliar no terceiro. Backend sintético, sem reboot do Windows.

[Workflow de publicação](https://github.com/JonJonGf/nexus-rgb/actions/runs/41098984384) em andamento nesta nota. As três análises da tag passaram e havia zero alertas abertos na consulta. Instalação real continua pendente de autorização atual; nenhuma ação física foi feita para produzir esses resultados.

### Fechamento da publicação

A [alpha.42](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.42) foi publicada no runtime/tag acima. Logs finais das duas VMs comprovam o ciclo de instalação/reinstalação/remoção; o job publish registra a publicação às 17:43:58 UTC de 30/10. Consultas de status retornaram etapas atrasadas mesmo após os logs finais e a release pública. Nenhum gate foi flexibilizado.

Os cinco assets oficiais foram baixados e verificados contra digests GitHub; BUILD-INFO confirmou tag, commit, run `41098984384`, tamanhos/hashes dos três executáveis/ZIP e SHA256SUMS confirmou os mesmos arquivos. Setup: **87.418.937 bytes**, SHA256 `d4a630c9064629211d353f4f3d701897312216c2bd86a817f4406af976913f38`.

Usuário autorizou a instalação nesta sessão após o pacote verificado e backup privado. Instalador oficial aberto com progresso, sem PawnIO ou reinício do Windows. A instalação e o teste físico são resultados separados; fechamento no contexto. As notas anteriores representam os estados de cada etapa, não ausência atual de publicação.

### Instalação autorizada no PC

Setup terminou com **código 0**; build-info instalado confirma alpha.42/`8fc5d48...`/development false. Dois serviços Running e bandeja na sessão interativa. Health pronto, controlador conectado, seis componentes e detecção encerrada. Configurações de ventilação, iluminação e rede idênticas ao backup e 38 arquivos de efeitos preservados. Arquivos alterados de runtime/UI conferidos; `en.js` tinha somente diferença de finais CRLF/LF, texto idêntico após normalização.

Windows não reiniciado e nenhum acionamento físico de fans foi usado para provar retomada. Usuário deve aplicar/ativar uma vez para registrar a intenção ausente em legado e conferir no próximo início normal. Testes automatizados e instalação bem-sucedida não comprovam RPM, associação física ou reboot real.
