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

**Checkpoint anterior à instalação:** o PC ainda executava `1b42f71`; helper privado preparado, aguardando autorização, sem UAC ou reinício manual naquela investigação. A reconexão automática observada foi consequência da reprodução autorizada. Esse estado foi superado pela atualização abaixo; preservar a distinção entre as duas etapas.

## Atualização autorizada e teste no transporte real

O usuário confirmou estar conectado e autorizou abrir a atualização. O helper verificou novamente a integridade do Setup e exportou backup novo imediatamente antes. O instalador mostrou progresso e reiniciou somente os serviços Nexus/OpenRGB. Log fechado em 19/10 às **20h43min15s, Brasília**; sem reinício do Windows e com PawnIO desmarcado. O helper usa `ShellExecute` e não capturou o código de saída: não registrar um código presumido. Houve um intervalo normal com a API indisponível e ambos os serviços parados enquanto a instalação concluía; não foi iniciado um segundo instalador nem feito reinício corretivo.

- API identifica o commit **`298761094514a7e7b434c21d5f689879bab16db4`**, `development: true`, `tag: null`.
- Serviços NexusRGB e NexusRGBHardware ativos; bandeja na sessão interativa; seis componentes online, detecção encerrada e nenhum erro reportado.
- **180 arquivos instalados** comparados com o payload, sem divergências. Ajustes, **11 perfis e 36 efeitos** exportados antes/depois exatamente iguais.
- Mesmo roteiro do navegador na instalação real, segurando o botão e desenhando círculos por **20 s**: **161 requisições HTTP 200, 24 amostras de conexão saudáveis, nenhuma interrupção observada e zero exceções JavaScript**. O roteiro anterior, com 157 requisições, teve 21/24 amostras interrompidas com `ERR_OUT_OF_RANGE`.
- Configurações e efeitos continuaram iguais ao terminar o teste. Evidências privadas em `approved-install-launch.json`, `approved-install-verification.json`, `installed-payload-verification.json`, `post-install-reproduction-private.json`, screenshots e log do instalador na pasta desta investigação.

O teste confirma que o erro de codificação reproduzido deixou de ocorrer no transporte real neste intervalo. Não observa fisicamente as cores nem comprova estabilidade por horas. A correção anterior de retorno do áudio foi instalada junto, mas seu teste físico específico não foi repetido nesta etapa. Não houve publicação no GitHub: Release pública permanece alpha.37, enquanto este PC executa a candidata local indicada acima. Documentação posterior não altera o instalador congelado.
