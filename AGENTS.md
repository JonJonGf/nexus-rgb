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
- Não reduza proteções, limites ou testes para declarar sucesso. Não declare correção no Echo ou no RGB físico com base apenas em simulação.
- Registre contexto também quando não houver alteração de código: uma investigação, falha, instalação ou teste físico pode mudar o próximo passo.
