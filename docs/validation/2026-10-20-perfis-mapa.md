# Edição de perfis espaciais — 20/10/2026

## Defeito reproduzido

Um perfil salvo do mapa abria o editor comum de sequência e mostrava a paleta do controle geral anterior. O cartão também usava esses dados. A API não permitia atualizar o efeito espacial mantendo o perfil. Isso explica a apresentação de cores de outro perfil; não comprova corrupção do código original do efeito.

Reprodução anterior à correção: teste Edge encontrou o campo de movimento comum visível; requisição de edição espacial retornou HTTP 400. Fixtures isoladas, sem comandos ao RGB físico.

## Resultado

- Cartões usam resumo do efeito referenciado. O editor distingue sequência e efeito do mapa e apresenta os parâmetros salvos.
- **Editar código** abre JSON/HTML em editor com prévia temporária. Parâmetros HTML salvos compatíveis são preservados; código e valores são validados antes do salvamento.
- Salvar mantém a iluminação atual. Ativação é explícita. Alterar código cria versão de efeito independente, mantendo o original e outros perfis que o referenciam.
- Energia individual, exclusões e brilho são preservados. Converter perfil espacial para sequência exige intenção explícita também na API, protegendo contra clientes antigos.
- Código completo acessível somente ao administrador local quando abre o editor; não acompanha snapshots recorrentes. Importações continuam limitadas e usam o orçamento de operações pesadas.
- Título principal do navegador: **Nexus RGB**, em português e inglês. README e ajuda atualizados.

## Verificação executada

- `npm.cmd test`: **263/263**, zero falhas.
- `npx.cmd playwright test --retries=0`: **56/56**, zero falhas, Edge real. Quatro regressões novas cobrem criação espacial, edição JSON/HTML, prévia, reabertura, salvamento sem ativar, original/cópias preservados e ativação no mapa. Incluem largura de celular e título em PT/EN.
- Depois do ajuste final do orçamento de criação e texto da ajuda: **7/7** testes API/prévia e **1/1** teste Edge da apresentação/ajuda.
- `git diff --check`: aprovado.

Logs completos ficam em `data/profile-map-*.log`, privados. Sem nova medição de consumo, teste prolongado de hardware ou validação visual dos LEDs. O ciclo completo do instalador em VM não foi repetido: não houve alteração de instalador/serviços nesta entrega. Compilação e eventual atualização local devem ser registradas no contexto, distinguindo candidata local da Release alpha.38 pública. Código local ainda sem novo commit/tag/publicação ao preparar este relatório.
