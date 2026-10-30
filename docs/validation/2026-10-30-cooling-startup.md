# Retomada da ventilação após iniciar — alpha.42

## Pedido e reprodução

Em 30/10 o usuário pediu que canais, sensores, curva e ativação voltem após iniciar o PC, sem repetir detecção e configuração. A regra anterior de sempre iniciar desligado foi substituída por essa decisão explícita.

Reprodução inicial pelo HTTP: ativar curva manual, parar toda a aplicação e criar outra instância usando a mesma pasta. As associações eram carregadas, mas o controle permanecia off e não abria o auxiliar. A ativação não era persistida e o ciclo start do app não retomava Cooling. O arquivo instalado lido nessa sessão tinha zero associações/perfis, o que não permite reconstruir escolhas não presentes nele; nenhum estado instalado foi escrito durante a investigação.

## Implementação

- `Cooling.start()` inicia a retomada em segundo plano; não bloqueia HTTP, Alexa ou RGB. A intenção é persistida somente depois de uma aplicação bem-sucedida. Nenhum write de configuração por tick/quadro foi adicionado.
- Associações e curvas continuam no arquivo privado separado `cooling.json`. Registro do perfil aplicado é independente do banco editável: uma edição ainda não aplicada não muda o próximo boot nem o gráfico apresentado como curva em uso.
- Antes de escrever na retomada, confere IDs, nomes e modelo informados dos canais/sensores e uma amostra recente de temperatura. O hash de identidade não mede ligação física nem distingue universalmente duas peças idênticas. Não adivinha nem reassocia por índice.
- Dependências tardias são aguardadas com recuo limitado a oito tentativas. Falta de leituras válidas não apaga as curvas nem assume controle. Incompatibilidade de identidade bloqueia a retomada para revisão.
- Desligar módulo salva a escolha off, cancela timer e invalida operações pendentes antes de emitirem comandos antigos. Encerrar o serviço libera o controle para o firmware e mantém a escolha salva para o próximo start.
- Encerrar monitoramento somente leitura não cancela a escolha salva; possui comando próprio. Navegar durante uma retomada não é interpretado como desligar o controle.
- Metadados de retomada danificados deixam o controle desarmado e as configurações básicas válidas visíveis, sem sobrescrever o arquivo original ao carregar.
- Interface PT/EN mostra retomada salva, pendente ou bloqueada. Novas instalações continuam off. Arquivos antigos sem intenção persistida exigem uma ativação/aplicação no build novo; não se presume autorização de controlar hardware a partir de um arquivo legado.

## Regressões e limites

Onze regressões HTTP exercitam novo start com a mesma pasta: curva manual; banco editado sem aplicar; serviço tardio; temperatura inválida; identidade de outra placa; cancelamento no meio da amostra; aplicação recusada; escolha off; tentativas esgotadas; metadado danificado; encerramento de monitoramento sem perder intenção. Falhas foram observadas antes das correções correspondentes. O limite de fila, pisos de controle, proteção térmica e watchdog existentes foram preservados.

O teste Edge reinicia o servidor inteiro na mesma origem e verifica sensores/RPM, ponto editado, traçado Suave e controle ativo sem detectar novamente; também cobre perfil pendente/aplicado, espera, cancelamento, tradução e 390 px. Capturas desktop/celular inspecionadas. A expectativa antiga de sempre voltar off foi atualizada nos testes conforme a decisão do usuário, mantendo novos testes de off explícito e bloqueios.

Antes do commit: **305/305** testes gerais e **68/68** Edge passaram sem retries na revisão final; 28 contratos direcionados e oito Edge de ventilação também passaram após ajustes. Pacote/gates serão registrados no fechamento. Nenhum teste físico de reboot, RPM real ou sensor real foi executado. Não reiniciar o Windows automaticamente para completar uma simulação.

## Desempenho

Benchmark isolado com duas repetições inversas, base `981fa7b`, SDK simulado (três controladoras, cinco componentes, 92 LEDs), Aurora a 20 FPS e auxiliar C# fixture. Soma Node + worker + auxiliar quando ativo; sem navegador, OpenRGB real ou I/O físico. Não mede watts, ruído, refrigeração ou consumo total instalado.

| Cenário | CPU média total | RSS médio | Memória privada | FPS |
| --- | --- | --- | --- | --- |
| Base off | 0,395% | 131,75 MiB | 68,81 MiB | 20,04 |
| Candidata off | 0,362% | 134,13 MiB | 69,07 MiB | 20,04 |
| Monitoramento simulado | 0,405% | 164,72 MiB | 90,57 MiB | 20,05 |
| Equilibrado simulado | 0,418% | 166,33 MiB | 92,78 MiB | 20,02 |
| TURBO simulado | 0,362% | 165,15 MiB | 91,12 MiB | 20,06 |

Auxiliar ausente off. Custo observado de Equilibrado sobre off: ~32,19 MiB RSS / 23,71 MiB privados. Working sets podem duplicar páginas compartilhadas; duas repetições não demonstram ganho de CPU. Não foi adicionado processo permanente por fan/sensor. [Dados sem identificadores pessoais](../benchmarks/2026-10-30-cooling-startup.json).

## Git e entrega

Código, pacote publicado e instalação real devem ser diferenciados no contexto. Até este registro inicial, trabalho ainda local na branch `codex/cooling-startup`, sem nova tag/release/instalação. A base instalada observada foi alpha.41; guias e notas alpha.42 foram preparados. Confirmação atual do proprietário é necessária antes de UAC/instalação. Fontes nativas e dependências de hardware não foram alteradas nesta correção.
