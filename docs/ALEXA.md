# Alexa: ligar e desligar

A ponte local do Nexus publica uma única luz, **Iluminação Nexus**, para Echos aprovados na mesma sub-rede. O controle físico oferecido é ligar/desligar; brilho, cor, velocidade, configurações individuais e perfis continuam sob controle do Nexus.

## Compatibilidade Hue a partir da alpha.20

A ponte mantém a descrição `Dimmable light` usada na descoberta e passa a reconhecer um brilho **virtual**, separado dos ajustes RGB. Ele serve para manter respostas Hue coerentes, sem implementar dimmer físico pela Alexa.

| Pedido | Energia dos LEDs | Resposta |
| --- | --- | --- |
| `{"on":false,"bri":127}` | Desliga | Confirma `on: false` e `bri: 127` separadamente. |
| `{"on":true,"bri":0}` | Liga com o brilho RGB salvo | Confirma os dois campos; brilho virtual zero não é um comando de desligar. |
| `{"bri":254}` ou `{"bri":0}` | Mantém o estado atual | Confirma apenas o brilho virtual, sem gravar ajustes ou enviar comando aos LEDs. |
| `{"on":true}` | Liga com os ajustes salvos | Confirma apenas energia. |
| `{"on":true,"bri":"127"}` | Mantém o estado atual | Recusa a mensagem antes de aplicar energia: brilho precisa ser inteiro entre 0 e 254. |

Uma consulta posterior retorna o último brilho virtual aceito. Ele começa em 254 a cada novo processo da ponte e não é salvo em `settings.json` ou nos perfis. O brilho RGB real não acompanha esse número. O estado `on` continua refletindo a energia geral do Nexus, e `reachable` reflete a conexão com o controlador.

Campos de cor, efeito e transição enviados junto com `on`/`bri` não modificam ajustes e não recebem confirmação de aplicação. Um pedido contendo apenas propriedades não suportadas continua retornando erro Hue. A alteração não implementa cenas ou grupos Hue no Nexus; grupos e rotinas do aplicativo Alexa precisam de teste específico.

As rotas aceitam barra final, inclusive `POST /api/`, mantendo as verificações de sub-rede, Host, origem e aprovação do Echo. Identidades da ponte e da luz não mudam com este ajuste; não é necessário apagar o cadastro como primeiro passo.

## Teste com um Echo físico

1. Anote brilho, cor/efeito e estado de componentes individuais no Nexus.
2. Pelo app Alexa, apague **Iluminação Nexus**, espere a conclusão e observe se aparece falha.
3. Acenda pelo app e confirme se o brilho, efeito e escolhas individuais foram preservados.
4. Repita por voz: **Alexa, apagar Iluminação Nexus** e **Alexa, acender Iluminação Nexus**.
5. Se usar grupos ou rotinas, teste-os separadamente. O controle de brilho da Alexa não deve ser usado como comando de energia; use ligar/desligar.
6. Caso o aviso persista, abra o diagnóstico local da Alexa. Compare o pedido, a energia e `hueBrightness` devolvidos; revise os dados antes de compartilhar.

Testes automatizados validam respostas, consultas posteriores, HTTP e preservação de dados. Eles não reproduzem o firmware de um Echo. No teste físico realizado após instalar a alpha.20, o usuário informou que o aviso persistiu; os pedidos observados continham somente `on`, sem brilho. A investigação continua: essa adaptação não demonstrou resolver o aviso nesse equipamento.
