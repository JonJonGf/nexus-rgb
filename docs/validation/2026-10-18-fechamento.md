# Validação da candidata após alpha.36 — 18/10/2026

## Escopo e versões

Código de produção em `a300821`, preservação de backups em `06063ee` e correção do instalador em `0aa9a8f`. A branch de revisão é `codex/reliability-alpha37`. Não existe uma alpha.37 publicada por este trabalho; a Release oficial continua alpha.36. A instalação no PC de desenvolvimento permanece no candidato anterior `52b9ac9`, sem atualização física nesta etapa.

**Resultado final:** [instalador em `ef66e93`](https://github.com/JonJonGf/nexus-rgb/actions/runs/39169465316) aprovado nas duas VMs, com **86 verificações em cada relatório**. Artefatos baixados e `Passed: true` conferido, sem erro. Pasta padrão e personalizada concluíram instalação, atualização com bandeja aberta, restauração após cancelamento transacional, recuperação, desinstalação e reinstalação, preservando perfis, efeitos, posições e calibração. Não foi feita instalação física no PC de desenvolvimento.

## Instalação em Windows isolado

A [primeira execução](https://github.com/JonJonGf/nexus-rgb/actions/runs/39154367929), sobre `3db0aa9`, concluiu com sucesso nas duas VMs: pasta padrão e pasta personalizada protegida. Cada relatório continha 74 verificações. Foram baixadas e conferidas as evidências; não se inferiu sucesso apenas pelo estado do workflow.

A [execução ampliada](https://github.com/JonJonGf/nexus-rgb/actions/runs/39167173172) acrescentou mapa/calibração, cancelamento transacional e bandeja aberta antes de atualizar. Ela encontrou um defeito: o `AppMutex` do Inno bloqueava a instalação na inicialização, antes do preflight que deveria encerrar o processo próprio. O teste falhou no upgrade; a outra VM foi cancelada pelo fail-fast. Esse resultado foi preservado.

O defeito foi reproduzido e corrigido usando o Inno 6.4.3 real num produto temporário inerte, com mutex exclusivo. A instalação agora chega ao preflight, que mantém verificações de identidade, sessão e diálogos. A desinstalação continua recusando bandeja ativa via `InitializeUninstall`/`CheckForMutexes`. O fixture passou antes de liberar nova execução das VMs. Não foi removida a proteção do encerramento de serviços ou de processos alheios.

A verificação antecipada do mutex corresponde ao comportamento documentado em [AppMutex](https://jrsoftware.org/ishelp/topic_setup_appmutex.htm); o guard mantido na desinstalação usa [CheckForMutexes](https://jrsoftware.org/ishelp/topic_isxfunc_checkformutexes.htm).

A [rodada corrigida](https://github.com/JonJonGf/nexus-rgb/actions/runs/39168065063), sobre `0aa9a8f`, cobre as duas pastas e não cancela uma matriz apenas porque a outra falhou. Resultado final deve ser conferido antes da publicação. O cancelamento exercitado chama a transação real de preparação/restauração; não equivale a testar manualmente cada botão da janela do instalador.

**Atualização posterior:** essa rodada confirmou nos dois logs que o upgrade terminou e reabriu a bandeja, mas o harness usava `Start-Process -Wait`, que aguarda também processos filhos persistentes. Foi cancelada para substituir essa espera pela saída do próprio instalador, com prazo de 180 segundos. Uma regressão com processos Windows reais passou. A [execução final em `ef66e93`](https://github.com/JonJonGf/nexus-rgb/actions/runs/39169465316) é a referência para conferir o ciclo completo; não confundir os logs de upgrade concluído com todos os testes posteriores aprovados.

**Conclusão da execução final:** os dois relatórios confirmaram fechamento automático da bandeja anterior, preservação byte a byte dos dados e manutenção do mapa/calibração após atualização, recuperação e reinstalação. As rodadas anteriores permanecem registradas como falha ou cancelamento; não foram reclassificadas como sucesso.

## Segurança

O [CodeQL de `0aa9a8f`](https://github.com/JonJonGf/nexus-rgb/actions/runs/39168069056) concluiu com sucesso nas três categorias, mantendo queries estendidas e modelo de ameaças locais.

- **#91:** backup da configuração inválida. Substituído o teste de existência por preservação exclusiva, com nome permitido, normalização/contenção no diretório e publicação do JSON completo sem substituir entrada existente. Regressão verifica travessia, backup anterior e hard link externo intacto.
- **#92:** avaliação do texto do módulo dentro do teste de rede. O teste passou a carregar o módulo real e substituir somente APIs do SO.
- **#93:** aviso posterior na limpeza de `writeJson`. Todos os quatro fluxos SARIF partiam de diretórios de inicialização/env ou argumento local do gerador de licenças, sem nome HTTP. O cleanup remove somente um temporário aleatório após criação exclusiva `wx` bem-sucedida. Classificado como **falso positivo**, com justificativa registrada no GitHub. Isso não é uma correção de vulnerabilidade e não foi anunciado como tal.

As instâncias #91/#92 ficaram corrigidas na branch. A consulta posterior ao tratamento de #93 retornou zero alertas abertos nessa branch. Não houve desativação de queries, exclusão de código da análise nem redução de proteções. Esse estado não garante ausência de vulnerabilidades ou malware.

A [última análise de `ef66e93`](https://github.com/JonJonGf/nexus-rgb/actions/runs/39169552913) também concluiu as três categorias. #94/#95 apontaram a seleção do compilador `csc.exe` a partir de `SystemRoot`, somente nos testes Windows. Os fluxos SARIF foram revisados: diretório do SO definido na inicialização, argumentos em array e shell desabilitado, sem parâmetro HTTP. Foram classificados como falsos positivos, com justificativas públicas e sem remover a análise desses arquivos. A consulta seguinte não apresentou alertas abertos na branch.

## Testes gerais finais

A [validação de `ef66e93`](https://github.com/JonJonGf/nexus-rgb/actions/runs/39169463695) aprovou **214 testes gerais**, **43 de interface**, supervisor e estabilidade. O ensaio de estabilidade isolado fez 171 requisições e dez reinícios abruptos do processo, preservando os dados. Não é uma medição de estabilidade física prolongada.

## Desempenho e evidências

Foram repetidos sete cenários do motor em baseline e candidata, além de oito execuções de navegador em ordens invertidas. O [relatório de desempenho](../DESEMPENHO.md#revisão-da-candidata-após-alpha36--18102026) separa motor e navegador, apresenta o aumento de CPU observado em algumas animações e explicita os limites da amostra. Não houve mudança na taxa física da RAM nem testes de LEDs no PC real.

Logs, SARIFs, artefatos das VMs e relatórios brutos ficam privados em `data/final-review-*`. Pacotes de desenvolvimento anteriores foram preservados antes de reconstruir `dist/`. O pacote é conferido por SHA-256 e comparação da fonte; assinatura digital pública continua sendo uma questão separada.

## Pacote local conferido

Compilação integral de desenvolvimento a partir de `13339a5f23260319fc8531e66a07417e4b5fc891`, que contém o código de produto validado e os documentos de desempenho. Os commits posteriores alteram o harness e registros de validação. Conferidos 159 arquivos de servidor, interface, scripts, documentação e metadados contra essa fonte, sem divergência. Dependências de produção sem vulnerabilidades reportadas; nenhum binário WinRing presente no payload. Não confundir os fixtures privados de compilação com os arquivos abaixo.

| Arquivo | SHA-256 |
| --- | --- |
| `NexusRGB-Setup-0.1.0.exe` | `c3e55b97d35169595449079e2b509dd88e92082dc9bf01318a3be88452be8886` |
| `NexusRGB-Uninstall-0.1.0.exe` | `826d64dccbd36ae11baea7017fca0a87a779ecddc921a9e4002b1be0d50ccf8c` |

`BUILD-INFO.json` local identifica o commit e informa `development: true`, sem tag e sem assinatura pública. Nenhum merge, tag ou Release nova foi criado nesta etapa. Novos modelos de hardware, clique manual em cada diálogo de cancelamento, medição de latência de digitação e estabilidade por horas/dias continuam fora da evidência disponível.

## Publicação posterior — alpha.37

Com autorização esclarecida pelo usuário, a branch foi integrada por fast-forward e a tag nova `v0.1.0-alpha.37` criada em `0a78ede08d3c3d9062657a0e764c46e11abf134a`, sem mover tags anteriores. O [workflow oficial](https://github.com/JonJonGf/nexus-rgb/actions/runs/39170857660) concluiu na tentativa 2: três categorias CodeQL aprovadas e duas VMs com **87 verificações cada**, incluindo a correspondência entre instalação, tag e commit. Os relatórios dos artefatos `12152504945` e `12152553539` foram baixados e confirmaram `Passed: true`, sem erro. A [validação geral da tag](https://github.com/JonJonGf/nexus-rgb/actions/runs/39170857629) também passou.

A primeira tentativa parou na conferência do download de `runtime/node.exe` em uma VM: hash divergente, sem publicar ou executar o arquivo. O checksum esperado foi confirmado no arquivo oficial do Node; outro download local coincidiu com ele e tinha assinatura OpenJS válida. A segunda VM passou e o job falho foi repetido com o mesmo manifesto/tag/commit, passando em seguida. A causa exata do download divergente não foi comprovada; não chamar isso de defeito do aplicativo corrigido nem de indício confirmado de malware. Logs privados preservados.

A [Release pública](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.37) contém os quatro arquivos esperados. Todos foram baixados e conferidos contra tamanho/digest do GitHub, `BUILD-INFO.json` e `SHA256SUMS.txt`:

| Arquivo | SHA-256 |
| --- | --- |
| `NexusRGB-Setup-0.1.0.exe` | `03fb72d8e2766c74e7bb5fd121af2e5b9cb5354ee46042ed29b33bdf85a7afa2` |
| `NexusRGB-Uninstall-0.1.0.exe` | `17ba22a2f8df2cfdc5f9c8a6ecef916c17f907ec0e8bd0a2a5719dae584b4c87` |

Esses hashes são da Release recompilada em VM, não do pacote local de desenvolvimento descrito acima. Executáveis Nexus continuam sem assinatura digital própria. Não houve atualização do PC real. Os links do texto público da Release foram ajustados para documentos na tag; tag e executáveis não foram substituídos.
