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

Correção commitada localmente em **`298761094514a7e7b434c21d5f689879bab16db4`**. Build de desenvolvimento aprovado, sem tag e sem nova dependência. Comparação de 62 arquivos de servidor/interface e smoke HTTP do payload passaram; identidade, assets, cena e backup conferidos. Auditoria npm de produção sem vulnerabilidades conhecidas na consulta; payload sem WinRing.

Checkpoint preservado em `data/live-continuous-review-20261019/candidate-2987610/`. Setup SHA-256 **`f7c6dfb8889420833c0d0ad4f32d8bed0894251bbe5a4f38261ee60b60a10c47`**; desinstalador **`4feac5e898cf26f464cd6f9fbf0dcf2436acd2f0001d57311ed7658be4f0df2b`**. Manifesto superior regenerado com a identidade/hashes atuais. A candidata inclui também o retorno de quadro após desativar áudio da correção anterior.

PC segue `1b42f71`; nenhuma instalação, reinício manual de serviço, alteração de driver/proteção, push, tag ou Release. A reconexão automática observada foi consequência da reprodução autorizada. Helper privado de instalação preparado, **não executado**: exige aprovação explícita, confere o hash e exporta backup novo imediatamente antes. Mantém progresso visível, não instala PawnIO e não reinicia o Windows. Próximo: instalar somente com autorização/disponibilidade para UAC, então repetir o mesmo arraste na versão corrigida. Não anunciar correção física concluída com base apenas na simulação.
