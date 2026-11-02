# Cartões de ventilação e temperaturas selecionadas — 02/11/2026

## Sintoma e escopo

Usuário mostrou três cartões independentes: sensores estreitos, rótulo adicional quebrando em várias linhas, seletor de RPM alto e controles embolados. Pediu reorganizar e mostrar a temperatura de cada fonte. A revisão visual anterior cobria grupo e prévia, mas não essa combinação de cartões com nomes longos. Release permanece pendente; não publicar alpha.44 com base apenas nessa correção.

Reprodução no Edge a 1600 px, com três canais e nomes longos CPU/GPU: seletor de RPM mediu **127,625 px** de altura; teste falhou antes da correção. O grid esticava o campo ao acompanhar a lista de fontes, e cada lista ocupava só metade do cartão. Não era problema do controlador de ventilação.

## Correção

- Fontes e RPM em linhas próprias, largura útil completa; seletores/campos com 40 px, alinhados pelo topo. Mínimo/proteção continuam lado a lado onde há espaço; celular usa uma coluna.
- Fonte adicional com nome curto na apresentação e botão × compacto, preservando rótulo acessível completo e título do nome selecionado. Espaçamento consistente, sem repetir o parágrafo explicativo em todos os cartões.
- Temperatura junto a cada seletor, destaque na maior fonte válida e resumo “Maior selecionada”. Não representa uma curva nova aplicada: o comando efetivo continua no resumo do canal; editar seleção não publica configuração.
- Fonte inválida/indisponível mostra aviso textual e remove o destaque da comparação. Valores usam as amostras já existentes e atualizam no refresh atual; seleção, adição/remoção e RPM também atualizam a apresentação localmente. Sem processo, sensor, timer, API ou comando de fan adicional.
- `public/cooling.js`, `public/cooling.css`, `public/en.js`; backend, persistência, limites e proteção térmica não foram alterados.

## Verificação e limites

`tests/ui/cooling-layout.spec.js` usa apenas o servidor/auxiliar sintético da fixture. Cobre três cartões com nomes longos, altura/largura dos campos, temperaturas individuais, 1600/1280/390 px sem overflow, polling, mudança da maior fonte, leitura nula e inglês. `tests/ui/cooling-linked.spec.js` agora exige também temperaturas no grupo. Capturas opcionais usam pasta fixa do projeto, sem caminho recebido por variável de ambiente.

Primeira rodada: **10/10** testes de ventilação aprovados. Adicionado o caso de atualização/indisponibilidade; sua primeira execução falhou ao voltar da página de idioma sem reiniciar a detecção — sair do monitoramento somente leitura encerra o auxiliar por contrato. Teste passou a detectar novamente antes de conferir a tradução, sem enfraquecer as asserções: **2/2 casos novos passaram**. Suíte completa Edge, sem retries: **76/76 aprovados** (1,8 min). `node --check` nos dois scripts e `git diff --check` aprovados. Mapa conservador regenerado: 1.229 nós/2.306 relações; é orientação estática, não prova física.

Capturas privadas `data/cooling-dev/layout-evidence/channels-{1600,1280,390}.png` inspecionadas; logs `layout-*.log`. Nomes/valores são da fixture, não diagnóstico bruto do usuário. Validação de UI não comprova temperaturas/RPM físicos. Sem alteração na instalação neste checkpoint; código em `codex/cooling-layout-readings`, base `ef323b0`, ainda sem commit da correção. Próximo: registrar o commit, conferir CI e preparar candidata de desenvolvimento para revisão local, mantendo a release pública alpha.43 imutável.
