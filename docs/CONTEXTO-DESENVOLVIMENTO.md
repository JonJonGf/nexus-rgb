# Contexto atual — 30/10/2026

Leia este resumo e o [plano atual](PLANO-MELHORIAS.md). Use o [índice do código](ARCHITECTURE.md) para abrir os módulos do pedido. [AGENTS.md](../AGENTS.md) continua obrigatório.

## Trabalho ativo: manutenção com menos contexto

- Usuário pediu revisar pendências, avaliar Tailwind e organizar código/documentação para reduzir trabalho e tokens futuros. Autorizou branch separada no GitHub; não pediu instalar esta revisão nem publicar nova alpha.
- Branch `codex/architecture-review`, base local `54b99ad` (documentação posterior à alpha.42); origin/main conferida em `de5573a` ao começar. Não mover tags, sobrescrever checkpoints ou mesclar automaticamente na main.
- **Decisão nova:** problema da RX 7600 e aviso de resposta da Alexa retirados das pendências ativas por pedido explícito. Histórico e funcionamento atual preservados. Steck/Tuya já estava suspensa; não retomar automaticamente.
- Os dois documentos de entrada antigos somavam 49.300 palavras por espaços. Histórico integral separado nos links abaixo; somente dois links de âncoras do contexto foram redirecionados ao plano arquivado. Não apagar evidências de falhas antigas.
- Primeiro lote: `server/cooling-config.js` concentra presets/validação sem I/O; `public/cooling-model.js` compartilha curva Linear/Suave entre gráfico e servidor; `server/cooling.js` conserva execução/segurança/retomada. Asset/script registrado em `server/index.js`/`public/index.html`. Sem dependência nova.
- Tailwind avaliado em fontes oficiais: manter CSS atual nesta rodada. Piloto futuro deve provar vantagem antes de migrar. [Decisão](adr/0001-maintenance-and-styles.md).
- Validação final local: **305 gerais e 68 Edge sem retries**, 28 HTTP direcionados e equivalência de 20 mil valores/2 mil gráficos. Primeira suíte Edge 67/68 teve erro de encerramento de interceptação; dez repetições isoladas passaram antes do ajuste. Teste agora aguarda handlers sem ignorar erros. Falha inicial preservada no relatório; nenhum teste físico alegado.
- Código commit `50895d8` e ajuste de encerramento do teste `259f554`. Documentação de fechamento vem depois, na mesma branch. Destino remoto é **somente `codex/architecture-review`**, sem merge/tag/release/instalação; confirmar HEAD/envio no Git. Main e PC permanecem alpha.42.
- Histórico preservado e 135 referências locais conferidas. Mapa atualizado: 1.153 nós/2.157 relações/88 comunidades. Próximo lote proposto: extrair uma família de rotas HTTP preservando os controles centrais, conforme plano. Não implementar automaticamente outros recursos do backlog.
- Branch enviada e conferida no remoto em `7affcce`; main permaneceu `de5573a`. [CI 41139571912](https://github.com/JonJonGf/nexus-rgb/actions/runs/41139571912) iniciou para esse commit; resultado remoto ainda pendente nesta nota. Fechamento documental posterior não muda runtime/testes locais. Documentos de entrada terminaram em ~10,5 mil caracteres, cerca de 97% menores.

## Versão publicada e instalada

- [Alpha.42](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.42), runtime/tag `8fc5d48ba592464b1b00b74c50b83f0a32244754`, development false. Main recebeu depois somente documentação. [Publicação/VMs](https://github.com/JonJonGf/nexus-rgb/actions/runs/41098984384); resposta de status atrasada foi conferida contra logs finais e assets.
- Setup oficial: 87.418.937 bytes; SHA256 `d4a630c9064629211d353f4f3d701897312216c2bd86a817f4406af976913f38`. Cinco assets conferidos contra digests, BUILD-INFO e SHA256SUMS.
- Instalada com autorização nesta sessão: código 0, dois serviços Running, bandeja interativa e painel pronto com seis componentes. Configurações de ventilação/iluminação/rede e 38 efeitos preservados. Windows não reiniciado, PawnIO não instalado.
- Retomada das fans salva somente após aplicação bem-sucedida; legado exige aplicar/ativar uma vez. Falta observação no próximo início normal. Sem prova física de reboot/RPM. Alpha.42: 305 gerais/68 Edge e três processos distintos com backend sintético.

## Invariantes e cuidados

- RAM SMBus limitada a 20 FPS; preservar filas limitadas, gerações, ACK, desligamento, perfis, efeitos, exclusões e mapas. SDK conectado não comprova cor física. Não adivinhar identidade nem habilitar protocolos experimentais por marca.
- Testes HTTP/navegador/IPC conforme área; mocks não comprovam hardware. Medir desempenho com cenários equivalentes e sem testes concorrentes.
- Sem hardware, restart de serviços, instalação/UAC ou release por causa de uma refatoração. Confirmar autorização atual antes de atualizar o PC.
- Dados privados em `data/`, ignorada; nada de credenciais/identificadores pessoais no contexto público. Mapa só com `scripts/update-code-map.ps1`.

## Consultar conforme o assunto

| Assunto | Documento |
| --- | --- |
| Módulos, contratos e testes | [Arquitetura](ARCHITECTURE.md) |
| Pendências e sequência | [Plano atual](PLANO-MELHORIAS.md) |
| Esta revisão, números e limites | [Manutenção](validation/2026-10-30-maintainability.md) |
| Ventilação/startup alpha.42 | [Retomada](validation/2026-10-30-cooling-startup.md) |
| Capacidades de hardware | [Compatibilidade](COMPATIBILIDADE.md) |
| Build/publicação | [Desenvolvimento](DESENVOLVIMENTO.md) |
| Histórico anterior integral | [Desenvolvimento até 30/10](HISTORICO-DESENVOLVIMENTO-2026-10-30.md) |
| Propostas e achados antigos | [Plano até 30/10](HISTORICO-PLANO-MELHORIAS-2026-10-30.md) |

Ao atualizar: manter decisão, módulos, testes reais, Git/instalação e próximo passo curtos. Detalhes ficam no relatório da entrega. Preservar decisões/evidências anteriores antes de substituir entradas. Notas antigas “local/pendente” não descrevem necessariamente o estado atual.
