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
- Navegador Edge na instalação real acessou a interface LAN em largura móvel: toque Live aceito por HTTP e abas Live/Cenas/Room/Som em PT/EN sem overflow horizontal ou exceções JS. Não é teste de um telefone físico.

## Fechamento e pacote

- Correção commitada localmente em **`af73392872dedf9d2737ee2e7748b6b0aec059e3`**. Build de desenvolvimento passou; pacote identificou esse commit, sem tag. Comparados 62 arquivos de servidor/interface byte a byte; smoke HTTP do código empacotado passou para identidade, assets, cena e backup. Auditoria npm de produção não encontrou vulnerabilidades conhecidas na consulta; payload sem WinRing. Isso não garante ausência de toda vulnerabilidade.
- Setup SHA-256 **`4026ee0afd8dd874e447d7424447dbb5ee2da57edf1720333284a8867d7d8af6`**; desinstalador **`74fa86475daea35dc02b014123501e2ac1f8ffa961e1655b9f950044c90fb584`**. Cópias congeladas e metadados coerentes em `data/experiences-autotest-20261019/candidate-af73392/`. O manifesto superior de `dist/` era um resíduo de build antigo: foi regenerado com a identidade do payload e hashes atuais antes de congelar. `build.ps1` gera as somas locais; o manifesto superior é produzido separadamente nos workflows/checkpoints. Não copiar um manifesto antigo para uma candidata nova.
- Observação final da **instalação anterior `1b42f71`**, com o mapa original a 60 FPS: 13 amostras ao longo de 62,3 s, seis componentes online e nenhum erro do controlador; configurações/efeitos continuaram exatamente iguais ao backup. Compilação local concorrente, portanto não usar como comparação limpa de desempenho. Recursos acessíveis somaram 304,5–311,3 MiB (serviço de rede, servidor, ponte HID e worker do efeito); duas diferenças válidas de CPU deram 0,7–0,8% da máquina. Leitura **parcial**: não inclui OpenRGB, bandeja nem navegador inacessíveis ao coletor. Não é consumo total do produto nem ensaio prolongado.
- Nenhuma instalação desta correção, UAC, reinício de serviço, push, tag ou Release neste bloco. PC continua `1b42f71`; Release pública permanece alpha.37. Documentação de fechamento posterior ao commit do pacote não altera o binário. Próximo passo, quando autorizado: atualizar com o instalador conferido e repetir desativação de áudio no transporte real. Não reutilizar o helper antigo fixado no hash de `1b42f71`.
- **Estado posterior à restauração:** a conferência final detectou novas alterações no painel depois das comparações exatas já aprovadas: movimento Arco-íris, mapa pausado e áudio habilitado. A origem dessas mudanças não foi rastreada; não houve tentativa de reverter sobre esse estado mais recente. Os 36 efeitos permanecem iguais, seis componentes continuam online e sem erro. `final-verification.json` distingue a restauração anterior do estado posterior preservado. Portanto, “opções desativadas” descreve o término do roteiro controlado, não a preferência atual após essas mudanças.

Não há WLED cadastrado neste PC. Não foi possível comandar/observar autonomamente o Echo físico. Protocolo simulado não comprova resposta de voz, nem UDP recebido comprova aparência de uma controladora WLED real. A aparência dos LEDs, a percepção musical e a compatibilidade com outros dispositivos de áudio permanecem testes físicos pendentes.
