# Roteiro para testes da comunidade

O projeto precisa de testes independentes em PCs e controladoras diferentes. Compatibilidade com um modelo não comprova suporte a todos os computadores. Use o instalador de uma [versão publicada](https://github.com/JonJonGf/nexus-rgb/releases) e registre sua tag.

1. **Antes de instalar:** feche outros controladores RGB e guarde os ajustes do fabricante. Mantenha as proteções do Windows. Não instale ou libere um driver bloqueado para fazer um teste.
2. **Instalação:** escolha português ou inglês, confira portas e os avisos. Registre se o painel abriu e o controlador ficou pronto. Uma porta ocupada deve oferecer um erro claro, preservando o aplicativo que já a usa.
3. **Detecção:** informe placa-mãe, memória, controladora e quantidade real de LEDs. Confira cada componente e o teste de identificação no mapa. Não suponha ligação independente só por existir cabo entre fans.
4. **Movimentos:** teste estático, movimentos comuns e um efeito espacial. Confira a orientação usando os LEDs físicos. Se o desenho e a peça discordarem, registre anéis, sentido, primeiro LED e fiação observados.
5. **Perfis e mapa:** crie um perfil próprio, duplique um existente, posicione peças, crie um grupo e teste desfazer/refazer. Recarregue a página e confirme que os ajustes persistiram.
6. **Atualização e backup:** exporte um backup privado; atualize usando o instalador seguinte e confira perfis, posições, calibração e fontes. Teste a revisão da restauração somente em uma configuração que possa recuperar. Nunca envie o backup completo publicamente.
7. **Confiabilidade:** teste suspensão/retomada e um reinício normal do Windows quando for conveniente. Registre tempo até a detecção. Se for necessário recuperar o serviço, use a ação própria do Nexus e confira o resultado. Não desconecte hardware interno com o PC energizado para simular falhas.
8. **Telefone:** abra o link LAN e teste controles. O endereço deve acompanhar a porta escolhida. A consulta opcional ao GitHub pode falhar sem Internet, mantendo o RGB funcionando.
9. **Alexa, se disponível:** teste acender e apagar pelo app e por voz. Registre separadamente se as luzes responderam e se a Alexa confirmou sucesso. Informe modelo/geração do Echo; não publique seu IP ou dados da conta.
10. **Consumo e remoção:** observe a central por alguns minutos, anotando efeitos/FPS e se a leitura é parcial. Desinstale se quiser e confira a preservação dos dados e dos outros aplicativos. Uma reinstalação deve recuperar os ajustes locais.

Abra um [teste de compatibilidade](https://github.com/JonJonGf/nexus-rgb/issues/new?template=teste-de-compatibilidade.md). Marque somente o que foi testado e informe o que falhou. O diagnóstico revisado de Configurações pode ajudar; revise também capturas antes de anexar. Comentários e respostas ficam no GitHub, sem coleta automática pelo aplicativo.
