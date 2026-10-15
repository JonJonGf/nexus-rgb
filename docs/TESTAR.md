# Testar o Nexus RGB e compartilhar o resultado

Testes da comunidade ajudam a registrar quais configurações funcionam e a reproduzir problemas em diferentes PCs. Use um instalador da [página oficial de versões](https://github.com/JonJonGf/nexus-rgb/releases) e informe a identificação completa da prévia, como `v0.1.0-alpha.5`. Se executou o código diretamente, informe o commit. As notas de cada versão descrevem os recursos do respectivo pacote.

## Roteiro

1. Instale e abra o painel. Registre a versão do Nexus, versão do Windows e modelos dos componentes que você conhece. Não precisa divulgar números de série, IPs ou dados pessoais.
2. Confira se RAM, placa-mãe e portas/controladoras aparecem. Não marque como detectado algo que não apareceu. Algumas portas ARGB exigem informar a quantidade real de LEDs na aba Dispositivos.
3. Teste uma cor estática, brilho, desligar e religar. Mude um componente e observe se os outros mantêm seus ajustes.
4. Teste os movimentos disponíveis no seu hardware. Informe quais foram testados e se percebeu piscadas involuntárias. Não é necessário testar Estrobo; evite-o em caso de sensibilidade à luz intermitente.
5. Crie um perfil com duas ou três cores, altere a ordem, salve e ative. Recarregue o painel e confira se o perfil continua disponível.
6. Se tiver outro aparelho na mesma LAN, abra o link mostrado em Conexões e tente controlar as luzes. Informe se o endereço funcionou novamente sem ler outro QR.
7. Se tiver um Echo compatível e quiser usar a integração, teste descoberta, ligar e desligar a **Iluminação Nexus**. Informe o modelo e geração do Echo, se conhecidos.
8. Quando for conveniente, reinicie o Windows por sua conta e confira se o serviço inicia e os ajustes retornam. Se testar suspensão e retomada, conte o resultado.
9. Informe quanto tempo usou o aplicativo e eventuais travamentos, desconexões ou problemas para abrir o painel. Se testar desinstalação, registre também o resultado.

Não desative o antivírus nem crie exclusões para conseguir testar. Pare diante de um alerta e compartilhe somente a mensagem relevante, depois de revisar dados pessoais. Não execute dois aplicativos RGB disputando o mesmo hardware.

## Compartilhar no GitHub

Abra [Issues → New issue](https://github.com/JonJonGf/nexus-rgb/issues/new/choose) e escolha **Teste de compatibilidade**, **Relatar um problema** ou **Sugestão**. É necessário ter uma conta GitHub para publicar. Preencha o modelo e revise o texto antes de clicar em **Submit new issue**. Issues e anexos são públicos; não inclua senhas, tokens, números de série ou outros dados pessoais. O aplicativo não coleta nem envia feedback.

O acompanhamento acontece nos comentários da própria issue. Consulte relatos existentes antes de abrir outro e acrescente detalhes ao existente se for o mesmo problema. As notificações seguem as preferências da sua conta GitHub. Não há prazo garantido de resposta.

Também é possível usar diretamente o [modelo de teste de compatibilidade](https://github.com/JonJonGf/nexus-rgb/issues/new?template=teste-de-compatibilidade.md). Marque apenas os itens realmente testados e indique o que ficou pendente. Relatos de configurações que funcionaram também ajudam a documentar a compatibilidade.
