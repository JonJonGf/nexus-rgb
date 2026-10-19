# Live contínuo: desconexão por mistura RGB fora do intervalo

O usuário relatou que segurar o botão e desenhar círculos no Live interrompia o RGB, seguido de recuperação automática. Diagnóstico em 19/10/2026, na instalação de desenvolvimento `1b42f71`, com seis componentes. Evidências privadas em `data/live-continuous-review-20261019/`.

## Reprodução e causa

- O servidor principal permaneceu no mesmo processo observado anteriormente. Um arraste real por Edge headless na instalação, durante 20 s, produziu 157 requisições Live, todas HTTP 200 e nenhuma exceção JavaScript. Das 24 amostras de conexão, 21 registraram interrupção.
- A API registrou `ERR_OUT_OF_RANGE`: cada canal deveria estar entre 0 e 255, mas recebeu valores como 256, 381, 299 e 306. O codificador real de `openrgb-sdk` usa `Buffer.writeUInt8`, que rejeita esses valores. O tratamento da falha encerra a conexão SDK e tenta reconectar. O log protegido do supervisor de hardware não foi acessado; não houve UAC nem evidência suficiente para afirmar reinício do processo OpenRGB. A falha capturada acontece antes de enviar o quadro inválido ao equipamento.
- Reprodução mínima isolada: um LED branco, brilho 100%, dois gestos cianos de aproximadamente meia intensidade sobre ele. A sobreposição soma cores, mas usa a maior opacidade individual; parte do branco ainda é somada. Antes da correção, o teste HTTP → Hardware → **codificador SDK real** recebeu 383 e perdeu a conexão. Isso distingue a falha de excesso de FPS ou uma saturação física do barramento.

## Correção

`server/experiences.js` limita a mistura final dos canais ao intervalo inteiro entre zero e o máximo permitido pelo brilho configurado. Limitar somente as cores da sobreposição não bastava: a base ainda podia ultrapassar o teto ao ser somada. A saturação aplica-se a Live, gravação reproduzida e áudio combinados.

Não muda FPS, proteção da RAM, quantidade de LEDs, recuperação automática, limites HTTP ou tamanho da fila de gestos. Não descarta exceções do transporte nem aumenta limites para ocultar a falha. A correção anterior de retorno do último quadro (`af73392`) permanece incluída na árvore.

## Verificação

- Teste vermelho registrado em `rgb-red.log`; verde com o mesmo caso em `rgb-green.log`.
- Regressão em `tests/experiences.test.js` usa o codificador real e acrescenta gravação de 32 eventos, lotes Live de 16 e áudio com ganho máximo. Confere brilho de 20%, 50% e 100% sem desconexão ou ultrapassar o teto configurado.
- Novo teste `tests/ui/live-transport.spec.js`: navegador segura o botão e desenha círculos; aplicação HTTP, composição, agenda de hardware e codificador reais, com equipamento SDK/HID substituído somente na fronteira externa. Dois módulos RAM sintéticos e uma placa a 60 FPS configurados; nenhuma reconexão. Não equivale a validação física após instalar a correção.
- 57/57 testes afetados e teste de navegador específico passaram. Fechamento conferido: **259/259 gerais** e **4/4 Edge de Experiências/transporte, sem retries**. A última suíte completa anterior da interface teve 50/50; este bloco acrescenta um caso e executa os quatro afetados, sem alegar uma nova execução completa de 51 casos.
- Após o teste na instalação antiga: seis componentes online, sem erro; configurações e todos os efeitos permaneceram exatamente iguais ao backup imediatamente anterior. Não foi restaurado o baseline de outra sessão nem alterada preferência de áudio/mapa do usuário.

## Entrega e limites

Correção ainda local neste checkpoint. PC segue `1b42f71`; nenhuma instalação, reinício manual de serviço, alteração de driver/proteção, push, tag ou Release. A reconexão automática observada foi consequência da reprodução autorizada. Próximo: conferir regressões, criar checkpoint e pacote local; instalar somente com autorização/disponibilidade para UAC, então repetir o mesmo arraste na versão corrigida. Não anunciar correção física concluída com base apenas na simulação.
