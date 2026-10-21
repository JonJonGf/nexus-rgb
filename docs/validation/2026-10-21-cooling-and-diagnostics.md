# Ventilação opcional, documentação e diagnóstico de GPU — 21/10/2026

## Estado e escopo

Trabalho local na branch `codex/fan-control-dev`, iniciado em `78f273565cc42340410d03f8882ab4eb611e4cf4`. A base publicada/instalada continua **v0.1.0-alpha.40**, tag imutável no merge `b967667f64c5d51c0cdae8784cd7849f95c28ca7`. Este trabalho não criou tag/release, não atualizou a instalação e não comandou iluminação, sensores ou RPM físicos.

Usuário autorizou a versão de desenvolvimento com controle de fans opcional e depois pediu tradução de READMEs/guias e coletor para o PC externo. Confirmou priorizar READMEs/guias, preservando histórico técnico. Relatou que o RGB da Gigabyte RX 7600 continua apagado na alpha.40; não foi comprovada correção desse caso.

## Implementação

### Ventilação

- `server/cooling.js`: módulo separado e desligado por padrão, configuração `cooling.json`, cinco perfis, curvas monotônicas de 2–8 pontos, pareamento explícito, mínimo/limites/temperatura crítica, histerese, redução gradual, deduplicação, fila limitada, amostragem sequencial de 1 s e liberação ao desligar/falhar. Não rearma após reiniciar.
- `server/cooling-bridge.js` e `native/NexusCoolingBridge.cs`: auxiliar iniciado sob demanda, protocolo limitado com timeout, fixture sem hardware, modo real por pipe local restrito ao PID pai, watchdog e `SetDefault` nos controles assumidos. Modo real exige solicitação explícita de detecção e administrador. Nenhum driver instalado pelo build.
- Backend LHM 0.9.6 fixado por SHA/commit em `dependencies/cooling`. Apenas SuperIO/AMD/NVIDIA com controle genérico exposto; sem garantia universal. CPU/GPU/placa-mãe habilitados para leitura quando solicitado, RAM/SPD/storage/rede/controladores genéricos desabilitados.
- `public/cooling.*`, `public/index.html`, `public/app.js`, `public/en.js`: aba PT/EN responsiva com perfis, seleção de sensores, RPM opcional e curva editável. Exibe solicitação, não confirmação física.
- `server/index.js`, `server/resources.js`, `public/health.js`: HTTP restrito ao administrador local e soma do auxiliar sob demanda nas métricas, sem polling extra de sensores pelo diagnóstico.
- `scripts/dev-cooling.cjs`/`build-cooling.ps1`: porta/dados separados, simulação inicial, sem tocar OpenRGB instalado; o helper opcional não é incluído no build oficial normal.

### Coletor de GPU

- `native/NexusDiagnostic.cs` + `scripts/build-diagnostic.ps1`: executável portátil WinForms/.NET Framework, sem Node/Python/LHM externo. Relatório revisável por categorias, gravação manual e nenhuma conexão externa.
- Coleta somente leitura do Windows, instalação registrada e API loopback. A sessão local temporária fica em memória; somente POST de sessão, GET health/state/diagnostics. Não envia comandos RGB nem consulta SDK/ADL/SMBus diretamente.
- Projeção explícita de GPU/zonas, parâmetros solicitados, drivers/modelos/IDs PCI de modelo, serviços, hashes de arquivos conhecidos e resumo opcional de assinaturas de log. Não exporta cookies, IP/MAC, serial, caminhos pessoais, código, cores ou perfis. Ausências/permissões aparecem no relatório; a ferramenta não pede UAC.
- Conexão e parâmetros solicitados não são confirmação física. Contagem de log/processos é evidência parcial, sem atribuição automática de causa. Logs protegidos podem exigir execução administrativa manual posterior pelo dono do PC.

### Documentação e mapa

- `README.md`/`README-en.md` em inglês, texto idêntico; `README-pt.md` preserva o guia completo PT com notas atuais. Banner inglês próprio. O build copia os três READMEs, além do guia texto existente para Bloco de Notas.
- `docs/en/` reúne guias de mapa, Experiences, Alexa, backup/diagnóstico, GPU, desenvolvimento e ventilação; `docs/EFFECTS.md` já existente foi ligado ao índice inglês. Histórico e licenças originais preservados.
- Corrigidas instruções antigas de exclusões/perfis e tabela de quatro padrões em `docs/STUDIO.md`; não confundir tradução com disponibilização de um recurso novo no instalador.
- Mapa Graphify local reconstruído pelo fluxo conservador: 1.103 nós, 2.049 relações, 80 comunidades, 182 relações pendentes separadas na auditoria. Não foi enviada fonte para provedor externo.

## Verificação realmente executada

| Ensaio | Resultado e escopo |
| --- | --- |
| Suíte geral `npm test` | 278/278, sem falha, antes do último teste de recursos e polimento da UI |
| Recursos adicionais final | 5/5, incluindo auxiliar somado uma vez e removido após desligamento |
| Cooling HTTP final | 8/8; mínimo/limites, proteção com sensor inválido, stale/fault/release, curvas/deduplicação, desativação, sessão local e reinício sem rearme |
| Navegador completo sem retries | 60/60; depois houve teste específico adicional de polimento, descrito abaixo |
| Cooling no navegador após polimento | 2/2, sem retries, PT/EN, pareamento, troca de perfil preservando rascunho, TURBO/off, 390 px e saída durante detecção assíncrona |
| Navegador→HTTP→C# fixture real | Passou, seis canais, RPM fictício de TURBO, PC/celular, desligamento e zero erros de página |
| Protocolo C# de cooling | Passou: stdio, batch inválido/liberação, watchdog sem heartbeat, pipe e restrição de PID, sem hardware/UAC |
| Coletor GPU nativo | Passou com fixture, canários de privacidade, falha de entrada sem caminho pessoal e servidor HTTP loopback isolado |
| Janela do coletor | Renderizada com fixture e inspecionada; conteúdo JSON legível, categorias, coleta/save e estado de simulação visíveis |
| Supervisor Windows | Passou com processos isolados: recuperação de encerramento/hang, retomada e cancelamento; nenhum serviço instalado reiniciado |
| Mapa CLI | 3/3; extração/refinamento e auditoria reconstruídos |
| READMEs | Links de versão dos três passaram no validador alpha.40; texto inglês espelhado, alvos dos links locais novos conferidos |
| Integridade textual | `git diff --check` passou |

Na preparação dos commits, a checagem incluindo os novos arquivos encontrou três espaços finais no aviso de terceiros copiado do upstream, que a checagem anterior de arquivos rastreados não cobria. Eles foram normalizados sem alterar o texto da licença; a checagem do diff completo foi repetida. Os dois erros de compilação intermediários do coletor (declaração `var` múltipla e nome local repetido) foram corrigidos antes da compilação/testes finais.

Falhas observadas antes das correções: primeira rota inexistente 405; mínimo maior que máximo aceito; queda lenta da temperatura mantendo alvo antigo; limite do canal reduzido durante execução não causando liberação; troca de perfil apagando pareamento ainda não salvo e checkbox voltando ao estado anterior durante a requisição; sair da aba antes da resposta de detecção deixando monitoramento ativo. Os testes/ensaios foram repetidos após os ajustes correspondentes. Não foram reduzidos limites, proteção ou asserções para declarar sucesso.

Compilação do coletor como aplicação gráfica inicialmente expôs falha da configuração de `Console.OutputEncoding` no modo fixture; corrigida por escrita explícita no stream redirecionado. Nenhum resultado do executável anterior foi atribuído ao binário final sem recompilar/retestar.

Não foram executadas as VMs de instalação/atualização/remoção para esta candidata: não há instalador novo publicado e o auxiliar experimental não foi integrado ao supervisor de produção. O build oficial normal recebeu apenas a inclusão dos READMEs na lista de arquivos.

## Benchmark equivalente

`scripts/benchmark-cooling.cjs` exportou a base Git para pasta nova ignorada, sem reset/checkout destrutivo. Dez cenários, duas repetições em ordem inversa, Aurora 20 FPS e SDK sintético idêntico (3 controladoras, 5 componentes, 92 LEDs). Auxiliar C# fixture foi realmente carregado quando ativo. Soma Node + worker + auxiliar; exclui navegador, OpenRGB, supervisor, bandeja, driver e I/O físico dos sensores.

Resultados e método em [VENTILACAO.md](../VENTILACAO.md) e [JSON público](../benchmarks/2026-10-21-cooling.json). Equilibrado: 160,64 MiB / 0,386% CPU; candidata desligada: 131,16 MiB / 0,348%. Diferença aproximada de 29,48 MiB e 0,038 ponto de CPU, com ruído maior que alguns deltas. Renderer ~20 FPS. Não foi medida temperatura, ruído, watts, desempenho em jogo ou estabilidade prolongada. Medição anterior ao último polimento da UI; não representa um novo binário instalado.

## Artefatos e próximo passo

- `dist/diagnostics/NexusRGB-Diagnostic.exe`, **256.000 bytes**, SHA-256 `69ac650f1b7658a059fe0b1e52546618a9f8d1ef64967f91ec466299ab8af94d`.
- `dist/diagnostics/NexusRGB-GPU-Diagnostic-dev.zip`, **239.850 bytes**, SHA-256 `4e994eee0f078468ad75093510b4790c90fd562ca8e9949ef151e562e88c707e`. Inclui EXE, instruções PT/EN, licença e soma do EXE. Não é instalador nem asset de release pública. Estes hashes substituem a compilação intermediária após incluir contagens Fusion2/ADL motivadas pela pesquisa adicional; o executável final foi recompilado e os testes de fixture/HTTP repetidos com sucesso.
- Dados/screenshots/logs privados em `data/cooling-dev/` e `data/gpu-report-tests/`, não versionados. Sem processos de diagnóstico/ventilação deixados em execução após os ensaios.
- Próxima evidência GPU: amigo executar a ferramenta no PC afetado, revisar e enviar JSON + relato físico. Não repetir como novos os testes estático/reinício já negativos.
- Próxima etapa cooling: combinar leitura real e ensaio de canal/RPM com o dono do PC; verificar backend, partida mínima, liberação, sensores inválidos e concorrência de barramento. Antes de distribuição oficial, concluir inventário de licenças/fontes transitivas e plumbing de privilégios/instalação. Não chamar a simulação de validação térmica.
