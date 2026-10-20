# Revisão antes da próxima publicação — 19/10/2026

Pedido: avaliar o que ainda precisa ser revisto antes de atualizar o GitHub. Esta revisão não autoriza publicar nem modificar a instalação. Código instalado e testado: `2987610`; documentação posterior não muda o binário.

## Resultado

**Ainda há trabalho antes de uma nova Release.** A prioridade funcional é a revisão/restauração de backups com efeitos importados antigos. Depois, concluir a identificação da versão e os gates de CI/VM no commit que será publicado. O código pode ser submetido a CI quando autorizado, distinguindo esse envio de disponibilizar um instalador público.

### 1. Backup completo: falha confirmada em cópia isolada

- A exportação privada com 36 efeitos foi submetida a `/api/backups/review` em servidor novo, armazenamento isolado, hardware e Alexa desativados. Resultado: HTTP 400, “O efeito excedeu o orçamento de desenho”, após 8,732 s.
- A revisão individual, usando ajustes sintéticos, identificou um importado que reproduz sozinho a mesma recusa em 604 ms. Nome, ID e código não são publicados. O arquivo original foi preservado, e **nenhuma restauração** ou alteração no PC real foi executada.
- Isso confirma que não basta ter um arquivo exportado: esse conjunto completo não passou pela revisão atual. A restauração parcial anteriormente validada preservou os arquivos já existentes no mesmo PC, mas não prova uma recuperação completa em instalação limpa.
- Antes da Release: investigar o efeito recusado e apresentar um caminho explícito de recuperação, com identificação do item, revisão das importações e referências de perfis/mapa. Não aumentar o orçamento nem ignorar erros para declarar sucesso; não descartar conteúdo silenciosamente. Esta revisão não implementou essa solução.

### 2. Publicação, versão e instalador

- Consulta somente de leitura ao GitHub confirmou `main` em `1dc5ef05f379c1af7f0998b4994ba0c6f80ff5cf` e Release pública [alpha.37](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.37). CI e CodeQL desse código estavam aprovados; **não analisaram** os commits locais posteriores.
- `node scripts/check-release.cjs v0.1.0-alpha.37` passou: os links atuais continuam coerentes com a versão pública. Isso não aprova uma nova versão. Ainda faltam nota própria e links coerentes com a próxima tag, além de build identificado por essa tag em vez de `development: true`/`tag: null`.
- O workflow existente exige CodeQL atual nos três grupos e ausência de alertas abertos, além de instalação/upgrade/recuperação/remoção/reinstalação nas VMs com portas padrão e alternativas e pasta personalizada. Esses gates precisam concluir no commit/tag novos. Não executar o ciclo destrutivo de VM no PC do usuário, nem reutilizar a aprovação do código anterior.
- A candidata local instalada e os três checkpoints privados permanecem preservados. Nenhum push, criação de tag, dispatch, Release ou substituição de executável público foi realizado nesta revisão.

### 3. Cobertura e estabilidade

- O commit de código atual já teve **259/259 testes gerais** aprovados no bloco Live. Como o código de produto não mudou depois, não se repetiu essa suíte sem necessidade.
- Nesta revisão, **51/51 testes completos de Edge passaram, sem retries**, incluindo o novo arraste contínuo do Live. Isso substitui a pendência da execução completa de 51 casos, que antes tinha somente os quatro afetados reexecutados.
- A instalação real já repetiu 20 s do caso que falhava, sem interrupção nas amostras. Para confiança adicional, acompanhar uso prolongado de gestos/áudio e troca de saída de som; não prometer estabilidade por horas com base nesse intervalo curto.
- WLED físico e cenas novas no Echo físico continuam sem validação neste equipamento. Podem permanecer claramente experimentais e opcionais, sem alegar compatibilidade física confirmada. O desligamento de áudio foi corrigido e instalado, mas o teste físico específico posterior à instalação ainda não foi repetido.

### 4. Documentação, privacidade e apresentação

- README e guia distinguem candidata e alpha.37 corretamente agora; devem ser revistos na publicação para que recursos, notas e downloads pertençam à mesma versão. Explicitar no guia quais configurações exigem sessão local do PC.
- O aviso de Iluminação Dinâmica deve distinguir visualmente consulta indisponível e conflito confirmado. A opção desativada na conta do usuário não resolve uma falha de leitura do serviço. Não esconder a incerteza nem afirmar que a opção está ativa.
- Varredura limitada dos 285 arquivos rastreados, com padrões de tokens GitHub, chaves privadas, caminho pessoal e artefatos privados, não encontrou tokens/chaves nesses padrões nem arquivos de `data/`, `dist/`, `runtime/` ou `vendor/` rastreados. Não equivale a auditoria de todos os tipos de segredo ou de todo o histórico.
- `tests/security.test.js` ainda reutiliza um endereço LAN do ambiente em fixtures antigas. Recomenda-se substituir coerentemente a sub-rede de exemplo antes do próximo envio. Não é uma credencial e não foi tratado como vulnerabilidade de acesso; não reescrever histórico nem apagar checkpoints por causa disso.

Evidências privadas: `data/release-readiness-20261019/github-public-status.json`, `tracked-data-scan.json`, `isolated-backup-review-private.json` e `ui-final.log`. Nenhum diagnóstico ou código importado enviado ao GitHub durante esta revisão.

## Assistência de áudio durante a revisão

O usuário também pediu orientação para “Luz no ritmo do som”. Consulta somente de leitura confirmou captura ativa e componentes espaciais disponíveis; nenhum ajuste foi alterado. Orientação: usar uma base estática preta com energia ligada, ajustar sensibilidade gradualmente, salvar e reproduzir som na saída padrão do mesmo Windows. A análise usa três bandas de energia, não BPM nem microfone; teclado de modos internos não recebe a sobreposição. A consulta não mede intensidade das bandas nem comprova resposta física à música.
