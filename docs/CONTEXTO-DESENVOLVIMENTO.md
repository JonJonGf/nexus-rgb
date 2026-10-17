# Contexto de desenvolvimento

Este é o registro público de continuidade entre sessões e ferramentas. Leia também [AGENTS.md](../AGENTS.md), o [plano de melhorias](PLANO-MELHORIAS.md) e o [guia de desenvolvimento](DESENVOLVIMENTO.md). Confirme o estado atual no Git e no ambiente antes de agir; versões instaladas em outros computadores podem ser diferentes.

## Situação atual — 16/10/2026

- **Entrega de código:** alpha.23, implementando o bloco completo de **clareza visual e rede** (itens 1 a 5) no commit `2414264` (tag `v0.1.0-alpha.23`).
- **Distribuição e validação:** workflow [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/38986894431) e [CodeQL](https://github.com/JonJonGf/nexus-rgb/actions/runs/38986879468) concluídos com sucesso (126 testes de unidade/integração, 36 testes de interface Playwright, supervisor e estabilidade 100% aprovados, e 0 alertas de segurança nas 3 linguagens). No workflow [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/38986894607), todas as análises CodeQL foram aprovadas; a VM 5151 apresentou falha transitória na tentativa 1 de `npm test`, aguardando reexecução da etapa com "Re-run failed jobs". As releases anteriores (`v0.1.0-alpha.20`, `v0.1.0-alpha.21` e `v0.1.0-alpha.22`) continuam preservadas.
- **PC de validação:** `v0.1.0-alpha.22` instalada no Windows real; atualização assistida para a `v0.1.0-alpha.23` aguarda autorização explícita do usuário, devendo mostrar a interface/progresso do instalador e conferir a bandeja na sessão interativa ao concluir.
- **Resultado físico (Alexa na alpha.20):** usuário testou a alpha.20 e confirmou aviso de falha nos dois comandos, acender e apagar. A hipótese de confirmação de brilho não resolveu esse equipamento. Nos pedidos observados de desligamento, o Echo enviou somente `on`, sem `bri`; respostas HTTP 200 terminaram em poucos milissegundos, e consultas posteriores devolveram energia apagada e controlador disponível. Dados identificadores do equipamento e da rede permanecem privados.
- **Resultado posterior em Alexa+:** o usuário pediu por voz para a Alexa deixar de anunciar o erro e informou que funcionou. Nenhuma outra mudança de código ou reinstalação ocorreu. Registrar como preferência de resposta/solução prática relatada pelo usuário, sem concluir que o protocolo foi corrigido. O estado do aplicativo Alexa após esse pedido não foi retestado.
- **Pendência técnica (Alexa):** a causa do aviso no protocolo permanece desconhecida. Investigar caso o usuário queira retomar; a confirmação de brilho não é causa comprovada. Grupos, rotinas e estado no aplicativo precisam de teste separado. Não iniciar novas tentativas de alteração ou recadastro automaticamente após a solução prática relatada.
- **Demais melhorias:** blocos de estabilidade/hardware (alpha.21), layout de Configurações (alpha.22) e clareza visual e rede (alpha.23) concluídos. As quatro propostas detalhadas em [PLANO-MELHORIAS.md](PLANO-MELHORIAS.md) (desfazer/refazer, transição suave, diagnóstico revisável e recuperação após falhas) permanecem planejadas para etapas futuras quando autorizadas.
- **Mudança documental após o instalador alpha.20:** regras de continuidade em `AGENTS.md` e `.agents/rules/continuidade.md`, este registro e sua referência no guia de desenvolvimento, introduzidos em `f895fa8`.

## Decisões de produto que devem ser preservadas

- Controle de RGB Windows pelo OpenRGB, com painel local no PC/celular; acesso LAN aberto por padrão e sem QR obrigatório a cada uso.
- Alexa controla fisicamente apenas ligar/desligar. Preservar brilho, cor, efeito, mapa, perfis e ajustes individuais ao alternar energia.
- Interface PT/EN; apresentação inicial uma vez por pasta de dados, preservada ao atualizar.
- Dados existentes precisam sobreviver à atualização e à desinstalação padrão. Executáveis publicados devem corresponder ao código/tag e aos testes indicados.
- Perguntar antes de abrir instalador/UAC ou reiniciar serviços no PC real, pois o usuário pode estar em acesso remoto. Não reiniciar/desligar Windows automaticamente.
- Projeto público MIT; sem assinatura digital própria no momento. Não prometer compatibilidade universal ou certificação de segurança.

## Ponto de recuperação antes da passagem

- Tag remota preservada: `checkpoint/alpha20-before-antigravity-2026-10-16`, apontando para `b112b150e32e314aa54dd57f47ca3927221b0538`. Inclui a fonte da alpha.20 e as instruções/contexto de continuidade já existentes naquele commit.
- Foi criada uma cópia privada fora da pasta do projeto contendo bundle do histórico Git, exportação de ajustes/efeitos, arquivos de dados para recuperação manual e os quatro assets oficiais da alpha.20. Localização e inventário ficam em `data/handoff-backup.json` no PC de origem; não publicar esses dados.
- O bundle passou em `git bundle verify`; uma clonagem separada sem checkout confirmou o commit/tag e passou em `git fsck --full`. A exportação foi confrontada com os ajustes locais no momento da coleta; os instaladores copiados tiveram seus hashes conferidos.
- Não apagar ou modificar esse checkpoint/backup. Para recuperar, usar uma pasta nova e conferir o resultado antes de substituir qualquer instalação ou checkout. O backup não autoriza restauração ou reinício de serviços sem o usuário.

## Passos para o próximo agente

1. **Ler e conferir:** `AGENTS.md`, este contexto e [PLANO-MELHORIAS.md](PLANO-MELHORIAS.md). Conferir `git status`, branch e histórico; respeitar mudanças locais sem sobrescrevê-las.
2. **Preservar o resultado da Alexa:** ela executa energia; o usuário relatou suprimir o anúncio de erro por um pedido à Alexa+. Não tentar outra correção de protocolo automaticamente. Se o usuário quiser investigar novamente, partir dos pedidos com somente `on`, dos retornos 200/GET e da incerteza no estado do app.
3. **Próximas melhorias quando solicitado:** o bloco de clareza visual e rede foi concluído na alpha.23. As próximas quatro propostas (desfazer/refazer, transição suave, diagnóstico revisável e recuperação após falhas) já estão detalhadas no plano para quando o usuário decidir avançar.
4. **Trabalhar em mudanças pequenas:** reproduzir o problema com SDK/ambiente isolado, corrigir um comportamento e testar preservação dos dados antes de avançar. Não depender de um número fixo de LEDs, modelo de placa-mãe ou ordem de descoberta.
5. **Validar e distribuir:** executar verificações pertinentes, registrar os resultados, e, se a tarefa autorizada incluir publicação, gerar uma nova versão com executáveis correspondentes e passar pelas duas VMs e pelo bloqueio de segurança. Não mover as tags anteriores (`v0.1.0-alpha.20`, `v0.1.0-alpha.21`, `v0.1.0-alpha.22`, `checkpoint/alpha20-before-antigravity-2026-10-16`) nem substituir seus assets.
6. **Antes de alterar a instalação real:** pedir autorização para instalador/UAC/reinício de serviços e permitir que o usuário aceite o Windows, inclusive por acesso remoto. Nas instalações assistidas locais, mostrar interface visível (sem `/VERYSILENT`) e reabrir/conferir a bandeja na sessão do usuário. Não reiniciar o PC automaticamente.
7. **Antes de parar ou trocar de ferramenta:** atualizar este documento com mudanças, arquivos, testes, Git/release/instalação, falhas e próximo passo. Se parar no meio, indicar exatamente o que ficou incompleto. O registro deve continuar suficiente para outro agente retomar sem o chat anterior.

Os passos de implementação acima são a sequência sugerida para as melhorias guardadas; não substituem o pedido atual do usuário nem autorizam alterações em lote por conta própria.

## Histórico de entregas

### 16/10/2026 — Alpha.23: clareza visual e rede (branch `codex/visual-clarity-network`)

**Objetivo:** implementar o bloco completo de **clareza visual e rede** do plano de melhorias: indicador de personalização individual nas peças excluídas do mapa e botão **Voltar a seguir o mapa**; seleção inteligente de interface LAN considerando gateway, rotas locais e VPNs sincronizada entre painel e bandeja; orçamentos de limite de taxa separados para leitura, escrita, operações pesadas e estáticos; capacidade reservada na prévia para o administrador local; e rotas `/api/` fora do Service Worker com reconexão automática com recuo progressivo.

**Mudanças e arquivos (Itens 1 a 5):**
- `server/store.js`, `server/studio.js`, `server/hardware.js`, `public/app.js`, `public/studio.js`, `public/index.html`, `public/style.css`, `public/studio.css`, `public/en.js`: suporte a payload `{ followMap: true }` em `/api/devices/:id` para reintegrar o dispositivo ao mapa sem apagar energia ou brilho individual, preservando exclusões ao pausar/reativar ou trocar efeitos; indicadores visuais **Ajuste individual · fora do mapa** na lista de dispositivos e no mapa do setup (`.studio-item.excluded`), botão **Voltar a seguir o mapa** e traduções em inglês.
- `server/network.js`, `server/index.js`, `native/NexusRGB.cs`, `public/app.js`: função `parseRoutes()` com leitura de rotas via `route.exe print -4` em cache de 15 s; exclusão estrita de VPNs e switches virtuais sem gateway; priorização por gateway real e métrica; persistência da preferência manual em `network.json` na pasta de dados privada do app (sem poluir `settings.json` ou quebrar restauração de backup); sincronização de `lanUrl` em `/api/network`, `/api/link`, `/api/health` e cópia de link pela bandeja (`NexusRGB.cs`).
- `server/index.js`: separação de orçamentos de taxa por IP em `readRate` (240/min para `GET`/`HEAD`), `writeRate` (180/min para `POST`/`PUT`/`DELETE` comuns), `heavyRate` (60/min para rotas de backup, diagnósticos, link, duplicação e rascunho), `assetRate` (512/min para estáticos) e `globalRate` (2000/min), impedindo que o esgotamento de uma categoria bloqueie outra.
- `server/studio.js`: em `watch()`, limpeza prévia de clientes lentos (`writableLength > 512 KiB`) ou encerrados, limite de até 2 conexões para clientes da LAN e até 4 conexões totais, garantindo 2 vagas reservadas ao administrador local com código de erro 503 (`Limite de prévias simultâneas atingido.`).
- `public/sw.js` e `public/studio.js`: Service Worker ignora qualquer requisição cujo destino seja `/api` ou inicie com `/api/`; reconexão automática de `/api/studio/preview` com recuo progressivo (2 s a 15 s) e recarregamento prévio do estado do mapa (`refresh()`).
- `tests/studio.test.js`, `tests/security.test.js`, `tests/adversarial.test.js` e `tests/ui/studio.spec.js`: testes de unidade, integração, segurança e interface cobrindo todos os 5 itens.
- `README.md`, `docs/PLANO-MELHORIAS.md`, `docs/releases/v0.1.0-alpha.23.md`: documentação pública e notas de lançamento atualizadas.

**Testes executados e resultados:**
- `npm.cmd test`: 126/126 aprovados (incluindo testes de rotas/gateway, orçamentos separados, limites de prévia, exclusão do Service Worker e exclusões do mapa).
- `npm.cmd run test:ui`: 36/36 aprovados no Playwright (incluindo navegação para Dispositivos, exibição de badge/botão de retorno ao mapa, seleção de peça no mapa e reconexão de stream).
- `npm.cmd run test:supervisor`: aprovado (parada graciosa, reinício por falha e Job Object).
- `npm.cmd run build`: executável C# e instalador compilados com sucesso em `dist/`.
- `npm.cmd run test:installer`: 12/12 cenários de instalação aprovados (PT-BR e EN).
- `node scripts/check-release.cjs v0.1.0-alpha.23`: aprovado.

**Git / Release / Instalação:**
- Branch `codex/visual-clarity-network` pronta para commit, merge e tag `v0.1.0-alpha.23`.
- Instalação no computador de desenvolvimento permanece na `v0.1.0-alpha.22` até autorização do usuário; quando autorizada, a atualização deverá exibir a interface visível do instalador (sem `/VERYSILENT`) e verificar a reabertura do ícone da bandeja na sessão do usuário.

**Pendências e próximo passo:**
- Fazer commit das alterações, mesclar à branch principal e acionar o workflow de publicação para gerar a release `v0.1.0-alpha.23`.
- Aguardar autorização do usuário antes de rodar o instalador ou reiniciar serviços no PC real.

### 16/10/2026 — Planejamento de edição, energia, diagnóstico e recuperação

- Pedido atual: aprofundar e salvar quatro propostas escolhidas pelo usuário, sem iniciar implementação: desfazer/refazer no mapa e no editor, transição suave de energia, exportação de diagnóstico com revisão e recuperação após falhas.
- `docs/PLANO-MELHORIAS.md` recebeu comportamento esperado, limites, privacidade, conflitos entre clientes, preservação da intenção de energia e critérios de aceitação para cada proposta. A sequência sugerida vem depois do bloco de clareza visual/rede já pendente; ela não autoriza execução automática.
- Mudança apenas documental. Não houve alteração do aplicativo, instalação, publicação, reinício de serviços ou teste físico. Instalador e instalação continuam na alpha.22. Verificação: `git diff --check` aprovado; verificador documental aprovado (52 arquivos Markdown, 183 links locais e sintaxe dos trechos Bash em cinco workflows). Suítes do aplicativo não foram repetidas para este planejamento.
- Git ao registrar: branch `codex/settings-layout`, base `564be72`, alterações locais no plano e neste contexto (incluindo o diagnóstico anterior da bandeja), sem commit ou tag novos. Próximo passo: apresentar o planejamento e aguardar pedido de implementação.

### 16/10/2026 — Diagnóstico da instalação sem janela e da bandeja

- O usuário esclareceu que faltava o ícone na bandeja, perto do relógio. Antes da intervenção havia dois processos do Nexus na sessão de serviços e nenhum processo da bandeja na sessão interativa. Foi aberto somente o executável instalado com `--tray`, sem UAC nem reinício dos serviços; confirmou-se processo na sessão do usuário e painel saudável com cinco componentes conectados. A posição visual do ícone (inclusive área de ícones ocultos do Windows) não foi inspecionada.
- O log privado da instalação alpha.22 confirma chamada com `/VERYSILENT /SUPPRESSMSGBOXES`: esse modo esconde também a janela de progresso. O instalador mantém `skipifsilent` no lançamento final do aplicativo, explicando a ausência de reabertura automática da bandeja nessa atualização. Não houve alteração desses arquivos de instalação/serviços entre as tags alpha.21 e alpha.22. Abrir normalmente o executável distribuído apresenta a instalação interativa; o problema observado foi a forma de execução da atualização local.
- Nas próximas atualizações assistidas, apresentar progresso visível e conferir/reabrir a bandeja na sessão do usuário ao terminar. Continuar pedindo autorização antes de instalador/UAC ou reinício de serviços. Não alterar o comportamento das instalações automatizadas de CI por causa deste diagnóstico.
- Verificação desta investigação: leitura do log, comparação do instalador entre tags, consulta dos processos e da saúde do painel. Não foram repetidas as suítes de testes nem executada outra instalação. Código e binário alpha.22 permanecem iguais; apenas este registro foi atualizado localmente na branch `codex/settings-layout`, sobre `564be72`, sem nova tag ou publicação.

### 16/10/2026 — Alpha.22: correção do layout da aba Configurações (branch `codex/settings-layout`)

**Objetivo:** corrigir o desalinhamento visual na aba **Configurações** relatado pelo usuário (espaço vazio ao lado de **Rede e serviços**, cartão **Seu idioma** esticado verticalmente, ausência de margem vertical entre os cartões principais da página e quebra de linha no rótulo **Transição entre perfis**).

**Mudanças e arquivos:**
- `public/index.html` e `public/studio.css`: agrupamento de **Seu idioma** e **Rede e serviços** em uma coluna esquerda empilhada (`.settings-stack`, com `flex: 1` no último cartão) ao lado de **Atualização do RGB**, eliminando a célula vazia ao lado de **Rede e serviços** e alinhando a base das duas colunas; adição de margem vertical (`18px`) entre os blocos visíveis de `.page[data-view=settings]`; `white-space: nowrap` no texto de `#library-transition-label` e `flex: 1` no `<select>` para manter **Transição entre perfis** em uma única linha.
- `tests/ui/language.spec.js`: verificação automatizada do alinhamento da base das duas colunas (`bottomDiff <= 1`), do espaçamento vertical antes de **Reiniciar Nexus e OpenRGB** (`restartGap >= 16`) e da altura de linha única do rótulo de transição (`labelHeight <= 20`).
- `README.md` e `docs/releases/v0.1.0-alpha.22.md`: links e notas da versão `v0.1.0-alpha.22`.

**Testes executados e resultados:**
- `npm.cmd test`: 125/125 aprovados localmente e na tag `v0.1.0-alpha.22`. (Na tentativa 1 da VM `5151` em `Publicar versão Windows`, houve um timeout transitório de partida a frio do worker QuickJS/Canvas em `tests/backups.test.js`; reexecutado na tentativa 2 com aprovação integral nas duas VMs.)
- `npm.cmd run test:ui`: 35/35 aprovados localmente e no CI (Playwright/Edge, incluindo verificação geométrica desktop e mobile da aba Configurações).
- `npm.cmd run test:supervisor`: aprovado localmente e no CI.
- `npm.cmd run build` e `npm.cmd run test:installer`: 12/12 cenários aprovados localmente e nas duas VMs (PT-BR e EN).
- `node scripts/check-release.cjs v0.1.0-alpha.22`: aprovado localmente e no CI.
- Workflows da tag `v0.1.0-alpha.22`: [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/38979425268), [CodeQL](https://github.com/JonJonGf/nexus-rgb/actions/runs/38979424694) e [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/38979425335).

**Git / Release / Instalação:**
- Tag `v0.1.0-alpha.22` publicada a partir do commit `4461edfdfb593dcab1263ecf3cd1202150c61d9f` em [releases/tag/v0.1.0-alpha.22](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.22) com `NexusRGB-Setup-0.1.0.exe` (`f96b6838ea3e70739bd4a46bc53378e6e8b73d6ed9035379a911c175b96a6293`), `NexusRGB-Uninstall-0.1.0.exe` (`449589317a5bacbf3adf3c73cb0501a1f955c4cfb962f6c5cd074ddf3136bc51`), `SHA256SUMS.txt` e `BUILD-INFO.json`.
- Versão `v0.1.0-alpha.22` instalada no PC real em `E:\Program Files\Nexus RGB` após autorização do usuário, sem reiniciar o Windows, com `/api/health` confirmando `ready: true`, `connected: true`, `devices: 5`, `detecting: false`, HTML/CSS servidos em `http://127.0.0.1:5050` já com `.settings-stack` e `#library-transition-label`, `settings.json` idêntico (`00338549087AC5D1D35ABFCC074138538C4D1B2157D88E74888B9B7E4FE48F29`), 36 efeitos preservados e backup pré-atualização criado automaticamente.

**Pendências e próximo passo:** correção de layout da aba **Configurações** (`v0.1.0-alpha.22`) concluída, publicada e instalada. Quando o usuário solicitar, iniciar o bloco planejado de **clareza visual e rede** em [PLANO-MELHORIAS.md](PLANO-MELHORIAS.md).

### 16/10/2026 — Alpha.21: estabilidade e hardware (branch `codex/hardware-stability`)

**Objetivo:** implementar as 5 melhorias de estabilidade e hardware planejadas após a alpha.20 sem refazer alterações da Alexa e preservando perfis, efeitos, mapa e configurações.

**Mudanças e arquivos (Itens 1 a 5):**
- `server/hardware.js` e `server/diagnostics.js`: descoberta em etapas (`DISCOVERY_STAGES = [1500, 1500, 3000, 6000, 15000, 30000, 60000]`), mantendo varreduras frequentes logo após conectar ou detectar mudanças estruturais, reiniciando o estágio em `deviceListUpdated`, recuando gradualmente até 60 s quando a lista permanece estável, expondo `detecting`, medindo `discoveryMs` no diagnóstico e evitando `dirty`/`emit('change')` redundantes quando nada mudou.
- `server/hardware.js` e `server/studio.js`: deduplicação de estado apagado (`power: false` ou `brightness: 0` sem modo nativo) para não reenviar quadros pretos quando a revisão espacial avança ou ajustes irrelevantes mudam com os LEDs apagados; encerramento do worker espacial quando a energia geral está desligada (`!master.power`) ou não há dispositivos ativos/clientes; aplicação de modo `Off` nativo em controladoras multizona (`d.components`) somente quando todas as zonas estão apagadas e sem identificação ativa, preservando `Direct` quando qualquer zona está acesa ou em identificação temporária.
- `native/NexusRGB.cs` e `server/index.js`: encerramento normal supervisionado (`NEXUS_SUPERVISED=1`, sinal `shutdown` via stdin e `CloseMainWindow`) com espera limitada fora do lock de log antes de acionar o fechamento forçado do Job Object.
- `server/index.js`, `scripts/restart-services.ps1`, `native/NexusRGB.cs`, `native/Locale.cs`, `public/app.js`, `public/health.js` e `public/en.js`: exposição de `detecting` em `/api/health` e no estado do painel; espera limitada por estabilização da descoberta parcial no reinício manual; mensagens de progresso na janela de recuperação e no painel web (PT-BR e EN) diferenciando painel pronto de hardware ainda em detecção.
- `tests/hardware.test.js`, `tests/studio.test.js`, `tests/recovery.test.js`, `tests/ui/health.spec.js` e `scripts/test-supervisor.js`: cobertura automatizada dos 5 comportamentos.
- `README.md`, `docs/PLANO-MELHORIAS.md` e `docs/releases/v0.1.0-alpha.21.md`: documentação e notas da versão `v0.1.0-alpha.21`.

**Testes executados e resultados:**
- `npm.cmd test`: 125/125 aprovados localmente e na tag `v0.1.0-alpha.21`. (Nos runs paralelos de branch `38965911218`/`38965911189`, o mock assíncrono `sleep(50)` em `tests/studio.test.js` apresentou condição de corrida ao usar `speed: 35` durante o desligamento; ajustado em seguida para receita estática `speed: 0` com asserção explícita de encerramento do worker, mantendo o teste determinístico.)
- `npm.cmd run test:ui`: 35/35 aprovados localmente e no CI (Playwright/Edge).
- `npm.cmd run test:supervisor`: aprovado localmente e no CI (reinício após falha, parada graciosa via stdin e fallback forçado via Job Object).
- `npm.cmd run test:installer`: 12/12 cenários aprovados localmente e nas VMs (PT-BR e EN).
- `node scripts/check-release.cjs v0.1.0-alpha.21` e `npm.cmd run build`: aprovados localmente e no workflow de release.
- Workflows da tag `v0.1.0-alpha.21`: [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/38965911532) (incluindo estabilidade de 60 s), [CodeQL](https://github.com/JonJonGf/nexus-rgb/actions/runs/38965911284) e [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/38965911628) (2 VMs Windows Server 2025 com instalação limpa, atualização, recuperação, desinstalação e reinstalação + CodeQL nas 3 linguagens sem alertas abertos).

**Git / Release / Instalação:**
- Tag `v0.1.0-alpha.21` publicada a partir do commit `db0c9e7f82b613e7ad65fa3b6bac388d0782d48d` em [releases/tag/v0.1.0-alpha.21](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.21) com `NexusRGB-Setup-0.1.0.exe` (`09f914fcb43ec0831453bf5ea5bbd6ef40869c71216f947290518958c3214628`), `NexusRGB-Uninstall-0.1.0.exe` (`e3c13e8191f044f6c3c73c8572097abd9ea9c67224ef7c488cfeb165adec732e`), `SHA256SUMS.txt` e `BUILD-INFO.json`.
- Versão `v0.1.0-alpha.21` instalada no PC de validação após autorização do usuário (`/api/about` confirma `tag: v0.1.0-alpha.21`, `commit: db0c9e7f82b613e7ad65fa3b6bac388d0782d48d`, `development: false`), sem reinício do Windows, com backup pré-atualização automático íntegro, 36 efeitos e 10 perfis preservados, os 5 componentes RGB conectados (`detecting: false`, `discoveryMs` ~1,2–1,5 ms) e funcionamento físico confirmado pelo usuário.
- Tag `checkpoint/alpha20-before-antigravity-2026-10-16` e backup `E:\Nexus RGB Backups\2026-10-16-alpha20-b112b15` preservados intactos.

**Pendências e próximo passo:** bloco de estabilidade/hardware (`v0.1.0-alpha.21`) concluído e validado. Quando o usuário solicitar, iniciar o próximo bloco planejado em [PLANO-MELHORIAS.md](PLANO-MELHORIAS.md) ("Próxima etapa: clareza visual e rede").

### 16/10/2026 — Alpha.20: respostas Hue da Alexa

**Objetivo:** investigar o caso em que o Echo acende/apaga as luzes e anuncia falha, mantendo a integração somente liga/desliga.

**Implementação:** `server/alexa.js` confirma `on` e `bri` separadamente; mantém `bri` virtual na memória, com GET posterior coerente; valida inteiro 0..254 antes de aplicar energia. Só `on` explícito modifica energia: pedidos apenas de brilho não reacendem/apagam, não gravam ajustes e não comandam LEDs. Aceita barra final nas rotas Hue sem alterar identidade da ponte/luz ou verificações de Host, origem, sub-rede e aprovação. Diagnóstico acrescenta brilho virtual e indicação de energia explícita, sem registrar campos arbitrários.

**Arquivos principais:** `server/alexa.js`, `tests/alexa.test.js`, `tests/alexa-http.test.js`, [Alexa e teste físico](ALEXA.md), [planejamento](PLANO-MELHORIAS.md), [notas alpha.20](releases/v0.1.0-alpha.20.md), README e índices de documentação.

**Validação:** 124 testes de lógica/integração locais e no CI; 34 de interface no CI; supervisor e estabilidade de 60 segundos/171 requisições/dez reinícios abruptos. Nove testes específicos de Alexa, incluindo transporte HTTP real em loopback com identidade LAN simulada. Duas VMs Windows passaram em 75 verificações cada. As três análises CodeQL do mesmo commit/tag passaram sem erros/avisos e sem alertas abertos, sem descartar novos alertas para esta alteração. Assets oficiais baixados e confrontados com hashes e metadados; instalação local e preservação dos dados verificadas. Consulte o [relatório](validation/2026-10-16-alexa-feedback.md), o [CI](https://github.com/JonJonGf/nexus-rgb/actions/runs/38957323136) e a [publicação](https://github.com/JonJonGf/nexus-rgb/actions/runs/38957323137).

**Resultado físico posterior à instalação:** o usuário confirmou aviso ao acender e apagar. O diagnóstico local do desligamento mostrou PUT com apenas `on`, sem `bri`, respostas 200 concluídas em aproximadamente 5–8 ms e GETs posteriores com `on: false`, `reachable: true`. Isso enfraquece a hipótese de confirmação de brilho para a falha observada. A finalização da resposta pelo servidor não comprova a interpretação dela pelo firmware. O ajuste melhora coerência do protocolo, mas não resolveu o aviso nesse Echo.

**Solução prática relatada depois:** em Alexa+, o usuário pediu para não ouvir mais o anúncio de erro e informou sucesso. Nenhum código mudou entre a falha e esse resultado. Não foi retestado o estado no app; não atribuir a supressão do aviso a uma correção de protocolo no Nexus.

**Limites:** brilho virtual não corresponde ao brilho RGB e reinicia em 254 com um novo processo. Campos Hue não suportados permanecem sem implementação. O efeito em grupos/rotinas precisa de observação física.

**Próximo passo:** manter o resultado registrado. Se o usuário retomar a investigação técnica, observar pedidos/respostas nas duas direções e o estado no app antes de modificar novamente o protocolo. Não alterar brilho RGB nem identidade/cadastro da luz como tentativa automática.

### 16/10/2026 — Continuidade entre agentes

**Pedido:** manter no Git um contexto atualizado para permitir que outra ferramenta continue o trabalho e que as mudanças sejam compreendidas ao retornar.

**Implementação:** instruções na raiz e regra sempre ativa do Antigravity direcionam a este registro. Exigem atualização após blocos relevantes e antes de encerrar/pausar, incluindo tarefa incompleta, testes, pendências e distinção entre fonte, release e instalação. O guia de desenvolvimento oferece o mesmo ponto de entrada.

**Validação:** links locais conferidos pelo leitor de documentação e diferenças verificadas com `git diff --check`. Não é necessária outra compilação para publicar apenas estas instruções. Nenhum comportamento do aplicativo é alterado por elas.

### 16/10/2026 — Checkpoint e instruções de passagem

**Pedido:** criar um ponto seguro antes de continuar em outra ferramenta e preparar um prompt de retomada.

**Resultado:** checkpoint Git e cópia privada externa verificados conforme a seção de recuperação acima. O contexto agora traz uma sequência explícita para o próximo agente; o usuário pediu guardar as melhorias e já recebeu a instalação da alpha.20. As instruções de proteção dos backups foram acrescentadas ao `AGENTS.md`.

**Próximo passo sugerido:** quando o usuário autorizar retomar as melhorias, trabalhar em estabilidade/hardware conforme a sequência, mantendo o contexto atualizado e preservando o ponto de recuperação. Não reabrir automaticamente a investigação da Alexa depois da solução prática de voz relatada.

## Modelo para novas entradas

```text
Data / ferramenta / objetivo:
Mudanças e arquivos:
Decisões e motivo:
Testes executados e resultados:
Limites e testes pendentes:
Git (branch, alterações locais, commit/tag conhecidos, workflows):
Release e instalação (distinguir fonte de binário instalado):
Pendências / próximo passo / autorização necessária:
```
