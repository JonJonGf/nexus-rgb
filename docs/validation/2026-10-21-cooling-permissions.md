# Ventilação: auxiliar sem permissão após instalação

## Reprodução e causa

Usuário recebeu **O auxiliar de ventilação precisa de administrador.** ao detectar sensores no painel instalado. A API real confirmou a mesma mensagem, com módulo desligado. Consulta do Windows confirmou: `NexusRGB` roda como **LocalService**, `NexusRGBHardware` como **LocalSystem**. O launcher WMI anterior era chamado pelo primeiro e herdava sua identidade reduzida. Autorizar o instalador não altera a conta de execução do serviço. Os ensaios anteriores não cobriam essa combinação real de contas; a afirmação de integração pronta foi prematura.

## Correção

- `CoolingLaunchBroker.cs` acrescenta uma ponte sob demanda no supervisor de hardware existente, somente com marcador de desenvolvimento válido. Nenhum serviço novo nem alteração da conta do servidor HTTP. Build estável continua sem habilitar ventilação.
- Pipe local com ACL para LocalService/SYSTEM e negação de acesso de rede. Confere PID real do cliente, vínculo com o supervisor registrado `NexusRGB` e caminho fixo do Node instalado. Pedido admite somente PID do pai e nome aleatório do pipe; não aceita executável, argumentos, modo ou caminho escolhidos pelo cliente.
- Lançamento usa os arquivos fixos do pacote, via WMI a partir do processo SYSTEM. Auxiliar segue independente do Job RGB e supervisiona o pai LocalService. Pipe do auxiliar permite esse cliente reduzido, mantendo verificação de PID. `GENERIC_WRITE` usado pelo Node requer também o direito sobreposto de instância do pipe: [Microsoft](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights), [libuv](https://github.com/libuv/libuv/blob/v1.x/src/win/pipe.c). Não foi concedido acesso geral a usuários/rede.
- Handshake informa privilégio efetivo e é recusado antes de abrir sensores quando insuficiente. Nenhuma curva é armada ao instalar, abrir o painel ou iniciar o serviço.

## Verificação e limites

Regressão de delegação falhou antes da implementação (**Missing expected rejection**, launcher antigo ignorava o broker) e passou depois. IPC nativo verifica PID real, esquema fechado, rejeição de caminho/argumentos extras e JSON inválido, usando adaptadores de lançamento sem hardware. Passaram também 280 testes gerais, 2 Edge, fixture de supervisor e protocolo/watchdog nativo. Após ajuste final de timeout/permissão, testes específicos de broker e UI foram repetidos com sucesso. Logs privados em `data/cooling-dev/`.

Esses testes não substituem execução nas duas contas reais do Windows. Atualizar o PC e clicar em **Detectar sensores** ainda é necessário para verificar o fluxo instalado; não afirmar detecção física ou ajuste mecânico concluídos. Nenhum sensor/RPM foi comandado durante esta correção. A instalação anterior permanece com o erro até receber o novo pacote.

## Pacote corrigido

Código de runtime salvo em `a7aa268b876ea0cb1f33925f79cfc3e3500425cf`, sem tag e com `development:true`. Instalador privado R2: `dist/NexusRGB-Setup-0.1.0-cooling-dev-r2.exe`, 87.394.503 bytes, SHA256 `5653714af176351928fa7cc4d499a3ab61ef7d222977da679fb9afd6f7508bbc`. Teste do pacote confirmou política do broker, dependências presentes, recurso off e nenhum auxiliar/timer; reflexão sem executar o aplicativo confirmou `CoolingLaunchBroker` no EXE empacotado. Dois testes automáticos adicionais passaram no wrapper que integra os contratos à suíte habitual. Somente o wrapper e documentação foram adicionados depois do build; sem mudança de runtime. Nenhuma atualização oficial nem nova instalação foram executadas nesta etapa.
