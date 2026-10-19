# Correções da auditoria de 19/10/2026

Implementação autorizada após a [revisão integral](2026-10-19-revisao-integral.md), na branch `codex/openrgb-incident-alpha37`, base `00625c1`. O usuário autorizou comandos RGB físicos, com aviso antes de instalar/UAC. Neste checkpoint os testes foram isolados e houve somente leitura do estado da instalação; nenhuma atualização ou comando RGB foi executado no PC instalado.

## Resultado por achado

| Achado | Alteração local e regressão observada |
| --- | --- |
| A15 | Recuperação de mapa inválido recusa retry/último funcional com 409 antes de modificar estado; só oferece apagar. Revisão explícita preserva original em arquivo separado. Teste vermelho/verde confirma também o disco. |
| A03 | Remover efeito usado por perfil retorna 409 antes de alterar biblioteca/recuperação. Exportação continua restaurável; após remover perfil, exclusão funciona. |
| A02/A10 | Envio do teclado ocorre antes do bloqueio SDK e seu ACK independe da geração SDK. Regressões cobrem SDK esperando/falhando e confirmação atravessando reconexão com nova cor. |
| A11 | Cor e efeito individuais do teclado precedem o mestre. Regressão verifica bytes azuis/Estático e ausência de streaming em dez ciclos seguintes. |
| A04 | Controles gerais e perfis preservam a preferência atual `syncWithPc`, removendo normalmente personalizações de iluminação do controle geral. Teste inclui reabrir o arquivo salvo. |
| A05 | Perfil criado pelo mapa captura exclusões; reaplicação conserva componente individual desligado/excluído. |
| A06 | Consulta do mapa respeita Linha explicitamente salva em teclado Direct e não modifica dimensões/revisão. Matriz continua padrão de peças novas compatíveis. |
| A14 | Erros do cliente conservam status HTTP; mapa trata 409 por status, independente da mensagem traduzida. Edge reproduziu falha em inglês antes; PT/EN passaram com posição local atualizada e botão de retry oculto. |
| A12 | Leitura de ativação Alexa usa dicionário JSON com chaves sensíveis à caixa, incluindo PowerShell 5.1. Transação com `Speed` e `speed` falhou antes e passou depois, verificando também a porta Alexa. Nenhuma porta real foi alterada. |
| A13 | Coleta de firewall usa variável própria e não substitui portas do inventário. Bloco real executado com adaptadores Windows inertes: vermelho/verde. |
| A16 | Sandbox Canvas acompanha pilha das propriedades suportadas em save/restore e reseta propriedades/pilha ao definir dimensão. Dois exemplos reproduzidos e corrigidos pelo renderer QuickJS real, com cores literais esperadas; não representa compatibilidade irrestrita com todas as APIs Canvas. |
| A17 | Brilho zero permanece zero nos seis encoders afetados e nos adaptadores experimentais do registro. Testes verificam payload, limites e valor padrão. Protocolos não validados continuam bloqueados no hardware real. |
| A07 | Cache somente de geometria/membership por layout e lista raiz detectada; leituras repetidas deixam de reconstruir snapshots completos. Regressão com 64 controladoras cobre ciclo inicial, repouso, edição e redescoberta com mudança na contagem. Energia e exclusões não ficam no cache. |

As quatorze pendências confirmadas receberam correção local. A investigação S01 sobre HKCU/Iluminação Dinâmica sob identidade do serviço **permanece pendente** de validação em contexto Windows apropriado; não foi convertida em alegação de correção. A01/A09 e a simulação SSE corrigidos no checkpoint anterior permanecem cobertos.

## Ajuste solicitado: Neon no teclado

Arco-íris passa a usar o ciclo interno Neon `0x13` do RK61; Onda mantém `0x01`. O teste inicialmente encontrou `0x01` no Arco-íris e depois confirmou os dois comandos distintos e a deduplicação. Não foi ativado streaming por tecla nem presumida taxa/latência interna do firmware. A aparência física ainda precisa ser confirmada após executar o código atualizado.

## Validação e limites

- Primeira suíte após o conjunto principal: **239/239 gerais**, **45/45 Edge** com retries desativados. Após corrigir também o fallback de brilho nos adaptadores, conjunto de controladores **15/15** e suíte geral final **240/240**, sem falhas. Sintaxe das 22 fontes JavaScript novas/alteradas e dos três scripts PowerShell aprovada; links de oitenta documentos e sintaxe bash dos cinco workflows conferidos.
- Teste real isolado do supervisor aprovado; fixture do instalador passou os **12 cenários PT/EN**, incluindo erros e reinício solicitado pelo runtime. Isso não é uma instalação completa em VM nem no PC real.
- Comparação sintética do mapa e dados sanitizados em [Desempenho](../DESEMPENHO.md#custo-de-processamento-do-mapa--19102026). Não houve medição nova de RAM/CPU total nem teste prolongado do barramento físico.
- Evidências e logs privados em `data/audit-20261019-082159/`, fora do Git. Dados pessoais, estado cru e cookies não foram publicados. Análise CodeQL remota anterior não valida este conjunto ainda não enviado.

## Entrega

Alterações de código/documentação ainda não commitadas neste registro inicial. Sem push, tag ou Release. Instalador publicado e PC continuam alpha.37 e não contêm estas correções. Preparar e conferir um pacote de desenvolvimento após os testes; avisar antes da instalação/UAC para permitir que o usuário aceite remotamente. Não reiniciar o Windows ou instalar outro driver. Confirmar resultado físico sem inferi-lo dos mocks ou do HTTP.

**Checkpoint posterior:** código commitado em `5b3e2466fa99a81e5de5c56ba13aa9b5765e1845`, build de desenvolvimento concluído e 159 arquivos conferidos com a fonte. Worker/WASM do pacote importou o exemplo Canvas próprio com hardware desativado; painel respondeu 200. Sem binários WinRing no payload; auditoria de dependências de produção sem vulnerabilidades conhecidas na consulta. Hashes e pasta privada congelada estão no contexto. Sem instalação, UAC, push, tag ou Release neste checkpoint; a documentação posterior não altera o pacote criado.
