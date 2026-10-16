# Editor JSON e prévia de efeitos — 16/10/2026

## Problema e correção

O editor anterior gerava JSON pelos controles, mas não interpretava edições do texto para atualizar os controles. Salvar adicionava à biblioteca sem ativar. Além disso, o padrão `gradient` do exemplo Rainbow Cascade é estático: alterar sua velocidade não produz movimento.

O editor agora valida e sincroniza as duas formas de entrada. **Testar prévia** usa a mesma função de desenho do motor, inteiramente no navegador; **Salvar e aplicar** é uma ação explícita. O comportamento estático de `gradient` e os identificadores dos efeitos anteriores foram preservados.

## Validação local

- **115 testes de lógica/integração passaram**, incluindo validação, estabilidade dos IDs, desenho compartilhado e diferença entre `gradient` estático e padrões animados.
- A suíte de interface exercitou **30 cenários**: 29 passaram na execução completa; o teste novo do guia inicialmente encontrou dois elementos com a mesma classe. O seletor foi restringido ao diálogo correto; os cinco testes do editor passaram novamente, incluindo esse cenário.
- JSON fornecido no relato, colagem com rótulo e cercas, sete cores, alteração de paleta/direção, prévia animada e pausada, fechamento do diálogo sem continuar desenhando.
- Nenhuma requisição POST durante edição/prévia. Erros de JSON mantêm o texto e bloqueiam aplicação. Falha simulada ao salvar perfil permite repetir sem ativação antecipada ou perfil duplicado.
- **Salvar na biblioteca** preserva a seleção anterior; **Salvar e aplicar** seleciona a fórmula e cria o perfil opcional, mantendo a energia geral desligada no cenário de teste.
- Desktop de 1366 px e celular de 390 px: prévia visível, ações acessíveis, diálogo dentro da tela. Guia em português/inglês sem requisições a destinos externos nem rolagem horizontal da página.

Os testes de interface usam servidores com diretórios temporários próprios, sem conexão ao OpenRGB ou à Alexa. As imagens foram inspecionadas no desktop e no celular simulado. Esses testes não alteraram a instalação nem os LEDs do computador em uso.

## Desempenho e limites

A prévia do rascunho usa Canvas 320 × 200 a até 10 FPS, com trabalho no navegador. Quadros estáticos só são redesenhados após alterações; a reprodução para ao fechar o criador e não desenha com o documento oculto. Ela não aumenta o FPS do controlador, não abre outro motor de efeitos no servidor e não transmite o rascunho para a rede. Isso descreve o funcionamento; não é uma nova medição do consumo total do aplicativo.

A imagem do editor é a fonte de cores, sem simular a geometria, o brilho ou a energia dos componentes. Diferenças físicas ainda podem envolver calibração, fiação, hubs, taxa do controlador ou suporte Direct. Nenhuma prévia confirma fisicamente a emissão dos LEDs.
