# Confirmações da Alexa — 16/10/2026

## Alteração

A ponte reconhece `on` e um `bri` virtual, confirmando cada propriedade aceita. O brilho virtual não altera o brilho RGB e não é persistido nos ajustes. Um pedido contendo somente brilho preserva a energia, evitando reacender um setup apagado. O caminho Hue aceita barra final sem mudar a identidade da luz ou a aprovação do Echo.

## Testes específicos

Nove testes de Alexa passaram localmente. Incluem:

- Confirmações separadas para `on` e `bri`, com consulta posterior coerente.
- Energia explícita prevalece: `on: false` com brilho positivo apaga; `on: true` com brilho virtual zero liga com o brilho RGB salvo.
- Pedidos somente de brilho, incluindo zero, mantêm a energia e não gravam `settings.json`, cancelam identificação ou enviam comandos ao hardware.
- Mensagens com tipos/faixas inválidos não modificam energia ou brilho virtual, mesmo com `on` válido.
- Preservação de cor, brilho RGB, paleta, efeitos, perfis, escolhas individuais e configuração do mapa após apagar/reacender.
- Barra final no cadastro, consultas e escrita; caminhos internos malformados e IDs de luz inexistentes continuam recusados.
- Aprovação, sub-rede e origem continuam exigidas.
- Um servidor HTTP real em loopback, com identidade LAN simulada apenas na fixture, verifica corpo em chunks, Content-Length, fechamento da conexão, consulta posterior, mensagens malformadas e limite de tamanho de 2048 bytes. Não acessa um Echo ou o hardware instalado.

A suíte local completa passou em **124 testes de lógica/integração**, sem falhas ou testes ignorados. Os resultados completos do CI e das VMs devem ser conferidos na execução vinculada à versão publicada. Estes testes não medem consumo do aplicativo completo.

## Limites e validação pendente

Ainda não foi validado o desaparecimento do aviso no Echo físico. O [roteiro de teste](../ALEXA.md#teste-com-um-echo-físico) separa app, voz, grupos e rotinas. Um firmware que dependa de brilho para ligar/desligar continua sem esse comportamento: esta adaptação exige `on` explícito para mudar energia.

O brilho virtual começa em 254 a cada novo processo e serve somente à emulação. Pedidos contendo propriedades não suportadas junto de `on`/`bri` preservam o comportamento de ignorar essas propriedades; elas não recebem confirmação. Pedidos contendo somente campos não suportados continuam retornando erro Hue.
