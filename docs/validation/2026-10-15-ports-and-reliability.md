# Portas e revisão de falhas — 15/10/2026

## Problemas encontrados e correções

1. As portas 5050/6743 estavam fixadas também no executável, firewall, verificação da instalação e link do celular. A configuração agora é centralizada em DWORDs protegidos de `HKLM\SOFTWARE\NexusRGB`, lida pelo supervisor e repassada aos serviços. O instalador oferece uma página de portas e o ícone do Nexus oferece **Configurar portas…**, inclusive quando o painel não abre. São validados intervalo, tipo e colisões entre as três portas TCP.
2. Um conflito da ponte Hue dizia sempre “porta 80”, mesmo que outra porta tivesse sido usada no desenvolvimento. O diagnóstico usa a porta real, e a falha da ponte não encerra o painel. UDP 1900 permanece fixo; alterar o HTTP da ponte não assegura compatibilidade com todo Echo.
3. Uma falha de gravação podia deixar estado alterado somente na memória, apesar de o comando retornar erro. O armazenamento agora restaura o último estado confirmado no disco quando a gravação falha. O teste provoca uma falha real de renomeação e confere ajustes e perfis em memória e no arquivo.
4. O atalho nativo do celular filtrava menos adaptadores virtuais que o servidor. Foram acrescentados Hamachi, Radmin, WireGuard, ZeroTier, WSL e túneis ao filtro de nomes do atalho. Isso reduz escolhas indevidas; interfaces renomeadas e múltiplas redes físicas ainda exigem conferir o link em Conexões.
5. A existência de um serviço “Running” não assegurava que seu processo Node tinha iniciado. O ícone agora consulta a saúde do painel de forma assíncrona. A abertura do aplicativo verifica um identificador Nexus na resposta; o instalador e o configurador exigem esse identificador e `ready: true`, evitando aceitar uma resposta genérica de outro aplicativo como sucesso.
6. Uma configuração de portas inválida no registro poderia bloquear a remoção. Desinstalar não depende mais da leitura dessas portas. A janela de configuração permite substituir valores inválidos por números válidos; se precisar restaurar e os valores antigos eram inválidos, usa os padrões conhecidos.

O configurador elevado verifica a identidade dos serviços e listeners antes de parar processos. Uma porta estrangeira é recusada sem parar os serviços. Ele atualiza somente regras próprias de painel/ponte, com programa dedicado, TCP, Ethernet/Wi-Fi e LocalSubnet; não altera regras globais. Se a troca falhar, tenta restaurar portas, regras e estado anterior dos serviços. Alterar apenas painel/ponte não reinicia o serviço de hardware. Logs antigos não são apresentados como erro novo na janela.

## Validações realizadas

- `npm test`: **61 testes passaram**, incluindo conflitos reais de bind, validação de Host na porta escolhida, erro da Alexa com preservação do painel, falha de persistência e as regressões de RGB, zonas e segurança já existentes.
- `npm run test:ui`: **10 testes passaram**, incluindo layout, arraste da cor, perfis, recuperação de sessão e reconexão. A configuração elevada fica na janela nativa, fora do navegador.
- `npm run test:supervisor`: o supervisor C# real reiniciou um filho de teste que falhou e encerrou seu Job sem deixar o filho rodando. Os dados e o filho ficam isolados; nenhum serviço instalado é controlado por esse teste.
- `npm run test:installer`: os seis cenários inertes do evento de pós-instalação passaram. Não instalam drivers, serviços ou regras no PC.
- `tests/port-settings.test.js` executa o corpo real da transação PowerShell com serviços, registro, probes e firewall simulados. Confere porta ocupada sem mutações, sucesso, restauração após falha, mudança somente do painel sem parar hardware e reparo de configuração inválida. Uma consulta separada verifica tipos/limites e o escopo LAN das regras geradas. Não há alterações reais de HKLM ou firewall nesses testes.
- `npm run build` compilou o executável e o instalador completo; os artefatos ficam ignorados em `dist/`. As dependências de produção passaram pela auditoria sem vulnerabilidades reportadas naquele momento. Isso não é uma auditoria de segurança completa.

O workflow manual de instalação em VM foi ampliado para testar portas padrão e alternativas. A mudança no workflow não equivale à execução dessa matriz. Ainda são necessários testes limpos em outros Windows, conflitos surgindo após o boot, redes físicas múltiplas, diferentes controladoras e Echos e uso por períodos longos. Não há garantia de que todos os erros possíveis foram encontrados. A disponibilidade de uma porta pode mudar entre a sugestão e a aplicação; a configuração é conferida novamente ao aplicar.
