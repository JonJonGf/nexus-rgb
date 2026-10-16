# Mapa, recuperação e diagnóstico — 16/10/2026

Validação da v0.1.0-alpha.16. Testes automatizados do projeto não equivalem a auditoria independente ou certificação de compatibilidade universal.

Na execução local, passaram **102 testes de lógica/integração**, **25 de interface**, o supervisor real do Windows e **12 fixtures do instalador** nos dois idiomas. O ensaio isolado de sustentação de 60 segundos completou 168 requisições, oito streams simultâneos e dez reinícios abruptos do processo de teste, preservando os dados. Compilação local e auditoria das dependências de produção também passaram. Pequenas correções finais de importação/backup foram verificadas novamente em testes direcionados; o workflow da tag repete a bateria sobre o código exato do pacote.

## Cobertura

- Calibração com múltiplos anéis, permutação física, simetria vertical e validação das faixas; controles de um HTML sintético prevalecem sobre seus defaults.
- Identificação temporária somente no componente escolhido, sem gravar ajustes, retomando desligamento/modo nativo. Transições limitadas respeitam desligamento e terminam no alvo sem repetir cores estáticas continuamente.
- Histórico e transformações, seleção múltipla, persistência dos grupos, alças, restauração do mapa e idioma no diálogo de calibração.
- Backup com validação de estrutura, fontes e referências; revisão invalidada por alterações concorrentes; falha de gravação sem alterar a configuração anterior; cópia local prévia e preservação da biblioteca.
- Backup do instalador em Windows PowerShell 5.1, Unicode, parâmetros que diferem por maiúsculas/minúsculas e rejeição de pasta redirecionada.
- Favoritos, categorias e duplicação de perfis/efeitos mantendo os originais. Interface PT/EN, desktop e telas móveis simuladas.
- Consulta GitHub somente após clique, URL fixa, sem credenciais, limites de resposta e comparação numérica de versões. A política do painel principal continua restrita à própria origem.
- Diagnóstico por lista de campos permitidos, sem dados privados de hardware/perfis; central indica leitura parcial e para a coleta ao sair da página.
- Tradução de diálogos nativos sem mostrar janelas nem alterar preferências do usuário nos testes; doze fixtures do instalador, seis por idioma, incluindo falhas e reinício requerido.

Os testes de interface usam dados, instância da API, porta e janela do limitador próprios por teste. Não se relaxa o limite HTTP da aplicação para acomodar a velocidade da bateria automatizada.

## Pacote e hardware

A [execução da versão](https://github.com/JonJonGf/nexus-rgb/actions/runs/38870043753) concluiu com sucesso no commit `2c3ab0509f7aef98591c937b5304258a2eea3cc3`. Foram **67 verificações em cada VM**, nas portas 5050/6743/80 e 5151/6754/8081. As duas confirmaram a tag/commit informados pela instalação, o backup anterior à atualização, a preservação dos dados e a remoção somente dos recursos próprios. O [registro dos resultados e hashes](2026-10-16-installer.json) identifica os executáveis publicados. Não foram instalados drivers nessas VMs.

O workflow de publicação compila a tag e testa instalação, atualização, preservação dos dados, recuperação e remoção em duas VMs descartáveis. A versão instalada deve informar a mesma tag e commit do pacote. O ensaio também verifica a cópia automática anterior à atualização e o diagnóstico sem caminhos privados. Consulte a execução vinculada nas notas da versão para o resultado do pacote efetivamente publicado.

A validação local usa dados temporários e SDK simulado. Os testes destrutivos de instalação ficam restritos a VMs descartáveis, sem alterar proteções ou drivers do computador de desenvolvimento. As medições usam processos dedicados; seus escopos estão no [relatório de desempenho](../DESEMPENHO.md).

A orientação física final, ligação espelhada/sequencial, suspensão/retomada de controladoras reais, comportamento antes do login e confirmação de sucesso da Alexa precisam de observação em hardware independente. Esses resultados não são inferidos de testes de software ou da VM.
