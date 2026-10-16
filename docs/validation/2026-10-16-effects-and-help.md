# Variedade, HTML/Canvas e ajuda — 16/10/2026

## Escopo

O criador passa a oferecer doze padrões JSON e um formato separado para colar efeitos HTML/Canvas compatíveis com o SignalRGB. A prévia HTML não importa arquivos nem muda o efeito ativo. O guia local, a seção de Ajuda e o arquivo `LEIA-ME.txt` tornam as instruções acessíveis sem um visualizador Markdown.

![Doze padrões nativos](../assets/patterns-overview.png)

Na imagem, um único instante pode coincidir com o intervalo escuro do cometa. Chuva usa direção 90°; fogo usa −90°. A paleta do fogo é amarela/laranja/vermelha; os demais usam ciano/roxo/rosa. A imagem não representa leitura de hardware.

## Testes locais

A suíte completa executada durante o desenvolvimento passou em 120 testes de lógica/integração e 33 de interface. Depois, foram adicionados e executados os testes de travamento por quadro, perda de autorização, stream duplicado, preservação dos parâmetros HTML ao aplicar e alternância dos rascunhos. Os quatro testes específicos da prévia e os três da interface HTML passaram. A configuração final possui 121 testes de lógica e 34 de interface; os resultados do CI da versão publicada devem ser consultados nas notas da versão.

Foram verificados:

- Identificadores dos efeitos anteriores preservados; doze padrões desenham, animam e respeitam velocidade zero. `gradient` permanece estático. O desenho compartilhado do editor corresponde ao motor.
- Importação de HTML e controles `color`, `number`, `boolean` e `combobox` pelos mecanismos existentes; booleanos entram como `0`/`1`.
- Prévia HTML por SSE com imagens PNG, sem gravação na biblioteca, ajustes ou comandos ao hardware. Pausar/fechar encerra o processo, e retomar reinicia o script.
- Recusa de LAN, origem forjada, token errado, scripts externos e acesso à rede pelo efeito. Loop infinito na inicialização ou no quadro é interrompido; autorização perdida fecha o stream; stream duplicado é recusado.
- Salvar na biblioteca preserva o efeito ativo. Salvar e aplicar guarda os parâmetros escolhidos e preserva a energia desligada. Alternar JSON/HTML mantém os rascunhos enquanto o editor está aberto.
- Apresentação inicial uma vez por pasta de dados, sem repetir entre sessões, reinício do processo ou atualização com dados preservados. Instalações já existentes sem marcador são tratadas como já apresentadas.
- Ajuda local com português/inglês e layout móvel sem exceder a largura da tela. A apresentação pode ser fechada; os links de ajuda permanecem nas Configurações.

Um exemplo HTML fornecido pelo usuário foi testado privadamente em processo isolado e no editor, com dez controles, duas direções, animação e autoria preservada. O código de terceiros não acompanha o pacote nem foi publicado no repositório. Os testes usam dados temporários e não alteram os LEDs da instalação em uso.

## Limites

A compatibilidade é parcial para Canvas 2D e metatags; não implementa o aplicativo SignalRGB, áudio, WebGL, jogos, periféricos ou suas APIs completas. Há uma prévia temporária por servidor, expiração de cinco minutos, timeout de inicialização de seis segundos, watchdog de quadro de um segundo e os limites existentes do sandbox. O código não executa no JavaScript do navegador ou do Node; a imagem decodificada é exibida no editor. Essas restrições não equivalem a uma auditoria independente.

O FPS do motor orienta os quadros do script HTML, enquanto a transmissão é limitada a dez imagens por segundo. Scripts que incrementam posições por quadro ainda podem mudar de velocidade quando o FPS configurado muda. Erros no código original, como cor não inicializada ou hexadecimal incompleto, não são corrigidos automaticamente.

Consulte a [medição isolada dos padrões](../DESEMPENHO.md#desenho-dos-doze-padrões--16102026) e os [dados brutos](2026-10-16-patterns.json). Não representam consumo total nem taxa física dos LEDs.
