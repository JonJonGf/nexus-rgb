# Contexto de desenvolvimento

Este é o registro público de continuidade entre sessões e ferramentas. Leia também [AGENTS.md](../AGENTS.md), o [plano de melhorias](PLANO-MELHORIAS.md) e o [guia de desenvolvimento](DESENVOLVIMENTO.md). Confirme o estado atual no Git e no ambiente antes de agir; versões instaladas em outros computadores podem ser diferentes.

## Situação atual — 18/10/2026

- **Suporte Nativo a Controladoras USB-HID (Design Clean-Room — Lian Li & NZXT Kraken):**
  - **Decisão e Requisito do Usuário:** implementação de suporte nativo out-of-the-box para controladoras USB populares (Lian Li Uni Hub SL120/AL120/SL-INF/SL-V2, cabos Strimer Plus/V2 e NZXT Kraken X/Z/Elite AIO) para que o sistema reconheça e controle essas peças imediatamente ao plugar.
  - **Blindagem Jurídica e Clean-Room (Licença MIT vs GPL/AGPL):** em estrito atendimento à determinação do usuário de evitar qualquer risco de processo ou contaminação de licença ("n fazer igual prs eu n tomar processo"), o código foi desenvolvido em arquitetura Clean-Room pura, 100% em JavaScript/Node.js nativo sob licença MIT, sem cópia de código de projetos C++ de terceiros sob GPL/AGPL. As estruturas de pacotes USB-HID de 64 bytes foram implementadas a partir de primitivas de Buffer puras do Node.js.
  - **Arquitetura e Arquivos Criados/Alterados:**
    1. `server/controllers/protocol-lianli.js`: codificador clean-room de pacotes de 64 bytes (`encodeLianLiPacket` com opcode `0xE0`, canal 1–4, contagem, escala de brilho e payload RGB), suporte a multi-pacotes (`encodeLianLiPackets`), gerador de descritor `buildLianLiDevice` com decomposição automática de canais em ventoinhas ARGB individuais independentes no Studio (`type: 3`, `shape: 'fan'`) e cabos Strimer (`type: 4`, `shape: 'strip'`).
    2. `server/controllers/protocol-nzxt.js`: codificador clean-room de pacotes de 64 bytes (`encodeNzxtPacket` com opcode `0x22`, sub-opcode `0x00`, zonas de bomba/logo/canais e escala de cores), suporte a multi-pacotes (`encodeNzxtPackets`), gerador de descritor `buildNzxtKrakenDevice` com decomposição de anel da bomba (`shape: 'fan'`), logo central (`ledCount: 1`) e ventoinhas do radiador (`type: 3`, `shape: 'fan'`).
    3. `server/controllers/index.js`: `ControllerRegistry` gerenciador do ciclo de vida das controladoras, inicialização a partir do store (`store.data.nativeControllers`), suporte a transporte customizado/virtual, roteamento de `sendLeds` e diagnósticos anonimizados seguros em `getSummary()`.
    4. `server/hardware.js`: integração transparente no ciclo do `Hardware` (`options.controllerRegistry || new ControllerRegistry({ store: this.store })`); fusão de dispositivos em `discover()`; guarda em `applyMode()` para evitar chamadas indevidas ao SDK do OpenRGB; despacho direto de quadros em `sendLeds()`; permissão de execução de `tick()` e relato de `connected: true` / status `'online'` mesmo quando o daemon OpenRGB não estiver em execução; exportação de `ControllerRegistry`.
    5. `tests/native-controllers.test.js`: 6 testes unitários aprofundados cobrindo protocolos, decomposição de ventoinhas, registro, descoberta, snapshot, entrega de pacotes, operação autônoma sem OpenRGB e valores de borda/sanitização.
  - **Testes Executados e Resultados Observados:**
    - `node --test tests/native-controllers.test.js`: 6/6 testes aprovados em ~100 ms.
    - `node --test --test-concurrency=2 tests/*.test.js`: todos os 182 testes unitários aprovados (176 de baseline + 6 novos) com 0 falhas, 0 cancelamentos e 0 pulados.
  - **Estado do Git:** alterações locais prontas para commit em `server/hardware.js`, novos arquivos em `server/controllers/` e `tests/native-controllers.test.js`.
  - **Próximo Passo:** registrar no plano de melhorias, commitar e enviar para a branch `main`.

## Situação atual — 17/10/2026

- **Remediação de alertas CodeQL / Code Scanning (`server/conflicts.js`):** resolução dos alertas #87 e #88 (`js/command-line-injection`). A injeção potencial era apontada pelo CodeQL devido ao uso de `process.env.SystemRoot` concatenado ao caminho de `reg.exe` e `tasklist.exe`. Em modelo de ameaça local (`threat-models: [local]`), `process.env` é classificado como entrada controlada pelo usuário. A chamada foi ajustada para invocar diretamente os executáveis do sistema como literais constantes seguros (`reg.exe` e `tasklist.exe`), removendo a dependência de `path` e saneando o fluxo de dados.
- **Entrega de código (Suporte a Periféricos, Mapeamento de Barramentos e Arquitetura Headless):** implementação dos três eixos acordados a partir do estudo de controladoras e do OpenRGB headless:
  1. *Matriz Visual de Periféricos e Formatos Espaciais:* novos ícones vetoriais SVG (`keyboard`, `mouse`, `gpu`, `cooler`, `strip`), badges de identificação e mapeamento de dimensões inteligentes no Studio (`spatial.defaults`), atribuindo formato horizontal a teclados, oval compacto a mouses e anéis circulares (`fan`) a coolers/fans (`public/app.js`, `public/en.js`, `public/spatial.js`).
  2. *Mapeamento de Barramentos e Preservação de Tipos:* funções puras `detectBusArchitecture` e `classifyDeviceType` em `server/hardware.js` cobrindo Intel PCH i801, AMD PIIX4, SuperIO (NCT67xx/ITE) e USB-HID. Propagação de `type`, `busType` e `vendor` para subcomponentes de zonas divididas (`components()`), evitando perda de metadados em headers ARGB.
  3. *Diagnóstico e Anonimização:* agregação de tipos de barramento em `health.busTypes` em `server/diagnostics.js`, preservando a conformidade estrita da allowlist de privacidade sem expor portas, caminhos físicos ou endereços de hardware.
  4. *Estudo de Engenharia Headless:* criação de `docs/OPENRGB-HEADLESS.md`, detalhando a redução de ~48 MB para ~9 MB (~80% menos footprint), a causa do deadlock de `std::shared_mutex` (SRWLock no Windows) em streaming contínuo versus requisições do SDK, a arquitetura de `ReentrantSharedMutex` e timeouts per-detector de 3000 ms.
  5. *Testes Automatizados:* 4 novos testes unitários dedicados em `tests/controllers-matrix.test.js`. Suíte completa de 176 testes unitários (`npm test`) e 40 testes de interface Playwright (`npm run test:ui`) — totalizando 216 testes automatizados — 100% aprovados sem falhas.
- **Entrega de código (Detecção de Conflitos de Iluminação e Softwares Concorrentes):** implementação de diagnóstico não intrusivo para detectar conflitos de controle RGB externos (`server/conflicts.js`), abrangendo:
  1. *Iluminação Dinâmica do Windows 11 (Dynamic Lighting):* consulta somente-leitura ao Registro do Windows (`HKCU\Software\Microsoft\Lighting /v AmbientLightingEnabled`), alertando quando ativada para evitar disputas de controle HID/LampArray.
  2. *Softwares Concorrentes em Execução:* varredura segura de processos via allowlist estrita (`tasklist.exe`), identificando softwares conhecidos por saturar o barramento SMBus ou travar o OpenRGB (Corsair iCUE, ASUS Armoury Crate / Aura, Lian Li L-Connect, Razer Synapse, Gigabyte RGB Fusion, MSI Mystic Light / Center, NZXT CAM e SignalRGB).
  3. *Cache e Economia de Recursos:* cache de 15 segundos e desduplicação de chamadas em voo (`inflight`), garantindo baixo consumo.
  4. *Integração no Painel e API:* rota protegida `GET /api/conflicts` para administradores e aviso visual em `#health-conflicts` na aba Configurações > Saúde/Consumo, com tradução completa PT-BR/EN reativa a `nexus:languagechange`.
  5. *Testes Automatizados:* 4 novos testes unitários em `tests/conflicts.test.js`, testes de segurança em `tests/api.test.js` e teste de interface Playwright em `tests/ui/health.spec.js`. Suíte completa de 172 unitários e 40 testes de UI (212 testes no total) 100% aprovada.
- **Entrega de código (versão alpha.32):** correção definitiva da limitação de taxa no modo Studio (`tick(true)`). Na alpha.31, a condição `!forceSend` na limitação de RAM era ignorada durante animações espaciais do Studio porque `this.studio.revision` alterava a assinatura a cada frame, marcando `forceSend = true` e transmitindo RAM a 60 FPS. Na alpha.32, a contenção a 20 FPS para RAM SMBus é incondicional a quadros de animação (`if (!isPowerOff && !this.identification && isSmbusRam(device))`), preservando apenas desligamento imediato e identificação manual. Exclusão explícita de dispositivos USB/HID em `isSmbusRam(device)`. Suíte completa de 168 testes aprovada (`server/hardware.js`, `tests/traffic-control.test.js`, `docs/releases/v0.1.0-alpha.32.md`, `README.md`, `docs/PLANO-MELHORIAS.md`).
- **Identidade das tags `alpha.24` a `alpha.34`:**
  - `v0.1.0-alpha.24` (`f9df27ff1c3f48163466b2d09bc00d40fff61d27`): publicada com todos os 3 workflows verdes e assets oficiais disponíveis.
  - `v0.1.0-alpha.25` (`4b2eaa2f4a53d96c4530efee8e32a17f5f0bd650`): passou nos workflows da tag `Validar Nexus RGB` e `CodeQL`, mantida conforme regra de imutabilidade.
  - `v0.1.0-alpha.26` (`4924d76e894ac590fdee6bba8ed5053dab3d1be6`): publicada em `releases/tag/v0.1.0-alpha.26` após aprovação nos workflows com assets oficiais e SHA-256 conferidos.
  - `v0.1.0-alpha.27` (`c29211be3204f99cd9210d1529386aa5b423c008`): publicada em [releases/tag/v0.1.0-alpha.27](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.27). Hashes SHA-256 conferidos: `NexusRGB-Setup-0.1.0.exe` = `1f6b7449c5be8f6905a20c2a76a0c24f3d386f836a194e1202cdf85f4ba57644`; `NexusRGB-Uninstall-0.1.0.exe` = `a678afcd8481a81c442b057166fd939c0b1e010f1c308088e5e1f67d8ae6121c`.
  - `v0.1.0-alpha.28` (`1728413472620e17d411a6d8b73e5590b06150d6`): publicada em [releases/tag/v0.1.0-alpha.28](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.28) com aprovação no workflow [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39051431459) (`success`) e [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39051431432) (`success`). Hashes SHA-256 conferidos: `NexusRGB-Setup-0.1.0.exe` = `582c4da5da2cd334d1da72c03f42d78ae1328eaed71f309bd612f93cb5d03718`; `NexusRGB-Uninstall-0.1.0.exe` = `a2356db66b21bf07b4a977e2aacb6dde487571d3f486dc4e863c1ff13f967668`.
  - `v0.1.0-alpha.29` (`6355d0417124107fd692182c544f76fe7b2ade81`): passou nos workflows [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39059611928) (`success`) e CodeQL; mantida conforme regra de imutabilidade após interrupção por variação de tempo em teste de UI no instalador em VM.
  - `v0.1.0-alpha.30` (`4a2de6915bf7d496584aa3b8ec91a8e9e4a9c1a7`): publicada em [releases/tag/v0.1.0-alpha.30](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.30) com aprovação no workflow [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39060379662) (`success`) e [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39060379613) (`success`). Hashes SHA-256 conferidos: `NexusRGB-Setup-0.1.0.exe` = `2ba4334879467c003293f2fb2dd024453ee3bad928e7fe0f7699dbba4db6cb51`; `NexusRGB-Uninstall-0.1.0.exe` = `0b401310e05806ad60dc313a0eaba0434e597a5ec68069d8f063322510d542a6`.
  - `v0.1.0-alpha.31` (`3ff5714df03c7f8871b58a879e3614ec4465699c`): publicada em [releases/tag/v0.1.0-alpha.31](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.31) com aprovação no workflow [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39063999828) (`success`) e [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39063999794) (`success`). Hashes SHA-256 conferidos: `NexusRGB-Setup-0.1.0.exe` = `c8356f2dc2a7bcf6c34e238b075511dcd23e4ef4fb6a51bb718dd28dd49db7e1`; `NexusRGB-Uninstall-0.1.0.exe` = `2fdf71c4425b7bde80cb9d5513faaca0615602ac08cf216e1d68c3eb7cff5be8`.
  - `v0.1.0-alpha.32` (`f31b694037add490816f653d8d910772d95f34a7`): publicada em [releases/tag/v0.1.0-alpha.32](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.32) com aprovação no workflow [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39069499685) (`success`) e [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39069499721) (`success`). Hashes SHA-256 conferidos: `NexusRGB-Setup-0.1.0.exe` = `27f3cb74d7ebe8e39230d8339cb7655280bccf7c4204d75f48a297485d49a32a`; `NexusRGB-Uninstall-0.1.0.exe` = `b98b32f9ad36c98629a8254d74ca31e85bf181ec7e498742b44b551cd228cc56`.
  - `v0.1.0-alpha.33` (`ce46f92`): passou nos workflows Validar Nexus RGB e CodeQL; bloqueada no security gate por alertas prévios de injeção em `conflicts.js`; mantida conforme regra de imutabilidade de tags.
  - `v0.1.0-alpha.34` (`055668a`): publicada em [releases/tag/v0.1.0-alpha.34](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.34) com aprovação no workflow [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39091258250) (`success`) e [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39091258231) (`success`). Hashes SHA-256 conferidos: `NexusRGB-Setup-0.1.0.exe` = `e9e7a9ebf4a0e092b38b583b3272e474b29badeb5a9b411ca49fc3405bfb3a0c`; `NexusRGB-Uninstall-0.1.0.exe` = `26388e9715b53b1e1b97f620ad83e9f780b3c5afbf4cbd412108f78a749af588`.
- **Versão instalada no PC físico do usuário:** o usuário testou a `alpha.32` a 60 FPS prolongadamente em hardware físico e confirmou estabilidade total sem qualquer travamento do controlador ("em relação ao teste de 60 fps até agora n deu problema acho q funcionou kkkkkk deu bom"), comprovando o sucesso da contenção física estrita a 20 FPS para a RAM no Studio. Nenhuma alteração não autorizada foi feita na instalação real, serviços, portas ou arquivos de dados do usuário pelo agente.
- **Identidade de produto (Nexus RGB Studio):** definida a consolidação da marca `Nexus RGB` com reforço no estúdio espacial: *"Nexus RGB Studio — O estúdio espacial de iluminação e controle RGB local para Windows"*. `README.md` reformulado e `playwright.config.js` fortalecido com retentativas para evitar flakes de runners no CI.
- **Evidência empírica coletada pelo usuário em hardware real (teste a 60 FPS com alpha.31 no Studio):**
  - O usuário testou a alpha.31 configurada a 60 FPS com efeito espacial ativo no Studio e relatou novo travamento ("tu n limitou a memoria ram a 20? pq eu botei a 60 aqui e depois de um tempo travou").
  - Análise aprofundada do código revelou que durante a execução espacial (`hardware.tick(true)`), a assinatura do dispositivo incluía `this.studio.revision`. Como a revisão incrementava a cada quadro animado, a assinatura divergia, forçando `changed = true` e `forceSend = true`. Com `forceSend = true`, a guarda `!forceSend` anulava o limitador de 20 FPS e despachava todos os 60 quadros/s para a RAM SMBus.
  - A correção na alpha.32 remove `!forceSend` da checagem de RAM, blindando a DRAM em 20 FPS mesmo sob animações contínuas do Studio.
- **Implementação do ritmo de velocidade dupla (Dual-Rate Engine):**
  - **Identificação segura de RAM SMBus (`isSmbusRam(device)`):** detecção estrita de `device.type === 1` (`DEVICE_TYPE_DRAM`) ou palavras-chave `dram`, `ram`, `memória`, `memory`, `ene smbus/dram`, `trident`, `vengeance`, `ballistix`, `dominator`, com exclusão explícita de placa-mãe (`type === 0`).
  - **Limitação de cadência a 20 FPS para RAM:** em `sendLeds()`, se o dispositivo for RAM no SMBus e não for comando de energia ou forçado, impõe intervalo mínimo de 46 ms (~20 FPS). Quadros intermediários a 60 FPS são descartados de forma preventiva (`framesThrottledRam++`), poupando o barramento SMBus de colisões.
  - **Prioridade absoluta de desligamento e comandos manuais:** comandos de desligamento imediato (`power: false` / blackout) e comandos com `forceSend = true` ignoram a limitação de taxa e são transmitidos imediatamente aos módulos de RAM sem qualquer atraso.
  - **Preservação do relógio unificado e fluidez nos demais componentes:** placa-mãe, conectores ARGB e controladoras USB continuam recebendo todos os 60 FPS fluidos; a animação do motor não sofre corte de fase. A iluminação da RAM, dotada de difusores acrílicos foscos, permanece esteticamente suave e indistinguível.
  - **Métricas estruturadas de tráfego:** expostas no snapshot e em `/api/diagnostics` sob `render.traffic.throttledRam`.
- **Evidência empírica coletada pelo usuário em hardware real (teste comparativo com versão oficial anterior):**
  - O usuário executou teste físico comparativo em versão oficial anterior do Nexus RGB configurada a 60 FPS e confirmou a mesma falha: o controlador trava e exige reinício após algum tempo tanto a 60 FPS quanto a 30 FPS, ao passo que a 20 FPS não foi observada falha no período testado.
  - Isso demonstra empiricamente que a instabilidade sob altas taxas de envio é uma característica de acúmulo contínuo de pacotes já existente nas versões anteriores, e não uma regressão introduzida nas alphas 27 ou 28.
  - Hipótese técnica correlacionada: streaming contínuo a 60 FPS sem controle de fluxo no cliente sobrecarrega o buffer de transporte local do Node.js e a fila de processamento do OpenRGB/SMBus, acumulando requisições e gerando timeout em `getControllerData`.
- **Implementação do controle de tráfego no Nexus RGB (limites e salvaguardas):**
  - **Backpressure e descarte de quadros obsoletos:** monitoramento de `socket.writableLength > 2048`. Em caso de contenção no transporte local (dados acumulados aguardando entrega ao socket do SO), quadros de animação obsoletos são descartados (`framesDroppedTransport++`), impedindo inchaço de memória. Um ouvinte de `drain` aciona imediatamente o envio do quadro mais recente, sem rajada de quadros acumulados.
  - **Prioridade absoluta de desligamento e Off:** comandos de desligamento (`isPowerOff = true` ou preto total) nunca sofrem drop por backpressure e limpam `hasDroppedFrame`, garantindo que os LEDs apaguem imediatamente e impossibilitando que um quadro atrasado reacenda a iluminação no drain.
  - **Deduplicação de cores:** comparação direta canal a canal sem alocações via `colorsEqual(a, b)`. Quando o frame renderizado é idêntico ao último transmitido com sucesso ao controlador e não há comando pendente (`!forceSend`), o envio é suprimido (`framesDeduplicated++`). No efeito `sequence` (configuração real do usuário), 59 de 60 quadros/s são deduplicados sem alteração visual, reduzindo drasticamente o tráfego no socket.
  - **Invalidação estrita de cache:** cache `lastSentColors` é invalidado em `connect()`, `lost()`, `stop()`, `applyMode()`, `resize()`, `identify()` e ao alterar `sdkId` de um controlador em `discover()`.
  - **Descoberta não intrusiva:** se `nextDiscovery` vencer mas `socket.writableLength > 0`, a consulta de controle é adiada em 500 ms, impedindo que `getControllerData` concorra ou fique preso atrás de escritas represadas.
  - **Coordenação de loops:** execução atômica com `this.busy`, `this.tickPending` e `this.tickPendingSpatial`. Quadros espaciais do Studio e ticks do temporizador são serializados via `setImmediate` sem concorrência de escritas nem duplicação de pacotes. Dispositivos não mapeados no Studio adiados durante frame espacial são marcados em `deferredFromSpatial` e despachados com `forceSend` no tick comum.
  - **Métricas estruturadas de tráfego:** expostas em `Hardware.snapshot()` e `/api/diagnostics` (`render.traffic: { calculated, sent, deduplicated, dropped }`).
- **Limites da implementação (o que o controle de tráfego NÃO faz):**
  - `socket.writableLength` mede bytes pendentes no buffer local do stream Node.js até o kernel do SO; **não comprova conclusão de gravação física no OpenRGB nem no barramento SMBus/i2c**.
  - O protocolo OpenRGB não emite ACK por pacote `updateLeds`. Não há como garantir fisicamente que a fila interna do OpenRGB nunca acumule em caso de deadlock no driver C++ ou hardware.
  - A taxa de 60 FPS permanece disponível e unificada no relógio compartilhado do Nexus, sem limitação artificial assimétrica de componentes (memória RAM e placa-mãe operam com a mesma base temporal).
- **Limites dos testes de instalação e infraestrutura:**
  - O isolamento de sessão do instalador e a rejeição de encerramento de processos em outras sessões (código 47) e diálogos (código 48) foram comprovados por testes unitários dedicados em `tests/installer.test.js`. A validação em sessões de múltiplos usuários simultâneos no Windows depende de infraestrutura RDS/Terminal Services não disponível localmente.
- **Limites dos testes físicos (próximo passo no hardware real):**
  - Suavidade das transições de energia e ausência de clarões nos LEDs físicos.
  - Inversão de comandos durante uma transição em andamento no controlador real.
  - Preservação física de dispositivos apagados individualmente e excluídos do mapa.
  - Recuperação após desconexão do controlador real e comportamento físico do último quadro deixado nos LEDs.
- **Resultado físico (Alexa na alpha.20):** usuário testou a alpha.20 e confirmou aviso de falha nos dois comandos, acender e apagar. A hipótese de confirmação de brilho não resolveu esse equipamento. Nos pedidos observados de desligamento, o Echo enviou somente `on`, sem `bri`; respostas HTTP 200 terminaram em poucos milissegundos, e consultas posteriores devolveram energia apagada e controlador disponível. Dados identificadores do equipamento e da rede permanecem privados.
- **Resultado posterior em Alexa+:** o usuário pediu por voz para a Alexa deixar de anunciar o erro e informou que funcionou. Nenhuma outra mudança de código ou reinstalação ocorreu. Registrar como preferência de resposta/solução prática relatada pelo usuário, sem concluir que o protocolo foi corrigido. O estado do aplicativo Alexa após esse pedido não foi retestado.
- **Pendência técnica (Alexa):** a causa do aviso no protocolo permanece desconhecida. Investigar caso o usuário queira retomar; a confirmação de brilho não é causa comprovada. Grupos, rotinas e estado no aplicativo precisam de teste separado. Não iniciar novas tentativas de alteração ou recadastro automaticamente após a solução prática relatada.
- **Demais melhorias:** blocos de estabilidade/hardware (alpha.21), layout de Configurações (alpha.22), clareza visual e rede (alpha.23) e edição, energia, diagnóstico e recuperação (alpha.24 a alpha.26) concluídos no código e validados em ambiente isolado.
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
3. **Melhorias de controle de tráfego e velocidade dupla no Studio (alpha.32):** a limitação estrita de cadência da DRAM SMBus a 20 FPS sob ticks espaciais do Studio (`hardware.tick(true)`) foi implementada e 100% validada na suíte automatizada (`tests/traffic-control.test.js`, 168/168 testes passando, incluindo teste dedicado de ticks espaciais). O próximo passo prático é compilar e publicar a `v0.1.0-alpha.32` para validação física no hardware real a 60 FPS com a RAM blindada a 20 FPS. Nenhuma instalação ou comando de LED deve ser feito sem autorização explícita.
4. **Trabalhar em mudanças pequenas:** reproduzir o problema com SDK/ambiente isolado, corrigir um comportamento e testar preservação dos dados antes de avançar. Não depender de um número fixo de LEDs, modelo de placa-mãe ou ordem de descoberta.
5. **Validar e distribuir:** executar verificações pertinentes, registrar os resultados, e, se a tarefa autorizada incluir publicação, gerar uma nova versão com executáveis correspondentes e passar pelas duas VMs e pelo bloqueio de segurança. Não mover as tags anteriores (`v0.1.0-alpha.20` a `v0.1.0-alpha.26`, `checkpoint/alpha20-before-antigravity-2026-10-16`) nem substituir seus assets.
6. **Antes de alterar a instalação real:** pedir autorização para instalador/UAC/reinício de serviços e permitir que o usuário aceite o Windows, inclusive por acesso remoto. Nas instalações assistidas locais, mostrar interface visível (sem `/VERYSILENT`, acionando via `ShellExecute` do Explorer no desktop interativo quando o terminal estiver em desktop isolado) e reabrir/conferir a bandeja na sessão do usuário. Não reiniciar o PC automaticamente.
7. **Antes de parar ou trocar de ferramenta:** atualizar este documento com mudanças, arquivos, testes, Git/release/instalação, falhas e próximo passo. Se parar no meio, indicar exatamente o que ficou incompleto. O registro deve continuar suficiente para outro agente retomar sem o chat anterior.

Os passos de implementação acima são a sequência sugerida para as melhorias guardadas; não substituem o pedido atual do usuário nem autorizam alterações em lote por conta própria.

## Histórico de entregas

### 17/10/2026 — Suporte a periféricos, mapeamento de barramentos e arquitetura headless

- **Objetivo autorizado:** implementar os 3 pilares explorados no ecossistema OpenRGB e autorizados pelo usuário ("pode fazer os 3."): (1) Especificação de arquitetura OpenRGB Headless ultra-leve (~9 MB sem Qt), resolução de deadlock SRWLock e timeouts I2C; (2) Suporte ampliado a periféricos e componentes com visual dedicado e layout espacial realista; (3) Mapeamento e classificação estruturada de barramentos de hardware (Intel PCH, AMD PIIX4, SuperIO e USB-HID) com diagnósticos em conformidade com a privacidade.
- **Arquitetura Headless e Análise de Deadlock (`docs/OPENRGB-HEADLESS.md`):**
  - Documentação da redução de ~48 MB para ~9 MB pela eliminação de bibliotecas Qt6 (`Qt6Widgets`, `Qt6Gui`, `Qt6OpenGL`, etc.) e shaders DirectX (`dxcompiler.dll`, `dxil.dll`), diminuindo o consumo de memória ociosa de ~90 MB para ~15–25 MB.
  - Análise física e matemática do deadlock em módulos DRAM ENE no Windows: a implementação nativa de `std::shared_mutex` sobre `SRWLOCK` no Windows prioriza requisições de escrita exclusiva, bloqueando leituras compartilhadas aninhadas (`ReentrantSharedMutex` resolve essa inanição na raiz).
  - Timeouts por detector I2C/SMBus delimitados em 3000 ms, impedindo que dispositivos em clock-stretching travem a inicialização do daemon por até 60 segundos.
- **Suporte a Periféricos e Adaptação Espacial (`public/app.js`, `public/en.js`, `public/spatial.js`):**
  - Ícones vetoriais SVG específicos para Teclados (`keyboard`), Mouses (`mouse`), Placas de Vídeo (`gpu`), Coolers/Fans (`cooler`) e Fitas LED (`strip`), além dos existentes para placa-mãe e RAM.
  - Badges visuais de identificação de tipo em `renderMini()` e `renderDevices()`, com suporte a múltiplos idiomas e dicionário inglês (`public/en.js`).
  - Posicionamento e formatos inteligentes em `spatial.defaults()`: proporção retangular horizontal (3:1) para teclados, proporção oval compacta para mouses e anéis circulares (`fan`) para coolers e fans.
- **Mapeamento de Barramentos e Metadados (`server/hardware.js`, `server/diagnostics.js`):**
  - Detecção pura via `detectBusArchitecture(device)` e `classifyDeviceType(device)` identificando barramentos `intel-smbus` (i801), `amd-smbus` (PIIX4/SB800), `superio` (Nuvoton NCT67xx / ITE LPC), `usb-hid` e `generic-smbus`.
  - Correção na divisão de zonas em componentes (`components()`): propagação dos metadados `type`, `busType` e `vendor` para todas as zonas divididas, preservando a identidade dos conectores ARGB da placa-mãe.
  - Exposição segura em `Hardware.snapshot().busTypes` e `/api/diagnostics` (`health.busTypes`), preservando estritamente a allowlist sem expor localizações físicas, endereços hexadecimais ou seriais.
- **Validação com testes automatizados:**
  - `tests/controllers-matrix.test.js`: 4 novos testes unitários cobrindo classificação de barramentos, categorização de periféricos, layout espacial e anonimização de diagnósticos.
  - Suíte completa: 176 testes unitários (`npm test`) e 40 testes Playwright (`npm run test:ui`) — 216 testes no total — 100% aprovados sem falhas.

### 17/10/2026 — Detecção de conflitos de iluminação e softwares concorrentes

- **Objetivo autorizado:** criar diagnóstico automatizado para detectar causas frequentes de interferência e travamentos no OpenRGB (Windows 11 Dynamic Lighting e softwares RGB concorrentes de fabricantes), aproveitando os aprendizados e estudos do ecossistema de controladoras RGB e autorização do usuário ("faça tudo q achar necessário! lembre de salvar no contexto e nos outros bgl oq vc foi fazendo quando necessrio").
- **Implementação em `server/conflicts.js`:**
  - Consulta estritamente somente-leitura ao Registro do Windows via `reg.exe query HKCU\Software\Microsoft\Lighting /v AmbientLightingEnabled`, identificando se a Iluminação Dinâmica do Windows 11 está ativa (no PC do usuário foi verificado `0x1`).
  - Varredura de processos ativos via `tasklist.exe /FO CSV /NH` comparados contra uma allowlist fechada de executáveis conhecidos por disputar barramentos e dispositivos USB/HID: `icue` (Corsair iCUE), `armoury-crate` (ASUS Armoury Crate / Aura LightingService), `l-connect` (Lian Li L-Connect), `razer-synapse` (Razer Synapse), `rgb-fusion` (Gigabyte RGB Fusion), `mystic-light` (MSI Mystic Light / Center), `nzxt-cam` (NZXT CAM) e `signal-rgb` (SignalRGB).
  - Cache de 15 segundos (`sample()`) com deduplicação de chamadas simultâneas (`inflight`), garantindo ausência de sobrecarga ou processos zumbis.
- **API e Segurança em `server/index.js`:**
  - Rota `GET /api/conflicts` protegida por autenticação administrativa (`admin()`) e rate limiting para operações pesadas (`heavyRate`), recusando clientes LAN sem token.
- **Interface e Tradução em `public/`:**
  - Elemento `#health-conflicts` na seção Saúde / Consumo (`public/index.html`).
  - Renderização dinâmica em `public/health.js` através de `renderConflicts(conflicts)` que exibe alertas direcionados e orientações claras de mitigação (ex.: como desativar a Iluminação Dinâmica nas Configurações do Windows).
  - Ouvinte de `nexus:languagechange` re-renderizando a mensagem em tempo real na troca de idioma.
  - Traduções completas em `public/en.js`.
- **Validação com testes automatizados:**
  - `tests/conflicts.test.js`: 4 testes unitários cobrindo ativação/desativação da Iluminação Dinâmica, identificação de processos na allowlist, cache de 15 segundos e execução real no Windows.
  - `tests/api.test.js`: validação de resposta 200 com cookie de administrador e 403 bloqueando acessos remotos via LAN.
  - `tests/ui/health.spec.js`: teste Playwright validando a exibição do banner de conflitos e a alternância imediata de idioma para o inglês.
  - Suíte completa: 172 unitários e 40 de interface (212 testes no total) 100% aprovados.

### 17/10/2026 — Correção definitiva do ritmo duplo no Studio (alpha.32)

- **Objetivo autorizado:** sanar a brecha no ritmo duplo onde a memória RAM continuava operando a 60 FPS durante o modo Studio, relatada pelo usuário após testes práticos com a alpha.31 ("tu n limitou a memoria ram a 20? pq eu botei a 60 aqui e depois de um tempo travou").
- **Causa raiz diagnosticada:** no loop espacial do Studio (`hardware.tick(true)`), a cada quadro animado a propriedade `this.studio.revision` era incrementada, tornando `signature` diferente a cada tick. Isso ativava `changed = true` e `forceSend = true`. Como a verificação de contenção na alpha.31 possuía `!forceSend`, ela era anulada a cada quadro espacial, transmitindo a RAM a 60 FPS e sobrecarregando o barramento SMBus/I2C.
- **Correção em `server/hardware.js`:**
  - Removido `!forceSend` do limitador de taxa da DRAM: a contenção de intervalo (mínimo de 46 ms / ~20 FPS) agora é aplicada incondicionalmente a quadros de animação (`if (!isPowerOff && !this.identification && isSmbusRam(device))`), mesmo com `forceSend = true` gerado pelo Studio.
  - Apenas desligamento total (`isPowerOff = true`) e identificação manual (`this.identification`) têm permissão para ignorar o intervalo de cadência da RAM.
  - Refinamento do classificador `isSmbusRam(device)`: exclusão explícita de localizações iniciadas por `usb` ou `hid` (`!loc.startsWith('usb') && !loc.startsWith('hid')`), garantindo que apenas dispositivos no barramento SMBus/DRAM sofram limitação, evitando falso estrangulamento de controladoras simuladas ou dongles USB.
- **Validação com testes automatizados:**
  - Adicionado teste específico em `tests/traffic-control.test.js`: `ritmo duplo no Studio: ticks espaciais (tick(true)) mantêm placa-mãe a 60 FPS e contêm RAM a 20 FPS`.
  - Suíte completa: 168/168 testes aprovados (`npm test`, 0 falhas).
  - Testes de instalador: 12/12 cenários aprovados (`node scripts/test-installer-smoke.js`).
  - Verificação de release: aprovada em `node scripts/check-release.cjs v0.1.0-alpha.32`.

### 17/10/2026 — Ritmo inteligente de velocidade dupla por barramento (preparação alpha.31)

- **Objetivo autorizado:** implementar velocidade dupla desacoplando a taxa de escrita dos módulos de memória RAM no barramento SMBus/I2C (limitados a 20 FPS seguros) enquanto preserva o relógio unificado e taxa global a 60 FPS para placa-mãe e demais componentes, atendendo à solicitação direta do usuário ("ent faz isso limita o fps da ram pra 20 fps") após confirmação empírica de congelamento do OpenRGB a 60 FPS e 30 FPS no hardware físico.
- **Detecção segura de RAM SMBus (`server/hardware.js`, `tests/traffic-control.test.js`):**
  - Função pura `isSmbusRam(device)` classificando estritamente dispositivos com `device.type === 1` (`DEVICE_TYPE_DRAM`) ou palavras-chave `dram`, `ram`, `memória`, `memory`, `ene smbus/dram`, `trident`, `vengeance`, `ballistix`, `dominator`, e excluindo categoricamente placas-mãe (`type === 0`).
- **Limitação de intervalo para barramento SMBus (`server/hardware.js`):**
  - Controle de carimbo temporal por dispositivo via `this.ramLastSentTime = new Map()`, limpo em `connect()`, `lost()` e `stop()`.
  - Em `sendLeds()`: se `!forceSend && !isPowerOff && isSmbusRam(device)`, impõe intervalo mínimo de 46 ms (~20 FPS). Quadros excedentes a 60 FPS são omitidos preventivamente (`metrics.framesThrottledRam++`), eliminando contenção física e colisões I2C com o chipset.
- **Prioridade absoluta de energia e comandos manuais:**
  - Comandos de desligamento imediato (`isPowerOff = true` / blackout) e comandos com flag de envio forçado (`forceSend = true`) ignoram completamente o limitador de taxa, garantindo desligamento instantâneo sem retenção de quadros acesos na RAM.
- **Métricas e diagnósticos (`server/hardware.js`, `server/diagnostics.js`):**
  - Métrica estruturada `metrics.framesThrottledRam` e flag `device.rateLimited` expostas no snapshot de hardware e na rota `/api/diagnostics` sob `render.traffic.throttledRam`.
- **Suíte de testes de ritmo duplo (`tests/traffic-control.test.js`):**
  - Testes unitários para identificação de dispositivos DRAM e exclusão de placa-mãe.
  - Teste de integração do motor de taxa dupla: 60 ticks a 60 FPS comprovando placa-mãe recebendo 60 envios, RAM recebendo exatamente 20 envios (40 quadros throttled), e desligamento imediato com `power: false` despachado no primeiro tick sem atraso.
  - Suíte completa: 167/167 testes passando (`npm test`, 0 falhas).

### 17/10/2026 — Controle de tráfego, backpressure, deduplicação de cores e coordenação de loops (preparação alpha.29 e alpha.30)

- **Objetivo autorizado:** implementar controle de tráfego para eliminar sobrecarga no transporte OpenRGB em altas taxas de quadros (60 FPS e 30 FPS), conforme observado empiricamente pelo usuário em hardware real tanto na versão recente quanto em versão oficial anterior; manter taxa global unificada e relógio comum sem limitação assimétrica de componentes.
- **Backpressure e descarte de quadros obsoletos (`server/hardware.js`, `tests/traffic-control.test.js`):**
  - Monitoramento de `socket.writableLength > 2048` em `sendLeds()`. Quando o transporte local do Node.js retém bytes aguardando envio ao kernel, quadros de animação subsequentes são descartados (`metrics.framesDroppedTransport++`), impedindo acúmulo descontrolado de buffers de escrita.
  - Registro de ouvinte único de `drain` no socket do cliente. Ao liberar a contenção local, se `hasDroppedFrame` estiver ativo, dispara imediatamente um novo tick para enviar o quadro mais recente, sem rajada de quadros acumulados.
  - Salvaguarda crítica de desligamento: quadros com `isPowerOff = true` ou cor preta total nunca sofrem drop por backpressure e limpam `hasDroppedFrame`, garantindo que os LEDs apaguem imediatamente e impedindo que um quadro atrasado reacenda a iluminação no drain.
- **Deduplicação estrita de cores (`server/hardware.js`, `tests/traffic-control.test.js`):**
  - Função pura `colorsEqual(a, b)` comparando canais `red`, `green`, `blue` elemento a elemento sem alocações no heap.
  - Cache `lastSentColors` armazena a última saída enviada com sucesso ao controlador. Se as cores do quadro renderizado forem idênticas e não houver flag de envio forçado (`!forceSend`), o envio ao SDK é omitido e incrementa `metrics.framesDeduplicated`.
  - No cenário do usuário com o efeito mestre `sequence`, a deduplicação reduz ~98% dos envios ao SDK quando as cores permanecem estáticas entre as alternâncias.
  - Invalidação estrita do cache em todos os eventos estruturais: `connect()`, `lost()`, `stop()`, `applyMode()`, `resize()`, `identify()` e ao alterar `sdkId` do controlador em `discover()`.
- **Descoberta não intrusiva durante tráfego ativo (`server/hardware.js`, `tests/traffic-control.test.js`):**
  - No ciclo de `tick()`, quando `nextDiscovery` expira mas `socket.writableLength > 0`, a execução de `discover()` é postergada em 500 ms, impedindo que requisições `getControllerData` fiquem presas ou concorram com escritas represadas no socket.
- **Coordenação dos loops de hardware e Studio (`server/hardware.js`, `tests/traffic-control.test.js`):**
  - Serialização atômica de requisições concorrentes via `tickPending` e `tickPendingSpatial` quando `this.busy` está ativo. Ao finalizar a execução no bloco `finally`, despacha o tick pendente via `setImmediate`, eliminando concorrência de escritas e perda de atualizações.
  - Dispositivos não mapeados no Studio que são pausados durante um frame espacial são marcados em `deferredFromSpatial` e recebem seus quadros com `forceSend` no tick regular subsequente.
- **Métricas e diagnósticos (`server/hardware.js`, `server/diagnostics.js`):**
  - Métrica estruturada `metrics: { framesCalculated, framesSent, framesDeduplicated, framesDroppedTransport }` exposta no snapshot e em `/api/diagnostics` sob `render.traffic`.
- **Suíte de testes de controle de tráfego (`tests/traffic-control.test.js`):**
  - 9 testes automatizados cobrindo comparação de cores sem alocação, descarte por backpressure, retomada no drain sem rajada, deduplicação de quadros estáticos, desligamento prioritário sob congestionamento, invalidação de caches por modo/redimensionamento/reconexão/identificação, adiamento de descoberta sob tráfego, serialização de loops concorrentes e benchmark de 60 FPS com 5 dispositivos simulados (redução de 59/60 frames no efeito sequence e tempo total de CPU inferior a 10 ms).

### 17/10/2026 — Robustez de cancelamento, sincronização automática do mapa, isolamento de sessão do instalador e validação Playwright (preparação alpha.28)

- **Objetivo autorizado:** corrigir as lacunas de cancelamento e contaminação entre conexões no hardware, garantir que o mapa do Studio atualize e selecione peças automaticamente após reinício/atualização sem precisar alternar efeitos, implementar encerramento gracioso e retorno automático da bandeja respeitando sessões do Windows e funções de processo, e validar a experiência completa no navegador real com Playwright.
- **Cancelamento explícito e ciclo de vida de operações (`server/hardware.js`, `tests/hardware.test.js`):**
  - Rastreamento de operações ativas em `this.activeOperations = new Set()`.
  - Implementado `cancelOperations(reason, generation, client)` que rejeita operações com `err.code = 'ECANCELLED'`, revalida `this.busy`, cancela temporizadores associados e descarta callbacks pendentes.
  - `recordFailure(err)` ignora cancelamentos (`err.code === 'ECANCELLED'`), operações com geração divergente ou instâncias de hardware encerradas (`this.stopped`).
  - `operation()` protege contra rejeições tardias de promises do SDK via `promise.catch(() => {})`, evitando unhandled rejections no processo Node.js.
  - `stop()` redefine `this.busy = false`, incrementa a geração, invoca `cancelOperations()` e limpa todos os timers e sockets de forma síncrona e definitiva.
  - 46/46 testes aprovados em `tests/hardware.test.js`, com teste de regressão comprovando término imediato com `ECANCELLED` e liberação de `this.busy`.
- **Sincronização automática do mapa (`public/studio.js`, `public/app.js`, `tests/studio.test.js`, `tests/ui/studio.spec.js`):**
  - Em `NexusStudio.update()`, detecção de mudanças estruturais via assinatura `hardwareSignature` (comparando conectividade, IDs, nomes, contagem de LEDs, status, exclusão de mapa, zonas e capacidade de transição suave), disparando `refresh(true, false)` automaticamente.
  - No stream de prévia SSE (`connectPreview`), a chegada de um quadro com layout quando `data.layout` local está vazio também engatilha `refresh()` automático.
  - Em `refresh()`, sequenciador `refreshSeq` rejeita respostas HTTP/SSE defasadas, e a detecção de novo layout sem peça previamente selecionada auto-seleciona a primeira peça (`selected = data.layout[0].key`), preenchendo o formulário de inspeção e ocultando a mensagem `#studio-empty`.
  - Guardas defensivas adicionadas em `public/studio.js` e `public/app.js` para manipulação segura de coleções (`effect.controls`, `alexa`, `profiles`).
  - Suíte Playwright real de interface expandida para 9 cenários em `tests/ui/studio.spec.js` (total de 39 testes de UI aprovados no Playwright), cobrindo: mapa aberto vazio (`#studio-empty`), chegada progressiva de RAM e placa-mãe, reinício/reconexão de servidor e controlador sem trocar efeito, mudança de capacidade com contagem constante, rejeição de respostas defasadas, persistência de arraste e soltura com undo/redo, e alternância entre PT-BR e EN sem recarregar.
- **Encerramento gracioso, compatibilidade com Restart Manager e isolamento de sessão do instalador (`native/NexusRGB.cs`, `installer/service-preflight.ps1`, `installer/NexusRGB.iss`, `tests/installer.test.js`):**
  - Em `native/NexusRGB.cs`, criada janela de mensagens oculta `TrayMessageWindow : NativeWindow` que processa `WM_QUERYENDSESSION` (retorna 1), `WM_ENDSESSION` (`ENDSESSION_CLOSEAPP`) e `WM_CLOSE`, chamando `tray.ExitThread()` para fechamento nativo pelo Windows Restart Manager.
  - Evento de término escopado para `Local\NexusRGB.Tray.Exit.<PathHash>` com permissões explícitas para `AuthenticatedUserSid` via `EventWaitHandleSecurity`, preservando escopo de compatibilidade com versões legadas.
  - Em `installer/service-preflight.ps1`:
    - Identifica a sessão interativa do chamador via `ProcessIdToSessionId` (parâmetro `-SessionId`).
    - Distingue a bandeja dos processos de serviço e de diálogos (`--restart-rgb`, `--configure-ports`), saindo com código 48 sem forçar encerramento.
    - Bloqueia encerramento de processos em outras sessões de usuário, saindo com código 47.
    - Cria o marcador `nexus-tray-resume.txt` apenas para sessões interativas do usuário (não cria em sessão 0).
    - Revalida estritamente caminho executável, ID de sessão e data de criação (`CreationDate`) imediatamente antes de qualquer encerramento forçado para prevenir ações sobre PIDs reutilizados.
  - Em `installer/NexusRGB.iss`:
    - Executa o preflight no evento `NextButtonClick(wpReady)`, encerrando a bandeja no exato momento em que o usuário clica em "Instalar", antes da verificação de mutex em `wpPreparing`. Isso elimina a exibição do diálogo de fechamento do Inno Setup.
    - Função `ShouldLaunchTray` desativa reabertura quando executado na sessão de serviços (Sessão 0).
    - Tratamento explícito de mensagens de erro para códigos de saída 47 (processo em outra sessão) e 48 (diálogo ativo).
  - 10/10 testes aprovados em `tests/installer.test.js` e 12/12 cenários aprovados em `node scripts/test-installer-smoke.js`.
- **Validação consolidada:** 156/156 testes unitários/integração aprovados (`npm.cmd test`), 39/39 testes de UI aprovados (`npm.cmd run test:ui`).
- **Tabela comparativa de problemas e correções:**

| Problema reproduzido | Correção realizada | Teste executado | Resultado observado | Limitações e pendências |
| :--- | :--- | :--- | :--- | :--- |
| **Cancelamento de operação pendente:** chamadas assíncronas do SDK sem resposta continuavam pendentes após `stop()` ou reconexão, mesmo após limpeza de timers. | `cancelOperations()` em `server/hardware.js` rejeita operações pendentes com `err.code = 'ECANCELLED'`, revalida `this.busy`, descarta callbacks e trata rejeições tardias com `.catch(() => {})`. | `tests/hardware.test.js`: simulação de Promise pendente interrompida por `stop()` e reconexão. | Operações encerram imediatamente com `ECANCELLED`, timers limpos, liberação de `busy` e sem unhandled rejections no Node.js. | Simulação no Node.js não altera o comportamento interno do C++ do OpenRGB nem prova ausência de vazamentos no processo do OpenRGB. |
| **Contaminação de diagnósticos entre conexões:** timeouts ou erros tardios de uma conexão anterior registravam falha e incrementavam contadores na conexão nova. | Isolamento por geração (`this.generation`), validação de `client` ativo e descarte de erros `ECANCELLED` ou de gerações divergentes em `recordFailure()`. | `tests/hardware.test.js`: injeção de erro tardio após reconexão / término de geração. | Geração nova permanece limpa (`failures: 0`, `lastFailure: null`), sem contaminação por eventos obsoletos. | Não elimina a causa física/driver que levou o hardware a falhar na geração anterior. |
| **Sincronização do mapa no Studio:** após atualização ou reinício do serviço, o Studio mantinha mapa vazio ou exigia troca manual de efeito para exibir dispositivos recém-descobertos. | Detecção de divergência de contagem ou assinatura em `NexusStudio.update()`, stream SSE e `refresh()` com auto-seleção da primeira peça (`selected = layout[0].key`). | `tests/studio.test.js` e Playwright `tests/ui/studio.spec.js` (9 testes no navegador real Edge/Chromium). | Dispositivos (RAM e placa-mãe) surgem em etapas, tela `#studio-empty` desaparece e inspetor é preenchido sem troca de efeito. | O relógio temporal compartilhado alinha o cálculo da fase no motor do Nexus, mas não prova simultaneidade física perfeita nos barramentos de hardware. |
| **Rejeição de respostas obsoletas no Studio:** requisições concorrentes ou lentas de `/api/studio` podiam sobrescrever um estado mais recente do mapa. | Sequenciador `refreshSeq` em `public/studio.js`; descartadas respostas cujo sequenciador não coincida com o mais recente. | `tests/ui/studio.spec.js`: injeção de resposta SSE atrasada após atualização local de layout. | Respostas defasadas são ignoradas; layout mais recente é preservado intacto. | Protege a sincronia da interface web; não altera a ordem de processamento em múltiplos navegadores sem SSE ativo. |
| **Fechamento e reabertura da bandeja no instalador:** preflight selecionava processos por caminho sem validar sessão interativa, arriscando encerrar outras sessões ou modos de recuperação. | `installer/service-preflight.ps1` valida `SessionId`, rejeita sessões externas (código 47) e diálogos (código 48), sinaliza `Local\NexusRGB.Tray.Exit.<hash>`, confere PID/criação antes de forçar, e reabre via `runasoriginaluser`. | `tests/installer.test.js` (4 testes de pré-instalação, isolamento de sessão e modos) e `scripts/test-installer-smoke.js`. | Encerramento gracioso via evento nomeado / janela nativa de mensagens, preservação de processos em outras sessões e reinstalação sem alerta de arquivo em uso. | Testes de múltiplas sessões de usuário reais dependem de infraestrutura Windows RDS/Terminal Services não disponível neste ambiente local. |
| **Indisponibilidade parcial do OpenRGB:** controlador de RAM/SMBus deixou de responder a consultas de descrição em 17/10 (~10h35 e ~11h19), recuperado com reinício. | Diagnóstico fiel (`offline`, `controllerHung`, protocolo `nexusrgb://restart`), sem travamento silencioso do Nexus, mantendo 60 FPS estáveis. | Coleta forense em `data/controller-recovery-20261017-*`, testes unitários e de integração de recuperação. | Notificação clara de falha no painel e recuperação manual bem-sucedida via reinício dos serviços. | Causa interna específica (travamento de barramento SMBus/I2C, deadlock em thread de driver ou firmware) permanece não confirmada; melhorias no Nexus não equivalem a correção no C++ do OpenRGB. |

### 17/10/2026 — Implementação da primeira entrega de robustez e recuperação de controlador (alpha.27)

- **Objetivo autorizado:** implementar a primeira entrega de robustez e recuperação manual de controlador sem resposta conforme o plano e `docs/RECUPERACAO-CONTROLADOR.md`, sem alterar a instalação real do PC, comandar LEDs físicos, reiniciar serviços ou solicitar UAC sem confirmação.
- **Isolamento de conexão por geração e ciclo de vida:**
  - Introduzido contador incremental `this.generation` em `server/hardware.js`. Cada chamada de `connect()` incrementa a geração.
  - Todas as operações assíncronas (`operation()`, listeners de socket, eventos de `error` e `disconnect`) verificam se pertencem à geração e instância de cliente ativas.
  - Temporizadores de timeout são rastreados em `this.activeTimers` e explicitamente limpos e cancelados em reconexões ou ao chamar `stop()`.
  - Conexões anteriores (`prevClient`) têm seus sockets destruídos na abertura de um novo ciclo, prevenindo acúmulo de sockets zumbis no sistema operacional.
- **Preservação de causa da falha e diagnóstico fiel:**
  - `recordFailure(err)` armazena erro estruturado em `lastFailure` com código `ETIMEDOUT`, fase da operação (`controller-description`, etc.), limite em milissegundos, índice do controlador e contagem deduplicada.
  - O método `lost(error)` protege o erro original gravado: quando a destruição do socket dispara o fechamento subsequente do TCP, a mensagem informativa de timeout não é mais substituída pela mensagem genérica "Controlador desconectado.".
  - Corrigido o mapeamento em `server/diagnostics.js:13`: dispositivos agora recebem status `'offline'` e `stale: true` quando `!hw.connected`, eliminando o falso `'online'` presente em versões anteriores durante falhas parciais.
  - Campos privados (seriais, caminhos locais e endereços de rede) continuam rigorosamente excluídos do diagnóstico exportável.
- **Detecção de assinatura e ação de recuperação manual:**
  - Reconhecimento automático de falha persistente (3 timeouts consecutivos em leitura de descrição de controlador ativam `controllerHung = true`).
  - Interface (`public/app.js`, `public/health.js`, `public/en.js`) exibe distintivo "● OpenRGB sem resposta", resumo explicativo e botão "Reiniciar controlador" acionando o protocolo local `nexusrgb://restart`. A ação exige consentimento explícito do administrador local com UAC nativo, sem expor endpoints de execução arbitrária na rede.
- **Sincronização determinística de animação entre placa e RAM:**
  - Corrigido o descompasso visual relatado ao desligar e ligar (`power: false` -> `power: true`). Em vez de resetar o relógio de cada componente isoladamente ao sair de `mult <= 0`, introduzido `this.sharedAnimations` em `server/hardware.js`, unificando a referência temporal `startedAt` para todos os dispositivos que compartilham o mesmo efeito e assinatura de parâmetros. Mantida a taxa integral de 60 FPS sem degradação visual.
- **Testes e validações executadas (100% aprovados):**
  - 11 novos testes automatizados em `tests/hardware.test.js` (37 testes no arquivo, todos verdes).
  - Suíte completa de testes (`npm.cmd test`): 142 testes executados e aprovados (0 falhas).
  - Testes do instalador (`node scripts/test-installer-smoke.js`): 12 testes aprovados.
  - Teste de firewall (`node scripts/test-offline-firewall.js`): aprovado (`internetBlockVerified: true`).
  - Teste de estabilidade (`node scripts/test-stability.js`): aprovado (600s, 1396 requisições, 10 reinícios abruptos, sem vazamentos).
  - Teste do supervisor (`node scripts/test-supervisor.js`): aprovado.
  - Validador de release (`node scripts/check-release.cjs v0.1.0-alpha.27`): aprovado.
- **Compilação e instalador:**
  - Executáveis compilados localmente com sucesso via `scripts/build-native.ps1` e `scripts/build.ps1`: `NexusRGB-Setup-0.1.0.exe` e `NexusRGB-Uninstall-0.1.0.exe`.
- **Git, publicação e instalação:**
  - Código commitado no commit `c29211be3204f99cd9210d1529386aa5b423c008` e tag anotada `v0.1.0-alpha.27`.
  - Publicação oficial concluída em [releases/tag/v0.1.0-alpha.27](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.27) via workflow [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39044233690) (`success`).
  - Hashes oficiais SHA-256 registrados em `BUILD-INFO.json` e `SHA256SUMS.txt`:
    - `NexusRGB-Setup-0.1.0.exe`: `1f6b7449c5be8f6905a20c2a76a0c24f3d386f836a194e1202cdf85f4ba57644` (94.637.752 bytes).
    - `NexusRGB-Uninstall-0.1.0.exe`: `a678afcd8481a81c442b057166fd939c0b1e010f1c308088e5e1f67d8ae6121c` (241.664 bytes).
  - A instalação real no PC físico permanece na `v0.1.0-alpha.26`. Atualização assistida para `v0.1.0-alpha.27` aguarda autorização explícita do usuário.

### 17/10/2026 — Segunda perda de conexão e recuperação autorizada

- Às 11h19 (Brasília), o painel confirmou nova desconexão na alpha.26, com os serviços Running e o mesmo processo OpenRGB iniciado na recuperação anterior, às 10h38. Não houve evidência de um reinício intermediário. O usuário informou que o Antigravity já estava parado; não foi atribuída a recorrência a um teste específico ou ao FPS.
- Após nova autorização explícita do usuário conectado, foram coletados os registros protegidos e executado novamente apenas o script oficial instalado de reinício de Nexus/OpenRGB. Conclusão às 11h20 com código 0; painel saudável, controlador conectado e cinco componentes, com detecção concluída na consulta. Windows não foi reiniciado; nenhum driver ou proteção foi alterado.
- Os 41 arquivos de dados acompanhados mantiveram seus hashes, sem ausentes. FPS continua 60 e transição de energia continua 400 ms. Registro, cópia dos ajustes e evidências ficam em `data/controller-recovery-20261017-02/`, separados do primeiro incidente e ignorados pelo Git.
- O último registro anterior à recuperação continha mensagem de fechamento de conexão às 10h49, mas isso não determina o início ou a causa da segunda falha. Nesta recorrência não foi repetida a consulta direta por índice de controlador, portanto não afirmar que o mesmo controlador específico travou de novo. A recuperação restaurou conexão; ausência de nova falha e resultado visual físico ainda dependem de observação.
- Nenhuma alteração de código ou publicação. A proposta de recuperação permanece documental, não implementada; instalação e release continuam alpha.26. Alterações documentais locais anteriores preservadas. Próximo passo: confirmar o funcionamento com o usuário e implementar/testar a proposta somente quando solicitado, sem reinícios automáticos nesta sessão.

### 17/10/2026 — Proposta de solução para indisponibilidade parcial do OpenRGB

- O usuário pediu ajuda para criar uma solução após a investigação do outro agente. Foram lidos o relato e os trechos locais de Nexus, SDK e OpenRGB. Alterações documentais locais anteriores foram preservadas; nenhuma implementação, instalação, consulta ao hardware ou reinício foi realizado nesta etapa.
- Nota explícita de correção às conclusões anteriores de "deadlock demonstrado": os trechos citados de descrição e atualização usam `AccessMutex.lock_shared()`, portanto uma leitura compartilhada não explica sozinha o bloqueio de outra. Outras travas/escritores podem participar, mas faltam pilhas/instrumentação do incidente. O prazo de encerramento de 1,5 segundo e o timeout de uma consulta não identificam a thread/causa física. A mensagem de socket posterior à falha também não demonstra o gatilho. A assinatura de indisponibilidade parcial é observada; deadlock SMBus específico e saturação por 60 FPS continuam hipóteses.
- Criado `docs/RECUPERACAO-CONTROLADOR.md`, referenciado no plano: diagnóstico offline correto, causa estruturada preservada, operações vinculadas à geração, assinatura repetida de falha, recuperação manual integrada, opção automática futura limitada pelo supervisor e testes de preservação. Cadência por controladora é avaliação posterior, sem limite fixo por nome/modelo.
- Git: base `f144096`, sem commit/tag/publicação novos; mudanças apenas no novo documento, plano e contexto já modificado anteriormente. O código e a instalação continuam alpha.26. Próximo passo: apresentar a proposta; implementação, publicação e teste físico não foram iniciados. Verificação documental aprovada: `git diff --check` e verificador de 57 arquivos Markdown, 197 links locais e sintaxe dos trechos Bash de cinco workflows. Suítes do aplicativo não foram repetidas para esta proposta.

### 17/10/2026 — Perda de comunicação com OpenRGB e recuperação autorizada

- O usuário relatou parada do controle na alpha.26. Painel e serviços permaneciam ativos, mas `hardware.connected` era falso. Consultas somente de leitura ao SDK confirmaram resposta de protocolo e três controladores; a descrição do controlador de índice 0 respondeu, mas a de índice 1 excedeu o prazo, tanto via biblioteca quanto por leitura direta do protocolo. Nenhuma cor ou redimensionamento foi enviado durante o diagnóstico.
- O usuário autorizou explicitamente coleta do registro protegido e reinício dos serviços, estando conectado para aceitar UAC. Foram preservados registros anteriores e cópia dos ajustes em `data/controller-recovery-20261017-01/`, ignorada pelo Git. O auxiliar elevado chamou exclusivamente o `scripts/restart-services.ps1` da instalação oficial, após coletar os registros. Não houve instalação, alteração de driver/proteções, modificação de ajustes ou reinício do Windows.
- O script de recuperação terminou com código 0. Os serviços voltaram a Running e o painel confirmou `ready: true`, `connected: true`, cinco componentes e `detecting: false`. Todos os 41 arquivos de dados acompanhados (JSONs de configuração/recuperação e efeitos) mantiveram os hashes e nenhum desapareceu.
- O registro do OpenRGB contém erro `[NetworkServer] recv_select failed receiving magic, closing listener` durante a investigação. A desconexão já havia sido relatada antes desse registro; ele não demonstra a causa inicial. Há avisos antigos de inicialização também presentes após recuperação bem-sucedida, portanto não foram tratados como causa comprovada nem justificativa para reinstalar drivers. Não há evidência suficiente para atribuir o episódio a 60 FPS ou às transições.
- Recuperação operacional observada, não correção definitiva de código. A percepção física dos LEDs depende de confirmação do usuário. Se ocorrer novamente, preservar o horário, estado e registros antes do reinício para investigar a falha por controlador e a recuperação do servidor SDK. Versão instalada e publicada permanecem alpha.26; nenhuma nova compilação/tag/publicação. Apenas este contexto foi alterado localmente, sem commit novo.

#### Investigação técnica detalhada dos 5 pontos (Análise e reproduções isoladas)

Em resposta à solicitação de investigação aprofundada (sem alteração da instalação real, sem reinício de serviços e sem comandos físicos), foi realizado um rastreamento completo no código-fonte do OpenRGB C++ (`vendor/openrgb-source/openrgb`), no cliente Node.js (`server/hardware.js`, `server/diagnostics.js`) e foram executados testes de reprodução isolados com servidor TCP mock e SDK mock.

1. **Bloqueio por controlador no OpenRGB (Ponto 1):**
   - *Por que versão e contagem respondem enquanto a descrição trava:* no OpenRGB (`NetworkServer.cpp`), `ProcessRequest_ClientProtocolVersion` (L1337, L3704) e `SendReply_ControllerCount` (L1307, L3603) não adquirem travas de controladores; operam somente com o estado local e `controller_ids_mutex.lock_shared()`, respondendo em sub-milissegundo.
   - Em contrapartida, `SendReply_ControllerData` (L1327, L3654) adquire explicitamente `controllers[dev_idx]->AccessMutex.lock_shared()`.
   - Cada dispositivo tem sua própria instância de `std::shared_mutex AccessMutex` (`RGBController.h:298`). O controlador 0 (`ENE DRAM` pente 1) e o controlador 1 (`ENE DRAM` pente 2) possuem mutexes distintos.
   - A thread interna do controlador (`DeviceCallThreadFunction()`, `RGBController.cpp:2078`) adquire `AccessMutex.lock_shared()` ao redor de `DeviceUpdateLEDs()`. Para controladores ENE SMBus, `DeviceUpdateLEDs()` chama `ENERegisterWriteBlock()`, que por sua vez chama `i2c_smbus_pawnio::i2c_smbus_xfer()`.
   - Em `i2c_smbus_pawnio.cpp` (L188), essa chamada executa `WaitForSingleObject(global_smbus_access_handle, INFINITE)` sobre o mutex do Windows (`Global\Access_SMBUS.HTP.Method`) e chama `pawnio_execute(handle, "ioctl_smbus_xfer", ...)`.
   - Quando essa operação no barramento I2C/SMBus ou no driver PawnIO trava (por colisão de barramento, atraso de ACK ou contenção externa), a thread do controlador 1 permanece presa com a trava compartilhada ou impede novas operações. Qualquer comando subsequente de escrita tenta `AccessMutex.lock()` (exclusivo), o que bloqueia permanentemente qualquer nova tentativa de leitura (`lock_shared()`).
   - Evidência conclusiva de bloqueio irrecuperável na thread do OpenRGB: o log do supervisor durante a recuperação (`hardware-after.log`, L182) confirmou: `Prazo de encerramento esgotado; aplicando recuperação forçada.` Isso comprova que o processo OpenRGB não conseguiu finalizar suas threads de dispositivo graciosamente no `OnStop()`, exigindo encerramento forçado do processo via Job Object / TerminateProcess.

2. **Reconexão e gerenciamento de sockets no Nexus RGB (Ponto 2):**
   - `Hardware.operation()` (`server/hardware.js:69`) aplica `Promise.race()` contra um temporizador de 4.000 ms. Ao atingir o prazo, executa: `this.client?.socket?.destroy(); reject(new Error('O controlador RGB não respondeu.'));`.
   - A destruição do socket encerra a conexão TCP imediatamente. No OpenRGB, a thread de escuta (`NetworkServer.cpp:1233`) tenta ler o próximo cabeçalho via `recv_select()`, recebe 0 (EOF) ou reset, e grava no log: `[NetworkServer] recv_select failed receiving magic, closing listener`. Fica comprovado que esse log é consequência direta do encerramento forçado pelo timeout do cliente Nexus, e não a causa da falha inicial.
   - O flag `this.busy = true` é atribuído no início de `connect()` e liberado com segurança no bloco `finally { this.busy = false; }` (L86), garantindo que o ciclo do Nexus não permaneça travado.
   - Agendamento de reconexão: `scheduleReconnect()` utiliza recuo exponencial (iniciando em 1.000 ms e dobrando até 30.000 ms), protegido por `if (this.reconnect || this.stopped) return;`, impedindo reconexões sobrepostas.
   - Ciclo de vida dos sockets: o teste em nível de protocolo TCP (`scratch/test-tcp-reproduction.js`) comprovou que exatamente 1 socket é criado e 1 socket é fechado a cada ciclo de tentativa de conexão com timeout (`openSockets == closedSockets`), descartando qualquer acúmulo ou vazamento de sockets no sistema operacional.

3. **Descoberta e envio de quadros vs 60 FPS (Ponto 3):**
   - No Nexus RGB, `this.busy = true` impede que `tick()` e `discover()` concorram na mesma conexão.
   - No entanto, a taxa configurada de 60 FPS (`fps: 60`), somada a transições contínuas de energia (`powerTransitionMs: 400`), gera envios a cada ~16,6 ms para a controladora de RAM através do barramento físico SMBus.
   - O barramento SMBus/I2C opera em baixa velocidade (tipicamente 100 kHz). Uma alta taxa de quadros direcionada a dispositivos SMBus/DRAM eleva a saturação do barramento, aumentando a vulnerabilidade a colisões ou a timeouts do protocolo de hardware se houver contenção concorrente (sensores da placa-mãe, software de monitoramento).
   - Conclusão: a falha não é causada puramente pelos 60 FPS em si, mas sim pela vulnerabilidade do barramento SMBus/I2C sob tráfego contínuo somada à ausência de timeout com liberação de mutex no código C++ do OpenRGB.

4. **Recuperação automática: reconectar cliente vs recuperar OpenRGB (Ponto 4):**
   - Reconectar o socket TCP resolve falhas de transporte de rede, mas é totalmente ineficaz quando um controlador interno do `OpenRGB.exe` entra em deadlock: todas as reconexões TCP subsequentes conectam com sucesso na porta 6743, leem a contagem 3 e travam de forma idêntica nos 4.000 ms ao tentar ler o controlador 1.
   - Para restabelecer o controle, a recuperação exige reiniciar o processo do serviço `NexusRGBHardware` (liberando handles de driver e reinicializando o barramento).
   - Proposta para evolução futura segura: detectar a assinatura específica dessa condição (TCP conecta e contagem responde com sucesso, mas `getControllerData` falha por timeout consecutivamente N vezes). A recuperação deve disparar um reinício pontual do serviço do supervisor com disjuntor de circuito (limite de 1 tentativa a cada X minutos), sem laço infinito e sem afetar processos alheios.

5. **Qualidade do diagnóstico — Causa raiz comprovada (Ponto 5):**
   - No incidente, o diagnóstico reportou `connected: false` e `hardwareErrorCode: disconnected`, mas os 5 componentes continuavam aparecendo como `'online'`.
   - Causa raiz identificada no código:
     - Em `server/hardware.js:207`: `snapshot()` define `status: this.connected ? 'online' : 'offline'`. Quando desconectado, o status real no snapshot é `'offline'`.
     - Em `server/diagnostics.js:12`: o mapeamento foi implementado como:
       `status: d.error || d.status === 'error' ? 'error' : 'online'`
       Esse ternário avalia apenas se há erro; qualquer outro status (incluindo explicitamente `'offline'`) recebia a string `'online'`!
     - Além disso, `this.devices` retém a lista da descoberta anterior bem-sucedida porque `discover()` lançou exceção no controlador 1 antes de sobrescrever o array.
   - Reprodução e evidência: no script isolado `scratch/test-reproduction.js`, o snapshot retornou `status: 'offline'`, enquanto `diagnostics()` retornou `status: 'online'`.
   - Correção proposta: alterar `server/diagnostics.js:12` para:
     `status: !hw.connected ? 'offline' : (d.error || d.status === 'error' ? 'error' : 'online')`
     assegurando consistência absoluta entre o status geral e os componentes.


### 17/10/2026 — Atualização assistida para a alpha.26 no PC de validação

**Objetivo:** instalar no PC real a versão oficial `v0.1.0-alpha.26` após autorização expressa do usuário, verificando integridade do pacote, metadados de build, serviços Windows, aplicativo da bandeja e preservação total dos dados locais.

**Mudanças e arquivos na instalação:**
- O instalador oficial `NexusRGB-Setup-0.1.0.exe` (SHA-256 `26d8c87545f660ebb7dfd9e749dbded942a286faef30e1ac9f9ec482f4a5fa4f`) foi preparado em pasta temporária limpa (`AppData\Local\Temp\nexus-alpha26-official-*`) e acionado via `ShellExecute` no desktop interativo do usuário (`/SP- /SILENT /NORESTART /MERGETASKS="!pawnio" /LANG=brazilianportuguese /LOG="..."`).
- A instalação concluiu com sucesso (`ExitCode 0`, `Need to restart Windows? No`).
- O instalador executou automaticamente `backup-before-upgrade.ps1`, gerando o backup pré-atualização `before-update-20261017T104251-9c5f261629af46d492fb435aabd715a8.json` em `C:\ProgramData\NexusRGB\app\backups\`.
- O aplicativo da bandeja (`NexusRGB.exe --tray`) foi reaberto e confirmado ativo na sessão interativa (`SessionId 1`).

**Verificação de arquivos e integridade:**
- `E:\Program Files\Nexus RGB\server\build-info.json` atualizado e conferido: `version: "0.1.0"`, `tag: "v0.1.0-alpha.26"`, `commit: "4924d76e894ac590fdee6bba8ed5053dab3d1be6"`, `development: false`.
- Comparação byte a byte (normalizando finais de linha) de todos os 49 arquivos instalados contra a tag oficial `v0.1.0-alpha.26`: 0 arquivos ausentes e 0 divergências.
- `/api/about` e `/api/diagnostics` reportam a mesma identificação da tag `v0.1.0-alpha.26`.
- `/api/health` confirma serviços saudáveis (`ready: true`, `connected: true`, `devices: 5`, `detecting: false`).
- Preservação dos dados: todos os 36 arquivos de efeitos espaciais em `effects/`, os 10 backups em `backups/`, `network.json`, `alexa.json` e `first-use.json` mantidos intactos.

**Desempenho do serviço instalado (`v0.1.0-alpha.26`):**
- Leitura via `/api/resources`: `PID 22140` (`NexusRGBHardware` / OpenRGB: 22,7 MB RSS, 0% CPU), `PID 13980` (`server`: 84,5 MB RSS, 0,3% CPU) e `PID 10468` (`effect-worker`: 70,5 MB RSS).

**Git / Release / Instalação:**
- Branch `main`, commit `52fe8d9` (documentação).
- Release oficial: `v0.1.0-alpha.26` (`4924d76e894ac590fdee6bba8ed5053dab3d1be6`).
- Versão instalada: `v0.1.0-alpha.26` (`4924d76e894ac590fdee6bba8ed5053dab3d1be6`). A versão instalada agora coincide rigorosamente com o código e a release publicada.

**Limites e próximo passo:**
- Com a versão instalada atualizada, o próximo passo é o teste físico nos LEDs reais e na Alexa conforme os limites documentados: percepção visual da transição suave (0,2 a 3 s), ausência de clarões, inversão de comando durante transição e comportamento de peças excluídas/apagadas.

### 17/10/2026 — Revisão técnica (CodeQL, desempenho, identidade de pacote e limites físicos) e publicação da alpha.26

**Objetivo:** revisar com evidências os quatro pontos levantados sobre o relatório da `alpha.24` e o estado da `alpha.25` antes de qualquer instalação no PC real: (1) natureza técnica da alteração `e5c16d4` perante o CodeQL e confinamento dos fluxos de diretório/IDs de efeitos; (2) correção metodológica de `docs/DESEMPENHO.md`; (3) verificação da identidade da `alpha.25` e publicação limpa da `v0.1.0-alpha.26` sem mover a tag `v0.1.0-alpha.25`; e (4) registro explícito dos limites de testes físicos pendentes.

**Evidências e conclusões por ponto:**
- **1. CodeQL (`e5c16d4` vs `f9df27f`):**
  - Os fluxos SARIF de `js/path-injection` em `server/store.js`, `server/studio.js`, `server/backup.js` e `server/index.js` partem exclusivamente de `process.env.NEXUS_DATA_DIR`, `process.env.BENCH_DATA`/`NEXUS_BENCH_DATA` e `process.env.NEXUS_TEST_DATA` (modelo de ameaça `local` sobre ambiente de inicialização). No serviço instalado (`native/NexusRGB.cs:271, 292`), o supervisor `LocalSystem` fixa `NEXUS_DATA_DIR` em `%ProgramData%\NexusRGB\app`; nenhuma rota HTTP controla esse caminho.
  - IDs de efeitos são hashes SHA-256 hexadecimais de 24 caracteres (`/^[a-f0-9]{24}$/`) gerados internamente em `server/studio-schema.js:45, 49`, validados na carga (`server/studio.js:15-20`), nas rotas HTTP (`server/index.js:151, 173`) e por consulta ao `Map` `this.effects` antes de `fs.unlinkSync` ou `readEffectJson`. `recovery.json` tem nome fixo em `path.join(directory, 'recovery.json')`.
  - O commit `e5c16d4` **não adicionou uma nova barreira de sanitização em tempo de execução** (pois o fluxo já era seguro e o alerta original era falso positivo de configuração privilegiada): ao delegar `Studio.loadRecovery()` para `readJson()` (`server/store.js:33-34`) e restaurar a linha única de `Studio.remove(id)` (`server/studio.js:326`), ele removeu os dois sinks novos de `server/studio.js` e realinhou o fluxo aos alertas `#30`, `#31` e `#36` (já dispensados manualmente como falsos positivos em `16/10/2026`), razão pela qual o GitHub Code Scanning marcou `#84`, `#85` e `#86` com `fixed_at: 2026-10-17T09:11:44Z`.
  - Foi adicionado teste de regressão explícito em `tests/security-files.test.js` provando que `Studio.remove`, `Studio.duplicate` e `Studio.loadRecovery` recusam entradas de traversal (`../outside`, `..\\outside`, `../settings`), chaves de protótipo (`__proto__`, `constructor`) e IDs inexistentes sem tocar em arquivos externos, e `docs/validation/2026-10-16-security-review.md` foi atualizado diferenciando todos os 24 alertas corrigidos no código (`state: fixed`), os 4 alertas dispensados e posteriormente marcados com `fixed_at` (`#23`, `#84`–`#86`) e os 58 alertas dispensados manualmente como falsos positivos.
- **2. Desempenho (`docs/DESEMPENHO.md`):**
  - `docs/DESEMPENHO.md` foi reestruturado para separar comparações entre versões em ambiente isolado (`v0.1.0-alpha.23` / `2414264` vs código novo) das leituras pontuais do serviço instalado no host (que permaneceu na `v0.1.0-alpha.23` durante todo o ciclo e, portanto, mostra apenas estabilidade/variação da própria `alpha.23`, não o impacto da `alpha.24`–`alpha.26`).
  - Foi executado um novo benchmark isolado completo do motor (`scripts/benchmark-engine.cjs`) na baseline `v0.1.0-alpha.23` (`docs/benchmarks/2026-10-17-alpha23-engine.json`) para comparação direta com o código novo (`docs/benchmarks/2026-10-17-alpha24-engine.json`) sob as mesmas condições (3 s de aquecimento, 21 amostras de ~1 s, janelas de ~26,6–26,9 s, 92 LEDs simulados).
  - Foram detalhados o cálculo de CPU normalizado pelos 12 processadores lógicos, a diferença entre RSS (`WorkingSet64`), memória privada (`PrivateMemorySize64`) e Heap JS (`JSHeapUsedSize`), a variação entre rodadas da mesma versão (`5,31–6,89 MiB` de RSS e `0,05` pp de CPU) e a atribuição dos `~505 MiB` de RSS (`~355 MiB` privados e `~3,95 MiB` de Heap JS) à árvore multiprocesso dedicada do Edge (`browser`, `renderer`, `GPU` e utilitários via `SystemInfo.getProcessInfo`).
- **3. Identidade da `alpha.25` e publicação da `alpha.26`:**
  - A tag `v0.1.0-alpha.25` (`4b2eaa2f4a53d96c4530efee8e32a17f5f0bd650`) contém `e5c16d4` e passou em [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39021031214) e [CodeQL](https://github.com/JonJonGf/nexus-rgb/actions/runs/39021031305), mas falhou em `node scripts/check-release.cjs` no workflow [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39021031254) porque as linhas 84 e 274 do `README.md` ainda referenciavam `v0.1.0-alpha.24`. Além disso, em `public/studio.js`, `isExcluded(deviceId)` foi ajustado para priorizar `data.excluded` e limpar `dev.mapExcluded` otimisticamente ao clicar em `#studio-follow-map` (5/5 execuções aprovadas em `tests/ui/studio.spec.js`).
  - Sem mover a tag `v0.1.0-alpha.25`, foi publicada a tag `v0.1.0-alpha.26` no commit `4924d76e894ac590fdee6bba8ed5053dab3d1be6`: aprovada em [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39024013745) (`success`), [CodeQL na main](https://github.com/JonJonGf/nexus-rgb/actions/runs/39024013913) (`success`) e [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39024013756) (`success`, incluindo 3 análises CodeQL da tag `1972448302`/`1972444454`/`1972444155` com 0 alertas abertos e 2 VMs Windows verificando `C:\Program Files\Nexus RGB\server\build-info.json` com `tag: "v0.1.0-alpha.26"`, `commit: "4924d76e894ac590fdee6bba8ed5053dab3d1be6"` e `development: false`).
  - Assets publicados em [releases/tag/v0.1.0-alpha.26](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.26) e baixados para conferência: `NexusRGB-Setup-0.1.0.exe` (`94.627.543` bytes, SHA-256 `26d8c87545f660ebb7dfd9e749dbded942a286faef30e1ac9f9ec482f4a5fa4f`), `NexusRGB-Uninstall-0.1.0.exe` (`241.664` bytes, SHA-256 `26e9399105424eb8aa4cfc81faf0bfaebd1b2f2d6361ebbc295d425a15da5ada`), `SHA256SUMS.txt` e `BUILD-INFO.json`.

### 17/10/2026 — Alpha.25: correção em código dos sinks CodeQL em `Studio.loadRecovery()` e sincronização pós-ação no mapa

**Objetivo:** publicar a `v0.1.0-alpha.25` solicitada pelo usuário contendo no binário a correção em código dos 3 alertas `js/path-injection` do CodeQL (`#84`, `#85` e `#86`) e a sincronização de `refresh(keepDraft, force)` após ações de retorno de peça ao mapa (`followMap`) e resolução de conflitos de revisão.

**Mudanças e arquivos:**
- `server/studio.js`: reutilização de `readJson(this.recoveryFile, null)` exportado por `server/store.js` em `loadRecovery()`, eliminando chamadas diretas a `fs.existsSync` e `fs.readFileSync` em `server/studio.js`, e restauração da linha original de `fs.unlinkSync` em `remove(id)`.
- `public/studio.js` e `tests/ui/studio.spec.js`: `refresh(keepDraft, force)` aguarda `loadingPromise` em andamento quando chamado após mutações (`sharedPlay` e conflito de `saveLayout`), garantindo que uma leitura periódica anterior não sobrescreva o estado recém-aplicado.
- `README.md`, `docs/releases/v0.1.0-alpha.25.md`, `docs/validation/2026-10-16-security-review.md` e `docs/CONTEXTO-DESENVOLVIMENTO.md`: notas e links da versão `v0.1.0-alpha.25`.

### 17/10/2026 — Alpha.24: recuperação após falhas, desfazer/refazer, diagnóstico com revisão e transição suave de energia (branch `codex/edition-energy-recovery`)

**Objetivo:** implementar, na ordem solicitada pelo usuário, as quatro propostas detalhadas no plano de melhorias: (1) recuperação após falhas, (2) desfazer e refazer no mapa e no editor, (3) exportação de diagnóstico com revisão e (4) transição suave de energia.

**Mudanças e arquivos:**
- **1. Recuperação após falhas** (`server/studio.js`, `server/hardware.js`, `server/index.js`, `public/index.html`, `public/studio.css`, `public/studio.js`, `public/en.js`):
  - Classificação explícita de falhas no motor espacial (`effect`, `worker`, `controller`, `config`), com registro estruturado e sanitizado em `recovery.json` (histórico validado de até 2 versões funcionais e estado `quarantined`, sem caminhos locais ou dados sensíveis).
  - Janela de estabilidade (`workingWindowMs` de 3 s contínuos e `workingMinFrames >= 3`) antes de promover uma versão de efeito/configuração a `workingHistory`.
  - Limite de retentativas automáticas com recuo progressivo (`retryDelays = [120, 300]`) para falhas de processo, interrompendo ciclos de falha e persistindo quarentena entre reinícios do processo.
  - Rota `POST /api/studio/recover` e aviso acionável no topo do mapa com 3 ações explícitas: **Tentar novamente** (`retry`), **Usar último efeito funcional** (`last-working`) e **Manter luzes apagadas** (`lights-off`), preservando biblioteca, perfis, mapa, exclusões e intenção de energia.
- **2. Desfazer e refazer** (`public/map-model.js`, `public/workspace.js`, `server/studio.js`, `public/studio.js`, `public/index.html`, `public/en.js`):
  - Pilhas independentes e limitadas para o layout do mapa (40 passos em `NexusMapModel.History`, agrupando um arraste/rotação/redimensionamento completo ao soltar o ponteiro e cobrindo posição, tamanho, rotação e representação) e para o rascunho de efeito (40 passos no editor, preservando o `Ctrl+Z` nativo dentro de `#studio-source`).
  - Última prévia funcional mantida no editor e botão de restauração quando o JSON em edição contém erro de sintaxe ou validação.
  - Verificação de revisão do layout no servidor (`layoutRevision` e `baseLayoutRevision`), retornando HTTP `409` quando outro cliente salvou o mapa entre a leitura e a escrita, evitando sobrescrita silenciosa.
- **3. Diagnóstico com revisão** (`server/diagnostics.js`, `public/index.html`, `public/studio.css`, `public/health.js`, `public/en.js`):
  - Lista explícita de campos permitidos (`DIAGNOSTIC_CATEGORIES`: `version`, `health`, `performance`, `devices`, `effects`, `failures`), filtragem por `?categories=...` em `GET /api/diagnostics` e inclusão do resumo de falhas recentes sem expor caminhos locais.
  - Exclusão e sanitização por padrão de credenciais, tokens, chaves, usuários Hue, seriais, IPs/MACs, caminhos locais (`E:\...`, `C:\Users\...`), nomes de usuário/computador e código/conteúdo de efeitos ou perfis.
  - Modal **Preparar diagnóstico** na aba **Configurações** com caixas de seleção por categoria, prévia JSON exata do conteúdo que será salvo e botões **Copiar JSON** e **Baixar JSON** 100% offline.
- **4. Transição suave de energia** (`server/store.js`, `server/backup.js`, `server/hardware.js`, `server/studio.js`, `public/index.html`, `public/studio.js`, `public/app.js`, `public/en.js`):
  - Preferência `powerTransitionMs` (`0` por padrão para transição instantânea; `200` a `3000` ms opcional) persistida nos ajustes e backups e configurável em **Configurações → Atualização do RGB**.
  - Multiplicador temporário de saída (`0..1`) em `Hardware` por dispositivo e geral, cobrindo energia geral, energia individual e comandos da Alexa sem alterar brilho salvo, cores, efeitos ou perfis e respondendo à Alexa imediatamente.
  - Inversão no meio da rampa partindo da intensidade atual (`powerScaleFor`), sem clarões nem filas, encerrando envios desnecessários assim que a rampa atinge `0` e expondo `smoothPowerCapable` para informar fallback instantâneo em dispositivos sem modo `Direct` por LED.
- **Testes e documentação:** `tests/studio.test.js`, `tests/map-model.test.js`, `tests/resources.test.js`, `tests/hardware.test.js`, `tests/ui/studio.spec.js`, `tests/ui/workspace.spec.js`, `tests/ui/formula.spec.js`, `tests/ui/health.spec.js`, `README.md`, `docs/PLANO-MELHORIAS.md`, `docs/BACKUP-E-DIAGNOSTICO.md`, `docs/DESEMPENHO.md`, `docs/validation/2026-10-16-security-review.md` e `docs/releases/v0.1.0-alpha.24.md`.

**Testes executados e resultados:**
- `npm.cmd test`: 130/130 aprovados (`0 fail`), cobrindo timeout/erro de sintaxe/queda de worker/queda do OpenRGB/persistência de falha após reinício, conflito `409` de revisão de layout, histórico de desfazer/refazer no modelo de mapa, ausência de dados sensíveis fictícios no diagnóstico e rampa suave de energia (incluindo inversão no meio do caminho, encerramento em zero e fallback instantâneo).
- `npm.cmd run test:ui`: 38/38 aprovados no Playwright (`0 fail`), cobrindo modal de revisão e filtro de diagnóstico, recuperação de falha no mapa, desfazer/refazer no mapa e no rascunho (com preservação do `Ctrl+Z` nativo no campo de código) e controles de transição de energia em Configurações.
- `npm.cmd run test:supervisor`: aprovado.
- `npm.cmd run test:installer`: 12/12 cenários aprovados (PT-BR e EN).
- `node scripts/check-release.cjs v0.1.0-alpha.24`: aprovado.
- **Desempenho antes/depois (condições comparáveis):**
  - Benchmark de interface (`node scripts/benchmark-ui.cjs v0.1.0-alpha.23`): `0.58%` CPU média e `505.13 MiB` RSS no mapa PT-BR a `20 FPS` na `alpha.24`, contra `0.61%` CPU e `503.65 MiB` RSS na linha de base `alpha.23`, com `0` erros de console/página/requisição.
  - Benchmark do motor (`node scripts/benchmark-engine.cjs`): `0.03%` CPU / `49.04 MiB` RSS em repouso (mapa desligado); `0.40%` CPU / `134.63 MiB` em Aurora `20 FPS`; `0.87%` CPU / `163.07 MiB` em Aurora `60 FPS`; `1.20%` CPU / `187.15 MiB` em Aurora `60 FPS` com prévia SSE; `0.39%` CPU / `232.98 MiB` em HTML `20 FPS`; `0.92%` CPU / `252.39 MiB` em HTML `60 FPS`.
  - Amostras do serviço real instalado (`v0.1.0-alpha.23`) antes e depois da bateria de validação salvas em `data/validation/resources-before-alpha24.json`, `data/validation/processes-before-alpha24.json`, `data/validation/resources-after-alpha24.json` e `data/validation/processes-after-alpha24.json` (serviço `node` em `0.5%` CPU / `78.59 MiB` RSS antes e `0.41%` CPU / `77.66 MiB` RSS depois; `OpenRGB` estável em `19.21 MiB` working set).
- **Workflows do GitHub Actions e CodeQL:**
  - [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/39018189302) (`success`), [CodeQL](https://github.com/JonJonGf/nexus-rgb/actions/runs/39018189206) (`success`) e [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/39018189288) (`success`).
  - Na análise CodeQL do commit `f9df27f`, abriram-se 3 alertas `js/path-injection` em `server/studio.js` (`#84` na linha 69 `fs.existsSync(this.recoveryFile)`, `#85` na linha 71 `fs.readFileSync(this.recoveryFile, 'utf8')` e `#86` na linha 321 `fs.unlinkSync(path.join(this.directory, id + '.json'))`, reidentificação do alerta `#36` após deslocamento de linha). O SARIF mostrou que os 4 fluxos partiam exclusivamente de `NEXUS_DATA_DIR`/`BENCH_DATA`/`NEXUS_TEST_DATA` na inicialização do processo/fixtures (nunca de entrada HTTP). Para concluir a publicação sem mover a tag `v0.1.0-alpha.24`, os 3 alertas foram revisados e encerrados como falsos positivos na referência da tag; em seguida, `loadRecovery()` em `server/studio.js` também foi refatorado na `main` para reutilizar `readJson()` de `server/store.js` e restaurar a linha original de `remove(id)`, eliminando esses sinks diretos no código.

**Limites e testes pendentes:**
- A suavidade visual real da transição de energia nos LEDs físicos e nos comandos de voz da Alexa depende da instalação da `v0.1.0-alpha.24` no PC real e de validação física autorizada pelo usuário.

**Git / Release / Instalação:**
- Commit e tag `v0.1.0-alpha.24`: `f9df27f` (`f9df27ff1c3f48163466b2d09bc00d40fff61d27`), publicado em [releases/tag/v0.1.0-alpha.24](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.24) com `NexusRGB-Setup-0.1.0.exe` (`7bc8f128cb169d21658c81e2b85ff18a610a693e847b02f4c484efcbd2fe6a41`), `NexusRGB-Uninstall-0.1.0.exe` (`764dee113d4098da36ac3c2fb0ed9bf34dfb21838f974808f2cd3583ae49c40f`), `SHA256SUMS.txt` e `BUILD-INFO.json`.
- **Versão instalada no PC real:** continua na `v0.1.0-alpha.23` oficial (`2414264f8f061e8866f54759686760f8a9265053`) até autorização explícita do usuário para abrir o instalador da `v0.1.0-alpha.24`.

**Pendências e próximo passo:**
- Aguardar autorização do usuário para instalar a `v0.1.0-alpha.24` no PC físico (com progresso visível e sem `/VERYSILENT`, reabrindo a bandeja na sessão do usuário) e validar fisicamente a transição suave de energia nos LEDs e na Alexa.

### 17/10/2026 — Reinstalação da alpha.23 a partir do pacote oficial verificado

- O usuário confirmou estar conectado e autorizou abrir o instalador/UAC. Foi executado o pacote baixado diretamente da release alpha.23, com SHA-256 `2b945eb8f1936ad06c1686c5f1b502975051e5afc793711100ba204686c1b7c8`, via Explorer ShellExecute, usando `/SP- /SILENT /NORESTART /MERGETASKS="!pawnio"`. O log registra instalação bem-sucedida, encerramento normal e ausência de necessidade de reiniciar Windows. Não foi reinstalado PawnIO.
- Resultado observado: o arquivo instalado `server/build-info.json` agora identifica tag `v0.1.0-alpha.23`, commit `2414264f8f061e8866f54759686760f8a9265053` e `development: false`, corrigindo a divergência encontrada. Isso substitui a confirmação anterior baseada em metadado de desenvolvimento; a causa exata da instalação anterior ainda não foi investigada. Não atribuir esse metadado antigo ao pacote oficial sem evidência.
- Os dois serviços voltaram a Running e o painel respondeu `ready: true`, controlador conectado, cinco componentes e detecção concluída na consulta. A bandeja foi reaberta e confirmada na sessão interativa. Foram comparados 49 arquivos instalados de `server/`, `public/`, instalação de serviços e manifests de dependências com a tag, normalizando finais de linha: nenhum ausente ou divergente. Não é uma comparação de todos os binários/dependências nem teste físico de efeitos/Alexa.
- Conferência de preservação: todos os arquivos copiados antes da atualização (ajustes, efeitos, backups anteriores, rede, Alexa e primeiro uso) mantiveram seus hashes; os 36 arquivos de efeitos permanecem presentes. Evidências, backup e log ficam somente em `data/alpha23-official-reinstall/`. Não foram repetidas suítes de CI para essa reinstalação.
- Apenas documentação pública alterada localmente; nenhum código, commit, tag ou release novo. A versão efetivamente instalada agora tem identificação oficial conferida. Próximo passo: usuário avaliar o funcionamento e decidir a continuidade das melhorias planejadas.

### 17/10/2026 — Metadados divergentes e preparação da reinstalação oficial

- Correção à confirmação anterior da instalação: painel saudável, cinco componentes, serviços e bandeja ativos não comprovam identidade integral da release. O arquivo instalado `server/build-info.json` indica `development: true`, tag nula e commit `564be72bb44ca051fe4550722a9925443b4b8d4c`, anterior à alpha.23. A causa ainda não foi determinada.
- A pedido do usuário, foi baixado o instalador diretamente da release alpha.23. SHA-256 conferido contra os dois manifestos publicados: `2b945eb8f1936ad06c1686c5f1b502975051e5afc793711100ba204686c1b7c8`, commit oficial `2414264f8f061e8866f54759686760f8a9265053`. O instalador local em `dist/` tem hash diferente, portanto não será usado para este teste. Essa diferença isolada não comprova defeito ou malware.
- Ajustes, efeitos, backups existentes e metadado instalado foram copiados para pasta privada, com manifesto de hashes em `data/alpha23-official-reinstall/`. Ainda não houve execução do instalador, UAC ou reinício nesta investigação. Próximo passo: confirmar disponibilidade do usuário no acesso remoto, instalar o pacote oficial com progresso visível e sem PawnIO/reinício do Windows, verificar metadados, dados e bandeja.
- Etapa apenas de preparação e documentação local; código, tags e releases inalterados, sem commit novo. Não declarar correção antes de verificar a instalação oficial.

### 16–17/10/2026 — Alpha.23: clareza visual e rede (branch `codex/visual-clarity-network`)

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
- Workflows do GitHub Actions: [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/38986894431) (`success`), [CodeQL](https://github.com/JonJonGf/nexus-rgb/actions/runs/38986879468) (`success`, 0 alertas) e [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/38986894607) (`success` nas duas VMs `5050` e `5151` e no job `publish` na tentativa 2, após timeout pontual de worker na VM `5151` na tentativa 1).

**Git / Release / Instalação:**
- Commit de código e tag `v0.1.0-alpha.23`: `2414264` (mesclado em `main` e publicado em [releases/tag/v0.1.0-alpha.23](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.23) com `NexusRGB-Setup-0.1.0.exe`, `NexusRGB-Uninstall-0.1.0.exe`, `SHA256SUMS.txt` e `BUILD-INFO.json`).
- Instalação local assistida no PC de validação concluída com autorização do usuário (`ExitCode: 0`, sem reinício do Windows), progresso visível via `ShellExecute` do Explorer no desktop interativo, serviços `NexusRGB` e `NexusRGBHardware` rodando na sessão 0, ícone da bandeja (`NexusRGB.exe --tray`) reaberto na sessão interativa (`SessionId 1`), `/api/health` reportando `ready: true`, `connected: true`, `detecting: false` com os 5 componentes detectados, e preservação confirmada de `settings.json`, `effects/` e `backups/`.

**Pendências e próximo passo:**
- Bloco de clareza visual e rede concluído, publicado e instalado.
- Aguardar orientação do usuário antes de iniciar qualquer uma das quatro propostas planejadas em [PLANO-MELHORIAS.md](PLANO-MELHORIAS.md) (desfazer/refazer, transição suave, diagnóstico revisável e recuperação após falhas).

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
