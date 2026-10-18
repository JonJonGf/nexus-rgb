# Documentação do domínio

O Nexus RGB usa um contexto único. Esta configuração orienta as skills de engenharia; não muda o aplicativo nem a instalação.

## Leitura e continuidade

Antes de explorar uma área, leia [AGENTS.md](../../AGENTS.md), [o contexto de desenvolvimento](../CONTEXTO-DESENVOLVIMENTO.md) e [o plano de melhorias](../PLANO-MELHORIAS.md).

Consulte `GLOSSARY.md` na raiz e as decisões relevantes em `docs/adr/` quando existirem. Se não existirem, prossiga com os documentos atuais: não crie arquivos vazios apenas para cumprir uma estrutura. Registre novos termos ou decisões duradouras quando forem efetivamente definidos durante o trabalho.

Preserve o vocabulário e as decisões existentes. Se uma proposta contrariar uma decisão anterior, explicite o conflito e a evidência que justifica reavaliá-la, sem substituir silenciosamente o registro.

## Evidência e comunicação

- Diferencie teste simulado, resultado físico relatado ou observado, hipótese e pendência.
- Diferencie código atual, tag/release publicada e versão instalada.
- Use linguagem simples nas explicações ao usuário. Resolva escolhas rotineiras dentro do escopo autorizado; peça informações quando uma decisão relevante depender delas.
- Respeite a limitação de cadência da RAM já adotada e as demais decisões de hardware documentadas; não retome testes físicos automaticamente.
- Skills complementam as regras do projeto e as instruções do usuário. Não autorizam reinstalação, UAC, publicação ou alterações nas proteções do Windows.

## Skills configuradas

Foram instaladas no ambiente do usuário `setup-matt-pocock-skills`, `diagnosing-bugs`, `tdd` e `codebase-design`, provenientes de [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336). A instalação local dessas skills não é uma dependência de execução do Nexus nem é incluída no instalador do produto.

Outro agente ou computador deve instalar as skills compatíveis no próprio ambiente para invocá-las; os documentos deste projeto continuam legíveis independentemente dessa instalação.
