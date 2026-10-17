# Proposta de recuperação de controlador sem resposta

Proposta de 17/10/2026 para o incidente observado na alpha.26. Este documento define a solução; não anuncia implementação, correção definitiva do OpenRGB ou autorização para reiniciar a instalação real.

## Evidência e limites

O OpenRGB respondeu à versão do protocolo, à contagem de controladores e à descrição de um controlador, mas não à descrição de outro. A reconexão TCP não restabeleceu o controle; o reinício autorizado dos serviços restabeleceu cinco componentes, preservando os dados acompanhados.

Isso demonstra indisponibilidade parcial do servidor SDK naquele momento. Não identifica sozinho a thread, a trava ou a operação de driver responsável. Os trechos citados na investigação usam `AccessMutex.lock_shared()` tanto na descrição quanto na atualização de LEDs; uma trava compartilhada não bloqueia outra compartilhada. Pode haver escritores, outras travas ou operações pendentes no fluxo completo, mas não houve captura das pilhas do processo no incidente para demonstrar qual delas causou a espera.

O encerramento forçado após 1,5 segundo também não comprova deadlock: o supervisor tenta escrever `shutdown` no stdin e fechar a janela; não foi demonstrado que o OpenRGB em modo servidor implemente esse comando de saída. Mensagens de encerramento de socket posteriores ao início da falha são evidência de desconexão, não prova do gatilho inicial. Não atribuir o incidente a 60 FPS ou à saturação do SMBus sem medição/reprodução.

## Etapa 1 — Diagnóstico correto e falhas identificáveis

- Corrigir a exportação que transforma `offline` em `online`. Contagens e LEDs descobertos anteriormente devem ser identificados como último estado conhecido enquanto desconectado; não substituí-los por zero nem fingir que estão disponíveis.
- Registrar falhas com códigos estruturados, fase (`connect`, `protocol`, `controller-count`, `controller-description`, `resize`, `mode`, `write`), prazo, índice da controladora naquela conexão e número de tentativas. Índices SDK não são identidades persistentes; não os associar a um nome depois de uma nova descoberta sem validação.
- Preservar o primeiro timeout significativo: o evento genérico de fechamento do socket não deve apagar a informação da operação que falhou. O diagnóstico público usa identificadores temporários, sem seriais, caminhos ou dados de rede reais.
- Registrar uma vez por mudança de estado, com histórico limitado; não gerar um log a cada quadro ou por repetição idêntica da falha.

## Etapa 2 — Detectar indisponibilidade parcial sem multiplicar conexões

- Manter uma única tentativa de conexão/descoberta por vez e prazos limitados. Cada operação deve estar vinculada ao cliente e à geração que a iniciou, para que um timeout antigo não feche uma conexão nova.
- Tratar como suspeita de controlador sem resposta a sequência: protocolo/conexão concluídos, contagem recebida e descrição expirada. Confirmar em três tentativas consecutivas, dentro de uma janela limitada proposta de dois minutos; valores sujeitos a testes. Limpar a sequência somente após descoberta íntegra bem-sucedida ou mudança comprovada da assinatura da falha.
- Diferenciar inicialização gradual, ausência de dispositivos, porta ocupada, erro de parsing e servidor SDK inacessível. Não usar `connected: false` sozinho para disparar recuperação de processo.
- Não adicionar sondagens por LED/frame. Reaproveitar as tentativas de reconexão com espera progressiva; encerrar e descartar o cliente anterior antes de abrir outro.
- Não continuar enviando comandos por IDs SDK de uma descoberta antiga nem simplesmente pular uma resposta pendente no mesmo socket. O protocolo e a biblioteca não garantem que respostas tardias não desorganizem o fluxo.

## Etapa 3 — Recuperação operacional supervisionada

Primeira entrega: mensagem clara **OpenRGB não respondeu ao consultar um componente**, com ação **Reiniciar controlador** usando o fluxo nativo existente e sua autorização de administrador. Explicar que todos os componentes atendidos por esse processo terão uma breve interrupção.

Ampliação opcional: configuração local **Recuperar automaticamente o OpenRGB**, desativada por padrão até validação. O usuário deve ativá-la conscientemente; testes nesta máquina continuam exigindo autorização prévia na sessão.

- Quem recupera é o supervisor de hardware, que já possui o processo filho e seu Job Object. Verificar a instância gerenciada e encerrar apenas esse filho; não procurar e matar todo processo chamado OpenRGB, não controlar instalações alheias nem reiniciar o Windows.
- Projetar um canal local de comando fixo com ACL apropriada e autorização administrativa; não expor execução de comandos arbitrários por HTTP, parâmetros de caminho/processo ou um endpoint LAN de reinício privilegiado.
- Suspender os envios do Nexus durante a recuperação. Conservar perfis, brilho, energia geral/individual, exclusões, mapa e configuração das zonas. Não escrever `power: true` como parte da recuperação.
- Limitar a uma recuperação automática por hora por instalação, com orçamento mantido pelo supervisor através de reinícios do Node e atualização atômica. Bloquear recuperações simultâneas com o reinício manual existente. Se houver nova falha após o orçamento, interromper o ciclo e pedir ação do usuário.
- Usar encerramento limitado e fallback ao Job Object somente para a instância gerenciada. Não chamar um prazo curto de encerramento de teste de travamento.
- Após iniciar OpenRGB, realizar descoberta nova e aguardar detecção gradual com prazo máximo. Somente então reaplicar configurações aos dispositivos de identidade validada. Separar painel pronto de controlador conectado/detectando e reportar recuperação parcial ou falha sem anunciar sucesso.

Essa etapa é mitigação operacional: recuperar o processo não corrige uma falha interna de driver ou controlador.

## Etapa 4 — Cadência por controladora, se necessária

- Não impor 30 FPS a toda RAM por suposição, nome comercial ou configuração deste PC. `busy` do Node não comprova que o trabalho físico assíncrono do OpenRGB terminou.
- Antes de alterar padrões, medir envios, tempos de resposta, fila e erros por controladora usando ambiente isolado. Suprimir quadros idênticos quando a semântica do efeito permitir e manter somente o quadro mais recente quando o transporte atrasar, com fila limitada.
- Avaliar uma opção de taxa por controladora, limitada pelo FPS global, para testar um componente lento sem reduzir todos os demais. Controladoras compostas compartilham o mesmo orçamento; uma peça do mapa não equivale a um barramento independente.
- Expor taxa solicitada e efetiva, sem prometer que cada envio corresponde a uma atualização física. Testes no hardware exigem autorização e não devem tentar provocar travamento de propósito.

## Testes e critérios de aceitação

1. SDK e servidor TCP simulados: responder protocolo/contagem, deixar uma descrição pendente, medir timeout e testar reconexão que depois volta a funcionar. Incluir resposta tardia, interrupção durante timeout e troca de geração, sem socket/temporizador acumulado.
2. Diagnóstico: componentes offline, contagens antigas identificadas e causa/fase preservadas mesmo após evento de desconexão. Dados sensíveis fictícios não aparecem na exportação.
3. Supervisor simulado: uma recuperação apenas, exclusão mútua com reinício manual, recusa de processo alheio, orçamento persistente, falha ao iniciar e recuperação parcial. Nenhum teste deve operar os serviços reais.
4. Preservação: master desligado, dispositivo individual apagado, exclusões, zonas e dispositivos que mudam de ordem. Não usar identidade antiga para endereçar controladores novos.
5. Interface: mensagens PT/EN em PC/celular, progresso e resultado coerentes, sem repetir notificações idênticas. Manter o painel disponível quando o OpenRGB falhar.
6. Publicação somente após implementação e controles obrigatórios. Até lá, o pacote e a instalação continuam alpha.26; a autorização desta proposta não cobre instalação, UAC ou reinício futuros.

## Sequência recomendada

Entregar primeiro diagnóstico e classificação com testes TCP, depois a recuperação manual integrada. Desenvolver e validar a recuperação automática como opção separada. Investigar cadência e mudanças no OpenRGB/PawnIO somente com evidência adicional; não reinstalar drivers nem alterar proteções para contornar o incidente.
