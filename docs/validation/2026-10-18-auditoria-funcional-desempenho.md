# Revisão funcional e de desempenho — 18/10/2026

## Resultado e escopo

A base OpenRGB continua passando nos testes, incluindo a limitação de memória RAM a 20 FPS. Entretanto, o suporte USB-HID novo contém falhas de descoberta, transporte, identidade e integração com o painel que impedem considerar a compatibilidade anunciada como validada. Também há defeitos de recuperação, backup e desperdício de tráfego no mapa.

Revisão de `main` no commit `8a11684250262cb0a0771eefa1c26463404fc401`. A API local identifica a instalação como `v0.1.0-alpha.36` nesse commit. Os hashes de `server/controllers/hid-bridge.js`, `server/controllers/index.js` e `server/hardware.js` instalados coincidem com a cópia revisada. Isso não é uma verificação de todos os arquivos instalados nem uma certificação de hardware.

Foram lidos os caminhos principais do servidor, hardware, Studio, controladoras nativas, rede, atualização, diagnóstico, recursos, persistência, backup, geometria, instalador e supervisor. A interface também foi exercitada pelos testes existentes. Não foi feita auditoria linha a linha de todas as dependências ou validação física de cada protocolo/modelo.

Nenhuma alteração de código de produção, instalação, serviço, driver, configuração pessoal, cadência física ou publicação foi feita nesta revisão. Os cenários adicionais usam SDK e ponte HID simulados, dados temporários e `NODE_ENV=test`. Os registros privados ficam em `data/`, ignorada pelo Git. A sessão local criada para consultar a versão não comandou iluminação.

## Falhas reproduzidas e prioridades

P1: corrigir antes de ampliar/divulgar o suporte correspondente. P2: corrigir na sequência. As evidências abaixo são de simulação isolada; não afirmam que o dano ou sintoma ocorreu no hardware físico.

### F01 — P1: descoberta HID sempre vazia no código publicado

- Local: `server/controllers/hid-bridge.js:9` e `:151–168`.
- O commit `8a11684` removeu a importação de `execFileSync`, mas manteve a chamada em `enumerate()`. O `ReferenceError` cai em um `catch` que devolve `[]`.
- Reprodução: mesmo com executável fictício existente e um enumerador instrumentado, a função devolveu zero dispositivos sem chamar o enumerador nenhuma vez.
- Consequência: a ausência de dispositivo parece normal; o usuário não vê a causa. O problema existe na fonte e no arquivo instalado conferido.
- Direção: implementar descoberta assíncrona com executável validado ou pelo protocolo da ponte persistente, tratamento visível de falhas e teste do caminho de produção com processo falso. Apenas repor uma chamada síncrona não resolve o bloqueio do processo principal.

### F02 — P1: controladoras anunciadas podem não enviar nada e o transporte corta quadros

- Local: `server/controllers/index.js:72–199` e builders `protocol-{corsair,lianli,nzxt,razer,coolermaster,nollie,motherboard}.js`.
- Diferentemente do teclado, esses builders não preservam `hidPath`; os transportes só escrevem quando `dev.hidPath` existe.
- Reprodução Corsair: dispositivo de 48 LEDs recebeu quadro no registro, mas houve **zero chamadas ao transporte físico simulado**. O método informou sucesso.
- Segundo defeito independente: os transportes usam o encoder de um pacote e porta/canal fixos, mesmo existindo helpers de múltiplos pacotes. Ao fornecer o caminho apenas no cenário de teste, foram enviados **20 de 48 LEDs**, em um pacote de canal 1. As outras portas/componentes não são distribuídos por offsets/canais.
- Direção: propagar endereço, validar modelo/protocolo, distribuir por porta e fragmentar o quadro completo; testar identidade, offsets e apagamento. Esta reprodução prova falhas do fluxo de dados, não valida os opcodes no equipamento real.

### F03 — P1: ponte HID sem limite de fila, prazo de resposta ou confirmação confiável

- Local: `server/controllers/hid-bridge.js:45–65,95–145`; `server/controllers/index.js:300–324`; `server/hardware.js:675–683`.
- O evento inicial `ready` também consome o primeiro callback pendente. Um pedido `ping` recebeu `{"status":"ready"}` como resposta no teste.
- Não há identificação de comandos/respostas, prazo por comando ou limite para `pendingCallbacks`. São ignorados o retorno de `stdin.write()` e a pressão do buffer.
- Reprodução de consumidor parado: **20.000 comandos acumulados, 20.000 callbacks pendentes**, sem contenção. É um ensaio sintético de fila, não tráfego USB físico.
- `sendFeatureReport`/`writeOutputReport` retornam sucesso antes da resposta e também quando a ponte está ausente. A resposta nativa de erro é descartada. O cache de teclado é atualizado antes de confirmação; um comando perdido pode deixar de ser reenviado.
- `Hardware.sendLeds` ignora o resultado do registro: um transporte que lançou erro terminou com `reportedSuccess=true` e `framesSent=1` no teste.
- Direção: handshake separado, IDs, ACK/erro, timeout, limite de bytes/comandos e substituição por estado mais recente. Distinguir pedido de envio, envio confirmado e falha; não aplicar cache de sucesso prematuramente. O buffer local não mede conclusão física no hardware.

### F04 — P1: identificação física e detecção de modelo insuficientes

- Local: `server/controllers/protocol-keyboard.js:123`, hashes nos outros builders, `server/controllers/index.js:335–403`.
- Dois teclados iguais com caminhos físicos diferentes produziram o mesmo ID; só um ficou no registro. Os outros builders também baseiam o ID principalmente em nome/modelo.
- A detecção de Corsair, Lian Li, NZXT e Cooler Master aceita fabricante + tamanho do relatório, sem confirmar modelo/PID/protocolo. Um dispositivo fictício Corsair com PID desconhecido `0xffff` foi registrado como controladora.
- Direção: tabela explícita de modelos/interfaces/relatórios suportados, identidade estável por instância e política de propriedade exclusiva. Revisar também a coexistência com OpenRGB: adicionar ambos os transportes sem identificar o mesmo hardware abre possibilidade de controle duplicado. Essa concorrência física não foi testada.

### F05 — P1: diagnóstico pode dizer pronto/online com OpenRGB desconectado

- Local: `server/hardware.js:527–563`; `server/diagnostics.js:5–17`.
- A existência de uma controladora nativa registrada torna o `connected` agregado verdadeiro, sem confirmar sua ponte. O diagnóstico usa esse valor para classificar também os componentes OpenRGB.
- Reprodução: conexão SDK falsa/desligada + teclado nativo registrado resultaram em `health.state="ready"`, `connected=true` e componente SDK `online`.
- Direção: saúde por transporte/controladora/componente; estado agregado parcial; preservar `offline` do componente. A mesma revisão deve alcançar o Studio: `hasActiveDevices()` usa a conexão SDK diretamente, mesmo quando existem componentes nativos.

### F06 — P1: layout inválido impede a construção do painel

- Local: `server/studio.js:25–28`; inicialização em `server/index.js`.
- `schema.layout()` lança durante a construção do Studio, antes de o painel de recuperação existir.
- Reprodução: layout estruturalmente inválido em dados temporários lançou `Componente do layout inválido.` e impediu construir o Studio.
- Direção: isolar configuração inválida com cópia preservada, iniciar um estado seguro com erro visível e recuperação explícita. Não sobrescrever silenciosamente a configuração anterior.

### F07 — P1: quarentena persistente falha com efeitos maiores

- Local: `server/studio.js:61–65,84–86,394`.
- `versionKey()` inclui o código completo do efeito, mas a leitura de `recovery.json` corta a chave em 4.096 caracteres. A comparação exata deixa de reconhecer o efeito em quarentena após reiniciar.
- Reprodução: chave válida de **6.354 caracteres** voltou com **4.096**, sem correspondência. Efeitos podem chegar a 128 KiB.
- Direção: fingerprint criptográfico estável de conteúdo e parâmetros, com migração conservadora do estado antigo. Testar falha, persistência, reconstrução e bloqueio da mesma versão.

### F08 — P1 condicional: backup próprio é recusado com configurações nativas

- Local: `server/backup.js:8,26,31–37`; `server/controllers/index.js:29–58`.
- `nativeControllers` é lido como configuração suportada, mas não está na lista de campos permitidos da restauração. A exportação copia o campo.
- Reprodução: acrescentar configuração nativa em um Store temporário, exportar e revisar esse mesmo backup retornou `Backup: campos inválidos.`.
- Direção: schema e política explícitos de migração das configurações nativas, sem importar automaticamente caminhos HID de outra máquina. Preservar o backup original. O caso depende da presença desse campo; não significa que todos os backups atuais estejam inválidos.

### F09 — P2: brilho e seleção de modo do teclado inconsistentes

- Local: `server/controllers/protocol-keyboard.js:62–63`; `server/hardware.js:573–577,752–776`.
- O encoder tenta aceitar tanto escala 0–5 quanto porcentagem no mesmo campo. Pelo caminho do registro, **5% virou nível 5**, enquanto **6% virou nível 0**.
- `settings(..., true)` apaga `nativeMode` para componentes, inclusive o teclado único, que é representado com `components`. Em estado estático, mudar só `nativeMode` não mudou a assinatura do tick: **zero envios adicionais**, permanecendo modo `0x11` no teste. O snapshot também perde a seleção do modo nativo.
- Direção: unidade explícita de brilho na fronteira do encoder e tratamento de peça única separado de zonas compostas; testar o fluxo do endpoint até o pacote, não apenas o encoder.

### F10 — P2: não há redescoberta USB nativa e encerramento correspondente

- Local: `server/hardware.js:289–300,418–429,870–894`; `server/controllers/index.js:451–455`.
- `nativeHardwareDetected` é marcado antes da descoberta e não volta ao estado inicial em reconexão. Um teste com dispositivo chegando na segunda tentativa fez duas conexões SDK, mas **só uma enumeração** e manteve zero dispositivos nativos.
- `Hardware.stop()` não chama `controllerRegistry.destroy()` ou a parada da ponte. A reprodução contou **zero chamadas de parada da ponte**.
- Direção: ciclo de vida explícito com hotplug/revalidação, remoção de dispositivos ausentes e fechamento da ponte na finalização. O Job Object do supervisor oferece contenção ao processo do serviço, mas não substitui o fechamento normal e não cobre igualmente todos os usos do módulo.

### F11 — P2: o mapa desativa a deduplicação de quadros iguais

- Local: `server/hardware.js:754–776,669–672`.
- A revisão do Studio entra na assinatura e muda em cada quadro. `forceSend = changed || deferred` transforma cada revisão em envio forçado e pula a comparação de cores.
- Reprodução: 60 ticks espaciais com 16 LEDs de cores idênticas geraram **60 escritas, zero deduplicações**. O cache permitiria um primeiro envio e supressão dos demais quando não há outra mudança.
- Direção: distinguir mudança de conteúdo/revisão de mudança de modo/topologia/energia que exige reenvio; manter comandos de desligamento e identificação. Preservar o limitador incondicional de RAM já validado.

### F12 — P2: consulta de rotas bloqueia o processo que atende o RGB

- Local: `server/network.js:34–43`.
- `route.exe print -4` é executado sincronamente no processo Node. O cache dura 15 segundos; cada renovação pode bloquear até o timeout de 1,5 segundo.
- Medição local somente de leitura: primeira chamada de `adapters()` **99,36 ms**, chamada com cache **3,05 ms**. Uma amostra não define uma média nem prova que toda falha de animação veio dessa consulta; comprova bloqueio observável muito maior que o orçamento de 16,7 ms de 60 FPS.
- Direção: atualizar rotas fora do caminho síncrono com cache previamente válido, execução assíncrona e proteção contra consultas simultâneas. Não enfraquecer as verificações de origem/sub-rede.

### F13 — P2: geometria especial se aplica a qualquer matriz de 61 LEDs

- Local: `public/spatial.js:18–28`, desenho correspondente em `public/studio.js`.
- A condição reconhece apenas quantidade, não layout/modelo de teclado. A opção de colunas deixa de funcionar para outra matriz com 61 LEDs.
- Reprodução: matriz de 61 LEDs configurada com uma coluna foi distribuída em cinco fileiras e múltiplas posições X, usando a forma do teclado.
- Direção: geometria identificada por metadado explícito/calibração; manter a matriz genérica configurável e não inferir o produto só pela contagem de LEDs.

## Outros pontos de revisão

- **Consumo incompleto:** `scripts/measure-resources.ps1` e a lista de papéis em `server/resources.js` não incluem `nexus-hid.exe`. O total não cobre o novo processo. Acrescentar o papel e a identificação de propriedade correta antes de comparar consumo de versões; páginas compartilhadas podem ser contadas mais de uma vez em RSS.
- **Isolamento dos testes:** `disableHardware` em `createApp` impede `hardware.start()`, mas a construção da ponte pode iniciar o executável antes disso, em produção. Os ensaios desta auditoria definiram `NODE_ENV=test` explicitamente. Tornar a dependência de hardware inerte/injetada em todos os fixtures e benchmarks; não depender de a descoberta estar quebrada para um teste ser seguro.
- **Documentação e handoff:** os números “0 ms”, “0 bps”, “60 FPS nativos” e explicações específicas de interrupções/DMA do microcontrolador não foram demonstrados pelos ensaios disponíveis. Há teste de deduplicação e relato físico de uma onda funcionando; isso não mede latência de digitação nem valida todos os modelos/opcodes. Reescrever essas afirmações como intenção ou observação delimitada até existirem medidas.
- **Cobertura do instalador:** o fixture comprova os caminhos adaptados de pós-instalação; não comprova uma atualização real com bandeja, ponte HID e serviços antigos abertos. O supervisor foi exercitado com processos artificiais. A revisão de fonte encontrou preflight de parada/reabertura e mutex; a confirmação completa pede VM autorizada, sem usar o PC do usuário como primeiro ensaio.
- **Sandbox, rede e atualizações:** foram preservados limites de memória/tempo, isolamento do efeito e validações de origem. Não foi constatado exploit nesta revisão, mas não foi realizado pentest completo nem prova de ausência de vulnerabilidades. A consulta a atualizações usa endpoint fixo, limites de resposta/tempo e abre a Release; não executa silenciosamente um download.

## Testes realmente executados

| Verificação | Resultado | Limite |
| --- | --- | --- |
| `npm.cmd test` com `NODE_ENV=test` | 190/190 aprovados | SDK/HID e arquivos artificiais; não certifica protocolo físico |
| `npm.cmd run test:ui` com `NODE_ENV=test` | 41/41 aprovados | Edge, servidores e dados isolados |
| `npm.cmd run test:supervisor` | Aprovado | C# real com processos/diretório de fixture |
| `npm.cmd run test:installer` | 12 cenários concluídos com códigos esperados | Pós-instalação adaptado, sem instalar serviços/driver |
| `data/audit-repro-20261018.cjs` | Casos adicionais descritos acima reproduzidos | Script e evidências privados, não comandos físicos |
| CI de `8a11684` | Validação, CodeQL e publicação concluídos com sucesso | Estado consultado em 18/10/2026; não substitui testes comportamentais |
| Code Scanning | Nenhum alerta aberto retornado pela consulta | Não equivale a ausência de defeitos ou garantia de segurança |

Workflows consultados: [Validação](https://github.com/JonJonGf/nexus-rgb/actions/runs/39145505024), [CodeQL](https://github.com/JonJonGf/nexus-rgb/actions/runs/39145501028), [Publicação](https://github.com/JonJonGf/nexus-rgb/actions/runs/39145505056). A [alpha.36](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.36) estava pública como prerelease, com instalador, desinstalador, manifesto e hashes. O commit que fez o CodeQL passar também introduziu F01; o pipeline precisa ganhar esse teste funcional, preservando a análise de segurança.

## Desempenho medido

Ryzen 5 3600, 12 processadores lógicos, aproximadamente 32 GiB, Windows 11, Node 24.20.0. CPU é porcentagem da capacidade total da máquina; memória é soma de conjuntos de trabalho (RSS), não memória exclusiva nem memória JavaScript.

### Servidor + processo do efeito, sem navegador/OpenRGB/supervisores/ponte HID

Usado `scripts/benchmark-engine.cjs`, API e classes de produção com SDK simulado: três controladoras, cinco componentes e 92 LEDs. Sete cenários sequenciais, aproximadamente 27–33 segundos por janela medida. Os primeiros cenários coincidiram parcialmente com os testes automatizados; estes são números de referência local, não comparação controlada antes/depois nem evidência de regressão histórica.

| Cenário | CPU total | RSS médio | FPS renderizados |
| --- | ---: | ---: | ---: |
| Mapa desligado, estático | 0,08% | 52,9 MiB | 0 |
| Aurora 20 FPS, sem prévia | 0,65% | 141,9 MiB | 20,0 |
| Aurora 60 FPS, sem prévia | 1,35% | 178,1 MiB | 60,3 |
| Aurora 60 FPS, com prévia | 1,67% | 208,8 MiB | 60,0 |
| HTML próprio 20 FPS, sem prévia | 0,20% | 248,8 MiB | 20,0 |
| HTML próprio 60 FPS, sem prévia | 1,02% | 259,0 MiB | 60,1 |
| HTML próprio 60 FPS, com prévia | 1,52% | 269,0 MiB | 59,9 |

O HTML é uma fonte sintética própria, não um efeito de terceiros. A retenção do alocador e a ordem sequencial influenciam a memória; o aumento entre cenários não prova vazamento. Não foi feito ensaio prolongado nem curva de centenas de trocas/importações. O benchmark usa controladoras simuladas e não mede capacidade do barramento ou FPS dos LEDs reais.

### Navegador separado, mapa Aurora aberto

Edge dedicado sem janela, 1366 × 900, cinco componentes simulados; duas janelas curtas de aproximadamente dez segundos, no mesmo navegador, depois de encerrar os demais ensaios pesados. O primeiro ensaio do harness parou na apresentação inicial; foi corrigido para clicar em “Começar”, repetido e só então medido. Isso foi ajuste do teste privado, não defeito do produto.

| FPS solicitado | CPU do conjunto do navegador | RSS médio do navegador | Heap JavaScript médio | Ocupação da thread principal |
| --- | ---: | ---: | ---: | ---: |
| 20 | 0,88% | 509,4 MiB | 4,05 MiB | 2,06% |
| 60 | 0,96% | 508,0 MiB | 3,99 MiB | 2,14% |

Sem erros de página nessas amostras. O conjunto inclui subprocessos do próprio Edge. Não representa uma aba extra dentro de qualquer navegador existente, não inclui os serviços do Nexus e não permite prometer que o produto completo consome menos que um aplicativo concorrente medido em outro cenário. Não somar mecanicamente esses números a cenários separados para anunciar um total exato.

## Ordem proposta para correção posterior

1. Acrescentar regressões para descoberta/ACK/erro/fila e corrigir F01–F05, limitando suporte aos modelos com protocolo e identidade confirmados. Preservar o teclado já funcional e a RAM a 20 FPS; não repetir streaming arriscado no hardware.
2. Corrigir recuperação e compatibilidade de backup (F06–F08), com cópias preservadas e cenários de reinício isolados.
3. Corrigir unidades/modos, ciclo de vida, deduplicação e consulta de rotas (F09–F12). Depois repetir medições equivalentes para demonstrar ganho.
4. Generalizar geometria por metadado/calibração, incluir a ponte no consumo e revisar afirmações públicas de compatibilidade/desempenho.
5. Validar atualização em VM com processos abertos e, somente com autorização específica, testar os modelos físicos disponíveis. Uma aprovação de CI não encerra esses testes.

Esta ordem é uma recomendação de auditoria. Não autoriza automaticamente implementação, instalação, publicação, reinício de serviços ou novas experiências físicas.
