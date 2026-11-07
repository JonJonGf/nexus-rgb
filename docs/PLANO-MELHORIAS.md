# Plano atual — revisão de 07/11/2026

Este é o índice atual. [Propostas e evidências anteriores](HISTORICO-PLANO-MELHORIAS-2026-10-30.md) foram preservadas; rótulos antigos “pendente” não devem iniciar implementações repetidas. [Git/instalação](CONTEXTO-DESENVOLVIMENTO.md).

## Entrega atual: oficial 1.0.0

Usuário autorizou concluir pendências e publicar a 1.0.0. [Relatório com evidências e limites](validation/2026-11-07-stable-1.0.md).

| Pendência da entrega | Estado |
| --- | --- |
| Sobreposição do mapa no telefone | Corrigida com reprodução anterior; rolagem, oito abas, toque e PT/EN verificados no Edge. |
| Timeout de importação durante inicialização do worker | Bootstrap confiável separado da validação do efeito; processo lento válido e processo que nunca inicia exercitados pelo worker real. |
| Recuperação parcial de OpenRGB travado | Canal autenticado existente e supervisor próprio, observação sustentada, cooldown e orçamento em duas camadas; IPC e processos reais em fixture aprovados. |
| Ventilação no instalador oficial estável | Política 1+ com versão/tag/marcador/commit conferidos; opcional e experimental por hardware. |
| Migração alpha.44 para 1.0.0 | Cenário da VM padrão preparado com pacote oficial fixado por hash e curvas de dois sensores; execução ainda pendente. |
| Publicação 1.0.0 | Candidata passou 331 gerais/79 Edge; estabilidade, build completo e gates remotos em andamento. |

Certificado de assinatura, matriz física ampliada, novos protocolos e piloto Tailwind são trabalho posterior com dependências próprias. Os detalhes históricos abaixo ficam subordinados a este estado atual.

## Pedido atual: ventilação conjunta

Implementado na main em `codex/cooling-linked-sensors`: curva opcional para os canais selecionados, até oito fontes seguindo a maior temperatura, configurações individuais preservadas e prévia recolhível de perfis sem comandos. Seleção de canal permanece explícita; nenhuma associação de RPM é adivinhada. Testes/limites/envio no [relatório](validation/2026-11-02-cooling-linked.md). **Alpha.44 publicada** após segurança e duas VMs, com cinco assets verificados. [Publicação e limites](validation/2026-11-02-alpha44.md). Usuário pediu instalação posterior e recebeu candidata de desenvolvimento; revisão posterior **c0dcfcd instalada**, com cartões reorganizados e temperatura por fonte. Ajustes preservados; vínculo não foi alterado pela atualização. [Correção visual](validation/2026-11-02-cooling-layout.md).

## Próxima atualização: sobreposição no celular

Adiado explicitamente pelo usuário durante a revisão dos cartões de ventilação. Na captura do Mapa do setup, a prévia cobre parte de Ajustar efeito/Trocar efeito e a área inferior encobre controles/conteúdo perto do painel Componente/Efeito. Reproduzir em navegador móvel/viewport estreito com efeito ativo, conferir altura/scroll/camadas e área segura da navegação inferior. Corrigir layout e cobrir interação por toque, sem reduzir o mapa nem esconder ações essenciais apenas para passar teste. Causa ainda não investigada; captura do usuário é evidência visual, não prova de um seletor CSS específico. Não foi incluído na alpha.44. Corrigido na candidata 1.0.0 conforme a tabela atual.

## Manutenção com menos contexto

Organizar responsabilidades, compartilhar regras e documentar interfaces para ler menos arquivos por atualização. A revisão inicial ficou em `codex/architecture-review`; depois o usuário autorizou implementar melhorias e publicar a alpha.43 em `codex/alpha43-improvements`. Alpha.43 publicada após CI/CodeQL/dois ciclos Windows; instalação real continua separada. Menos linhas não é o objetivo: fonte comprimido pode dificultar manutenção.

| Ordem | Entrega | Estado / critério |
| --- | --- | --- |
| 1 | Contexto curto, plano atual e índice de módulos/testes | Entregue na alpha.43, histórico preservado e links conferidos. |
| 2 | Configuração de ventilação separada da execução; curva compartilhada | Entregue na alpha.43; equivalência calculada, HTTP/Edge e ciclo de instalação validados. Retomada física após boot ainda requer observação. |
| 3 | Separar política e configuração da composição HTTP | Alpha.43: acesso/reconexão/rede em módulos próprios; autenticação/CSRF/limites ficam centrais. Extração adicional de grupos de rotas continua incremental. |
| 4 | Separar transporte, topologia e agendamento RGB | Alpha.43 extrai interpretação de capacidades/modos e elimina notificações descartadas. Agendamento/topologia continuam preservados; não reescrever todos os transportes de uma vez. |
| 5 | Separar editor, desenho e conexão de prévia do Studio | Alpha.43 extrai EventSource com geração e corrige reconexão obsoleta; editor/desenho continuam próximos do estado compartilhado para evitar duplicação. |
| 6 | Consolidar estilos e contratos dos módulos | Inventariar repetições reais. CSS já tem variáveis/classes comuns; documentar invariantes, não cada linha. |
| 7 | Tailwind | Avaliado, sem adoção automática. [Decisão](adr/0001-maintenance-and-styles.md): piloto real precisa justificar migração. |

Cada lote deve ser revisável em commit próprio. Não reescrever tudo de uma vez nem criar módulos que apenas repassam chamadas. Usar [mapa de tarefas](ARCHITECTURE.md) e contratos existentes. A branch protege a main; código executado nela pode afetar hardware se apontado à instalação real. Usar fixtures independentes.

## Recursos ainda não concluídos

| Recurso | Estado confirmado / próximo passo |
| --- | --- |
| Três modos de acesso LAN | Entregues na alpha.43: aberto, link autorizado compartilhado revogável/renovável e somente PC; revogação de streams e Alexa independente. Não há revogação por telefone individual. [Guia](ACESSO-LAN.md). |
| “Reconectar dispositivo” | Entregue na alpha.43 com origem/destino explícitos, revisão temporária, conflitos/faixas bloqueados, backup e transferência de referências. Modos internos/contagem ARGB não são adivinhados. [Guia](RECONECTAR-DISPOSITIVO.md). |
| Novos adaptadores de teclado/ventilação | OpenRGB genérico e nativo RK61 já existem; LampArray/protocolos adicionais não são suporte universal. Exigir capacidades, identidade, retorno seguro e teste por modelo. |
| Recuperação autônoma de controlador travado | Implementada na candidata 1.0.0 com canal autenticado existente, observação sustentada, limite de tentativas e exclusão mútua com resume/stop. Fixtures aprovadas; validação física ampliada continua separada. |
| Ensaios físicos adicionais | Transições em outros controladores, WLED, áudio/contexto em outras sessões e novos dispositivos precisam de observação. Recurso implementado com teste sintético não vira recurso ausente. |
| Boot real das fans | Candidata de desenvolvimento c0dcfcd instalada a pedido; três associações retomadas após reinício de serviços. Falta observação em boot real. Não reiniciar PC para encerrar esta revisão. |

As duas primeiras entregas estão publicadas na alpha.43; foram mantidas nesta tabela para localizar seus limites. Ensaios físicos e novos protocolos dependentes de dispositivo/empacotamento não podem ser declarados concluídos com simulações. Recuperação autônoma de processo elevado permanece uma ampliação separada; não reduzir validações/privilégios para encaixá-la nesta publicação.

## Entregue: não refazer como pendência

- Alpha.21/23: descoberta gradual, economia com RGB apagado, encerramento, exclusões visíveis, interface LAN, limites separados, vagas de prévia e API fora do Service Worker.
- Alpha.24–26: desfazer/refazer, recuperação de efeitos, diagnóstico revisável e transições; limites físicos continuam explícitos.
- Alpha.38–40: edição JSON/HTML de perfis espaciais, zonas agrupadas e backend headless fixado. Orientação de primeiro uso ARGB veio depois.
- Alpha.41: ventilação opcional, Linear/Suave, três perfis próprios, identificação manual e guias PT/EN.
- Alpha.42: retomada da curva aplicada/ativação; Desligar cancela retomada sem apagar curvas.
- A02–A17 tiveram [correções registradas](validation/2026-10-19-correcoes-auditoria.md). S01 teve [correção posterior](validation/2026-10-19-conflitos-windows.md). Não reabrir apenas ao ler relatório anterior à correção.

## Retirado das pendências ativas

- **RGB da RX 7600 e aviso de resposta da Alexa:** usuário pediu esquecer esses problemas em 30/10. Histórico preservado, sem investigação prometida; integrações atuais permanecem.
- **Steck/Tuya:** suspensa pelo usuário por não oferecer a simplicidade desejada. WLED é independente. Não reabrir conta/chave local automaticamente.

## Validação e documentação

Testes direcionados por lote, suíte ampla quando a integração justificar; navegador real para interação/visual, VM quando mudar ciclo do instalador. Documentar responsabilidades, invariantes, comandos e limites. Não prometer economia exata de tokens sem tarefas equivalentes; contagem de linhas não mede clareza.
