# Ventilação e curvas — experimental

[English](en/COOLING.md) · [README](../README-pt.md)

A alpha.41 inclui ventilação opcional com LibreHardwareMonitor 0.9.6 fixado por hash/commit e auxiliar nativo separado, iniciado sob demanda. RGB e energia dos LEDs continuam independentes da rotação. Macros de mouse ficam fora do escopo.

## Instalação e ativação

Atualize pelo instalador oficial da alpha.41, sem desinstalar a versão anterior. O módulo começa desligado e não reativa o controle ao reiniciar. **Detectar sensores** inicia monitoramento; mudar rotações exige associar explicitamente canal e sensor e ativar o controle. Uma leitura zero não prova canal vazio, e canais paralelos compartilham a saída física do conector. O auxiliar independente solicita retorno ao automático se perder o serviço pai. Compatibilidade e resposta mecânica precisam ser conferidas no equipamento; os testes automatizados usam canais simulados.

Os pacotes alpha e de desenvolvimento incluem o backend somente com marcador do mesmo commit. Versões estáveis não habilitam automaticamente este recurso experimental. Para preparar uma candidata privada, `scripts/build.ps1 -CoolingDevelopment` continua disponível; isso não instala nem inicia sensores no PC.

## Experimentar sem tocar nas ventoinhas

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-cooling.ps1
node scripts/dev-cooling.cjs --simulate --port 5151
```

Abra `http://127.0.0.1:5151/` e entre em **Ventilação**. A página mostra **Simulação**, com seis canais e temperaturas/RPM fictícios. Usa dados em `data/cooling-dev/app`, não inicia o OpenRGB instalado nem altera serviços. Nenhum sensor real é aberto neste modo.

1. **Detectar sensores** inicia somente monitoramento, sem comandar rotação.
2. Marque um canal, escolha explicitamente o sensor de temperatura e, se souber a correspondência, a leitura de RPM. Não existe associação automática por ordem/nome.
3. Escolha um perfil ou selecione **Modo de controle → Curva manual** no canal. Ajuste de 2 a 8 pontos crescentes, arrastando no gráfico ou digitando temperatura/velocidade. **Traçado da curva** escolhe Linear ou Suave.
4. Defina uma rotação mínima em que a fan continue girando e a temperatura de proteção adequada ao componente.
5. Ative **Ativar controle pelo Nexus**. **Aplicar curvas** salva associações/curvas; os valores exibidos são percentuais solicitados, não confirmação mecânica.
6. **Desligar módulo** solicita retorno ao controle automático, encerra o auxiliar e para as leituras. Deixar a aba enquanto apenas monitora também encerra esse monitoramento. Controle ativo continua ao trocar de aba.

## Perfis

### Três perfis personalizados

Em **Meus perfis personalizados**, clique em **Criar perfil personalizado**, dê um nome e ajuste pontos/traçado. **Salvar como perfil personalizado** em um canal copia sua curva para o editor da biblioteca. Você pode salvar até três, editar ou excluir. Selecione outro perfil antes de excluir o atual. Salvar/editar a biblioteca não inicia sensores nem altera rotações: para aplicar, clique no perfil salvo e ative o controle explicitamente quando necessário. Se editar um perfil em execução, a versão aplicada continua até selecioná-lo novamente; o painel informa a alteração pendente.

**Linear** liga pontos por segmentos de reta: em cada trecho, a velocidade é uma função afim da temperatura. **Suave** usa interpolação cúbica monotônica `3t² − 2t³` entre os mesmos pontos, sem ultrapassá-los. Não é uma exponencial; é uma curva contínua com transições arredondadas. Mínimo, proteção térmica e limites de hardware continuam prevalecendo.

### Identificação e canais exibidos

Todos os canais informados pela biblioteca aparecem inicialmente, inclusive em zero RPM. Uma leitura zero pode indicar parada, falta de retorno ou saída não utilizada; não comprova porta vazia. Em **Identificar canal**, salve um nome e oculte apenas saídas que você conferiu. **Mostrar todos os canais** recupera as ocultas; canais selecionados para controle permanecem visíveis. Salvar identificação não muda rotações, não inicia sensores e não aplica o rascunho de curva. Preferências ficam no arquivo privado `cooling.json`, associadas à identidade informada da placa/canal para evitar reaproveitamento automático em outra placa.

Os nomes originais da biblioteca são preservados. Sugestões disponíveis para um modelo exato aparecem separadas como **não confirmadas** e não substituem a identidade, não selecionam RPM nem comandam saídas. A associação de RPM continua explícita: índices iguais de sensores e controles não comprovam correspondência elétrica. Ventoinhas em paralelo/divisor compartilham um canal; número de fans físicas não é número de controles independentes. Veja [compatibilidade e limites](COMPATIBILIDADE.md).

| Perfil | Pontos de referência (°C → %) |
| --- | --- |
| Silencioso | 30→25, 50→35, 65→55, 75→75, 85→100 |
| Equilibrado | 30→35, 50→45, 65→65, 75→85, 85→100 |
| Desempenho | 30→45, 50→60, 65→80, 75→100, 85→100 |
| Agressivo | 30→60, 45→75, 60→90, 70→100, 85→100 |
| TURBO | Solicita 100% nos canais selecionados, respeitando o máximo declarado pelo hardware |

Interpolação linear entre pontos. O mínimo configurado prevalece: por padrão 40%, ajustável de 20 a 100%, dentro dos limites do canal. Portanto, Silencioso não envia 25% se o mínimo do usuário for 40%. Não há parada a 0% nem calibração automática da velocidade de partida. RPM não é proporcional universalmente à porcentagem.

Trocar de perfil substitui curvas personalizadas salvas; editar pontos preserva a curva até essa escolha explícita. O arquivo privado `cooling.json` é separado do RGB e do backup de iluminação. Reiniciar o servidor **não reativa o controle** automaticamente.

## Proteções e limites

- Um ciclo sequencial por segundo; saída idêntica não é reenviada. Histerese de cerca de 2 °C e redução limitada a 12 pontos percentuais por segundo evitam oscilações; aumento térmico e TURBO respondem sem essa espera.
- Ativar/aplicar consulta uma nova amostra antes de enviar a curva. Limites fracionários são respeitados sem arredondar acima do máximo; canais sem um valor inteiro dentro do piso de segurança ficam somente para leitura. Falha ao liberar canais durante reassociação desarma o controle em vez de continuar com estado divergente.
- Temperatura inválida solicita a saída de proteção máxima. Leitura atrasada, canal removido ou falha de comunicação desativa o módulo e solicita liberação. Não há reconexão/rearme automático.
- O auxiliar tem watchdog de cinco segundos sem comunicação e observa o processo pai; EOF/encerramento também solicita `SetDefault` nos canais que assumiu.
- Isso não garante retorno físico ao firmware em um travamento de driver, bloqueio de chamada ou morte abrupta do auxiliar. Simulação não comprova segurança térmica. Não substitui as proteções do firmware/CPU/GPU.
- Compatibilidade inicial somente com controles genéricos expostos pelo backend SuperIO, AMD GPU e NVIDIA GPU. Muitos aparelhos não expõem escrita; hubs USB específicos e GPU Intel não receberam adaptador de controle. Ter RGB compatível não significa ter controle de fan.
- Não executar dois programas controlando a mesma rotação. Monitorar sensores pode disputar recursos com outros aplicativos; o custo real ainda precisa ser medido.

Para um ensaio físico posterior, `--hardware` permite solicitar administrador quando **Detectar sensores** for clicado. O runner continua sem iniciar o RGB instalado. Não executar esse modo até combinar o ensaio com o proprietário. A candidata não instala driver automaticamente; o backend pode depender do PawnIO já disponível.

## Consumo medido em 21/10/2026

Dois ensaios em ordem inversa, Aurora 20 FPS, SDK simulado com 3 controladoras/5 componentes/92 LEDs e seis canais de fan simulados. Cada janela tem aproximadamente 10,4 s após 4 s de aquecimento. Soma Node + worker espacial + auxiliar C# quando ativo; exclui navegador, OpenRGB, supervisores, bandeja, driver e acesso físico aos sensores. CPU normalizada às 12 threads; working sets podem contar páginas compartilhadas mais de uma vez.

| Cenário | CPU média da máquina | Working set médio somado |
| --- | ---: | ---: |
| Base Git `78f2735`, sem módulo | 0,350% | 129,06 MiB |
| Candidata, módulo desligado | 0,348% | 131,16 MiB |
| Apenas monitoramento simulado | 0,286% | 159,88 MiB |
| Equilibrado, 6 canais simulados | 0,386% | 160,64 MiB |
| TURBO, 6 canais simulados | 0,342% | 160,73 MiB |

Controle Equilibrado acrescentou aproximadamente **29,48 MiB e 0,038 ponto percentual de CPU** frente à candidata desligada. As variações entre repetições são grandes em relação ao delta de CPU: não demonstram ganho ao monitorar nem custo físico final. O renderer manteve aproximadamente 19,93–20,13 FPS. Nenhum auxiliar existe com o módulo desligado.

Não foram medidos watts, ruído, queda de temperatura, ganho em jogos ou estabilidade térmica. [Dados e escopo](benchmarks/2026-10-21-cooling.json); reprodução: `node scripts/benchmark-cooling.cjs`.
