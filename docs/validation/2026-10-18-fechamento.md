# Validação da candidata após alpha.36 — 18/10/2026

## Escopo e versões

Código de produção em `a300821`, preservação de backups em `06063ee` e correção do instalador em `0aa9a8f`. A branch de revisão é `codex/reliability-alpha37`. Não existe uma alpha.37 publicada por este trabalho; a Release oficial continua alpha.36. A instalação no PC de desenvolvimento permanece no candidato anterior `52b9ac9`, sem atualização física nesta etapa.

## Instalação em Windows isolado

A [primeira execução](https://github.com/JonJonGf/nexus-rgb/actions/runs/39154367929), sobre `3db0aa9`, concluiu com sucesso nas duas VMs: pasta padrão e pasta personalizada protegida. Cada relatório continha 74 verificações. Foram baixadas e conferidas as evidências; não se inferiu sucesso apenas pelo estado do workflow.

A [execução ampliada](https://github.com/JonJonGf/nexus-rgb/actions/runs/39167173172) acrescentou mapa/calibração, cancelamento transacional e bandeja aberta antes de atualizar. Ela encontrou um defeito: o `AppMutex` do Inno bloqueava a instalação na inicialização, antes do preflight que deveria encerrar o processo próprio. O teste falhou no upgrade; a outra VM foi cancelada pelo fail-fast. Esse resultado foi preservado.

O defeito foi reproduzido e corrigido usando o Inno 6.4.3 real num produto temporário inerte, com mutex exclusivo. A instalação agora chega ao preflight, que mantém verificações de identidade, sessão e diálogos. A desinstalação continua recusando bandeja ativa via `InitializeUninstall`/`CheckForMutexes`. O fixture passou antes de liberar nova execução das VMs. Não foi removida a proteção do encerramento de serviços ou de processos alheios.

A [rodada corrigida](https://github.com/JonJonGf/nexus-rgb/actions/runs/39168065063), sobre `0aa9a8f`, cobre as duas pastas e não cancela uma matriz apenas porque a outra falhou. Resultado final deve ser conferido antes da publicação. O cancelamento exercitado chama a transação real de preparação/restauração; não equivale a testar manualmente cada botão da janela do instalador.

## Segurança

O [CodeQL de `0aa9a8f`](https://github.com/JonJonGf/nexus-rgb/actions/runs/39168069056) concluiu com sucesso nas três categorias, mantendo queries estendidas e modelo de ameaças locais.

- **#91:** backup da configuração inválida. Substituído o teste de existência por preservação exclusiva, com nome permitido, normalização/contenção no diretório e publicação do JSON completo sem substituir entrada existente. Regressão verifica travessia, backup anterior e hard link externo intacto.
- **#92:** avaliação do texto do módulo dentro do teste de rede. O teste passou a carregar o módulo real e substituir somente APIs do SO.
- **#93:** aviso posterior na limpeza de `writeJson`. Todos os quatro fluxos SARIF partiam de diretórios de inicialização/env ou argumento local do gerador de licenças, sem nome HTTP. O cleanup remove somente um temporário aleatório após criação exclusiva `wx` bem-sucedida. Classificado como **falso positivo**, com justificativa registrada no GitHub. Isso não é uma correção de vulnerabilidade e não foi anunciado como tal.

As instâncias #91/#92 ficaram corrigidas na branch. A consulta posterior ao tratamento de #93 retornou zero alertas abertos nessa branch. Não houve desativação de queries, exclusão de código da análise nem redução de proteções. Esse estado não garante ausência de vulnerabilidades ou malware.

## Desempenho e evidências

Foram repetidos sete cenários do motor em baseline e candidata, além de oito execuções de navegador em ordens invertidas. O [relatório de desempenho](../DESEMPENHO.md#revisão-da-candidata-após-alpha36--18102026) separa motor e navegador, apresenta o aumento de CPU observado em algumas animações e explicita os limites da amostra. Não houve mudança na taxa física da RAM nem testes de LEDs no PC real.

Logs, SARIFs, artefatos das VMs e relatórios brutos ficam privados em `data/final-review-*`. Pacotes de desenvolvimento anteriores foram preservados antes de reconstruir `dist/`. O pacote é conferido por SHA-256 e comparação da fonte; assinatura digital pública continua sendo uma questão separada.
