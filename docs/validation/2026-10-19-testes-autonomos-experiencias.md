# Testes autônomos de Experiências — 19/10/2026

O usuário autorizou testar os recursos sem acompanhamento, incluindo mudanças temporárias nos LEDs. A instalação examinada executa `1b42f71`, desenvolvimento/sem tag. Nenhum serviço foi reiniciado, nenhum driver instalado e nenhuma proteção alterada neste bloco. Evidências e dados pessoais ficam somente em `data/experiences-autotest-20261019/`, ignorada pelo Git.

## Instalação real

O roteiro usa HTTP autenticado e o stream de saída do Studio. Os bytes desse stream correspondem aos quadros aceitos pelo transporte; não são uma leitura física das cores. Os comandos foram enviados ao hardware real, preservando a cadência segura da RAM e os modos internos do teclado.

Passaram:

- Arco-íris → Estático nas duas RAMs, com o quadro completo final chegando à saída em aproximadamente 251 ms na segunda rodada.
- Gesto Live na posição de LEDs do mapa, expiração e retorno ao estático.
- Peça desligada permanecendo apagada durante o gesto.
- Gravação de gesto, reprodução e expiração.
- Cena de duas etapas, ordem das cores e retorno à configuração anterior.
- Comando manual cancelando a cena.
- Energia geral desligada seguida de acionamento de uma única peça, mantendo a outra RAM apagada.
- Perfil por aplicativo acionado pela **bandeja instalada**, usando o executável em primeiro plano; mudança manual prevaleceu mesmo após nova confirmação da bandeja. Nome do aplicativo mantido privado.
- Duas observações curtas de aproximadamente 33 s, com todos os seis componentes online e sem erro do controlador. Não equivalem a estabilidade por horas.
- Restauração exata das configurações e dos 36 efeitos, comparados com o backup imediatamente anterior. Perfis, mapa, cores, potência e opções retornaram ao original; cenas/gravações/perfil de teste foram removidos. Áudio e contexto originalmente desativados foram restaurados.

## Defeito encontrado e correção local

A bandeja real abriu a captura WASAPI. Um tom sintético baixo de dois segundos provocou saída RGB; o volume do Windows não foi alterado e nenhuma amostra capturada foi gravada. Entretanto, **desabilitar áudio deixou a última cor musical em alguns componentes**: a configuração persistida continuava estática e seu identificador não mudou, portanto a marcação de trabalho pendente não bastava para enviar o quadro base.

Reprodução isolada usa as mesmas rotas HTTP e o adaptador SDK, sem hardware físico: preto → banda média verde → desabilitar áudio. Antes da correção, o último quadro permaneceu verde em vez de preto (`audio-red.log`). Em `server/hardware.js`, o estado de sobreposição agora participa da assinatura de saída; sua passagem para inativo também permite um último tick após suspensão/atraso. Não altera o brilho salvo, não grava a cada quadro, não relaxa a cadência da RAM e retorna ao repouso depois do quadro final.

A regressão em `tests/experiences.test.js` cobre desativação de áudio, parada explícita de gesto, expiração sem ticks intermediários e ausência de reenvios em repouso. Verde específico observado. **Esta correção ainda não está na instalação `1b42f71`**; não afirmar validação física da correção sem atualizar e repetir o roteiro.

## Backup completo e limites de validação

A revisão do backup com todos os efeitos antigos recusou um importado com a mensagem “O efeito excedeu o orçamento de desenho”. Nenhum limite foi ampliado e o conteúdo não foi removido. Para restaurar o estado do teste, a revisão recebeu os mesmos ajustes e somente os seis importados referenciados pelo mapa/perfis. O restaurador preserva por projeto os demais arquivos já existentes. Comparação posterior confirmou igualdade de **todos** os ajustes e efeitos com a exportação inicial.

Isso confirma a preservação neste procedimento, **não** confirma que o backup completo com os 36 importados seja atualmente restaurável. Investigar a compatibilidade do importado recusado em armazenamento isolado antes de prometer recuperação completa; não ignorar erros de validação nem executar código importado fora do worker limitado.

## Roteiro e verificações automatizadas

A primeira rodada também teve dois erros do próprio roteiro: envio de `followMap` junto de `power` e tentativa de atualizar áudio sem todos os seus campos. A API corretamente respondeu 400. O roteiro foi corrigido e os passos repetidos; esses erros não são defeitos do produto. Resultados iniciais foram preservados em `initial-results.json`.

- 14 testes específicos de Experiências/Room/ponte nativa e três de Edge passaram antes da correção.
- Oito testes de backup e recuperação de configuração/quarentena passaram em armazenamento isolado, sem provocar falha no controlador real.
- Após a correção: **258/258 testes gerais aprovados**, sem skips. A suíte inclui protocolo Hue e transporte WLED HTTP/DDP com receptores locais.
- Suíte completa **50/50 Edge aprovada, sem retries**, incluindo PT/EN, largura móvel, mapa, calibração, editor, recuperação e novos recursos. Os testes usam armazenamento isolado; não simulam cor física.

Não há WLED cadastrado neste PC. Não foi possível comandar/observar autonomamente o Echo físico. Protocolo simulado não comprova resposta de voz, nem UDP recebido comprova aparência de uma controladora WLED real. A aparência dos LEDs, a percepção musical e a compatibilidade com outros dispositivos de áudio permanecem testes físicos pendentes.
