# Ventilação conjunta e múltiplas temperaturas — 02/11/2026

## Pedido e resultado

Usuário autorizou implementar, testar e enviar ao GitHub: controle opcional dos canais juntos, curva seguindo o sensor mais quente (CPU/GPU) e gráficos dos perfis prontos com pouca poluição visual. Branch `codex/cooling-linked-sensors`, base `c0f58d7`. Nenhuma instalação/UAC, reinício de serviço ou comando físico faz parte deste lote. PC e release publicada continuam alpha.43.

- **Uma curva para os canais selecionados** concentra fontes, mínimo, proteção e curva. Os ajustes individuais continuam salvos separadamente e voltam a valer ao desmarcar/aplicar. Associação de RPM permanece por canal.
- **Selecionar canais visíveis** marca somente canais visíveis com faixa segura; não ativa o controle, não escolhe portas ocultas e não pressupõe que zero RPM seja porta vazia.
- Um canal ou grupo pode seguir até **oito sensores distintos**. Maior temperatura em °C, não média, orienta a curva. O auxiliar já consultava CPU e GPU; nenhum processo, driver ou temporizador adicional foi criado.
- Vínculo significa mesma curva/porcentagem solicitada, sujeita aos limites de cada canal; não iguala mecanicamente RPM de fans diferentes.
- **Ver curvas dos perfis** mostra um gráfico por vez em painel recolhido. Seu seletor é apenas visual: não inicia sensores, ativa controle ou publica configurações. Botões de perfil existentes continuam sendo a ação de aplicar. Prévia e editor usam o mesmo cálculo Linear/Suave.

## Contratos e proteções

`cooling-config.js` valida `sensorIds` opcional e `group` opcional. `sensorId` continua presente como primeira fonte para compatibilidade; lista ordenada/distinta, tamanho/IDs limitados. `effectiveAssignments` deriva os comandos do grupo sem sobrescrever preferências individuais. Configurações legadas com uma fonte conservam o formato de identidade anterior.

`Cooling.bindings` confere todas as identidades (placa, canal e sensores, incluindo secundários). Hashes de uma mesma linha são reutilizados dentro de cada verificação, sem manter cache que possa mascarar mudança futura de identidade. A retomada aguarda temperaturas atuais válidas e preserva a curva realmente aplicada.

Temperatura nula/não finita/fora da faixa válida em qualquer fonte selecionada solicita proteção máxima permitida pelo canal. Fonte/canal ausente ou identidade alterada interrompe controle e solicita devolução ao firmware; não usa silenciosamente só o sensor mais frio. Mantidos serialização, amostra de 1 Hz, limites mínimos/máximos, histerese, queda gradual, deduplicação e watchdog nativo. Não há prova de RPM/segurança térmica física em novos equipamentos.

UI mantém fontes explícitas, salva apenas ao aplicar/ativar e preserva rascunhos no polling. Editor do grupo é criado somente quando usado; prévia é SVG local, sem gráficos/temporizadores em segundo plano. Tradução PT/EN e largura de 390 px conferidas. Sem dependência nova.

## Verificação realizada

- TDD em contratos HTTP existentes: primeiro teste falhou com 400 por `sensorIds` desconhecido; implementado suporte e retomada. Próximo teste falhou com 400 por `group` desconhecido; implementada derivação/persistência. Depois: seleção da fonte mais quente, troca CPU/GPU, reinício, desfazer vínculo/restaurar curvas, sensor inválido/ausente, identidade secundária alterada, entradas malformadas, limites individuais e canal não selecionado.
- Dois novos testes de navegador falharam pela ausência da opção/preview antes da UI. Primeira rodada integrada teve duas falhas de seletores ambíguos por editor compartilhado criado mesmo oculto. Criação sob demanda removeu esse trabalho e a ambiguidade; **9/9 testes de ventilação** passaram e depois **74/74 Edge sem retries** na suíte completa.
- Suíte geral local: **322/322** antes do teste adicional de limites; contratos finais de ventilação/retomada: **34/34** após cache local de hashes e esse teste. Contagens se sobrepõem, não somar como testes únicos. O CI do commit final deve registrar o total atualizado.
- `scripts/test-cooling-native.cjs`: fixture passou em framing, monitoramento sem escrita, apply/release, lote inválido, watchdog e identidade de pipe. Usa apenas backend simulado, sem abrir sensores ou pedir administrador.
- Auditoria npm de produção: **zero vulnerabilidades**. Sintaxe de JS e `git diff --check` conferidos. Mapa atualizado pelo script conservador (1.227 nós/2.297 relações/95 comunidades); cobertura estática não é teste físico.
- Capturas privadas dos painéis de grupo/prévia em inglês, 1280 e 390 px, inspecionadas em `data/cooling-dev/linked-ui-evidence/`. Logs privados `linked-*.log`. Sem exportar configurações pessoais.

Não foi repetido ciclo de instalador em VM: não houve mudança de empacotamento, auxiliar nativo, serviços ou ciclo de instalação; os arquivos existentes de server/public são copiados pelo build. Nenhum executável novo foi anunciado ou instalado. Retomada foi exercitada em processos/servidores de fixture, não com reboot físico do PC.

## Git e próximo passo

Mudanças em configuração/execução de ventilação, UI/CSS/HTML, strings PT/EN, dois testes de contrato/browser e guias/índice/contexto. Commit e confirmação remota serão registrados no fechamento; não inventar hash antes da criação. Conferir CI/CodeQL antes de encerrar. Publicar instalador e instalar no PC são entregas separadas; tag/binário alpha.43 não serão substituídos.
