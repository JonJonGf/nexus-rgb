# Backup, diagnóstico e atualizações

Estas ferramentas ficam em **Configurações**. Backup, restauração e diagnóstico detalhado exigem abrir o painel no próprio computador. O controle normal das luzes continua disponível pela LAN.

## Guardar e restaurar ajustes

**Exportar backup** gera um JSON `nexus-backup/1` com configurações, perfis, posições, calibração, organização da biblioteca e fontes dos efeitos importados. Guarde esse arquivo em um lugar privado. Ele pode conter nomes e conteúdo de terceiros que não devem ser publicados.

Para recuperar:

1. Escolha **Revisar arquivo de backup**. O Nexus verifica estrutura, limites, referências e fontes, usando o mesmo motor isolado da importação.
2. Confira quantidade de perfis, posições e efeitos, FPS e ativação da Alexa.
3. Clique em **Restaurar ajustes revisados**. A revisão vale cinco minutos e é invalidada se qualquer ajuste ou importação mudar nesse intervalo.
4. Recarregue o painel. Confira a compatibilidade dos componentes e suas quantidades, especialmente se mudou de computador.

A restauração substitui configurações e perfis, mantendo os efeitos que já estavam na biblioteca. Arquivos importados são adicionados por identidade de conteúdo; os originais existentes não são removidos. Antes da gravação, o Nexus cria uma cópia completa em `%ProgramData%\NexusRGB\app\backups\before-restore-*.json`. Falhas de gravação preservam o estado anterior. Arquivos adicionados antes de uma interrupção abrupta podem ficar disponíveis na biblioteca, sem substituir os ajustes anteriores.

O instalador também cria `before-update-*.json` nessa pasta antes de substituir os executáveis, depois de parar os serviços próprios. Se não conseguir guardar o backup, interrompe a preparação e tenta restaurar os serviços. Backups não são excluídos automaticamente; administre o espaço conforme a quantidade de efeitos e atualizações.

Portas, sessões e autorização dos Echos não são transferidas. Não se restaura permissões de rede ou arquivos executáveis de um backup. A ativação da integração Alexa é um ajuste do aplicativo; aparelhos autorizados continuam sujeitos ao cadastro local da instalação.

## Saúde e consumo

A central identifica os processos da própria instalação: serviços, servidor, OpenRGB, motor de efeitos e bandeja, quando o Windows permite consultá-los. Ela não soma outros aplicativos por usarem o nome `node.exe`. A leitura ocorre a cada dez segundos somente com Configurações aberta e a página visível. O Windows pode continuar exibindo processos separados no Gerenciador de Tarefas.

CPU é a diferença entre amostras, normalizada pelo total de processadores lógicos. A primeira leitura mostra que ainda falta outra amostra. Memória é a soma dos conjuntos de trabalho dos processos; páginas compartilhadas podem ser contadas mais de uma vez. Leitura parcial ou permissão insuficiente é indicada explicitamente; no desenvolvimento pode ser possível medir somente o servidor. Esses números não incluem navegador, driver ou o custo transitório do coletor PowerShell. O diagnóstico registra a duração da coleta.

## Relatar um problema

**Preparar diagnóstico** mostra exatamente o relatório técnico JSON que será baixado, utilizando uma lista explícita de campos permitidos (*allowlist*) com versão, ambiente, estado geral, resumo anonimizado de componentes (`device-1`, `device-2`, …), métricas do motor, estado booleano da ponte Alexa, consumo e categorias de falha. Você pode desmarcar qualquer categoria (`Versão e compilação`, `Ambiente Node / SO`, `Controlador e descoberta`, `Resumo de componentes`, `Motor e FPS`, `Estado da ponte Alexa`, `Consumo de processos` e `Categorias de falha`) para removê-la antes do download. O relatório exclui por padrão tokens, credenciais, usuários Hue, seriais, IPs/MACs, caminhos pessoais, nomes de computador/usuário, conteúdo de efeitos importados e nomes/conteúdo de perfis, sem incluir logs crus ou anexos ocultos. Confira o conteúdo e use **Baixar diagnóstico revisado** se quiser anexá-lo manualmente a uma [Issue](https://github.com/JonJonGf/nexus-rgb/issues/new/choose).

Nada é enviado automaticamente. Não anexe o backup completo, sessões ou logs privados sem revisar. O mantenedor e a comunidade respondem no GitHub.

## Consultar uma nova versão

Em **Sobre e atualizações**, abra a página de consulta e clique em **Consultar GitHub**. Somente esse clique consulta o endpoint público do repositório oficial pelo navegador. O GitHub recebe uma requisição comum, incluindo o endereço de origem da conexão; o Nexus não envia perfis, configurações ou a lista de componentes.

A página mostra a versão instalada e uma versão publicada com instalador e arquivos de integridade. Builds alpha/beta/rc podem consultar prévias; uma versão estável não recebe uma prévia como atualização. Sem Internet ou com limite de consultas do GitHub, o RGB continua funcionando normalmente.

O resultado abre a página oficial da versão. Não há download, execução, atualização silenciosa ou alteração do firewall. A consulta não autentica o executável nem substitui assinatura digital. Confira notas, hashes e compatibilidade antes de executar o instalador. Os executáveis Nexus continuam sem assinatura própria enquanto não houver um certificado aprovado.
