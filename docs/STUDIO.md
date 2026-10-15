# Mapa do setup e biblioteca de efeitos

O mapa reúne os efeitos da Iluminação, os perfis salvos e a biblioteca espacial. As peças mostram as últimas cores enviadas a cada LED. Nos efeitos espaciais, uma imagem em movimento é a fonte de cor: posicionar uma memória à esquerda e uma ventoinha à direita permite que uma onda atravesse os dois componentes em sequência.

Esse controle exige **Direct e cor por LED** no OpenRGB. A posição dos componentes é uma organização virtual; o Nexus não reconhece sozinho onde cada peça está instalada fisicamente.

## Organizar o setup

1. Abra **Mapa do setup** no painel do próprio PC.
2. Arraste as peças para representar o gabinete. As setas do teclado também movem a peça selecionada.
3. Escolha o formato **Fita**, **Ventoinha/anel** ou **Matriz**, ajuste tamanho e rotação e, se necessário, marque **Inverter ordem dos LEDs**.
4. Solte a peça para salvar a posição automaticamente. Durante o arraste, a geometria muda apenas na tela; as luzes recebem a nova posição ao soltar, além do tempo da conexão/controladora. Edições por teclado e campos são agrupadas em intervalos de até 350 ms. Aguarde **Salvo automaticamente** antes de fechar a página. Em falha, o ajuste fica no navegador e **Tentar novamente** permite reenviá-lo.
5. Escolha um efeito na biblioteca para ativar o mapa espacial. Alterar seus parâmetros também ativa esse efeito, respeitando a energia geral e individual. Abrir a aba ou editar posições preserva o efeito ativo e os controles individuais. Use **Voltar ao controle comum** para sair do efeito espacial.

**Dividir faixa** separa uma sequência de LEDs em duas peças virtuais. Ajuste **Primeiro LED** e **Quantidade** para que cada peça corresponda a uma ventoinha ou trecho de fita. **Unir faixas** junta trechos vizinhos do mesmo componente. As faixas não podem compartilhar o mesmo LED.

Exemplo: uma porta com 36 LEDs que alimenta três fans de 12 LEDs pode usar as faixas 1–12, 13–24 e 25–36. Isso só permite efeitos independentes se os LEDs forem endereçáveis em sequência. Um hub que espelha o mesmo sinal em todos os fans continua mostrando as mesmas cores neles.

Para fans iguais, selecione a faixa, informe **LEDs por ventoinha** e clique em **Separar em ventoinhas**. A faixa é dividida em anéis consecutivos, sem alterar a quantidade configurada no OpenRGB. Três fans de 36 LEDs em sequência exigem 108 LEDs configurados na porta, não 36; confira o hardware antes de alterar a quantidade em **Dispositivos**. Uma controladora que replica sinal não passa a oferecer endereçamento independente com essa divisão.

O formato **Ventoinha/anel** descreve onde cada LED está na peça, e não obriga o efeito a girar. Num movimento vertical, LEDs na mesma altura recebem a mesma amostra; a onda percorre o anel de cima para baixo. Ajuste **Rotação** para alinhar o primeiro LED físico e **Inverter ordem** quando o cabeamento percorre o sentido oposto. Se uma porta representa vários fans, mapeá-la como um único anel distribui setores desse anel entre as peças e pode distorcer o movimento.

Componentes novos compatíveis recebem uma posição inicial. Ajustes salvos de dispositivos ausentes são preservados para uma futura reconexão. Confira as faixas do mapa depois de mudar a quantidade de LEDs de uma porta. Os limites são 256 posições, 4.096 LEDs por componente e 32.768 LEDs no total.

## Entender a prévia e a saída dos LEDs

As peças e os pontos mostram as últimas cores enviadas pelo Nexus a cada índice de LED, incluindo brilho e estado ligado/desligado. Isso inclui **Arco-íris**, Onda, sequências dos perfis e os ajustes individuais. O cabeçalho **Em reprodução** identifica o movimento geral ou o efeito espacial selecionado; componentes personalizados podem usar outros ajustes. Esses dados não são uma leitura física da luz nem uma confirmação eletrônica do dispositivo.

O **fundo colorido** aparece somente quando um efeito espacial está ativo, conectado e com a energia geral ligada. Nos efeitos comuns, a tela mantém a grade e mostra as cores nas próprias peças; ela não exibe a imagem de um efeito espacial antigo. Efeitos comuns seguem a ordem física dos LEDs: mover uma peça muda sua organização visual, sem transformar esse movimento em um efeito espacial.

Durante o arraste, os pontos acompanham a peça que está sendo editada; suas cores continuam representando a última saída enviada. Ao soltar, as novas posições são salvas e passam a orientar a amostragem do efeito espacial. Uma imagem antiga do stream não substitui as posições editadas. Mover peças não reinicia o processo nem o relógio da animação. Desligamento, perda de conexão e falha do efeito aparecem na legenda.

Modos nativos calculados pelo próprio hardware não fornecem uma leitura por LED; suas peças e pontos ficam sem cor conhecida. Em configurações grandes, a tela limita os marcadores e a amostragem do preenchimento a aproximadamente 4.096 LEDs para reduzir o trabalho do navegador. Todos os LEDs configurados continuam sendo enviados ao controlador.

Peças com o mesmo nome, como duas memórias RAM, são identificadas pelo OpenRGB; a ordem detectada pode ser diferente da posição física no gabinete. Para identificá-las, altere temporariamente a cor de apenas uma peça em **Dispositivos**. Posicione essa peça no mapa e selecione novamente o efeito do mapa para reintegrá-la à sincronização.

## Efeitos incluídos

- **Aurora espacial:** onda de cores atravessando o mapa.
- **Cometa no setup:** uma faixa luminosa com rastro.
- **Anéis de luz:** cores que se expandem a partir do centro.

Em **Perfis e cenas**, no próprio mapa, escolha qualquer perfil salvo ou uma cena pronta. **Movimento da Iluminação** oferece os mesmos movimentos usados no controle comum. São as mesmas configurações das outras abas: ativar um perfil por qualquer uma delas altera as mesmas luzes e a visualização acompanha a saída.

Escolher cor ou movimento na aba **Iluminação**, ou ativar uma cena comum, desativa o efeito espacial. O mapa continua mostrando os componentes e suas cores. Alterar cor ou modo de um dispositivo faz esse componente seguir seu controle individual. Para sincronizá-lo novamente, selecione o efeito espacial outra vez; editar apenas a posição não remove essa personalização.

Ligar/desligar e mudar brilho preservam a seleção do efeito. A Alexa continua usando somente ligar/desligar. Ativar um componente com o controle geral desligado liga apenas aquele componente.

**Perfis → Guardar ajustes atuais** salva também o efeito ativo e seus parâmetros. As posições do setup são compartilhadas entre todos os perfis. Os arquivos importados devem permanecer na biblioteca: o perfil guarda uma referência ao efeito. Editar esse perfil pelo criador de sequências substitui o efeito espacial por uma sequência comum.

Na biblioteca do mapa, **Salvar como perfil** guarda o efeito selecionado e seus parâmetros com um nome próprio, sem mudar as luzes ao salvar. Ele aparece em **Perfis** como **Efeito no mapa**; **Ativar perfil** recupera esse efeito com os ajustes de energia/brilho e componentes guardados. O criador de efeitos também oferece **Guardar também na aba Perfis**, marcado inicialmente. Não remova o arquivo importado enquanto houver perfis que dependam dele.

## Importar HTML de efeitos

No próprio PC, use **Importar efeito** e selecione arquivos HTML com JavaScript incorporado e Canvas 2D. É possível selecionar vários arquivos. A importação valida uma primeira renderização e adiciona o efeito à biblioteca; ela não o aplica às luzes automaticamente. Escolha-o na lista para visualizar e ativar.

Esta é uma **compatibilidade parcial e experimental** com efeitos Canvas usados no SignalRGB. Não executa o aplicativo SignalRGB nem implementa todas as suas APIs.

| Recurso | Nesta versão |
| --- | --- |
| Canvas 2D, formas, caminhos, transformações e gradientes permitidos | Suportado dentro dos limites do motor |
| Parâmetros numéricos, cores, booleanos e listas em metatags | Exibidos no painel quando compatíveis |
| Áudio do SignalRGB | Não suportado; esses arquivos são recusados |
| Teclado, mouse, jogos e integrações do SignalRGB | Não encaminhados ao efeito |
| Scripts, imagens ou fontes externos, WebGL e APIs de navegador completas | Não suportados |
| Efeitos muito pesados | Podem ser pausados pelo orçamento do motor |

O limite por arquivo é 128 KiB; o Canvas pode ter até 640 × 400 pixels. A biblioteca admite até 64 importações. Alguns efeitos avançam uma etapa a cada quadro: mudar os FPS pode mudar também sua velocidade. Não há promessa de equivalência visual completa com o SignalRGB.

O Nexus mantém o nome e a autoria informados no HTML. Importe apenas arquivos que você tenha direito de usar e confira sua licença antes de redistribuir. Nenhum pacote de efeitos de terceiros acompanha o instalador ou é enviado ao GitHub automaticamente.

Controles booleanos são guardados como ligado/desligado na configuração e enviados ao script como números `0` e `1`, conforme as metatags de Lightscripts. Isso inclui efeitos que usam comparações estritas com `1`.

## Criar uma fórmula Nexus

**Criar efeito** abre uma janela própria, acima do mapa, com rolagem interna no desktop e no celular. Escolha nome, movimento, até oito cores ordenadas, ritmo, direção e escala. **Salvar na biblioteca** adiciona o modelo sem aplicá-lo às luzes; a opção **Guardar também na aba Perfis** cria um perfil para ativar depois. A faixa colorida do editor representa a paleta, sem simular a animação.

**Editar JSON · avançado** permite escrever o formato declarativo `nexus-effect/1`. Alterar os controles visuais substitui esse JSON. Também é possível importar um arquivo JSON nesse formato.

```json
{
  "format": "nexus-effect/1",
  "name": "Minha onda",
  "pattern": "wave",
  "palette": ["#00f0ff", "#7954ff", "#ff0055"],
  "speed": 30,
  "angle": 45,
  "scale": 1
}
```

| Campo | Valores |
| --- | --- |
| `name` | Nome de até 60 caracteres |
| `pattern` | `wave`, `comet`, `rings` ou `gradient` |
| `palette` | De 1 a 8 cores `#RRGGBB`, na ordem desejada |
| `speed` | De 0 a 100; zero mantém uma imagem imóvel |
| `angle` | De −360 a 360 graus |
| `scale` | De 0,1 a 10 |

O padrão `gradient` é estático. Essa primeira versão do formato descreve padrões e parâmetros; não é uma linguagem de programação geral.

## FPS e consumo

Em **Configurações → Atualização do RGB**, escolha **5 a 60 FPS** e salve. O padrão é 20; há atalhos para 10, 20, 30 e 60. Essa alteração dispensa reiniciar o controlador.

FPS maiores aumentam o trabalho do processador e a quantidade de comandos enviados ao OpenRGB. Um PC rápido não elimina limites da conexão ou da controladora. Se houver atraso, reduza a taxa.

A métrica **FPS renderizados** mede a produção de quadros pelo motor espacial. Não mede a taxa física dos LEDs nem a taxa dos efeitos comuns. A prévia no navegador usa até 10 FPS para limitar tráfego e compressão de imagens. Assistir aos efeitos comuns usa a saída já enviada pelo controlador, sem iniciar um processo Canvas ou uma segunda animação. Efeitos espaciais estáticos mantêm seu último quadro, sem renderização e envio contínuos.

Consulte as [medições de desempenho e seus limites](DESEMPENHO.md).

## Execução dos arquivos importados

O HTML nunca é inserido na página nem executado pelo JavaScript do Node. Seu código roda em **QuickJS WASM dentro de um processo filho**, com uma ponte restrita de comandos Canvas. Não recebe APIs de arquivos, rede, Node, imagem, fonte ou hardware.

O motor impõe limites de memória da VM (16 MiB), pilha (256 KiB), operações de desenho e tempo por quadro (40 ms). O processo tem limite de heap V8 de 64 MiB e verificação de RAM residente acima de 256 MiB entre etapas de desenho/quadros. Essa verificação não é uma reserva rígida de memória do sistema operacional. O supervisor interrompe o processo se um quadro deixar de responder por um segundo.

Em falha, o efeito espacial é pausado, o erro aparece no painel e os componentes voltam aos ajustes comuns. Escolher outro efeito ou usar o botão para ativá-lo permite tentar novamente; mover uma peça preserva a pausa. Fechar a prévia encerra seu stream. O processo de efeitos encerra quando o controle comum está ativo, ou quando não há luzes ativas no efeito espacial nem clientes de prévia.

Essas restrições reduzem a superfície de execução, mas não equivalem a uma auditoria independente nem garantem que bibliotecas nativas estejam livres de vulnerabilidades.

## Dados e backup

Posições, seleção do efeito, perfis e FPS ficam em `%ProgramData%\NexusRGB\app\settings.json`. Os arquivos importados ficam na subpasta `effects` desse mesmo diretório. Preserve **os dois** ao fazer backup.

Atualizar pelo instalador preserva esses dados. A desinstalação padrão também os mantém. Remover essa pasta manualmente exclui a biblioteca e os ajustes.
