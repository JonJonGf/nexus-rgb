# Testes e validação do Nexus RGB

Os relatórios registram os cenários testados, seus resultados e limitações. Os testes são mantidos pelo próprio projeto e não equivalem a uma auditoria independente ou certificação de compatibilidade com todo PC.

| Data | Escopo | Relatório |
| --- | --- | --- |
| 15/10/2026 | Perfis com cores ordenadas, editor, interface e persistência após reiniciar o serviço | [Perfis e movimentos](validation/2026-10-15-profiles.md) |
| 15/10/2026 | Portas configuráveis, recuperação de falhas e atualização do instalador; 62 testes de lógica/integração e 10 de interface | [Portas e confiabilidade](validation/2026-10-15-ports-and-reliability.md) |
| 14/10/2026 | API, supervisor, instalação em VM, ensaio de 15 minutos e configuração instalada | Resultados detalhados abaixo |

Os números de cada relatório correspondem à execução documentada. Para uma versão publicada, consulte também as verificações e os artefatos da execução do GitHub Actions indicada nas notas da versão.

## Resultados de 14/10/2026

## Resultado por área

| Área | Resultado | Alcance |
| --- | --- | --- |
| Lógica, API, segurança e hardware simulado | 48 testes passaram no CI | Requisições HTTP reais e testes de componentes, sem tocar nos LEDs do usuário |
| Interface | 9 testes passaram | Microsoft Edge/Playwright, desktop e telas móveis simuladas |
| Evento de instalação | 6 cenários passaram | Sucesso, diagnóstico antigo/novo, runtime com falha, processo não iniciado e reinício necessário |
| Supervisor nativo | Passou | Código C# real com Job Object do Windows e processo filho de teste |
| Ciclo do instalador completo | 45 verificações passaram | VM descartável Windows Server 2025, build 26100, no GitHub |
| Sustentação do servidor | 15 minutos passaram | API Node isolada, sem OpenRGB ou Alexa ativos |
| Configuração do PC instalado | Verificada | Defender/firewall ativos, serviços automáticos, SDK no loopback e 5 componentes/92 LEDs |

O [CI do software](https://github.com/JonJonGf/nexus-rgb/actions/runs/38618940136) validou o commit `bb64db82c941f0e46ee1621e26a58617b2a594b5`. A [VM de instalação](https://github.com/JonJonGf/nexus-rgb/actions/runs/38618683477) compilou e testou o commit `f9b6e932f7b43ebb4e016abaebef7169afc9f4e2`. As diferenças entre esses commits são do teste de interface e da preservação dos relatórios; as correções do servidor e o instalador são os mesmos.

## Segurança da API

Os testes adicionais verificam rejeição de Host/origem forjados, cabeçalhos de proxy, requisições de sites externos, tipos inválidos, JSON malformado, valores fora de faixa, tentativa de alterar protótipos e tentativa de obter arquivos fora dos recursos públicos. Cada comando inválido deve manter a configuração intacta.

Também foram exercitados:

- Corpo maior que 8 KiB enviado em chunks, sem depender do Content-Length.
- Cliente que interrompe o envio antes de completar o corpo, com o painel continuando disponível.
- Limite de 16 streams simultâneos e liberação da vaga após desconexão.
- Bloqueio HTTP real após 240 requisições por IP na janela, seguido por recuperação após um minuto.
- Recusa das rotas administrativas pela LAN mesmo quando o cliente apresenta um cookie administrativo do PC.
- Expiração, falsificação e remoção de sessões administrativas pelo limite de sessões.
- Máscaras de rede ausentes, inválidas, não contíguas ou zeradas, sem ampliar a autorização LAN.
- Nome de perfil contendo HTML exibido como texto, sem executar eventos ou abrir diálogos.

Dois problemas foram corrigidos: um comando individual inválido podia remover o modo nativo do estado em memória antes da validação completa; e metadados de rede com máscara ausente/zerada podiam ampliar a comparação de sub-redes. A aplicação agora valida o comando antes de alterar o dispositivo e recusa máscaras inválidas. Os testes de regressão reproduzem essas condições.

## Instalador real em máquina descartável

O pacote foi baixado e compilado a partir das dependências verificadas do projeto dentro do runner Windows do GitHub. O teste não usa o computador do usuário e recusa execução fora de um runner hospedado/descartável ou quando já existem dados/instalação Nexus.

As 45 verificações incluem instalação silenciosa, contas LocalService/SYSTEM, inicialização automática, SDK restrito a `127.0.0.1`, proprietários/permissões dos arquivos, atualização com diagnóstico preexistente, preservação dos perfis byte a byte, recuperação após encerrar o Node, reinício do serviço, verificação do assistente de desinstalação, remoção dos executáveis/serviços/regras próprias, reinstalação com dados preservados e preservação de regra de firewall e serviço Windows alheios ao Nexus.

O [resultado bruto da VM](validation/2026-10-14-installer.json) identifica o pacote efetivamente testado por SHA256, o commit e o workflow. Um build local de distribuição pode ter outro hash por conter documentação atualizada e timestamps de compilação; esse relatório não afirma identidade binária entre builds diferentes.

Não foram instalados PawnIO ou outros drivers na VM. Ela não tem RGB físico e é Windows Server, portanto este resultado não equivale a testar PCs limpos com Windows 10/11, drivers, hardware real ou comportamento antes de login, suspensão e reinício completo da VM.

## Sustentação e recuperação de processos

O script usa um processo Node dedicado, dados temporários e autorização apenas para loopback. Hardware e Alexa ficam desativados. Ele alterna controles na configuração de teste, lê o estado, mantém oito streams e reconecta esses streams a cada 30 segundos. Ao terminar, encerra abruptamente o processo dedicado dez vezes e confirma que os dados persistiram e que novas sessões funcionam.

A coleta de 900 segundos terminou em 901,97 segundos, incluindo as dez recuperações. Foram 2.066 requisições, 90 comandos, oito streams simultâneos e 29 ciclos de reconexão. A RAM residente do Node passou de 48,78 para 52,38 MiB (pico 52,38 MiB); o heap usado passou de 7,29 para 9,77 MiB, com pico de 10,13 MiB. Esses aumentos não demonstram nem descartam vazamento de memória numa amostra de quinze minutos. A CPU média do processo, normalizada pelas 12 threads do PC, foi 0,0165%; a latência até os cabeçalhos HTTP teve mediana de 16,06 ms, percentil 95 de 16,67 ms e máximo de 385,53 ms. O [relatório bruto](validation/2026-10-14-stability.json) inclui as amostras e os limites do cenário.

Os relatórios são gravados fora da pasta de saída do Playwright para impedir que uma suíte apague as evidências da outra. As métricas medem apenas esse processo Node; não substituem o [consumo do aplicativo completo com RGB](DESEMPENHO.md), nem demonstram estabilidade por horas/dias ou ausência de todos os vazamentos de memória.

## PC instalado

O [inventário de configuração](validation/2026-10-14-installed-config.json) foi obtido após o reinício do PC e depois de aplicar as correções. Não modifica ajustes de iluminação ou configurações de segurança. Registra os serviços ativos/automáticos, contas de execução, permissões, firewall, proteção do Defender, ausência de alerta WinRing ativo, driver PawnIO carregado e hardware conectado.

As três correções do servidor instalado foram conferidas por hash contra o código revisado. A atualização manteve o controlador OpenRGB em execução. Essa fotografia de configuração não é uma análise forense do sistema inteiro.

Uma verificação personalizada do Defender na pasta instalada do Nexus terminou sem novos eventos de detecção e com zero ameaças ativas. Foram conferidos os eventos de início/conclusão do mesmo exame. O [registro do exame](validation/2026-10-14-defender.json) informa esse escopo limitado; não é um exame completo do PC nem uma garantia de ausência de malware.

O [teste de saída TCP](validation/2026-10-14-firewall.json) comparou dois runtimes: o Node de desenvolvimento conseguiu conectar a `1.1.1.1:443`; o Node dedicado do Nexus recebeu `EACCES`, mantendo conexão a `127.0.0.1:5050`. Nenhum dado de aplicação foi enviado. Isso confirma o bloqueio nesse destino IPv4 e o funcionamento local; não testa todos os destinos, IPv6 ou conexões originadas pelo OpenRGB. `npm run test:offline` permite repetir esse teste num PC com o Nexus instalado. Uma rede que bloqueie também o runtime de controle torna o resultado inconclusivo.

## Repetir os testes

```powershell
npm test
npm run test:ui
npm run test:supervisor
npm run test:installer
```

O teste do instalador simulado precisa do Inno Setup preparado conforme o [guia de desenvolvimento](DESENVOLVIMENTO.md). Para uma coleta de uma hora da API isolada:

```powershell
$env:NEXUS_STABILITY_SECONDS = '3600'
npm run test:stability
```

O resultado fica em `data/validation/stability.json`; o teste falha se houver respostas inesperadas ou perda dos dados após as interrupções. O CI executa uma amostra de 60 segundos a cada revisão. O workflow **Validar instalador em VM descartável** é disparado manualmente no GitHub e publica seus logs/relatório como artefato.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/audit-installed-config.ps1
```

Esse último comando apenas consulta a configuração instalada e grava o relatório local. Os comandos de teste não desativam o Defender, não criam exclusões e não instalam WinRing0.

## Trabalho ainda necessário para distribuição ampla

Permanecem pendentes assinatura pública dos executáveis, revisão externa de segurança, testes limpos de Windows 10/11 com contas comuns, driver com integridade de memória, uma matriz física de fabricantes/modelos, celulares Android/iOS, múltiplos Echos, suspensão/retomada, mudanças reais de rede e sustentação por horas/dias. Consulte os [critérios de distribuição](COMERCIAL.md).

O controle RGB pela LAN usa HTTP sem autenticação. Os testes verificam os limites de sub-rede e a separação dos ajustes administrativos. A conexão local não possui senha nem criptografia.
