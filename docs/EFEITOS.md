# Criar efeitos em JSON

[English](EFFECTS.md) · [Mapa e biblioteca](STUDIO.md)

O formato `nexus-effect/1` descreve uma imagem de cores que o Nexus amostra conforme a posição dos LEDs no mapa. É declarativo: não executa JavaScript, expressões, áudio ou integrações.

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

## Campos e limites

Todos os campos são obrigatórios. Números aceitam decimais e usam **ponto**, conforme o JSON.

| Campo | Valores | Significado |
| --- | --- | --- |
| `format` | `"nexus-effect/1"` | Identifica o formato. |
| `name` | Texto de 1 a 60 caracteres | Nome na biblioteca. |
| `pattern` | Um dos quatro nomes acima | Escolhe o desenho. |
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
