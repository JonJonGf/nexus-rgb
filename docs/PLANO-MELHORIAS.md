# Plano atual — revisão de 30/10/2026

Este é o índice atual. [Propostas e evidências anteriores](HISTORICO-PLANO-MELHORIAS-2026-10-30.md) foram preservadas; rótulos antigos “pendente” não devem iniciar implementações repetidas. [Git/instalação](CONTEXTO-DESENVOLVIMENTO.md).

## Manutenção com menos contexto

Organizar responsabilidades, compartilhar regras e documentar interfaces para ler menos arquivos por atualização. Branch `codex/architecture-review`; sem merge, release ou instalação automáticos. Menos linhas não é o objetivo: fonte comprimido pode dificultar manutenção.

| Ordem | Entrega | Estado / critério |
| --- | --- | --- |
| 1 | Contexto curto, plano atual e índice de módulos/testes | Nesta branch; preservar histórico e conferir links. |
| 2 | Configuração de ventilação separada da execução; curva compartilhada | Primeiro lote nesta branch. Preservar HTTP/Edge, retomada, segurança e visual. |
| 3 | Grupos de rotas separados da composição HTTP | Planejado. Autorização/CSRF/limites permanecem centrais; começar por uma família real, sem criar framework próprio. |
| 4 | Separar transporte, topologia e agendamento RGB | Planejado em lotes; preservar RAM, gerações, ACK, desligamento e fallback. Medir antes de alegar ganho. |
| 5 | Separar editor, desenho e conexão de prévia do Studio | Planejado. Estado/revisão/desfazer continuam únicos; verificar PT/EN/celular no navegador. |
| 6 | Consolidar estilos e contratos dos módulos | Inventariar repetições reais. CSS já tem variáveis/classes comuns; documentar invariantes, não cada linha. |
| 7 | Tailwind | Avaliado, sem adoção automática. [Decisão](adr/0001-maintenance-and-styles.md): piloto real precisa justificar migração. |

Cada lote deve ser revisável em commit próprio. Não reescrever tudo de uma vez nem criar módulos que apenas repassam chamadas. Usar [mapa de tarefas](ARCHITECTURE.md) e contratos existentes. A branch protege a main; código executado nela pode afetar hardware se apontado à instalação real. Usar fixtures independentes.

## Recursos ainda não concluídos

| Recurso | Estado confirmado / próximo passo |
| --- | --- |
| Três modos de acesso LAN | `security.js` concede acesso não administrador à mesma sub-rede. Falta “somente PC” e link autorizado revogável/renovável. QR atual entrega URL, não autorização individual. Definir sessões, revogação de streams e ponte Alexa antes de implementar. |
| “Reconectar dispositivo” | Falta migração revisável entre IDs distintos; reconexão de transporte já existe. Projetar origem/destino com prévia, sem adivinhar por nome/LEDs. |
| Novos adaptadores de teclado/ventilação | OpenRGB genérico e nativo RK61 já existem; LampArray/protocolos adicionais não são suporte universal. Exigir capacidades, identidade, retorno seguro e teste por modelo. |
| Recuperação autônoma de controlador travado | Reconexão, supervisor e renovação ao retomar Windows já existem. Proposta de recuperação da indisponibilidade parcial não está integralmente entregue; revisar cenários/orçamento/exclusão mútua antes de ampliar privilégios. |
| Ensaios físicos adicionais | Transições em outros controladores, WLED, áudio/contexto em outras sessões e novos dispositivos precisam de observação. Recurso implementado com teste sintético não vira recurso ausente. |
| Boot real das fans | Alpha.42 instalada; falta observar no próximo início depois de aplicar uma vez. Não reiniciar PC para encerrar esta revisão. |

Estes itens são backlog, não autorização para implementar todos nesta rodada.

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
