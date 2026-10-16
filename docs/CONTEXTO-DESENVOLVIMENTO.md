# Contexto de desenvolvimento

Este é o registro público de continuidade entre sessões e ferramentas. Leia também [AGENTS.md](../AGENTS.md), o [plano de melhorias](PLANO-MELHORIAS.md) e o [guia de desenvolvimento](DESENVOLVIMENTO.md). Confirme o estado atual no Git e no ambiente antes de agir; versões instaladas em outros computadores podem ser diferentes.

## Situação atual — 16/10/2026

- **Entrega de código:** alpha.21, commit `db0c9e7f82b613e7ad65fa3b6bac388d0782d48d` (tag `v0.1.0-alpha.21`).
- **Distribuição:** [release alpha.21](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.21) publicada com instalador (`09f914fcb43ec0831453bf5ea5bbd6ef40869c71216f947290518958c3214628`), desinstalador (`e3c13e8191f044f6c3c73c8572097abd9ea9c67224ef7c488cfeb165adec732e`), `SHA256SUMS.txt` e `BUILD-INFO.json`, aprovada em [Publicar versão Windows](https://github.com/JonJonGf/nexus-rgb/actions/runs/38965911628) (CodeQL nas 3 linguagens e 2 VMs Windows descartáveis) e [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/actions/runs/38965911532). Commit posterior em `codex/hardware-stability` e `main` apenas registra as evidências da publicação neste documento e remove condição de corrida no mock de `tests/studio.test.js`, sem alterar o binário publicado da `v0.1.0-alpha.21`.
- **PC de validação:** `v0.1.0-alpha.21` instalada com autorização explícita do usuário, encerrada com sucesso e sem reinício do Windows. O backup automático pré-atualização preservou os ajustes byte a byte; todos os 36 efeitos importados, 10 perfis, biblioteca e mapa permaneceram intactos, e os 5 componentes RGB voltaram conectados (`detecting: false`, sem erros, `discoveryMs` ~1,2–1,5 ms). A confirmação final dos comportamentos físicos depende do relato do usuário.
- **Resultado físico (Alexa na alpha.20):** usuário testou a alpha.20 e confirmou aviso de falha nos dois comandos, acender e apagar. A hipótese de confirmação de brilho não resolveu esse equipamento. Nos pedidos observados de desligamento, o Echo enviou somente `on`, sem `bri`; respostas HTTP 200 terminaram em poucos milissegundos, e consultas posteriores devolveram energia apagada e controlador disponível. Dados identificadores do equipamento e da rede permanecem privados.
- **Resultado posterior em Alexa+:** o usuário pediu por voz para a Alexa deixar de anunciar o erro e informou que funcionou. Nenhuma outra mudança de código ou reinstalação ocorreu. Registrar como preferência de resposta/solução prática relatada pelo usuário, sem concluir que o protocolo foi corrigido. O estado do aplicativo Alexa após esse pedido não foi retestado.
- **Pendência técnica (Alexa):** a causa do aviso no protocolo permanece desconhecida. Investigar caso o usuário queira retomar; a confirmação de brilho não é causa comprovada. Grupos, rotinas e estado no aplicativo precisam de teste separado. Não iniciar novas tentativas de alteração ou recadastro automaticamente após a solução prática relatada.
- **Demais melhorias:** bloco de estabilidade e hardware (itens 1 a 5) concluído, validado e publicado na `v0.1.0-alpha.21`.
- **Mudança documental após o instalador alpha.20:** regras de continuidade em `AGENTS.md` e `.agents/rules/continuidade.md`, este registro e sua referência no guia de desenvolvimento, introduzidos em `f895fa8`. O registro posterior incorpora a confirmação das duas direções e a solução prática na Alexa+.

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

1. **Ler e conferir:** `AGENTS.md`, este contexto e [PLANO-MELHORIAS.md](PLANO-MELHORIAS.md). Conferir `git status`, branch e histórico; respeitar mudanças locais sem sobrescrevê-las. A alpha.20 já foi publicada e instalada no PC de validação; não repetir instalação, recadastro da Alexa ou os testes concluídos sem motivo.
2. **Preservar o resultado da Alexa:** ela executa energia; o usuário relatou suprimir o anúncio de erro por um pedido à Alexa+. Não tentar outra correção de protocolo automaticamente. Se o usuário quiser investigar novamente, partir dos pedidos com somente `on`, dos retornos 200/GET e da incerteza no estado do app.
3. **Retomar o próximo bloco quando o usuário solicitar as melhorias adiadas:** começar por estabilidade/hardware, nesta ordem: descoberta gradual e eventos com recuperação limitada; evitar reenvios com luzes apagadas; Off nativo apenas com todas as zonas apagadas; encerramento normal dos serviços; mensagem de detecção em andamento no reinício. A justificativa e os limites estão no plano.
4. **Trabalhar em mudanças pequenas:** reproduzir o problema com SDK/ambiente isolado, corrigir um comportamento e testar preservação dos dados antes de avançar. Não depender de um número fixo de LEDs, modelo de placa-mãe ou ordem de descoberta. O próximo bloco visual/rede e os recursos opcionais vêm depois.
5. **Validar e distribuir:** executar verificações pertinentes, registrar os resultados, e, se a tarefa autorizada incluir publicação, gerar uma nova versão com executáveis correspondentes e passar pelas duas VMs e pelo bloqueio de segurança. Não mover a tag alpha.20 nem substituir seus assets. Mudanças exclusivamente documentais não exigem outro instalador.
6. **Antes de alterar a instalação real:** pedir autorização para instalador/UAC/reinício de serviços e permitir que o usuário aceite o Windows, inclusive por acesso remoto. Depois conferir versão, detecção gradual e preservação dos dados. Não reiniciar o PC automaticamente.
7. **Antes de parar ou trocar de ferramenta:** atualizar este documento com mudanças, arquivos, testes, Git/release/instalação, falhas e próximo passo. Se parar no meio, indicar exatamente o que ficou incompleto. O registro deve continuar suficiente para outro agente retomar sem o chat anterior.

Os passos de implementação acima são a sequência sugerida para as melhorias guardadas; não substituem o pedido atual do usuário nem autorizam alterações em lote por conta própria.

## Histórico de entregas

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
- Versão `v0.1.0-alpha.21` instalada no PC de validação após autorização do usuário (`/api/about` confirma `tag: v0.1.0-alpha.21`, `commit: db0c9e7f82b613e7ad65fa3b6bac388d0782d48d`, `development: false`), sem reinício do Windows, com backup pré-atualização automático íntegro, 36 efeitos e 10 perfis preservados e os 5 componentes RGB conectados (`detecting: false`, `discoveryMs` ~1,2–1,5 ms).
- Tag `checkpoint/alpha20-before-antigravity-2026-10-16` e backup `E:\Nexus RGB Backups\2026-10-16-alpha20-b112b15` preservados intactos.

**Pendências e próximo passo:** aguardar a confirmação do usuário sobre o comportamento físico das luzes na `v0.1.0-alpha.21` antes de declarar os testes físicos concluídos ou avançar para o próximo bloco do plano de melhorias (Experiência visual e rede).

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
