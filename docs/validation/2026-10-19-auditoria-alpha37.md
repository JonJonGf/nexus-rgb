# Auditoria funcional e de desempenho da alpha.37 — 19/10/2026

**Ampliação posterior:** o usuário pediu revisão de todo o código. Os achados A10–A17, extensão do benchmark A07 e cobertura por arquivo estão no [relatório integral](2026-10-19-revisao-integral.md). Este documento preserva os resultados e limites do primeiro bloco; o total de seis pendências abaixo refere-se somente a esse bloco.

## Escopo e resultado

Revisão solicitada com autonomia para investigar enquanto o usuário estava remoto. Skills usadas: `diagnosing-bugs`, `tdd` e `codebase-design`. Código inicial: `1dc5ef0`; a versão instalada e a Release consultadas eram a alpha.37, cujo código de produto corresponde à tag `0a78ede`.

Foram exercitados o contrato Hardware → SDK/HID, os endpoints reais de mapa/perfis/biblioteca/backup e a interface no Edge sem janela visível. Cada reprodução usou arquivos sintéticos, armazenamento separado e transportes artificiais. O teste prolongado desabilitou hardware e Alexa. Não houve UAC, reinício de serviços, instalação, comandos de iluminação física, alteração de drivers ou envio de diagnósticos pessoais.

**Resultado:** oito problemas funcionais/de processamento confirmados e uma fragilidade dos testes de navegador. Dois problemas de entrega/cadência foram corrigidos localmente, assim como a simulação dos testes instáveis. Seis problemas do produto permanecem pendentes. Nenhum desses resultados comprova a causa do bloqueio físico do OpenRGB registrado no dia anterior.

## A01 — P1 — Última cor estática perdida após um envio adiado

**Reprodução:** enviar arco-íris à RAM simulada; 10 ms depois solicitar estático azul; aguardar o intervalo protegido e executar novos ciclos sem outra ação do usuário. Resultado original: apenas o quadro anterior foi enviado. O estado de saída usado pela prévia já continha azul. O mesmo erro ocorreu ao congestionar e depois liberar a fila do socket. O usuário relatou a manifestação física arco-íris → estático durante esta auditoria; a reprodução automatizada é sintética.

**Causa:** `sendLeds` devolvia falso por cadência/congestionamento, mas `tick` atualizava `applied` e `rememberOutput` como se o envio tivesse acontecido. Ao terminar a animação, o caminho estático não tinha motivo para tentar novamente.

**Correção local:** `server/hardware.js` mantém somente os IDs dos controladores cujo envio foi adiado. O próximo ciclo calcula o estado mais recente; não acumula quadros antigos. Cache de aplicação e saída da prévia só avançam depois que o envio deixa de estar pendente. Desligamento e modos internos substituem o comando anterior, e perda de conexão/remoção/encerramento limpam a pendência. A cadência da RAM e os limites de transporte permanecem ativos. Aceitação pelo SDK não equivale a confirmação física dos LEDs.

Testes em `tests/traffic-control.test.js` cobrem arco-íris → estático na RAM, congestionamento e última cor, desligamento durante espera, controladora com várias zonas e Off nativo sem cores por LED. Foram observadas falhas antes da correção e sucesso após ela; os casos auxiliares ampliam a regressão. **Status: corrigido no código, não instalado nem publicado.**

## A02 — P1 — OpenRGB indisponível bloqueia comandos ao teclado nativo

**Reprodução:** manter um teclado nativo conectado num adaptador HID sintético e falhar a consulta do SDK. O teclado continua `online`, mas um comando novo não chega ao transporte nativo. Com SDK saudável, o mesmo comando chega uma vez.

**Causa localizada:** em `server/hardware.js`, `tick` permite operação com dispositivos nativos, porém executa `discover` do SDK antes do caminho de envio nativo; a exceção interrompe o ciclo inteiro. O estado agregado de conexão não representa a disponibilidade de cada transporte.

**Direção:** separar a tentativa de descoberta SDK do envio independente nativo, preservando serialização e limites de cada transporte. Testar reconexão, falha persistente e ausência de comandos duplicados. **Pendente; não foi alterado nesta entrega.**

## A03 — P1 — Excluir efeito referenciado torna o backup exportado irrestaurável

**Reprodução HTTP:** importar um gradiente sintético, salvar um perfil que o utiliza e revisar o backup exportado: HTTP 200. Excluir o efeito: HTTP 200. Exportar outro backup: HTTP 200. Revisar esse próprio arquivo: HTTP 400, `Backup: referência de efeito inválida.` O perfil continua salvo apontando para o efeito removido.

**Causa localizada:** `Studio.remove` em `server/studio.js` não resolve referências em `store.data.profiles[].studio.activeId`. A validação de `server/backup.js` corretamente rejeita a referência ausente.

**Direção:** bloquear a remoção com explicação das referências ou oferecer uma operação explícita e transacional para resolvê-las. Não relaxar a validação do backup ou substituir silenciosamente os efeitos dos perfis. **Pendente.**

## A04 — P2 — Controle geral apaga a preferência de desvincular o teclado

**Reprodução:** gravar `syncWithPc: false`, enviar o estado pelo transporte sintético e observar zero pacotes. Alterar a cor geral e enviar novamente: a preferência desaparece e um pacote é produzido.

**Causa localizada:** `Store.master` em `server/store.js` substitui integralmente `data.devices` por `{}`, removendo também a preferência de sincronização. Ela deveria ser distinguida dos ajustes de iluminação que o controle geral substitui.

**Direção:** preservar preferências de participação/sincronização ao aplicar ajustes gerais, com regressões para cor, brilho, energia e perfis. **Pendente.**

## A05 — P2 — Perfil criado pelo mapa perde exclusões intencionais

**Reprodução HTTP:** personalizar um componente individualmente, confirmar sua exclusão do mapa, criar um perfil pelo mapa e aplicar o perfil. A exclusão muda de presente para ausente.

**Causa localizada:** `Studio.profile` em `server/studio.js` salva sempre `excluded: []`, apesar de copiar outros estados do setup.

**Direção:** capturar a intenção de exclusão junto do perfil, ou oferecer uma escolha explícita de sincronizar tudo. Não apagar exclusões implicitamente. **Pendente.**

## A06 — P2 — Formato explícito do teclado é alterado durante leitura do mapa

**Reprodução HTTP e navegador:** num teclado sintético com Direct por LED, escolher Linha. O formulário indica `Salvo automaticamente` e mantém Linha, mas a resposta do servidor já contém Matriz. Recarregar a página muda o seletor para Matriz. O primeiro arquivo gravado ainda continha Linha, enquanto a memória já havia sido modificada.

**Causa localizada:** `Studio.layout` em `server/studio.js` muda `shape`, `columns` e dimensões nos próprios objetos salvos quando encontra teclado no formato `strip`. A leitura é usada por snapshots e pelo motor, sem revisão correspondente do layout.

**Direção:** usar Matriz como padrão apenas na criação de peças novas; respeitar escolhas válidas existentes. Caso necessária, uma migração deve ser explícita e persistida, sem mutações escondidas em leituras. O caso não se aplica ao RK61 nativo sem Direct, que foi corretamente retirado do mapa na alpha.37. **Pendente.**

## A07 — P2 — Custo do mapa cresce excessivamente com o número de controladoras

Medição do caminho de atualização em Node 24.20.0, Ryzen 5 3600, 12 processadores lógicos. Mesmos descritores sintéticos, quatro LEDs por controladora, SDK imediato, nenhum worker Canvas e nenhuma escrita física. Três ciclos de aquecimento e vinte ciclos medidos por caso; duas ordens invertidas com mapa desativado/ativado. É um microbenchmark do processamento, não medição de FPS ou consumo total do aplicativo.

| Controladoras | Mediana sem mapa, duas rodadas | Mediana com mapa, duas rodadas | Snapshots completos por ciclo com mapa |
| --- | --- | --- | --- |
| 5 | 0,01–0,02 ms | 0,22–0,56 ms | 30 |
| 16 | 0,03–0,06 ms | 2,00–2,16 ms | 96 |
| 32 | 0,07–0,08 ms | 8,06–8,45 ms | 192 |
| 64 | 0,13–0,15 ms | 30,77–32,94 ms | 384 |

Os 64 descritores têm somente 256 LEDs, dentro dos limites aceitos. O processamento excedeu o orçamento de 16,7 ms de um ciclo a 60 FPS antes de incluir renderização ou tempo físico de hardware. Isso indica um gargalo de escala; não demonstra que um setup de seis componentes tenha o mesmo custo.

**Causa localizada:** `Studio.hasDevice` chama `layout`, que refaz snapshots completos; esse caminho se repete dentro dos laços de `Hardware.tick`. O número de snapshots cresce com N e cada snapshot percorre os dispositivos novamente.

**Direção:** preparar uma visão da topologia e um índice de participação por revisão/ciclo, em vez de montar o snapshot público em cada consulta. Pela análise de `codebase-design`, a interface de participação deve esconder esse trabalho, sem exigir que cada chamador recalcule o mapa. Repetir o benchmark após uma alteração específica, sem iniciar refatoração ampla. **Pendente.**

## A08 — P3 — Simulação finita de eventos tornava testes de navegador instáveis

A primeira suíte de 43 cenários terminou com 41 aprovações diretas, um caso que passou na repetição e uma falha após repetição. Numa segunda execução completa sem repetição automática, 42 passaram e o cenário de detecção parcial falhou. Os dois cenários visados passaram seis vezes quando executados separadamente, o que não anulou as falhas anteriores.

**Reprodução minimizada:** o mesmo app saudável e o mesmo snapshot num navegador separado mantêm controles ativos com o stream real aberto. Trocar apenas `/api/events` por uma resposta SSE finita faz o navegador encerrar a conexão e o app corretamente mostrar reconexão/desabilitar controles. Não houve erro JavaScript. Os testes confundiam essa desconexão artificial com um estado estável.

**Correção:** `tests/ui/fixture.js` permite um snapshot sintético de hardware mantendo o stream HTTP real aberto. `health.spec.js` e `spatial-capability.spec.js` usam esse adaptador. Nenhum timeout, proteção ou comportamento do produto foi relaxado. Dez execuções dos dois casos sem repetição automática e a suíte completa de 43 cenários passaram após a alteração. **Resolvido nos testes.**

## A09 — P1 — Identificar outro componente suspendia também a proteção da RAM

**Reprodução:** RAM e ARGB sintéticos, efeito animado e ciclos de 60 FPS. Ao identificar somente um LED do ARGB, a RAM recebeu treze envios em 200 ms, incluindo o envio inicial. O teste esperava no máximo cinco nesse intervalo. Foi observado vermelho antes da correção e verde depois dela.

**Causa:** `sendLeds` usava a existência de qualquer identificação como exceção global ao limite da RAM, mesmo quando o componente identificado pertencia a outra controladora.

**Correção local:** a exceção é restrita à controladora que contém o componente identificado. A identificação continua disponível e a RAM não relacionada mantém sua cadência. Não houve teste físico de sobrecarga; não atribuir a esse caso a causa do incidente anterior sem correlação. **Corrigido no código, não instalado nem publicado.**

## Validações e limites

- Base inicial: 214/214 testes gerais aprovados. A rodada intermediária da correção A01 aprovou 218/218, seguida de 219/219 com a regressão do modo Off. Verificação final após A09: **220/220 aprovados**, duração de 67,4 s.
- Conjunto focado de hardware/tráfego/recuperação: 76/76 após A09. Seis regressões foram acrescentadas em `tests/traffic-control.test.js`.
- Interface: 43/43 na rodada completa final, sem repetição automática, após corrigir A08; falhas iniciais preservadas e descritas acima.
- Falha de gravação simulada no endpoint de controle retornou erro sem alterar o estado comprometido em memória ou em disco: o rollback de `Store.save` funcionou. Essa hipótese foi descartada como defeito nesta reprodução.
- Ensaio isolado de estabilidade: 602,1 s, 1.394 requisições, oito streams simultâneos, dezenove ciclos de reconexão e dez términos abruptos do processo de teste, preservando dados. CPU média do processo medido: 0,033% da máquina; latência HTTP mediana 16,06 ms, p95 16,82 ms e pico 38,88 ms. Sem hardware, Alexa ou navegador nesse escopo.
- Nesse ensaio, RSS passou de 51,65 para 63,98 MiB, pico 64,02 MiB; heap de 8,42 para 10,19 MiB. As quatro amostras finais de RSS ficaram entre 63,95 e 64,02 MiB. A amostra não prova ausência de vazamento, não mede o total instalado e não valida estabilidade do OpenRGB.
- `npm audit`: zero vulnerabilidades conhecidas reportadas na consulta. Main remota permaneceu em `1dc5ef0`; [CodeQL](https://github.com/JonJonGf/nexus-rgb/actions/runs/39172574407) e [validação](https://github.com/JonJonGf/nexus-rgb/actions/runs/39172574435) aprovados, sem alertas abertos na referência consultada. Esses resultados remotos antecedem a correção local e não a validam automaticamente.
- O teste de estabilidade começou antes da correção e mede a base isolada sem hardware. Os testes focados e a suíte geral final exercitam a nova lógica de entrega. Não foram necessários novos ciclos de instalador/VM, pois instalador, supervisor e empacotamento não mudaram.

## Encaminhamento

Primeiro revisar/empacotar A01 e A09 para validação física autorizada. Em seguida priorizar A02 e A03, depois A04–A06 e A07 com benchmark equivalente. As reproduções usam as interfaces existentes; não é necessário inventar protocolos USB, baixar drivers ou reduzir o limite da RAM para corrigi-las.

Evidências privadas e fontes sintéticas de reprodução: `data/audit-20261019-082159/`. Incluem logs antes/depois, resultados, screenshots próprios e medição de escala. Não publicar diagnósticos crus ou arquivos pessoais. O relatório sanitizado e o contexto são os documentos compartilháveis. Correção local em `d14be36f5495df50da6bbdb2b09fff03322bdd89`, branch `codex/openrgb-incident-alpha37`, sem push ou nova tag. Documentação posterior não altera esse código. O [contexto de desenvolvimento](../CONTEXTO-DESENVOLVIMENTO.md) registra a continuidade; a Release e a instalação alpha.37 permanecem inalteradas.
