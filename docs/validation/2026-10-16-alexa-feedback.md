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

## Validação automatizada do commit da versão

O [CI 38957323136](https://github.com/JonJonGf/nexus-rgb/actions/runs/38957323136) executou o commit `b00c3f687bdd9509dd3d9d9d79a362034cb7c397`: **124 testes de lógica/integração e 34 de interface aprovados**, além do supervisor nativo. O teste de estabilidade de 60 segundos passou com 171 requisições e dez reinícios abruptos do processo de teste.

As três análises CodeQL da [execução da alpha.20](https://github.com/JonJonGf/nexus-rgb/actions/runs/38957323137), para o mesmo commit/tag, concluíram sem erros ou avisos de análise e sem alertas abertos. C# foi analisado com compilação manual acompanhada. As regras e o bloqueio de publicação foram preservados; não houve descarte de novos alertas para esta alteração. Isso não equivale a auditoria independente ou certificação.

## Instaladores publicados

As duas VMs Windows passaram em **75 verificações cada, sem falhas**, nas portas painel/SDK/Alexa `5050/6743/80` e `5151/6754/8081`. Incluem instalação, atualização, recuperação, preservação dos dados, desinstalação e reinstalação. Essas VMs não possuem RGB físico nem um Echo.

A [alpha.20](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.20) foi publicada pelo workflow acima a partir do commit documentado. Os quatro assets oficiais foram baixados e conferidos: tag, commit, execução, tamanhos e hashes coincidem com `BUILD-INFO.json`, `SHA256SUMS.txt` e os digests do GitHub. Essa verificação não executou o instalador no PC em uso.

| Arquivo | Bytes | SHA256 |
| --- | ---: | --- |
| `NexusRGB-Setup-0.1.0.exe` | 94583500 | `3764a31f34170d346875abc0c980af83a5d19722c23b27151fd257c94f84b264` |
| `NexusRGB-Uninstall-0.1.0.exe` | 240640 | `84709a3a84a2beeea326a27a8e56bb70395523e07da28ae567e977b8c6111648` |

## Limites e validação pendente

Ainda não foi validado o desaparecimento do aviso no Echo físico. O [roteiro de teste](../ALEXA.md#teste-com-um-echo-físico) separa app, voz, grupos e rotinas. Um firmware que dependa de brilho para ligar/desligar continua sem esse comportamento: esta adaptação exige `on` explícito para mudar energia.

O brilho virtual começa em 254 a cada novo processo e serve somente à emulação. Pedidos contendo propriedades não suportadas junto de `on`/`bri` preservam o comportamento de ignorar essas propriedades; elas não recebem confirmação. Pedidos contendo somente campos não suportados continuam retornando erro Hue.
