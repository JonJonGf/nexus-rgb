# Mapa local do código com Graphify

Graphify é uma ferramenta de desenvolvimento, não uma dependência do Nexus instalado.
O usuário solicitou `/graphify` para facilitar a compreensão das relações do código.
O grafo complementa a leitura dos arquivos, a reprodução de bugs e os testes.

## Origem e instalação

- Projeto: [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify).
- CLI instalada em ambiente isolado pelo uv: `graphifyy==0.9.93`, usando Python 3.14 já disponível neste PC. O Python padrão não foi alterado.
- Fonte consultada: [`b90b9df7949bd04a15b40a1624af85d0a9cfdf04`](https://github.com/Graphify-Labs/graphify/tree/b90b9df7949bd04a15b40a1624af85d0a9cfdf04).
- Skill copiada pelo instalador oficial: `graphify install --project --platform agents`, para `.agents/skills/graphify/`. Referências, identificação da versão e licenças/NOTICE foram preservados. O repositório upstream gera o arquivo SKILL.md durante a instalação; por isso foi usado seu próprio instalador, em vez do instalador de skills que exige um SKILL.md já existente na origem.
- Sem hooks, watchers, MCP ou serviços em segundo plano. Não houve alteração do pacote Node, dos serviços instalados, da iluminação ou dos binários da alpha.40.

Em outro computador, com uv disponível:

```powershell
uv tool install --python 3.14 'graphifyy==0.9.93'
graphify install --project --platform agents
```

A skill do projeto fica disponível para descoberta nas próximas interações do agente.

## Gerar ou atualizar

Execute na raiz do projeto:

```powershell
./scripts/update-code-map.ps1
```

O script confere a versão da ferramenta, preserva a visualização anterior em
`graphify-out/history/`, atualiza a extração original em `graphify-out/raw/` e
gera a vista principal com `scripts/refine-code-map.py`. Desativa provedores
de IA somente durante a execução e restaura a variável anterior ao sair.
Não use `graphify update .` diretamente na vista principal: essa operação
contornaria a camada local de qualidade.

Os arquivos locais `graphify-out/graph.html`, `GRAPH_REPORT.md` e `graph.json`
são ignorados pelo Git. A análise de código usa AST, sem chamadas a modelos de IA.
O HTML gerado pelo upstream carrega vis-network 9.1.6 de um CDN com hash SRI;
a primeira visualização depende de acesso a esse recurso. Não é um visualizador
totalmente offline.

## Correção dos ruídos identificados

A biblioteca upstream 0.9.93 foi preservada. A correção é uma projeção local
auditável, não uma afirmação de que o resolvedor inteiro passou a ser exato.

- Relações inferidas ficam separadas em `MAP_AUDIT.json`. Não são declaradas falsas: algumas são callbacks ou dependências reais ainda não verificadas. A extração original continua disponível em `raw/graphify-out/graph.json`.
- Para autorrelações JavaScript, tree-sitter verifica o receptor no local informado. `client.connect()` não comprova recursão de `Hardware.connect`; chamadas diretas ao próprio nome ou a `this` são preservadas. Isso não implementa resolução completa de tipos, bindings, herança ou callbacks em execução.
- Nomes repetidos ganham o arquivo de origem na visualização, sem mudar IDs dos símbolos.
- Arquivos HTML/CSS de `public/` entram no mapa. Dependências de `<script src>` e `<link rel="stylesheet">` são extraídas com HTMLParser e verificadas no disco. Links externos e caminhos que escapem de `public/` não são seguidos. Não foi prometida análise completa de seletores CSS, DOM ou scripts inline.
- Testes/benchmarks e as próprias ferramentas do mapa foram retirados desta vista principal; permanecem no repositório. Nenhum código de teste foi apagado.
- `MAP_AUDIT.json` registra os hashes de conteúdo dos arquivos mapeados, as relações separadas e os motivos. Compare também arquivos novos/excluídos e as regras de escopo ao avaliar atualidade; hashes de arquivos existentes sozinhos não detectam novas dependências.

Resultado da reconstrução: **959 nós, 1.770 relações e 79 comunidades**, com
**171 relações separadas para revisão** (164 inferidas e sete possíveis
autorrelações com receptor não confirmado). As 13 autorrelações restantes são
compatíveis com chamadas ao próprio nome/`this` nesse teste estático; não são
13 defeitos. Nove arquivos classificados como código continuam sem símbolos
extraídos; a ferramenta não tem cobertura semântica universal.

Regressões na interface CLI/artefatos: três testes passaram, com falhas observadas
antes das correções para string `origin` confundida com callback de outro arquivo,
falsa recursão por método de outro objeto e referências HTML ausentes.
Testes também verificam preservação de todas as arestas originais entre mapa
principal/auditoria e endpoints válidos. Para executar no Python isolado:

```powershell
$graphifyPython = Join-Path (uv tool dir) 'graphifyy/Scripts/python.exe'
& $graphifyPython tests/test_code_map.py
```

A comparação com o mapa inicial completo também foi repetida. A vista final
foi aberta no Edge, com busca/seleção e zero erros de página. Sem teste físico,
comando ao Nexus, reinstalação ou alteração da aplicação.

Exemplos de consultas locais:

```powershell
graphify query 'Hardware sendLeds' --budget 1500
graphify path 'server/studio.js::Studio' 'server/hardware.js::Hardware' --undirected
```

Quando houver nomes ambíguos, use `caminho::símbolo` ou o ID exato. O caminho
entre classes não demonstra o trajeto de um quadro: pode representar apenas
imports. Consulte as funções e confirme a chamada no código.

## Histórico: escopo e limites da primeira execução (21/10/2026)

Os números abaixo descrevem a primeira extração bruta, antes da projeção
conservadora descrita acima; não são o estado atual do mapa principal.

- `.graphifyignore` exclui dados privados, anexos, bibliotecas e binários, documentação extensa, `tests/` e resultados gerados. Os scripts de verificação em `scripts/` continuam no escopo.
- Detectados 100 arquivos; analisados 87 arquivos classificados como código. Treze documentos/imagens foram deliberadamente ignorados pelo modo `--code-only`. HTML, CSS, configuração Inno Setup e workflows não receberam análise semântica.
- Resultado: 1.074 nós, 2.104 conexões e 71 comunidades. O relatório registra 92% das relações como extraídas e 8% como inferidas; a inferência pode ligar funções homônimas sem uma chamada real. Nove arquivos classificados como código não produziram símbolos, embora alguns tenham nó de arquivo.
- Diagnóstico do grafo exportado: nenhum endpoint ausente, referência pendurada ou duplicação exata; 20 autorrelações. Estas precisam de leitura contextual, pois podem representar recursão ou imprecisão da extração. Como a verificação foi pós-construção, ela não comprova ausência de perdas anteriores na extração.
- Navegador Edge: canvas renderizado, busca por Hardware com seis resultados e seleção de um nó funcionando; zero erros de página observados. Evidência local em `data/graphify-setup/`.
- Os números descrevem cobertura e estrutura, não bugs comprovados, ganho de desempenho ou redução medida de tokens. Os títulos e perguntas gerados automaticamente também podem ser pouco úteis.
- Base de código: HEAD `78f2735`, com ajustes documentais locais posteriores. Após editar código, regenere o mapa; o hash de HEAD sozinho não detecta mudanças locais não commitadas. Arquivos e linhas do mapa podem ficar obsoletos.

Não envie corpus para provedores externos, amplie para dados pessoais ou instale
automação permanente apenas por orientação do grafo ou da skill. As instruções
do usuário e AGENTS.md continuam prevalecendo.
