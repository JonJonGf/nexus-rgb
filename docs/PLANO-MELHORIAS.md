# Melhorias avaliadas em 16/10/2026

Este registro mantém as melhorias aceitas para avaliação e implementação futura. Ele não anuncia recursos disponíveis nem uma data de entrega. A revisão do código identificou diferenças em relação às hipóteses do relatório externo; cada alteração precisa de reprodução e testes próprios.

## Implementado na alpha.20, com resultado físico registrado: comunicação da Alexa

- Confirmar separadamente energia e brilho virtual no protocolo Hue, sem mudar o brilho RGB, cores, perfis ou parâmetros do mapa.
- Preservar a energia em pedidos que contêm somente brilho. Um `on` explícito determina a energia, mesmo com `bri: 0`.
- Manter consultas posteriores coerentes com o brilho virtual aceito e validar tipos/faixas antes de aplicar energia.
- Aceitar barra final nas rotas Hue sem ampliar o acesso a Echos não aprovados.
- Validar com HTTP real e testes isolados; o desaparecimento do aviso de falha depende de teste com Echo físico. Consulte [Alexa](ALEXA.md).

O teste físico da alpha.20 ainda acusou falha ao acender/apagar. Depois, o usuário relatou que pediu à Alexa+ para não anunciar mais o erro e a resposta de voz foi suprimida, sem nova alteração do Nexus. O estado no app e a causa no protocolo permanecem sem confirmação de correção. Consulte o [contexto de continuidade](CONTEXTO-DESENVOLVIMENTO.md) antes de novas tentativas.

## Implementado e validado na alpha.21: estabilidade e hardware

- Otimizar a redescoberta sem perder a detecção inicial por etapas, os eventos do SDK, a reconexão e uma recuperação limitada caso eventos sejam perdidos. A primeira peça detectada não significa que a varredura terminou.
- Medir o custo da descoberta antes de atribuir engasgos a ela. O caminho do SDK consulta descrições mantidas pelo OpenRGB; isso não comprova nova varredura SMBus a cada consulta.
- Evitar reenvios de preto quando a prévia espacial continua gerando revisões com as luzes apagadas. Considerar Off nativo quando todas as zonas estiverem apagadas, preservando zonas independentes e identificação temporária.
- Implementar encerramento normal dos processos por um canal compatível com serviços Windows, com prazo máximo e Job Object como recuperação forçada.
- Diferenciar painel pronto de hardware ainda em detecção no reinício manual; espera limitada, mensagem de progresso e tratamento de descoberta parcial.

## Implementado e validado na alpha.23: clareza visual e rede

- Indicar personalização individual nas peças excluídas do mapa com o indicador **Ajuste individual · fora do mapa** e oferecer **Voltar a seguir o mapa** por dispositivo, preservando exclusões intencionais ao pausar ou reativar o mapa.
- Melhorar seleção de interface considerando gateway/rotas locais, interfaces Hyper-V válidas e VPNs; manter escolha manual coerente entre painel e bandeja via `network.json`, sem depender da Internet.
- Separar orçamentos de leitura (240/min), escrita (180/min), operações caras (60/min) e arquivos estáticos (512/min), preservando proteções contra inundações sem que um orçamento bloqueie outro.
- Reservar capacidade limitada da prévia ao administrador (2 clientes LAN no máximo e até 4 totais) sem remover o limite global ou o descarte de clientes lentos (> 512 KiB acumulados).
- Deixar rotas `/api/` fora do interceptador do Service Worker e implementar reconexão automática da prévia com espera progressiva.

## Recursos opcionais

- Acesso LAN aberto por padrão, link/QR autorizado com revogação e renovação, e somente neste PC. Definir separadamente o comportamento da ponte Alexa. Links HTTP não fornecem criptografia.
- **Reconectar dispositivo** com revisão da origem/destino e das configurações migradas; aproveitar número de série confiável quando disponível e exigir escolha em casos ambíguos. Não adivinhar por fabricante, nome e contagem de LEDs.
- Melhorar diagnóstico da porta da Alexa, incluindo possível uso pelo Windows/HTTP.sys, sem encerrar serviços alheios ou impedir desnecessariamente o controle RGB pelo painel.

## Implementado na alpha.24 (validação física de transição suave pendente no hardware real): edição, energia, diagnóstico e recuperação

As quatro propostas abaixo foram detalhadas em 16/10/2026 e implementadas em 17/10/2026 na `v0.1.0-alpha.24`, com validação automatizada completa (unidade, integração, interface e instalador). A validação visual física da transição suave de energia nos LEDs reais depende da instalação autorizada pelo usuário no PC de validação.

### 1. Desfazer e refazer no mapa e no editor de efeitos

**Experiência:** oferecer botões visíveis de **Desfazer** e **Refazer** no PC e no celular, com descrição breve da ação disponível, além de `Ctrl+Z` e `Ctrl+Shift+Z` no PC. Um arraste completo corresponde a uma ação; a posição é aplicada ao soltar, conforme a preferência do usuário. Alterações de posição, tamanho, rotação e representação do dispositivo devem ser recuperáveis.

- Manter históricos separados para o mapa e para o rascunho do efeito. Uma nova alteração após desfazer descarta somente o caminho de refazer daquele histórico. Definir limites de quantidade e memória, sem copiar quadros de animação ou criar histórico a cada frame.
- Dentro do campo de código, preservar o desfazer nativo do editor, incluindo texto temporariamente inválido. Os atalhos do mapa não podem capturar a digitação do JSON/HTML. A aplicação só envia ao motor um efeito válido; erro de sintaxe não substitui a última prévia funcional.
- Separar rascunho, prévia e efeito salvo. Cancelar a edição mantém o efeito salvo; permitir restaurar a última versão salva antes de substituir o rascunho. Avisar sobre rascunho não salvo ao fechar. Recuperação do rascunho após recarregar é uma ampliação futura, não requisito da primeira entrega.
- Usar revisões do servidor para evitar que desfazer em um celular sobrescreva silenciosamente alterações posteriores feitas no PC. Ao detectar conflito, apresentar o estado atualizado e pedir uma nova decisão; não restaurar um snapshot completo de configurações antigas.
- **Aceitação:** arrastar/desfazer/refazer e recarregar preserva a posição persistida correta; os LEDs da prévia permanecem presos à peça; uma ação não altera dispositivos alheios, perfis ou exclusões; testar teclado, toque, JSON inválido e edição simultânea em dois clientes. Operações de energia, instalação e hardware não entram nesse histórico.

### 2. Transição suave ao ligar e desligar

**Experiência:** em Configurações, escolher entre **Instantâneo** e **Suave**, com duração ajustável. Proposta inicial: manter Instantâneo como padrão e oferecer durações de 0,2 a 3 segundos para a opção suave, sujeitas a validação física. Aplicar ao controle geral, ao individual e aos comandos de energia da Alexa.

- Implementar a transição como um multiplicador temporário da saída de luz, preservando brilho configurado, paleta, velocidade, mapa e perfis. Ao apagar, chegar a preto/Off e cessar os envios desnecessários; ao acender, retornar ao brilho anterior. Componentes desligados individualmente precisam conservar a semântica atual do controle geral.
- Se chegar outro comando durante a transição, partir da intensidade atual e seguir a intenção mais recente, sem saltos, filas ou clarões. Alterar cor/brilho no meio deve atualizar o destino coerentemente. Não gravar em disco a cada passo.
- Não esperar o fim da animação para responder ao comando da Alexa. Confirmar a aceitação e representar coerentemente o estado solicitado e a transição em andamento, sem declarar como resolvido o aviso de falha já conhecido do Echo.
- Respeitar o FPS configurado e a capacidade do controlador. Modos nativos sem controle contínuo de brilho podem exigir fallback instantâneo informado; não trocar silenciosamente o efeito nativo para simular a transição. Nunca acender uma peça apagada durante reconexão ou recuperação.
- **Aceitação:** testar ligar/apagar rápido e repetidamente, energia individual e geral, brilho zero, reinício durante a transição, controlador indisponível e efeitos animados. Medir custo de CPU/envios e confirmar fisicamente suavidade, ausência de piscadas e parada dos envios ao apagar. A prévia isolada não comprova o resultado físico.

### 3. Exportar diagnóstico com revisão antes de compartilhar

**Experiência:** botão **Preparar diagnóstico** em Configurações, seguido de uma tela que mostra os dados incluídos e permite remover categorias. Depois de revisar, a pessoa baixa um arquivo e decide se o anexa manualmente a uma issue no GitHub. Coleta sob demanda, sem telemetria, envio automático ou conexão externa para preparar o relatório.

- Incluir versão do Nexus/OpenRGB e Windows, estado dos serviços/conexões, contagens e capacidades técnicas dos componentes, FPS configurado e erros recentes sanitizados. Organizar por componente com identificadores temporários; informar o horário da coleta e quando alguma informação não pôde ser consultada.
- Excluir por padrão credenciais, tokens, usuários da ponte Alexa, seriais, IPs/MACs, nome do computador/usuário, caminhos pessoais, conteúdo de efeitos importados e nomes/conteúdo dos perfis. Preferir campos permitidos explicitamente a tentar limpar logs crus com expressões regulares. Limitar tamanho, período e quantidade de registros.
- A revisão deve representar exatamente o arquivo a baixar, incluindo anexos; não incluir arquivos ocultos ou logs adicionais fora da tela. Mostrar que se trata de diagnóstico técnico, sem afirmar que o arquivo prova ausência de malware ou certifica segurança.
- Entregar resumo legível em texto UTF-8 e dados estruturados com formato versionado. O usuário escolhe o que compartilhar; o aplicativo continua funcionando sem GitHub e sem acesso à Internet. Não coletar despejos de memória nem pedir administrador apenas para exportar.
- **Aceitação:** usar dados fictícios com tokens, seriais, caminhos e endereços em campos e mensagens de erro; confirmar que não aparecem na exportação padrão. Verificar correspondência entre revisão e arquivo final, remoção de categorias, PT/EN, limites de tamanho, falha parcial e ausência de tráfego externo.

### 4. Recuperação após falhas de efeitos e conexões

**Experiência:** explicar o que falhou e oferecer **Tentar novamente**, **Usar último efeito funcional** e **Manter luzes apagadas**, conforme o caso. Um efeito importado que excede limites ou trava deve ser interrompido sem derrubar o painel ou apagar as configurações salvas.

- Primeiro inventariar o isolamento, os limites e os mecanismos de recuperação já existentes no worker/supervisor. Acrescentar somente as lacunas comprovadas. Distinguir erro do efeito, perda do OpenRGB, falha do processo e arquivo de configuração inválido; cada causa exige uma resposta diferente.
- Promover uma versão a "última funcional" somente após validação e execução por uma janela definida, não apenas por aceitar o JSON/HTML. Associar esse estado à versão do efeito, conservar a versão problemática para correção e limitar o armazenamento. Nunca substituir automaticamente a biblioteca, os perfis ou o mapa.
- Limitar tentativas automáticas e aplicar espera progressiva. Se o mesmo efeito falhar repetidamente, interromper sua execução e não retomá-lo automaticamente após reiniciar o aplicativo. Preservar a intenção de energia; um fallback jamais pode reacender LEDs que estavam apagados ou reativar peças excluídas do mapa.
- Definir comportamento explícito para o último quadro deixado no controlador: se houver conexão, usar a recuperação configurada ou apagar; se não houver, informar que o estado físico não pôde ser confirmado. Não prometer manter o último quadro em todo hardware. Reiniciar serviços/OpenRGB continua exigindo ação e autorização apropriadas.
- **Aceitação:** provocar loop infinito/timeout e erro de sintaxe em ambiente isolado, término do worker, desconexão/reconexão do SDK e configuração inválida. Confirmar painel responsivo, CPU/memória limitadas, ausência de ciclos de reinício, preservação dos dados e recuperação após nova abertura. Testar também master desligado, dispositivo individual apagado e peça excluída do mapa.

### Sequência sugerida e limites da entrega

Após o bloco pendente de clareza visual e rede, priorizar: **recuperação após falhas**, **desfazer/refazer**, **diagnóstico revisável** e **transições de energia**. Essa ordem é uma recomendação de execução, ajustável pelo usuário. O diagnóstico pode ser antecipado para apoiar testes; transições dependem de medições e de validação física com controladores diferentes.

Cada recurso deve ter textos PT/EN, funcionar no celular e no PC, preservar dados em atualização e documentar os limites. Comparar consumo em repouso, com mapa aberto e durante efeitos antes/depois; nenhuma dessas propostas justifica animação, coleta ou gravações permanentes em segundo plano.

## Critério de conclusão

Preservar dados existentes, testar o comportamento anterior e a recuperação, documentar limites e publicar executáveis correspondentes à versão do código. Instalações que pedem administrador exigem a confirmação do usuário. Problemas sem reprodução permanecem identificados como hipóteses.
