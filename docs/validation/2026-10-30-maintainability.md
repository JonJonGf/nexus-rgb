# Revisão de manutenção e contexto — 30/10/2026

## Pedido e escopo

Usuário pediu revisitar pendências, avaliar Tailwind e refatoração modular/documentada para reduzir trabalho e tokens em atualizações. Aceitou trabalho em branch separada. Depois retirou explicitamente problema da RX 7600 e aviso de resposta da Alexa das pendências ativas. Não autorizou por essa revisão nova instalação, hardware, merge ou release.

Base local `54b99ad`; origin/main conferida em `de5573a`. Branch `codex/architecture-review`. Não se trata de reescrita concluída de todo o aplicativo: revisão do backlog e primeiro lote de organização, com sequência restante explícita.

## Achados confirmados

1. Contexto obrigatório tinha 1.340 linhas/40.694 palavras; plano 290 linhas/8.606 palavras. Misturavam propostas, estados locais antigos e entregas posteriores. Referências antigas a pendências corrigidas favoreciam leituras extensas e retrabalho.
2. `server/cooling.js` concentrava configuração/presets/validação, matemática e execução/retomada. Gráfico e servidor repetiam a interpolação Linear/Suave.
3. CSS já utiliza variáveis de tema e classes compartilhadas. Tailwind não estava instalado. O app não precisa dele para modularizar regras de hardware, estado e documentos.
4. Os três modos LAN e a migração revisável entre IDs não estão completos: `Security.session` concede acesso não administrador à mesma sub-rede e QR entrega URL; não há assistente de migração. Reconexão TCP/SSE existente não é migração de dispositivo.
5. Reabrir A02–A17 com base nos relatórios originais ignoraria correções posteriores registradas em 19/10. O plano agora distingue entregue, backlog, ensaio físico e suspensão pelo usuário.

## Alterações

- Arquivos anteriores preservados em `docs/HISTORICO-DESENVOLVIMENTO-2026-10-30.md` e `docs/HISTORICO-PLANO-MELHORIAS-2026-10-30.md`. No primeiro, apenas dois links para âncoras do plano foram redirecionados ao arquivo histórico correspondente. Git mantém versões originais.
- `CONTEXTO-DESENVOLVIMENTO.md` e `PLANO-MELHORIAS.md` passam a representar somente estado atual/índice. AGENTS orienta leitura proporcional e consulta histórica sob demanda. `ARCHITECTURE.md` documenta tarefas, módulos, contratos, invariantes e testes.
- `server/cooling-config.js`: extração de presets e validação existente, sem I/O. `public/cooling-model.js`: interpolação/gráfico puros compartilhados. Chamadores atualizados e asset/script incluídos. Sem nova dependência, processo, polling, formato salvo ou mudança de limites térmicos/cadência.
- [ADR 0001](../adr/0001-maintenance-and-styles.md): não migrar para Tailwind automaticamente. Eventual piloto precisa comparar custos e comprovar valor numa tela real. Nenhum pacote Tailwind adicionado.

## Medida da documentação

Antes: 385.885 caracteres nos dois documentos originais. Primeira versão curta: 9.917 caracteres, **97,43% menos**, com 576 + 699 palavras por espaços. O contexto pode crescer alguns parágrafos no fechamento; medida final será registrada abaixo.

Isso mede entrada documental, não tokens reais de um modelo nem duração de futuras tarefas. Arquivos históricos continuam disponíveis e ocupando espaço. Não houve remoção de evidências, compactação de fonte ou alegação de redução de RAM/CPU.

## Testes e limites

- Baseline antes da extração: 28 contratos HTTP e oito Edge de ventilação aprovados sem retries.
- Depois da extração: 28 contratos HTTP aprovados. Verificação diferencial privada determinística: 1.000 curvas, Linear/Suave, temperaturas internas/externas — **20.000 valores e 2.000 gráficos idênticos** à implementação anterior; rascunho vazio preservado. Isto comprova equivalência calculada, não RPM físico.
- Suíte geral: **305/305** aprovados. Primeira suíte Edge sem retries: **67/68**; o teste de exclusão/reconexão do mapa terminou com `apiResponse.json: Response has been disposed` dentro de uma interceptação de estado. Dez repetições isoladas passaram antes de alterar o teste; a intermitência não foi atribuída à curva nem anunciada como defeito físico.
- Ajuste restrito ao encerramento desse teste: `page.unrouteAll({behavior:'wait'})` aguarda interceptações em andamento antes de descartar o contexto, conforme [contrato oficial](https://playwright.dev/docs/api/class-page#page-unroute-all). Não ignora erros, não remove asserções nem amplia retries/timeouts. Suíte completa final: **68/68 Edge sem retries**. Uma rodada verde não demonstra ausência universal de intermitência; o stack e o ajuste de ciclo ficam registrados para investigação futura se retornar.
- Histórico verificado contra `54b99ad` e 135 referências locais conferidas sem destino ausente. Mapa conservador regenerado: **1.153 nós, 2.157 relações, 88 comunidades**, sem API de IA externa. Números do mapa não comprovam ganho de desempenho ou ausência universal de defeitos.
- Testes existentes via HTTP/browser são o contrato da refatoração. Nenhum teste de nome de função privada foi acrescentado para espelhar a implementação. Nenhum defeito novo foi declarado sem reprodução.
- Sem teste de instalador real em VM nesta rodada: não houve alteração de ciclo de instalação. `scripts/build.ps1` copia server/public recursivamente; nova rota estática deve passar nos testes do navegador. Não foi produzido nem instalado novo executável.

## Próximo lote

Seguir [plano atual](../PLANO-MELHORIAS.md): rotas/composição HTTP, depois responsabilidades de hardware e editor/prévia. Cada lote precisa preservar interfaces e justificar sua extração. Não usar o tamanho do arquivo ou trocar CSS como evidência automática de ganho.

## Git e estado do aplicativo

Runtime refatorado: `50895d8`; encerramento do teste: `259f554`. Documentação desta revisão é posterior e não altera esses resultados. Entrega na branch `codex/architecture-review`, sem merge automático; CI remoto deve ser distinguido dos resultados locais acima. Não há nova tag, instalador ou atualização instalada nesta rodada. Main/release/PC continuam alpha.42; o próximo lote de organização permanece proposto.
