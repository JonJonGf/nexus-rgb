# Continuidade do trabalho

Estas instruções se aplicam a qualquer agente que trabalhe neste repositório. A autorização e as orientações atuais do usuário têm precedência.

## Ao começar ou retomar

1. Leia [o contexto de desenvolvimento](docs/CONTEXTO-DESENVOLVIMENTO.md) e o [plano de melhorias](docs/PLANO-MELHORIAS.md).
2. Confira `git status`, branch, commits e mudanças locais. O contexto é um registro auxiliar; confirme informações voláteis no código e nos workflows.
3. Identifique o pedido atual e as pendências. Não implemente automaticamente itens adiados nem suponha autorização para instalar, publicar, reiniciar serviços ou comandar hardware.
4. Se outro agente estiver trabalhando, combine a passagem antes de alterar os mesmos arquivos.

## Registrar contexto é parte da tarefa

Atualize `docs/CONTEXTO-DESENVOLVIMENTO.md` após blocos relevantes de trabalho e **antes de encerrar, pausar ou passar a tarefa**, inclusive quando ela estiver incompleta ou perto de acabar o orçamento de execução.

O registro deve permitir que outro agente continue sem depender da conversa anterior. Informe:

- Objetivo e decisões do usuário que afetam a implementação.
- O que mudou, por quê e quais arquivos foram alterados.
- Testes realmente executados, resultados e limites. Diferencie resultado observado de hipótese e de teste pendente.
- Estado do Git: trabalho não commitado, commit de código, tag, publicação e links dos workflows quando existirem. Não invente o hash do commit que ainda será criado.
- Diferença entre código do repositório, instalador publicado e versão instalada. Documentação posterior à tag não significa mudança do binário.
- Pendências, próximo passo concreto e qualquer autorização ou teste físico ainda necessário.

Mantenha um resumo atual curto e um histórico por data/entrega; preserve os registros anteriores. Se detalhes ficarem extensos, coloque-os em um relatório próprio e faça um link. Corrija entradas antigas com uma nota explícita, sem apagar evidências de falhas relevantes.

## Privacidade e cuidado com o PC

- O contexto versionado é público: não inclua tokens, credenciais, e-mail pessoal, IPs reais, seriais, perfis pessoais, diagnósticos crus ou código de terceiros sem licença/autorização. Detalhes privados ficam em `data/`, ignorada pelo Git, com referência pública apenas quando segura.
- Antes de atualizar o PC real ou pedir UAC, confirme a autorização da sessão atual. Preserve os dados e não reinicie o Windows automaticamente.
- Preserve os checkpoints e backups de recuperação. Não mova/apague suas tags, não altere os arquivos de backup e não use `reset --hard`, limpeza destrutiva ou force push para contornar problemas sem autorização explícita. Recuperações devem primeiro usar uma pasta nova, sem sobrescrever o projeto atual.
- Não reduza proteções, limites ou testes para declarar sucesso. Não declare correção no Echo ou no RGB físico com base apenas em simulação.
- Registre contexto também quando não houver alteração de código: uma investigação, falha, instalação ou teste físico pode mudar o próximo passo.

## Agent skills

### Issue tracker

Issues e especificações ficam no GitHub `JonJonGf/nexus-rgb`. Consulte [a configuração do tracker](docs/agents/issue-tracker.md).

### Domain docs

Contexto único: glossário em `GLOSSARY.md` e decisões em `docs/adr/`, quando existirem. Consulte [as orientações de domínio](docs/agents/domain.md).

### Engineering workflow

- Use `diagnosing-bugs` para construir uma reprodução do sintoma e separar fatos de hipóteses antes de corrigir.
- Use `tdd` nas correções e funcionalidades que precisam de regressão automatizada: observar a falha, implementar o mínimo e verificar o comportamento na interface apropriada.
- Use `codebase-design` quando a organização ou as interfaces do código forem parte do problema; não iniciar refatorações amplas automaticamente.
- Testes de interface devem exercitar o navegador quando o problema for visual/interativo; testes do instalador devem cobrir seu ciclo real em VM quando necessário. Mocks não comprovam comportamento físico.
- Compare desempenho em condições equivalentes e declare o escopo da medição. Quantidade de testes aprovados não substitui reprodução do defeito relatado.
- As instruções atuais do usuário e os cuidados com hardware, dados e publicação acima continuam prevalecendo. O setup das skills não autoriza operações externas ou alterações na instalação real.

### Mapa do código (Graphify)

A skill local está em [.agents/skills/graphify/SKILL.md](.agents/skills/graphify/SKILL.md). Consulte [o guia de uso e limites](docs/agents/graphify.md). Quando existir um mapa atual em `graphify-out/graph.json`, use consultas focadas para se orientar em relações entre módulos; confirme os trechos no código antes de concluir ou editar. Um mapa desatualizado ou uma ligação inferida não é evidência de defeito. Preserve os comandos locais sem API de IA, as exclusões de dados privados e a ausência de hooks/serviços automáticos.

Neste projeto, regenere o mapa com `scripts/update-code-map.ps1`, que preserva a extração original e aplica a camada conservadora de qualidade. Não substitua o mapa principal por uma extração/update direto do Graphify: isso reintroduz inferências por homônimos. Relações não confirmadas ficam em `graphify-out/MAP_AUDIT.json`, e os hashes dos arquivos nesse relatório ajudam a detectar mudanças locais além do commit. O marcador EXTRACTED continua sendo evidência estática, não prova de execução.
