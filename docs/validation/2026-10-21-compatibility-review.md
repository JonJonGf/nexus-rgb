# Revisão de compatibilidade, segurança e eficiência — 21/10/2026

## Pedido e escopo

O usuário pediu ampliar o alcance do projeto, revisar falhas e pesquisar referências na Internet/GitHub. Revisão orientada às interfaces de detecção RGB/SDK, controladores USB, ventilação, apresentação, persistência, privilégios, recuperação e empacotamento. Isto não é certificação de todo o código ou suporte físico a toda máquina. Desenvolvimento privado sobre `8cc284a`, sem instalar, reiniciar serviço, abrir sensores reais, testar rotações ou publicar release nesta etapa.

## Evidências externas

- [Fan Control: compatibilidade](https://github.com/Rem0o/FanControl.Releases#issues-and-hardware-compatibility): o próprio projeto depende do suporte das bibliotecas e limita notebooks; quantidade de fans não equivale a quantidade de canais. [Documentação de pareamento](https://getfancontrol.com/docs/) trata associação de RPM como uma operação própria.
- [Discussão de mapeamento EC/SuperIO no LHM](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/discussions/2422): há relatos de controle funcional com RPM zero no índice correspondente. É evidência contra deduzir porta vazia pelo zero, não comprovação do cabeamento de outro PC.
- [Contrato IControl 0.9.6](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/blob/v0.9.6/LibreHardwareMonitorLib/Hardware/IControl.cs) e [implementação Control](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/blob/v0.9.6/LibreHardwareMonitorLib/Hardware/Control.cs): identificador de controle e limites de software não são confirmação de conector ou de resposta mecânica.
- [OpenRGB: ARGB e redimensionamento](https://openrgb.org/resize.html): o sinal não permite descobrir automaticamente o tamanho da cadeia. Manter configuração explícita e zero técnico em vez de inventar LEDs.
- [Flags do OpenRGB](https://github.com/CalcProgrammer1/OpenRGB/blob/master/RGBController/RGBControllerInterface.h) distinguem cores por LED, cores de modo e salvamento automático; nomes de fabricantes não substituem capacidades.
- [Fork headless fixado](https://github.com/hello-nexus/openrgb-headless/tree/18e2c95f5e6d5d9f45a948df1e3d0b882e605b45) mantém controladores/protocolo e remove GUI. A lista atual upstream não equivale à revisão fixada no instalador. Não houve substituição de binários/dependências nesta revisão.

## Correções reproduzidas

| Caso | Antes | Depois / superfície testada |
| --- | --- | --- |
| Identificação da placa | Sugestão específica substituía nome do backend | Nome original preservado; sugestão separada como não confirmada; HTTP |
| RPM zero | Filtro mostrava 4 de 8 controles sem escolha do usuário | Todos disponíveis; ocultação explícita persistente e reversível; Edge |
| Identificação portátil | Sem nome/visibilidade privados por identidade | Preferências por fabricante/modelo/id/nome original; não herdam em outra placa; HTTP/reinício |
| Rascunhos | Mudança de nome poderia reconstruir cartões | Atualiza apresentação sem destruir curva não aplicada; Edge |
| Limite fracionário | Máximo 60,6 resultava em pedido 61 | Arredondamento limitado à faixa inteira segura; sem faixa mantém somente leitura; HTTP/Edge |
| Leitura ao aplicar | Nova temperatura crítica ainda produzia 58% da amostra anterior | Nova amostra antes do comando; proteção pede máximo permitido; HTTP |
| Liberação falha | Reassociação falha deixava enabled=true | Desarma, encerra auxiliar e informa fault; não continua com associação divergente; HTTP |
| Ordem dos modos RGB | Primeiro Custom com automaticSave vencia Static sem esse flag | Prefere alternativa compatível sem salvamento automático; fallback estático preservado; contrato SDK |

Preferências de apresentação são gravadas sem ativação, sem abrir auxiliar, sem escrita física e sem aplicar rascunhos. Nomes são texto DOM, não HTML nem caminhos. IDs de hardware, perfis RGB, exclusões, mapa e RAM a 20 FPS não foram remapeados.

## Segurança e desempenho preservados

Continuam: autenticação local para ventilação, orçamento/fila limitada, respostas/identidades limitadas, mínimo de 20%, proteção por temperatura, falha fechada com tentativa de release, watchdog, ausência de rearme automático, separação do serviço HTTP e auxiliar privilegiado, caminhos fixos, dependências por hash e licenças/fontes correspondentes. Não foi adicionado carregador de DLL/plugins externos nem protocolo USB genérico baseado apenas em fabricante. Nenhuma nova varredura, dependência ou temporizador de produto.

Uma heurística de associação de RPM por índice foi removida, inclusive seu custo de busca; a seleção é explícita. Novos nomes/visibilidade não comandam hardware. Valores aceitos pelo protocolo continuam sem comprovar que o motor/GPU respondeu: a biblioteca pode não confirmar fisicamente a escrita.

## Validação

- Suíte geral: **291 aprovados**, zero falhas. Após ajustes finais de apresentação, **17 contratos cooling** e **7 Edge cooling** aprovados sem retries; a suíte completa Edge passou **67 testes** sem retries.
- Matriz sintética confirma nomes/IDs em descritores de fabricantes diferentes e canais SuperIO, AMD e NVIDIA reordenados; não é ensaio físico de marcas/modelos.
- Regressões foram observadas falhar antes das correções. Não foi executado teste térmico, acústico, consumo elétrico ou bancada física.
- Medição isolada e artefato final: registrar abaixo quando concluídos. A primeira tentativa de benchmark foi interrompida por sobreposição com testes; resultados dessa tentativa foram invalidados e não sustentam conclusões.

### Medição isolada concluída

CPU real de processos Windows e soma de working sets, duas rodadas em ordem inversa, três controladoras SDK simuladas/cinco componentes/92 LEDs, Aurora a 20 FPS. Sem navegador, prévia, OpenRGB real, sensor físico ou medição elétrica. Auxiliar C# fixture carrega a biblioteca sem abrir hardware. RSS pode contar páginas compartilhadas mais de uma vez. Logs privados em `data/cooling-dev/compatibility-performance-clean.log` e relatório do benchmark correspondente; não versionar dados crus.

| Cenário | CPU média normalizada | RSS médio somado | Memória privada média | FPS |
| --- | ---: | ---: | ---: | ---: |
| Base `8cc284a`, módulo off | 0,443% | 128,88 MiB | 68,78 MiB | 20,06 |
| Candidata, módulo off | 0,342% | 131,35 MiB | 68,75 MiB | 19,97 |
| Candidata, monitoramento fixture | 0,397% | 160,84 MiB | 90,86 MiB | 20,10 |
| Candidata, Equilibrado fixture | 0,445% | 161,29 MiB | 91,19 MiB | 19,99 |
| Candidata, TURBO fixture | 0,525% | 161,13 MiB | 91,49 MiB | 20,07 |

Somente as duas linhas off são comparação equivalente antes/depois; as ativas medem cenários da candidata. Memória privada off ficou praticamente igual; RSS variou +2,47 MiB. Duas repetições não sustentam alegar ganho de CPU. Não extrapolar para custo de driver/sensores, consumo completo instalado, watts ou ruído. Nenhum auxiliar presente nos cenários off.

## Pacote privado entregue

Runtime `d12d98c19b2036126499a65fc4fb5dae371e9a95`, development true/sem tag. `dist/NexusRGB-Setup-0.1.0-cooling-dev-r5.exe`: 87.409.194 bytes, SHA256 `6d8396caf69bd6664afa21164765a8a7dec20b5ca87377b12caf1a68c508c399`. Validação do app empacotado confirmou ventilação disponível/off/sem auxiliar ou timer, caminho fixo e arquivos de runtime/UI idênticos ao fonte. Build e auditoria de produção passaram, sem vulnerabilidades reportadas. Sem execução do instalador nesta etapa. Leitura do build-info real instalado confirmou R4 `234d9bb...`; pacote R5 e documentos posteriores não alteram essa instalação. Sem push/tag/release nova.

## Limites e próximos adaptadores

O backend de fan atual habilita CPU/GPU/placa-mãe e oferece escrita SuperIO/AMD/NVIDIA. Hubs USB/AIOs, Intel GPU e protocolos de notebooks ainda exigem adaptadores auditados; não habilitar todas as classes nem carregar bibliotecas de terceiros para aparentar suporte universal. Novos adaptadores devem preservar desligamento sem custo, validação de identidade/faixa, saída ao firmware e comprovação física por modelo/revisão.

GPU Gigabyte RX 7600 com RGB apagado continua sem causa física comprovada; a alteração de prioridade de modo não é anunciada como solução desse caso. Próximo passo desse incidente continua sendo coletor no PC afetado e evidência revisável. Guia de uso geral em [COMPATIBILIDADE.md](../COMPATIBILIDADE.md), com equivalente em inglês.
