# Criar efeitos em JSON

[English](EFFECTS.md) · [Mapa e biblioteca](STUDIO.md)

O formato `nexus-effect/1` descreve uma imagem de cores que o Nexus amostra conforme a posição dos LEDs no mapa. É declarativo: não executa JavaScript, expressões, áudio ou integrações.

Para código HTML/JavaScript do SignalRGB, escolha **SignalRGB · HTML / Canvas** no criador ou importe o arquivo `.html`. Esse código não é JSON. Veja [compatibilidade e prévia de HTML](#htmlcanvas-do-signalrgb).

## Testar antes de aplicar

1. No painel do próprio PC, abra **Mapa do setup → Trocar efeito → Criar efeito +**.
2. Use os controles ou cole o objeto em **Editar JSON · avançado**. JSON válido atualiza os controles; os controles também geram o JSON. Um erro preserva o texto e bloqueia testar/salvar até a correção.
3. Clique em **Testar prévia**. Ela acompanha as edições válidas sem gravar configurações, importar arquivos ou enviar comandos às luzes. **Pausar prévia** congela o tempo; editar ainda redesenha o rascunho.
4. **Salvar na biblioteca** guarda sem ativar. **Salvar e aplicar** guarda e seleciona o efeito nas luzes. **Guardar também na aba Perfis** cria um perfil. A energia geral e os componentes desligados são preservados.

O link **Guia de efeitos e patterns** abre uma referência local em português ou inglês, sem Internet. A prévia desenha a fonte de cores a até 10 FPS, enquanto o criador está aberto e reproduzindo. Não simula posição, brilho e energia dos dispositivos. Depois da aplicação, o mapa mostra as últimas cores enviadas; nenhum dos dois confirma fisicamente a emissão dos LEDs.

Salvar uma fórmula modificada gera outro item na biblioteca, preservando efeitos e perfis antigos. Os perfis que apontavam para a versão anterior não são alterados automaticamente.

## Exemplo: Rainbow Cascade

```json
{
  "format": "nexus-effect/1",
  "name": "Rainbow Cascade",
  "pattern": "wave",
  "palette": [
    "#ff0000", "#ff7f00", "#ffff00", "#00ff00",
    "#00f0ff", "#0000ff", "#7f00ff"
  ],
  "speed": 40,
  "angle": 90,
  "scale": 1.2
}
```

O arco-íris se move de cima para baixo. Trocar `wave` por `gradient` mantém as cores paradas: **`speed` não anima `gradient`**.

## Padrões disponíveis

| `pattern` | Comportamento | Direção |
| --- | --- | --- |
| `wave` | Onda contínua com transições suaves entre as cores. | Segue `angle`. |
| `comet` | Faixa luminosa com rastro e intervalos escuros. | Segue `angle`. |
| `rings` | Anéis de cores que se expandem a partir do centro. | Radial; `angle` não muda visualmente os anéis. |
| `gradient` | Gradiente estático. | `angle` orienta as faixas; `speed` não o anima. |
| `scanner` | Feixe que atravessa o mapa e volta. | Segue `angle`. |
| `rain` | Rastros com velocidades e posições variadas. | Use 90 para chuva de cima para baixo. |
| `spiral` | Três braços de cores girando em torno do centro. | `angle` orienta o desenho. |
| `plasma` | Nuvens de cores que se misturam suavemente. | `angle` orienta o campo. |
| `fire` | Campo de calor e turbulência usando a paleta. | Use −90 para calor na base e chamas para cima; experimente amarelo, laranja e vermelho. |
| `sparkle` | Pontos que acendem e desaparecem, sem flashes sincronizados de toda a tela. | `angle` orienta a distribuição. |
| `ripples` | Ondas de dois centros que se encontram. | `angle` orienta os centros. |
| `blocks` | Mosaico de blocos coloridos em movimento. | Segue `angle`. |

## Campos e limites

Todos os campos são obrigatórios. Números aceitam decimais e usam **ponto**, conforme o JSON.

| Campo | Valores | Significado |
| --- | --- | --- |
| `format` | `"nexus-effect/1"` | Identifica o formato. |
| `name` | Texto de 1 a 60 caracteres | Nome na biblioteca. |
| `pattern` | Um dos doze nomes acima | Escolhe o desenho. |
| `palette` | Lista de 1 a 8 cores `#RRGGBB` | Sequência ordenada, da última de volta para a primeira. Uma única cor é válida; em `comet`, continua existindo o rastro escuro. |
| `speed` | 0 a 100 | Velocidade da animação, independente dos FPS. Zero congela o quadro; não anima `gradient`. |
| `angle` | −360 a 360 graus | 0: esquerda → direita; 90: cima → baixo; 180: direita → esquerda; −90: baixo → cima. |
| `scale` | 0.1 a 10 | Valores maiores repetem mais a paleta, criando faixas menores. |

`speed: 40` não significa 40 FPS nem uma duração em segundos. Escolha os FPS do RGB em **Configurações → Atualização do RGB**. O editor usa a mesma fórmula de desenho do motor, mas navegador e controlador podem atualizar em ritmos diferentes.

## Colagem e importação

O editor aceita um rótulo `JSON` antes do objeto ou cercas de Markdown ao colar. Para importar um arquivo `.json` pela biblioteca, use somente o objeto JSON: sem rótulos, cercas, comentários ou vírgula depois do último campo. Cores abreviadas (`#f00`), nomes CSS (`red`) e canais alpha não são aceitos.

O limite é 128 KiB por arquivo e 64 efeitos importados. Cores são normalizadas para minúsculas. Campos adicionais não criam movimentos ou parâmetros; use o formato documentado. A importação por arquivo adiciona sem ativar; selecione o cartão para aplicar depois.

## O hardware parece diferente

Use **Direct com cor por LED**, habilite a energia do componente e confira quantidade, faixas, primeiro LED, sentido, rotação e posição no mapa. Uma onda espacial amostra X/Y de cada LED: em uma ventoinha corretamente mapeada, LEDs da mesma altura recebem a mesma região da onda vertical. Movimentos comuns da aba Iluminação seguem a sequência do cabo, não a posição espacial.

Para fans endereçáveis em série, configure a quantidade real na porta e divida as faixas no mapa. Um hub que espelha o sinal continua replicando as cores, sem controle independente. Consulte [mapa e calibração](MAPA-E-CALIBRACAO.md).

## HTML/Canvas do SignalRGB

1. Abra o criador e escolha **SignalRGB · HTML / Canvas**, ou cole o HTML completo com `<canvas>` e `<script>` para reconhecer o formato automaticamente. Os rascunhos JSON e HTML ficam separados enquanto o editor está aberto.
2. Cole o arquivo completo, incluindo `<head>`, `<title>`, metatags dos controles, `<canvas>` e `<script>`. **Testar prévia** valida e executa o código em um processo isolado, sem importar na biblioteca nem mudar o efeito ativo.
3. Os controles definidos nas metatags aparecem após a validação. Ajustar um controle ou editar o código pausa a prévia; clique em **Testar prévia** para reiniciar com os novos valores.
4. **Salvar na biblioteca** importa sem ativar. **Salvar e aplicar** importa e ativa com os parâmetros escolhidos. A opção de Perfis guarda esses parâmetros também. Nome e autoria do HTML são preservados.

A prévia HTML envia somente imagens PNG do processo isolado para o navegador, a até 10 FPS. O código importado não é inserido na página nem executado pelo Node. Pausar ou fechar encerra o processo; retomar começa do início. Há uma prévia de código por servidor, expiração de cinco minutos, encerramento por inatividade e limites de memória e tempo. A criação é permitida somente no painel local do PC.

O suporte é **parcial a efeitos Canvas 2D**, não ao aplicativo completo SignalRGB. Suporta `window.requestAnimationFrame`, timers limitados, `document.getElementById` do Canvas, formas, caminhos, gradientes e transformações permitidos. Metatags `color`, `number`, `boolean` e `combobox` geram controles; booleanos chegam ao script como `0` ou `1`. Áudio, integrações de jogos/periféricos, arquivos, rede, scripts/imagens externos, WebGL e APIs completas do navegador não são suportados. Consulte [limites do motor](STUDIO.md#execução-dos-arquivos-importados).

Um efeito pode ter erros próprios mesmo usando APIs compatíveis. Por exemplo, uma cor aleatória deve ser inicializada antes do primeiro desenho; um gerador hexadecimal deve completar seis dígitos com `.padStart(6, '0')`. Não há conversão automática de JavaScript arbitrário para os doze padrões JSON, nem garantia de equivalência com todo efeito do SignalRGB. Importe apenas arquivos cuja origem e licença você conhece.
