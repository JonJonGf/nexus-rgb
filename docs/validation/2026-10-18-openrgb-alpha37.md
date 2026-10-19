# Interrupção do controle RGB na alpha.37 — 18/10/2026

## Sintoma reproduzido

O usuário relatou que o aplicativo deixou de controlar a iluminação. A instalação consultada já era a **v0.1.0-alpha.37**, commit `0a78ede08d3c3d9062657a0e764c46e11abf134a`, sem marca de desenvolvimento. Isso atualiza o registro anterior que ainda apontava um candidato instalado; não houve instalação nesta investigação.

O painel HTTP respondeu normalmente e os dois serviços Windows estavam em execução. Entretanto, `/api/health` retornou conexão OpenRGB indisponível e `controllerHung: true`. A mesma verificação falhou antes da recuperação e passou depois dela.

O estado detalhado registrou `ETIMEDOUT` em `controller-description`, prazo de 4.000 ms, índice 0 e doze ocorrências acumuladas. A primeira falha registrada foi às 20:16:14, horário de Brasília. Os componentes do OpenRGB estavam offline e o teclado de integração nativa permanecia online. O processo OpenRGB continuava existente, com conexões antigas em `CLOSE_WAIT`. Esses sinais comprovam perda de resposta no caminho SDK; não identificam o componente ou a operação que iniciou o bloqueio.

O campo agregado `hardware.connected` do estado completo pode continuar verdadeiro quando a integração nativa está disponível; `/api/health` consulta a conexão OpenRGB diretamente. Portanto, o valor agregado isolado não comprova que todos os componentes estejam funcionando.

## Recuperação executada e autorização

O usuário autorizou expressamente abrir o pedido de administrador, copiar os registros protegidos, fazer backup dos ajustes e reiniciar somente Nexus/OpenRGB. O helper privado executou a cópia antes de chamar o `restart-services.ps1` da instalação registrada. Resultado: código de saída zero, sem reiniciar o Windows ou instalar/alterar drivers.

O supervisor encerrou o processo antigo após esgotar o prazo de encerramento normal. Essa mensagem também existe em reinícios anteriores; sozinha não distingue uma instância travada do comportamento habitual de encerramento do OpenRGB.

## Resultado observado

- Os seis componentes voltaram a ficar online, sem erro, com detecção concluída e `controllerHung: false`.
- O usuário confirmou que as luzes voltaram a responder aos controles.
- Três leituras entre 20:23:24 e 20:23:32 mantiveram painel e OpenRGB conectados; o processo recuperado havia iniciado às 20:21:58. É uma observação curta, não estabilidade prolongada.
- Perfis e estrutura completa do mapa permaneceram iguais ao backup. Os 36 arquivos de efeitos continuaram presentes e idênticos.
- O arquivo de ajustes mudou em cor e velocidade gerais durante a verificação interativa. Os demais campos comparados foram preservados; não houve restauração automática que sobrescrevesse as alterações feitas no painel.
- A configuração de 60 FPS foi preservada. Não foram comandados efeitos de teste, alterada a proteção da RAM ou realizados testes de estresse no hardware.

## Causa e limites

A causa inicial do bloqueio **não foi determinada**. Os registros do OpenRGB preservados não contêm uma explicação no instante da primeira falha. Há avisos de inicialização anteriores, também presentes após a recuperação saudável; eles não demonstram a causa desta interrupção. Não atribuir a falha à RAM, ao teclado, a um driver específico ou a uma regressão da alpha.37 sem evidência adicional.

Esta entrega é recuperação operacional e registro de evidências, **não uma correção de código que previna recorrência**. Não foram executadas suítes automatizadas porque nenhum arquivo de produto mudou. Os testes desta investigação foram consultas ao serviço real antes/depois, comparação dos dados e confirmação física do usuário.

Próxima investigação, se a falha se repetir: preservar novamente o último erro de operação e os registros antes de reiniciar, correlacionar o efeito efetivamente ativo e o tempo até a interrupção, e avaliar uma coleta supervisionada mais precisa. Não realizar estresse físico ou recuperação automática indiscriminada por dedução.

## Evidências e Git

Diagnósticos crus, logs, informações de processos, backup dos dados e resultados do helper estão na pasta privada `data/incident-20261018-202010/`, ignorada pelo Git. Não publicar seu conteúdo. A referência de código continua sendo a tag alpha.37; a main consultada estava em `1dc5ef0`. Branch de investigação `codex/openrgb-incident-alpha37`, somente documentos locais ainda não commitados; nenhuma nova tag, Release ou instalação foi criada.
