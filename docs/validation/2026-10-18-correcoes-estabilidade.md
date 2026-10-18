# Correções após a auditoria — 18/10/2026

## Escopo e estado

O usuário autorizou corrigir os problemas encontrados e relatou que o teclado deixou de ser reconhecido na alpha.36. O trabalho foi feito na branch `codex/reliability-alpha37`, partindo de `8a11684`. Nenhuma instalação, UAC, reinicialização de serviço, escrita física em RGB ou publicação foi executada.

O número da branch indica uma próxima entrega candidata; não afirma que exista uma alpha.37 publicada. A instalação e a Release oficiais continuam na alpha.36 até uma atualização explicitamente autorizada.

## Mudanças de comportamento

| Auditoria | Tratamento no código |
| --- | --- |
| F01 — descoberta USB | Enumeração pelo protocolo assíncrono da ponte persistente, sem a chamada indefinida ou execução síncrona no servidor. Um teste de processo artificial observou a lista vazia antes da correção e a resposta de descoberta depois. |
| F02 — transportes incompletos | Mitigação conservadora: encoders de controladoras não validados não podem anunciar sucesso nem emitir pacotes físicos presumidos. Essas controladoras continuam pelo OpenRGB. Seus encoders permanecem modelos experimentais para testes; não foi inventado um protocolo físico para preencher essa lacuna. |
| F03 — fila/ACK/erro | Handshake separado das respostas, um comando em voo, fila limitada, tamanho máximo de resposta, prazos, tratamento de erro do pipe e cancelamento da geração após timeout. Cache do teclado só muda após ACK. Hardware conta o envio após a confirmação. Uma confirmação USB pendente não bloqueia o ciclo OpenRGB; pedidos seguintes são substituídos pelo estado atual. Falhas repetidas recebem espera progressiva de 500 ms até 15 s; mudança de comando permite nova tentativa imediatamente. |
| F04 — identidade/modelo | Instâncias de teclado incluem caminho físico no ID. Descoberta automática limitada a VID/PID conhecidos, Feature Report de 65 bytes e Usage Page de iluminação `0xff00`; fabricante sozinho não autoriza o envio. A mesma identidade não é atribuída a duas unidades conectadas. |
| F05 — saúde | Estado de conexão por transporte/componente, confirmação de presença/ACK nativo e diagnóstico parcial quando uma peça OpenRGB está offline. Falhas na descoberta USB ficam disponíveis ao painel, sem detalhes privados. |
| F06 — configuração inválida | Studio abre em configuração de recuperação sem sobrescrever o arquivo original. Antes de gravar uma configuração substituta, preserva cópia identificada pelo conteúdo do mapa inválido. |
| F07 — quarentena | Chave de versão passa a ser SHA-256 de conteúdo/parâmetros, sem truncar código. Leitura compatível com chaves antigas completas. Efeito HTML grande em quarentena continua bloqueado após reabrir o Studio. |
| F08 — backup | Endereços e configuração física USB são locais à instalação: não entram no backup de iluminação e são preservados ao restaurar. Backups antigos com o campo nativo são aceitos sem aplicar os endereços de outra máquina. |
| F09 — teclado | Brilho percentual explícito no caminho do painel para o encoder; 5% não vira brilho máximo. Modo nativo é preservado no snapshot/assinatura de teclado de peça única e chega ao transporte mesmo em estado estático. |
| F10 — ciclo de vida | Redescoberta periódica com cache, reconciliação de presença, remoção de dispositivos desconectados e parada da ponte junto do hardware. Construção inerte: criar o aplicativo com hardware desativado não inicia um executável USB. |
| F11 — quadros repetidos | Revisão do mapa deixa de forçar reenvio de cores idênticas. Reprodução de 60 quadros iguais passa de 60 escritas a uma; desligamento, identificação, retomada e RAM a 20 FPS continuam cobertos. |
| F12 — rotas | Consulta do Windows assíncrona, com cache e no máximo uma atualização em andamento; o servidor não aguarda sua conclusão para responder ou renderizar. Autorização LAN continua usando as mesmas verificações de origem/máscara. |
| F13 — geometria | Layout ANSI de 61 teclas exige metadado explícito. Uma matriz genérica de 61 LEDs respeita suas colunas. Edição de formato/colunas/contagem remove o perfil especial; o schema persiste e valida a geometria. |

O coletor e o painel de recursos também incluem o processo da ponte USB por caminho/parentesco da instalação. Foram retiradas promessas não medidas de latência zero, taxa universal de teclado e suporte universal; a nota histórica da alpha.36 recebeu uma correção explícita, preservando o registro anterior.

## Testes e evidências

As regressões novas usam processos, relógio, SDK e dispositivos artificiais, diretórios temporários e navegador isolado. O caminho de produção da ponte é exercitado por um adaptador de processo; os testes não dependem exclusivamente do modo que simula sucesso sem comunicação.

Os ciclos vermelho/verde foram observados para descoberta, ACK, retenção de erro/estatísticas, não bloqueio de tick, seleção de interface de iluminação, instâncias/hotplug, brilho/modo, recuperação de mapa, quarentena longa, backup, deduplicação e consulta de rotas. Registros privados em `data/correction-*`.

Na verificação inicial completa, um teste de envio esperava um quadro igual desnecessário: foi corrigido para usar cores diferentes e continuar verificando a separação dos relógios. Um teste hostil de efeito teve uma espera insuficiente para três reinícios de processo sob carga: a janela do teste foi ampliada para observar a mesma condição final, sem alterar orçamento do renderer ou retentativas de produção. Outra execução identificou que o modo simulado da ponte não deveria invalidar o cache apenas por não ter um processo real pronto; a condição foi corrigida e os 42 testes afetados passaram.

Validação final: **209/209 testes gerais e 42/42 de interface aprovados**. Supervisor aprovado; **12 cenários** do fixture do instalador concluídos com os códigos esperados em PT-BR/EN. Validação de documentação: 72 arquivos Markdown, 230 links locais, cinco workflows e sintaxe dos blocos de shell aprovados. `git diff --check` aprovado (avisos de conversão de fim de linha, sem erros de whitespace).

O cenário de teclado com animação interna foi exercitado por 60 ticks: um único comando e um único envio contado, sem renderização contínua de quadros por tecla. O teste de RAM/placa mantém 20/60 FPS simulados. A medição local da consulta de adaptadores após a mudança retornou 22,19 ms na primeira chamada e 4,26–4,91 ms nas quatro seguintes; são poucas amostras em condições diferentes das anteriores, não uma comparação controlada de CPU.

A primeira compilação de desenvolvimento concluiu com auditoria de dependências de produção sem vulnerabilidades reportadas, mas antecedeu ajustes finais. O pacote será recompilado a partir do commit final; não utilizar essa compilação inicial como se fosse a entrega definitiva. Hashes e identificação final ficam no registro de continuidade e nos arquivos privados de validação do pacote.

## Limites e testes necessários antes de chamar de validado fisicamente

- O reconhecimento e o comportamento do RK61 devem ser conferidos após instalar a correção com autorização. Um teste simulado não prova a resposta do dispositivo real.
- O ID físico novo diferencia unidades. Configurações e posições antigas continuam armazenadas; caso uma peça tenha sido cadastrada com a identidade antiga ou mude de porta, pode exigir revisão de vínculo. Não foi feita migração automática por nome ou modelo presumido.
- Compatibilidade USB própria de outras controladoras continua pendente de protocolo/modelo confirmado e ensaio físico. Elas devem usar o caminho OpenRGB existente.
- Não foi feita verificação física de toda combinação de hub/LED/placa, pentest completo, teste prolongado de vazamento nem medição de latência de digitação.
- Os fixtures do supervisor e instalador não substituem atualização real em VM com processos abertos. Nenhuma nova validação CodeQL remota foi executada neste trabalho ainda não publicado.
- O [relatório da auditoria](2026-10-18-auditoria-funcional-desempenho.md) contém medições anteriores à correção. Não reutilizar seus números como benchmark da versão corrigida nem somar escopos diferentes para anunciar consumo total.
