# Desempenho do Nexus RGB

## Prévia compartilhada — v0.1.0-alpha.10

Ensaio de 15/10/2026 com Arco-íris comum, limite solicitado de 60 FPS, SDK simulado de 3 controladoras/5 componentes/92 LEDs, Ryzen 5 3600 e Node 24.20.0. A soma inclui somente o servidor Node. Assistir ao controle comum não iniciou um processo Canvas.

| Cenário | CPU média da máquina | RAM residente média | Pico de RAM residente | Tráfego da prévia |
| --- | ---: | ---: | ---: | ---: |
| Arco-íris sem prévia | 0,065% | 51,27 MiB | 51,38 MiB | — |
| Arco-íris com prévia | 0,104% | 54,45 MiB | 55,75 MiB | 17,91 KiB/s |

Cada linha teve aquecimento de 3 segundos e 21 amostras, com janela efetiva de aproximadamente 26 segundos. CPU é a diferença do contador cumulativo dividida pelo tempo efetivo e pelos 12 processadores lógicos. Os cenários ocorreram na ordem da tabela, no mesmo processo; retenção de memória e ruído de amostragem impedem atribuir toda diferença exclusivamente à prévia.

O controlador simulado recebeu aproximadamente 37–39 atualizações por segundo por controladora, apesar do limite solicitado de 60. Isso mede chamadas de software, sem medir LEDs físicos. O motor espacial permaneceu sem quadros renderizados porque a visualização apenas transmitiu o cache das cores que o efeito comum já enviava.

**OpenRGB, supervisores, bandeja, navegador e driver não estão incluídos.** Desenhar as peças no navegador acrescenta consumo, não medido aqui. Não é uma medição do aplicativo completo ou garantia para outros PCs. O [JSON do ensaio](benchmarks/2026-10-15-common-preview.json) registra os valores sem arredondamento.

## Motor espacial — medição de 15/10/2026

Ensaio isolado do motor espacial em desenvolvimento em 15/10/2026, no Ryzen 5 3600 com 12 processadores lógicos, 31,89 GiB de RAM, Windows 11 build 26300 e Node 24.20.0. A coleta antecede as alterações de edição ao vivo da v0.1.0-alpha.9.

Esta tabela inclui **servidor Node e processo de efeitos**. A classe de hardware é a mesma da aplicação, conectada a um SDK simulado com 3 controladoras, 5 componentes e 92 LEDs. **OpenRGB, serviços, bandeja, navegador e driver ficam fora da soma.** Portanto, os valores não representam o consumo total do aplicativo instalado.

| Cenário | FPS solicitados | FPS renderizados¹ | CPU média² | RAM residente média³ | Pico de RAM residente³ | Renderização média |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mapa desativado, cor estática | 20 | 0 | 0,015% | 48,01 MiB | 49,51 MiB | — |
| Aurora espacial, sem prévia | 20 | 20,06 | 0,372% | 132,82 MiB | 139,90 MiB | 0,34 ms |
| Aurora espacial, sem prévia | 60 | 60,06 | 0,593% | 156,97 MiB | 182,45 MiB | 0,30 ms |
| Aurora espacial, com prévia | 60 | 60,04 | 0,969% | 184,58 MiB | 185,69 MiB | 0,31 ms |
| HTML próprio de barras, sem prévia | 20 | 20,00 | 0,339% | 197,86 MiB | 220,74 MiB | 0,78 ms |
| HTML próprio de barras, sem prévia | 60 | 59,87 | 1,055% | 250,24 MiB | 255,24 MiB | 0,71 ms |
| HTML próprio de barras, com prévia | 60 | 60,13 | 1,100% | 254,10 MiB | 258,34 MiB | 0,71 ms |

¹ Quadros concluídos divididos pelo tempo medido; pequenas diferenças acima de 60 decorrem dos limites da janela e dos relógios de amostragem. A taxa física dos LEDs **não foi medida**. O SDK simulado não reproduz atrasos USB/SMBus, congestionamento ou limites do OpenRGB.

² Percentual da capacidade total dos 12 processadores lógicos. Não é a porcentagem de um único núcleo.

³ Soma dos conjuntos residentes do servidor e do filho. Pode contar páginas compartilhadas mais de uma vez; a memória privada é outra métrica, disponível no relatório JSON.

### Método e interpretação

Cada cenário teve aquecimento de 3 segundos e 21 amostras, com espera solicitada de 1 segundo entre elas. A consulta de processos acrescentou tempo: as janelas efetivas ficaram entre 26,11 e 26,53 segundos. A CPU usa a diferença do contador cumulativo de CPU dos processos dividida pelo tempo efetivo e por 12. RAM média e pico usam as mesmas amostras; o tempo de renderização é a média dos últimos quadros observados em cada consulta.

Os cenários foram executados na ordem da tabela, no mesmo servidor; o processo de efeitos foi recriado ao trocar o efeito/configuração. O servidor pode reter memória alocada, e o coletor de lixo pode agir em momentos diferentes. A diferença entre linhas não isola somente o custo do efeito. Estes números não demonstram ausência de vazamentos.

O HTML usado no ensaio é um exemplo próprio, com 64 barras coloridas desenhadas a cada quadro, sem arquivos externos ou áudio. A prévia usa PNG 320 × 200 e as últimas cores enviadas por LED, por SSE, com limite de 10 FPS; nesses cenários, o tráfego medido ficou em aproximadamente 27–28 KiB/s. O navegador que apresenta a imagem e desenha os marcadores acrescenta seu próprio consumo, não medido aqui.

O processamento de 60 FPS foi viável nesses dois efeitos e nesse ambiente. O envio ao SDK simulado acompanhou a renderização: cerca de 60 chamadas de LEDs por segundo no total a 20 FPS, e 180 a 60 FPS, distribuídas pelas três controladoras. Isso não comprova que um controlador físico processe essa taxa. Efeitos mais complexos podem atingir o orçamento de execução, e controladoras reais podem entregar menos atualizações. O padrão permanece **20 FPS**. Aumentar FPS implica mais CPU e comandos; reduza-o se o equipamento apresentar atraso.

Uma sondagem local separada verificou 28 arquivos HTML fornecidos para compatibilidade: 25 renderizaram 20 quadros sem erro; 2 exigiam áudio do SignalRGB, não suportado, e 1 excedeu o orçamento de desenho. Esse ensaio curto não comprova equivalência visual, funcionamento de todas as opções ou estabilidade prolongada. Os arquivos desses criadores não foram redistribuídos.

O [resumo em JSON](benchmarks/2026-10-15-studio.json) registra os valores e o escopo. A coleta inclui envio imediato de quadros e dados de saída por LED; antecede ajustes posteriores de diagnóstico, atualização de status em prévias estáticas/pausadas e espera do envio antes de publicar a imagem. Não é uma nova aferição de cada linha do código final. GPU, energia elétrica, temperatura, inicialização e horas/dias de uso não foram medidos.

### Edição ao vivo do mapa

O arraste move a peça apenas no navegador até soltar; nesse momento, envia e salva a posição. Edições por teclado e campos são agrupadas em até uma requisição a cada 350 ms. Cada envio aceito salva a configuração de forma atômica. Mudar a geometria preserva o processo e a fase do efeito espacial e atualiza a amostragem no próximo quadro disponível; efeitos estáticos recalculam a amostra quando as posições mudam. Os testes confirmam a troca de cores sem recriar o processo e a preservação do efeito comum ao editar posições. O custo de um arraste prolongado não foi aferido separadamente nas tabelas acima.

## Aplicativo completo — referência histórica de 13/10/2026

Medição real realizada em **13/10/2026**, na versão instalada **0.1.0**, com os serviços do Nexus RGB, OpenRGB e ícone da bandeja em execução. Os números abaixo representam este equipamento e estas configurações; não são requisitos mínimos nem uma garantia para todos os PCs.

A medição é de 13/10/2026 e antecede as alterações posteriores de recuperação de conexão, instalação, perfis e portas. Os valores não representam uma nova aferição de cada prévia publicada.

## Identificar processos no Windows

O Nexus usa serviços que iniciam antes do login, além de um ícone executado na sessão do usuário. Eles podem aparecer separados no Gerenciador de Tarefas. O supervisor já mantém seus filhos em Job Objects para encerrar processos corretamente; isso não determina um grupo visual único no Gerenciador.

| Parte | Processo esperado |
| --- | --- |
| Serviço do painel | `NexusRGB.exe --service`, serviço `NexusRGB`, com um filho `runtime\node.exe` executando `server\index.js` |
| Acesso ao RGB | `NexusRGB.exe --hardware-service`, serviço `NexusRGBHardware`, com um filho `openrgb\OpenRGB.exe` |
| Ícone perto do relógio | `NexusRGB.exe --tray`, na sessão do usuário |
| Motor espacial | Um filho Node executando `server\studio-worker.js`, enquanto um efeito espacial está ativo e há luzes ou clientes de prévia; observar efeitos comuns não abre esse processo. Uma validação de importação pode abrir outro processo temporário |
| Janela do painel | Processos do navegador escolhido pelo Windows/Nexus |

Na aba **Serviços**, localize `NexusRGB` e `NexusRGBHardware` e use **Ir para detalhes** para identificar seus PIDs. Na aba **Detalhes**, habilite as colunas **PID** e **Linha de comando**; alguns dados de serviços exigem abrir o Gerenciador como administrador. PIDs mudam ao reiniciar. Confira o caminho da instalação para distinguir esses filhos de outros programas que também usam Node.

Processos Node pertencentes ao Codex, editores ou outras aplicações não devem ser somados ao consumo do Nexus. O título `Node.js` sozinho não identifica qual aplicativo o iniciou. Renomear o executável ou definir `process.title` não garante um nome/grupo no Gerenciador; a [documentação do Node](https://nodejs.org/api/process.html#processtitle) também registra essa limitação. AppUserModelIDs controlam [agrupamento de janelas na barra de tarefas](https://learn.microsoft.com/en-us/windows/win32/shell/appids), sem oferecer por si só a árvore solicitada de serviços no Gerenciador.

## Equipamento e configuração

| Item | Configuração medida |
| --- | --- |
| Processador | AMD Ryzen 5 3600, 6 núcleos / 12 processadores lógicos |
| Memória informada pelo Windows | 31,89 GiB |
| Sistema | Windows 11 Pro, versão 10.0.26300, build 26300 |
| Controladoras físicas | 3: duas ENE DRAM e uma ASUS TUF GAMING A520M-PLUS II |
| Componentes no painel | 5: duas memórias RAM, iluminação da placa-mãe, ARGB 1 e ARGB 2 |
| LEDs configurados | 92: RAM 8 + 8, placa-mãe 4, ARGB 36 + 36 |
| Cor de referência | `#00ff7c` |
| Brilho / ritmo | 100% / 17% |
| Integração Alexa | Habilitada |

Nos cenários ligados, o RGB foi controlado pelo Nexus. A onda é um efeito calculado pelo aplicativo; a cor de referência, brilho e ritmo foram mantidos. O efeito muda as cores dos LEDs ao longo do tempo.

## Consumo total

Os totais incluem o servidor Node, o OpenRGB, os dois supervisores dos serviços e a bandeja. **O navegador não está incluído.**

| Cenário | Janela | CPU média | Pico de CPU¹ | RAM residente média² | Pico de RAM residente² | Memória privada média³ | Pico de memória privada³ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Luzes desligadas, sem animação | 40 s | 0,065% | 0,395% | 187,38 MiB | 187,41 MiB | 136,61 MiB | 136,66 MiB |
| Estático, luzes ligadas | 30 s | 0,035% | 0,393% | 187,68 MiB | 187,71 MiB | 136,89 MiB | 136,96 MiB |
| Onda, luzes ligadas | 30 s | 0,468% | 1,037% | 187,86 MiB | 188,03 MiB | 137,18 MiB | 137,58 MiB |

¹ Pico observado entre as amostras de aproximadamente 1 segundo, e não um máximo instantâneo.

² Soma dos *working sets*: páginas residentes em RAM dos processos. Bibliotecas compartilhadas podem aparecer em mais de um processo; o total pode contar essas páginas mais de uma vez.

³ Memória privada comprometida de cada processo. É uma métrica diferente do *working set* e **não deve ser somada** à RAM residente.

A diferença pequena de CPU entre desligado e estático está sujeita ao ruído de uma janela curta, à resolução dos contadores e a tarefas periódicas. Ela não demonstra que ligar os LEDs melhora o desempenho. Na onda, o aumento veio principalmente do processo OpenRGB, que recebeu as atualizações de animação.

## Consumo por processo

Valores médios durante cada cenário ligado. A CPU está expressa como porcentagem da capacidade total dos **12 processadores lógicos**.

| Processo | CPU estático | RAM residente estático | Privada estático | CPU onda | RAM residente onda | Privada onda |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Servidor Node / painel LAN | 0,004% | 69,05 MiB | 67,62 MiB | 0,056% | 69,20 MiB | 67,79 MiB |
| OpenRGB / controle do hardware | 0,030% | 26,21 MiB | 7,21 MiB | 0,412% | 26,21 MiB | 7,21 MiB |
| Supervisor do serviço de rede | 0,000% | 22,27 MiB | 16,96 MiB | 0,000% | 22,28 MiB | 17,01 MiB |
| Supervisor do serviço de hardware | 0,000% | 21,86 MiB | 16,96 MiB | 0,000% | 21,86 MiB | 16,97 MiB |
| Ícone da bandeja | 0,000% | 48,29 MiB | 28,15 MiB | 0,000% | 48,30 MiB | 28,21 MiB |

`0,000%` significa que não houve aumento mensurável do contador de CPU nessa janela. Não significa que um processo sempre consome zero CPU.

## Como foi medido

1. Os processos foram identificados pelo registro dos serviços do Windows, pela relação entre processos pai e filho e pelo executável da bandeja. Processos de compilação, ferramentas de medição e outros programas ficaram fora do grupo.
2. Em cada amostra, `Win32_Process` forneceu `KernelModeTime`, `UserModeTime`, `WorkingSetSize` e `PrivatePageCount`. O tempo cumulativo de CPU foi obtido pela soma dos tempos de kernel e usuário fornecidos pelo CIM.
3. A CPU foi calculada pela diferença desse tempo cumulativo entre amostras. A média usa a janela inteira; o pico usa cada intervalo observado.
4. O cenário desligado teve 41 amostras em 40 segundos. Estático e onda tiveram aquecimento de 3 segundos, seguido por 31 amostras em 30 segundos. O intervalo solicitado foi de 1 segundo e o tempo efetivamente decorrido foi usado no cálculo.
5. A configuração principal e os ajustes individuais foram guardados em um perfil temporário e restaurados ao terminar a coleta. O perfil temporário foi removido. Os serviços, as zonas e as autorizações da Alexa permaneceram inalterados.

```text
tempo_CPU = (KernelModeTime + UserModeTime) / 10.000.000
CPU_% = 100 × diferença(tempo_CPU) / segundos_decorridos / 12
memória_MiB = bytes / 1.048.576
```

Para repetir a análise em outro PC, identifique os processos instalados por serviço e árvore, use a quantidade de processadores lógicos daquele equipamento e registre a quantidade de LEDs, brilho, ritmo e efeito. Preserve os ajustes antes de alternar os cenários. Uma mudança do usuário durante a coleta deve invalidar o cenário, em vez de ser sobrescrita pelo teste.

## Limites da análise

- É uma amostra curta de um único PC, com 92 LEDs configurados. Mais LEDs, outros protocolos/controladoras e outros efeitos podem mudar o consumo.
- CPU e memória do navegador, ferramentas de compilação/medição e alocações do driver no kernel não foram contabilizadas.
- GPU, consumo elétrico em watts, temperatura e duração de bateria não foram medidos.
- Os picos dependem da frequência e da resolução das amostras. A análise não comprova ausência de vazamento de memória nem estabilidade por horas ou dias.
- Na versão histórica medida, a agenda usava intervalos de 50 ms. A versão atual permite 5–60 FPS; a taxa efetiva do hardware não foi medida neste ensaio histórico.

O [resumo em JSON](benchmarks/2026-10-13.json) contém os valores sem arredondamento para consulta e comparação.
