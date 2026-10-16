# Prioridades do Nexus RGB

O Nexus está em versão alpha. O objetivo é controlar hardware RGB compatível com OpenRGB de forma local, preservar os ajustes e permitir recuperar o aplicativo sem depender de um desenvolvedor. Esta lista distingue recursos disponíveis de trabalho ainda necessário.

O [plano de melhorias revisado em 16/10/2026](PLANO-MELHORIAS.md) registra os próximos ajustes de hardware, mapa e rede. O teste físico do ajuste Hue da alpha.20 e a solução prática relatada para a resposta de voz da Alexa+ estão no [contexto de desenvolvimento](CONTEXTO-DESENVOLVIMENTO.md). Os demais itens do plano aguardam implementação.

## Estabilidade e recuperação

- **Disponível:** reinício manual do Nexus e OpenRGB pela bandeja, menu Iniciar e Configurações no PC. A operação confere a identidade dos serviços, preserva os dados e verifica o retorno do controlador.
- **Disponível:** o supervisor recupera um processo que encerrou; a conexão SDK tenta reconectar após falha.
- **Pendente:** investigar travamentos em que OpenRGB continua aberto e responde parcialmente. Reiniciar recuperou um caso observado, mas a causa não foi comprovada.
- **Pendente:** recuperação automática de um controlador travado, com confirmação de falha, limites de tentativas e proteção contra reinícios repetidos. O reinício manual atual não implementa essa política.
- **Pendente:** ensaios prolongados, suspensão/retomada do Windows, reconexão USB, mudanças de rede e interação com outros aplicativos RGB em mais computadores.

## Hardware e apresentação

- **Disponível:** detecção pelo OpenRGB, zonas separadas quando há mapa completo por LED, quantidade de LEDs configurável e mapa espacial.
- **Disponível:** visualização das últimas cores enviadas, com perfis e movimentos compartilhados. Essa saída não é uma leitura física dos LEDs.
- **Pendente:** onboarding que diferencie faixa sequencial de hub que replica sinal e facilite identificar componentes de nomes iguais.
- **Pendente:** feedback visual explícito para personalizações individuais, faixas incompatíveis após redimensionamento e alterações ainda não salvas.
- **Pendente:** testes com outras placas-mãe, controladoras e periféricos. A compatibilidade não é universal e depende do OpenRGB.

- **Disponível:** biblioteca visual com busca, ajustes contextuais por componente e painel web em português/inglês.
- **Disponível:** instalador e janelas nativas em português/inglês, com preferência independente do navegador.
- **Pendente:** ampliar os idiomas oferecidos.

## Perfis, diagnóstico e distribuição

- **Disponível:** perfis, posições e importações preservados pelo instalador e pela desinstalação padrão. Backup manual de `settings.json` junto com `effects`.
- **Disponível:** exportação e importação de backup pelo painel, com validação, revisão da restauração e verificação dos efeitos necessários.
- **Disponível:** versão instalada identificada e diagnóstico exportável com revisão dos dados antes de compartilhar.
- **Disponível:** consumo consolidado dos processos identificados como pertencentes à instalação, com indicação de leitura parcial quando houver restrições do Windows. Serviços, ícone do usuário e navegador podem aparecer separados no Gerenciador de Tarefas; um agrupamento visual único ali não está implementado nem garantido.
- **Disponível:** testes automatizados de instalação, atualização, recuperação e remoção em duas VMs Windows antes da publicação do executável correspondente.
- **Pendente:** assinatura digital dos executáveis e revisão independente de segurança. Licença MIT não substitui assinatura digital.

## Alexa e efeitos

- **Disponível:** comandos de ligar/desligar e diagnóstico local da ponte Hue.
- **Pendente:** resolver o caso de Echo que executa o comando, mas anuncia falha. O recadastro da luz e os ajustes de resposta testados não resolveram esse equipamento.
- **Disponível:** efeitos próprios e importação experimental de uma parte dos efeitos Canvas.
- **Pendente:** ampliar os testes de compatibilidade e do orçamento de execução. Áudio e APIs avançadas do SignalRGB não estão implementados.

Sugestões, problemas e resultados de testes devem ser registrados nas [Issues do GitHub](https://github.com/JonJonGf/nexus-rgb/issues). Não há envio automático de diagnóstico ou feedback pelo aplicativo. Não há prazo prometido para os itens pendentes.
