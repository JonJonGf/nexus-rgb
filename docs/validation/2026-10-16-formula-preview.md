# Editor JSON e prévia de efeitos — 16/10/2026

## Problema e correção

O editor anterior gerava JSON pelos controles, mas não interpretava edições do texto para atualizar os controles. Salvar adicionava à biblioteca sem ativar. Além disso, o padrão `gradient` do exemplo Rainbow Cascade é estático: alterar sua velocidade não produz movimento.

O editor agora valida e sincroniza as duas formas de entrada. **Testar prévia** usa a mesma função de desenho do motor, inteiramente no navegador; **Salvar e aplicar** é uma ação explícita. O comportamento estático de `gradient` e os identificadores dos efeitos anteriores foram preservados.

## Validação local

- **115 testes de lógica/integração passaram**, incluindo validação, estabilidade dos IDs, desenho compartilhado e diferença entre `gradient` estático e padrões animados.
- **30 testes de interface passaram no GitHub Actions.** Localmente, o teste novo do guia inicialmente encontrou dois elementos com a mesma classe; o seletor foi restringido ao diálogo correto e os cinco testes do editor passaram novamente antes da publicação.
- JSON fornecido no relato, colagem com rótulo e cercas, sete cores, alteração de paleta/direção, prévia animada e pausada, fechamento do diálogo sem continuar desenhando.
- Nenhuma requisição POST durante edição/prévia. Erros de JSON mantêm o texto e bloqueiam aplicação. Falha simulada ao salvar perfil permite repetir sem ativação antecipada ou perfil duplicado.
- **Salvar na biblioteca** preserva a seleção anterior; **Salvar e aplicar** seleciona a fórmula e cria o perfil opcional, mantendo a energia geral desligada no cenário de teste.
- Desktop de 1366 px e celular de 390 px: prévia visível, ações acessíveis, diálogo dentro da tela. Guia em português/inglês sem requisições a destinos externos nem rolagem horizontal da página.

Os testes de interface usam servidores com diretórios temporários próprios, sem conexão ao OpenRGB ou à Alexa. As imagens foram inspecionadas no desktop e no celular simulado. Esses testes não alteraram a instalação nem os LEDs do computador em uso.

O [CI da alpha.18](https://github.com/JonJonGf/nexus-rgb/actions/runs/38903993854) validou o commit `8a150e977ddfbbb43ee206eceecb000b843bc8ce`: 115 testes de lógica, 30 de interface, supervisor nativo e sustentação de 60 segundos com 171 requisições e dez reinícios abruptos do processo de teste. A execução terminou com sucesso. A análise CodeQL das três linguagens no mesmo commit/tag também concluiu sem erros nem avisos de extração.

O [workflow do instalador](https://github.com/JonJonGf/nexus-rgb/actions/runs/38903994724) validou o mesmo commit em duas VMs Windows descartáveis, com as portas padrão e alternativas. Cada VM passou por **67 verificações** de instalação, atualização, preservação de dados, recuperação, remoção e reinstalação. Os jobs foram `116982893710` (5050/6743/80) e `116982894062` (5151/6754/8081). As VMs não têm RGB físico e não instalam drivers; esses resultados não comprovam compatibilidade com todo hardware.

## Desempenho e limites

A prévia do rascunho usa Canvas 320 × 200 a até 10 FPS, com trabalho no navegador. Quadros estáticos só são redesenhados após alterações; a reprodução para ao fechar o criador e não desenha com o documento oculto. Ela não aumenta o FPS do controlador, não abre outro motor de efeitos no servidor e não transmite o rascunho para a rede. Isso descreve o funcionamento; não é uma nova medição do consumo total do aplicativo.

A imagem do editor é a fonte de cores, sem simular a geometria, o brilho ou a energia dos componentes. Diferenças físicas ainda podem envolver calibração, fiação, hubs, taxa do controlador ou suporte Direct. Nenhuma prévia confirma fisicamente a emissão dos LEDs.
