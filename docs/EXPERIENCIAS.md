# Experiências Nexus

Recursos da v0.1.0-alpha.38. A presença deste guia no repositório não atualiza uma instalação antiga. A aba **Experiências** reúne Live, Cenas, Room e Som/contexto. Todos são opcionais; áudio e regras começam desativados. O controle continua local, sem conta externa ou nova dependência npm.

Cenas, WLED, áudio e regras são configurados pelo painel aberto no próprio PC. Pelo celular na LAN, use o Live, salve/reproduza gestos e inicie cenas já criadas.

## Nexus Live

Organize e calibre os componentes no **Mapa do setup**. Em **Experiências → Live**, toque ou arraste na superfície pelo PC ou celular. Escolha uma cor e um gesto: ondulação, rastro ou varredura. As posições e a geometria por LED são as do mapa, incluindo ventoinhas.

**Gravar gestos** inicia uma gravação de até 30 segundos e 256 eventos. Encerre, dê um nome e salve. **Reproduzir** executa os eventos com sua temporização; não é um vídeo nem um programa JavaScript. Uma gravação também pode ser escolhida como etapa de uma cena. Há até 16 gravações e 32 gestos ativos simultâneos; excesso visual antigo é descartado.

Peças desligadas, com brilho zero ou excluídas do mapa não recebem a sobreposição. Teclados que oferecem somente modos internos continuam fora dos efeitos espaciais. Pontos da prévia mostram o último quadro aceito pelo transporte: não há sensor de retorno das cores físicas. O fundo desenhado indica o gesto e não comprova o estado dos LEDs.

## Cenas e foco

Em **Cenas**, dê um nome e adicione etapas de movimento comum, perfil salvo ou gravação. Ajuste duração, transição e repetições. O modelo **Foco e pausa** sugere 25 minutos de luz estática e cinco de respiração. Ele pode ser editado antes de salvar. Limites: 32 cenas, 64 etapas por cena, 99 repetições e 24 horas no total.

**Iniciar** toma o controle temporariamente, sem regravar a iluminação a cada etapa/quadro. Ao terminar, a configuração anterior volta; um comando manual assume o controle imediatamente. A cena não liga peças que estavam apagadas nem modifica exclusões do mapa. **Parar e voltar** encerra cena, reprodução e gestos pendentes; a opção de áudio tem seu próprio interruptor.

Referências a perfis e gravações são protegidas: remova a referência da cena/regra antes de excluir o item. Cenas não são retomadas automaticamente depois de reiniciar o serviço.

Opcionalmente, marque **Expor esta cena como luz opcional na Alexa** e descubra dispositivos no Echo. Acender a luz da cena inicia a execução; apagar a interrompe. A identidade e o comportamento da luz principal são preservados. Isso usa a ponte Hue existente; compatibilidade e resposta de voz ainda precisam de validação no Echo real. Não interpreta comandos livres de linguagem natural.

## Nexus Room / WLED

Use uma controladora com firmware WLED, conectada à mesma rede privada. Em **Room / WLED**, informe nome, IPv4 literal e porta HTTP. **Conferir e adicionar** consulta a identidade e a quantidade de LEDs antes de cadastrar; não procura equipamentos pela Internet nem aceita redirecionamentos/nomes de host.

- **Seguir iluminação e mapa:** integra a peça aos dispositivos e ao mapa. Cores estáticas usam a API JSON sem reenvios idênticos. Efeitos calculados no PC usam DDP em UDP 4048, sem alterar o limite seguro da RAM do computador.
- **Efeito nativo WLED:** informe o ID de efeito ou preset da sua controladora. Ela executa o efeito, reduzindo tráfego e processamento no PC; nessa opção a peça não recebe o mapa espacial. Preset e efeito são locais à WLED, não os nomes de perfis do Nexus.

Até oito controladoras, com até 4.096 LEDs por peça; o mapa mantém seu limite total de 32.768 LEDs. A contagem vem da WLED, não de um modelo fixo. **Editar** permite desativar ou conferir novamente. Remover/encerrar libera o modo ao vivo quando a controladora responde; sem rede, o painel não pode confirmar essa liberação. Repetição de falha usa espera progressiva, sem fila ilimitada de quadros.

UDP não confirma a exibição de um quadro. Latência, perda de pacotes e efeitos nativos com relógios próprios impedem prometer sincronismo físico perfeito. Testes de protocolo com receptor local não substituem validação de firmware/hardware WLED real.

## Som e contexto

### Música

Para destacar a reação musical, experimente Estático com cor preta e energia ligada, sensibilidade baixa e música na saída padrão do mesmo Windows. Depois aumente a sensibilidade gradualmente e clique em **Salvar áudio**. Sensibilidade máxima pode saturar as bandas e esconder variações; este recurso não detecta BPM.

Ative **Reagir ao áudio do Windows**, escolha sensibilidade, cores e eixo das três regiões do mapa. A bandeja analisa a saída padrão usando WASAPI loopback; não usa microfone, não grava som e não envia áudio à Internet. Uma análise leve por filtros gera energia de graves, médios e agudos: não é reconhecimento de músicas nem uma FFT detalhada.

Somente três valores limitados são enviados ao serviço, até oito vezes por segundo. O motor mistura as bandas no mapa e usa os limites normais de saída. Dados antigos desvanecem em até um segundo; perda da ponte não deixa uma banda travada. Fechar a bandeja/desativar a opção encerra a captura. Mudanças de configuração chegam à bandeja na consulta de até cinco segundos; o estado da captura aparece na aba.

A bandeja precisa ser a da nova candidata e estar na sessão de usuário, não na sessão do serviço. Se a saída de áudio mudar/falhar, existem até três tentativas com espera de 30 segundos; desativar e ativar permite tentar novamente. Formatos comuns PCM e float são suportados; formatos incomuns e conteúdo protegido podem não fornecer áudio capturável.

### Perfis por aplicativo

Crie um perfil normal. Em **Som e contexto**, cadastre o nome do executável (por exemplo, `editor.exe`), associe o perfil, ative e salve. A bandeja usa eventos de janela em primeiro plano e uma confirmação periódica; não enumera todos os processos por quadro, não lê teclas, títulos, texto ou caminhos pessoais.

A regra usa somente o nome, não autentica a identidade/publicador de um executável. Ao sair do aplicativo, volta a iluminação anterior. Um comando manual prevalece até trocar de aplicativo. Se a bandeja parar de confirmar o estado, a substituição expira em até 12 segundos. Uma cena iniciada explicitamente tem prioridade sobre o contexto. Contas/sessões Windows múltiplas ainda exigem teste de uso real.

## Dados, recursos e limites

Cenas, gravações e preferências/regras ficam no `settings.json`, dentro da pasta privada de dados; entram no backup revisável existente. O arquivo contém nomes de aplicativos e eventos escolhidos: guarde o backup em lugar privado. O cadastro `room.json` é local ao hardware e permanece separado, assim como portas e controladores nativos; atualizações o preservam e restaurar iluminação não o transfere para outro PC.

Não há processo extra por gesto, cena ou WLED. A ponte de áudio/contexto vive na bandeja existente; captura só é aberta quando habilitada. A superfície Live fecha o stream ao sair/ocultar a página e limita o desenho a 4.096 marcadores. Limites e [medições de desempenho](DESEMPENHO.md) descrevem o escopo do ensaio, sem garantir o mesmo consumo em todo computador.

Protocolos: [JSON WLED](https://kno.wled.ge/interfaces/json-api/), [DDP WLED](https://kno.wled.ge/interfaces/ddp/), [WASAPI loopback](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording), [eventos de janela Windows](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwineventhook).

## English quick start

These features belong to v0.1.0-alpha.38. Choose **English** in Settings, then open **Experiences**. Nothing here installs a newer binary automatically.

**Live:** draw ripples, trails or sweeps on your calibrated map. Record up to 30 seconds / 256 events, name and save, then replay or use the recording in a scene. Only powered, nonexcluded spatial devices receive gestures. The preview shows submitted frames, not physical LED feedback.

**Scenes:** combine ordinary movements, saved profiles and gesture recordings with durations, fades and repeats. Focus/break is an editable template. Scenes are transient; manual commands win, and stopped/restarted scenes do not overwrite saved lighting. Optional Alexa lights start/stop scenes through the existing Hue bridge; real Echo validation is still required.

**Room:** register a WLED controller by private IPv4 and HTTP port on the same LAN. Its identity and LED count are checked first. Map mode streams DDP when needed; native mode uses a local WLED effect ID/preset and does not follow spatial geometry. No Internet discovery, arbitrary URL or guaranteed physical synchronization. WLED hardware testing is separate from local protocol tests.

**Sound and context:** both are off by default. Audio analyzes the default Windows output into three band energies, without microphone or recording. Keep the updated tray running; changes take up to five seconds. Choose colors, sensitivity and map axis. App rules match a foreground executable basename to a saved profile; they read no titles, keys or content. Manual actions override the rule until you change foreground apps. Stale audio fades out; stale context expires.

Scenes, recordings and rules are included in the reviewed lighting backup. The local WLED inventory stays in `room.json` and is preserved across application updates and lighting restores. Benchmarks exclude processes explicitly listed as out of scope; they do not represent the total memory of every installation.
