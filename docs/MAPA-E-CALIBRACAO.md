# Mapa e calibração

O mapa representa posições em um campo de efeitos. Cores na prévia são os últimos comandos enviados ao OpenRGB, não uma leitura física dos LEDs. Modos nativos podem não informar cores individuais.

## Primeira configuração

1. Aguarde o OpenRGB detectar os componentes. Abra **Mapa do setup → Conferir meu primeiro componente**, ou selecione uma peça na lista abaixo do mapa.
2. Escolha **Linha**, **Ventoinha** ou **Matriz** e ajuste o tamanho e a rotação. Arraste a peça e solte para salvar. O teclado e os campos de posição permitem ajustes precisos.
3. Abra **Calibrar peça…**. Confira o componente e a faixa informada. **Identificar componente** acende somente aquele componente por até três segundos com brilho reduzido; **Testar LED** seleciona um índice físico. **Parar teste**, fechar a janela ou o prazo encerram a identificação. Um comando de desligamento também a interrompe. Os ajustes atuais são retomados; o teste não grava uma cor permanente.
4. Informe se a ligação é independente em sequência, espelhada ou ainda desconhecida. Isso registra a fiação observada; o software não consegue descobrir essa informação sozinho.
5. Para uma ventoinha com vários anéis, informe-os de fora para dentro, com suas quantidades, deslocamentos e sentidos. A soma deve corresponder à faixa da peça. O deslocamento usa zero para o topo; teste um LED por vez para conferir a orientação.
6. Se o hardware usar outra ordem, abra **Ordem física personalizada** e informe cada índice da peça uma única vez, a partir de 1. Deixe vazio para usar a ordem padrão. Salve a calibração.

O teste físico usa o índice do componente inteiro. A ordem personalizada usa índices relativos à peça dividida. Por exemplo: uma peça que usa LEDs 13–24 tem índices relativos 1–12; seu índice relativo 1 corresponde ao LED físico 13.

## Quantidades e fiação

Não existe quantidade fixa de LEDs para ARGB. Os valores iniciais vêm do OpenRGB e os limites do mapa não são especificações elétricas. Nenhum assistente aumenta automaticamente o tamanho de uma porta.

Em **Conexão e sequência de LEDs**, informe a faixa real ou use **Separar em ventoinhas** com a quantidade conhecida por fan. Dividir o mapa não redimensiona o conector. Se o SDK informa menos LEDs que a instalação física, confira a configuração da zona em **Dispositivos** e os limites do fabricante antes de alterá-la.

Um cabo passando de uma ventoinha à seguinte pode replicar o sinal em vez de criar uma sequência independente. Se os LEDs se repetem durante o teste, vários desenhos no mapa não tornam essas saídas independentes. Uma controladora com canais separados ou uma ligação endereçável de verdade é necessária para isso.

## Direção dos efeitos

- **Movimentos comuns**, como Arco-íris e Onda, seguem os índices do cabo. Escolher Ventoinha como formato não transforma esses movimentos em um campo vertical ou horizontal.
- **Efeitos espaciais** amostram X/Y no mapa. Uma ventoinha usa coordenadas circulares; em uma faixa horizontal uniforme, LEDs na mesma altura recebem a mesma cor. Se o desenho acompanha o campo mas os LEDs físicos giram, confira a ordem física, os anéis e a fiação.
- Um efeito importado define seu próprio movimento. Um controle chamado “vertical” pode afetar apenas uma parte da animação; o Nexus não reescreve a lógica do autor.

## Editar o conjunto

Use as alças da peça selecionada para tamanho e rotação, ou os controles equivalentes no inspetor. Shift durante a rotação alinha a passos de 15°. **Alinhar à grade** ajusta deslocamentos a passos de 2,5% do mapa.

Shift/Ctrl + clique permite selecionar várias peças. Arrastar ou usar as setas move o conjunto e preserva suas distâncias. Atribua um **Grupo** e use **Selecionar grupo** para recuperá-lo. Desfazer/refazer atua nas alterações do mapa desta sessão; uma atualização externa do mapa reinicia esse histórico para evitar aplicar posições antigas sobre outro editor.

Se mudar a quantidade de LEDs ou dividir/juntar uma peça, refaça a calibração dessa faixa. Nomes, posições e calibração entram no [backup completo](BACKUP-E-DIAGNOSTICO.md).
