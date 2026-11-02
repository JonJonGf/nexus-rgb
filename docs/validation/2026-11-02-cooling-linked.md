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

Código `4b2e8735e129622e6ef261cac46b770275e95311` enviado e confirmado na main. [CI 41532051543](https://github.com/JonJonGf/nexus-rgb/actions/runs/41532051543) e [CodeQL 41532051733](https://github.com/JonJonGf/nexus-rgb/actions/runs/41532051733) iniciados; resultados finais ainda pendentes neste checkpoint. Guias foram explicitados como posteriores ao instalador alpha.43. Notas posteriores ao commit não mudam seus executáveis.

### Capturas de teste: reanálise solicitada

CodeQL abriu `#119/#120` (`js/path-injection`) nas duas capturas opcionais do novo teste de navegador: `mkdirSync` recebia uma pasta da variável de ambiente de evidência. É código de teste, sem entrada HTTP/controle de fans, mas a saída foi restringida a `data/cooling-dev/linked-ui-evidence/`, derivada de constantes do projeto. A variável agora é apenas um opt-in booleano (`NEXUS_COOLING_SCREENSHOTS=1`); seu conteúdo nunca define caminho. As duas verificações de navegador com captura passaram novamente. Nenhum alerta dispensado; aguardar a reanálise do commit com essa correção antes de declarar fechamento.

Correção em `5192f46c8319a315abb38243cabcd8e70b20cff1`, enviada e conferida na main. A análise JavaScript marcou ambos **Fixed** automaticamente em `2026-11-02T21:56:39Z`; consulta autenticada confirmou zero alertas abertos. [CI final 41532729511](https://github.com/JonJonGf/nexus-rgb/actions/runs/41532729511) e [CodeQL final 41532729100](https://github.com/JonJonGf/nexus-rgb/actions/runs/41532729100) ainda em andamento neste checkpoint. CI anterior `41532051543` passou: **323 gerais, 74 Edge**, supervisor e estabilidade de 60 segundos (171 requisições/10 reinícios abruptos na fixture). Não é medição de overhead térmico/físico da ventilação.

### Fechamento remoto

CI final **41532729511: success** no commit `5192f46`: **323/323 gerais, 74/74 Edge (2,3 min, sem flaky reportado)**, supervisor e estabilidade de 60 s aprovados. Ensaio de estabilidade: 171 requisições/10 reinícios abruptos na fixture, sem falha; memória do processo dessa fixture não é medição do módulo em hardware. CodeQL final **41532729100: success** nas três linguagens; zero alertas abertos e nenhuma dispensa. Não houve alteração de código após essas verificações, apenas este fechamento documental.

Confirmada leitura do carimbo instalado: **alpha.43 / c2f87cd / development false**, sem atualizar/configurar o PC. A main contém as novas funcionalidades; o release/instalador alpha.43 permanece imutável e não as inclui. Nenhum novo instalador foi publicado como parte deste pedido de envio de código.

## Instalação posterior a pedido do usuário

Usuário pediu “instala a nova versão”. Compilada candidata local com `scripts/build.ps1 -CoolingDevelopment`, carimbo **b1d87b4ff5f4c5086cc3734117f6a3d38adecf99 / tag null / development true**. Não é alpha.44 nem substituição da release alpha.43. Build/self-test e auditoria de produção passaram; contrato do pacote confirmou ventilação disponível, desligada com dados novos, sem auxiliar/polling. Seis arquivos de configuração/execução/UI do pacote conferidos por hash contra fonte testado.

Setup: **87.454.469 bytes**, SHA256 `07c4cad48bdb578952863ca67d889ce3eb91c7e2bae7db0efa16a1740a0c711e`. Cópia do instalador/carimbo, backup e evidências em `data/cooling-dev/linked-install-*/`, ignorados. Backup prévio: 44 arquivos (38 efeitos), todos verificados por hash. Instalador aberto via ShellExecute na sessão interativa, com progresso `/SILENT`, `/NORESTART`, PawnIO desmarcado e aviso de administrador. Log confirmou conclusão, inicialização dos serviços, chamada da bandeja e ausência de necessidade de reboot.

Após instalar: dois serviços Running, painel ready, controlador conectado, seis componentes/detecção encerrada e processo NexusRGB na sessão interativa. **44/44 arquivos preservados byte a byte**; seis módulos instalados iguais ao fonte. HTML servido contém os controles de vínculo, grupo e prévia. Leitura autenticada de estado, sem POST de ventilação, mostrou **três associações anteriores retomadas** e **grupo desligado**. Nenhuma curva/sensor novo foi aplicado, nem foram comandados LEDs/ventoinhas para ensaio adicional. RPM/temperatura mecânica e retomada após boot real não são comprovados por essa verificação. O registro de “PC alpha.43” acima descreve o checkpoint anterior; agora o PC usa esta candidata de desenvolvimento.
