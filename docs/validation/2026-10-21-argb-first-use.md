# Primeiro uso de saídas ARGB — 21/10/2026

## Problema reproduzido

Usuário apontou má impressão causada por portas ARGB inicialmente com zero LEDs. Na alpha.40, a orientação de quantidade já existia, mas ficava dentro do grupo de zonas fechado da placa-mãe. Controles de iluminação eram apresentados mesmo sem LEDs configurados, parecendo comandos que não funcionam.

Reprodução em navegador com snapshot de uma controladora contendo uma saída redimensionável sem LEDs e outra já configurada. O novo teste falhou antes da mudança porque não havia orientação/ação visível no cartão principal. Nenhum componente, serviço ou LED físico foi comandado.

## Mudança local

- `public/app.js`: cartão do aparelho mostra **Há saídas ARGB disponíveis para configurar** e ação **Configurar portas ARGB**; abre as zonas e foca o campo correto. Pelo celular/LAN aparece **Ver portas ARGB**, com orientação para configurar no PC.
- Saída redimensionável sem quantidade usa **Quantidade não configurada / Configuração pendente**. O valor técnico continua zero no backend; não há inferência de número físico nem gravação automática.
- Campo inicial vazio, obrigatório e inteiro, respeitando os limites reais. Valor vazio não vira silenciosamente `count: 0`. Gravação usa a mesma rota de redimensionamento já existente, somente após escolha explícita válida.
- Controles de energia/cor/brilho/modo e selo de sincronização ficam ocultos na saída sem quantidade; voltam pelo estado normal quando houver LEDs configurados. Outras saídas continuam operando.
- `public/style.css` e `public/en.js`: apresentação responsiva, campo legível e PT/EN. Orientação é inline, sem modal/tutorial repetido. Porta vazia não precisa ser configurada; não se presume que zero represente erro físico.

O uso do termo ARGB preserva o escopo anterior: saídas redimensionáveis sem LEDs fornecidas pelo adaptador. A interface não foi alterada para descobrir automaticamente a ligação física, contar fans ou ignorar limites do dispositivo.

## Testes e limites

- 15 testes Edge passaram sem retries: app geral, agrupamento/primeiro uso e teclado.
- Após ajuste de largura/captura, 4 testes de agrupamento/ARGB PT/EN passaram novamente sem retries.
- 7 testes selecionados do adaptador hardware passaram: zonas, redimensionamento, identidade, desconexão e energia. SDK simulado; não prova LED físico.
- Navegador verificou orientação visível com grupo fechado, foco ao abrir, input vazio, nenhum POST de dispositivo automático/vazio e envio de `{zone:0,count:24}` apenas ao escolher 24. Essa fixture de navegador verifica a emissão do pedido; não simula confirmação física ou persistência real do controlador. O caminho de redimensionamento é coberto separadamente pelos testes do adaptador.
- Desktop/celular 390 px inspecionados, sem overflow horizontal. Evidência privada em `data/argb-setup/`; snapshots e logs não entram no Git.
- Apenas interface/documentação/testes mudaram. Sem dependências de runtime novas, timers, trabalho por quadro, alteração de cadência ou benchmark novo desnecessário para estes controles. Sem nova instalação/VM, reinício, UAC, release ou teste físico.

Branch `codex/fan-control-dev`, base anterior `af97610`, commit de código **`075207f`**. Esta atualização documental posterior não modifica os binários. A candidata não altera o instalador alpha.40 já publicado.
