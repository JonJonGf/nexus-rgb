# ⚡ Nexus RGB

<p align="center">
  <img src="docs/assets/nexus-banner.svg" alt="Nexus RGB — Seu RGB. Sua rede. Seu controle. Windows, OpenRGB incluído, controle local e Alexa para ligar e desligar." width="100%">
</p>

<p align="center">
  <b>A iluminação do seu setup, do seu jeito.</b><br>
  Controle os componentes RGB do PC pelo computador, celular ou tablet.<br>
  Escolha suas cores no Nexus e use a Alexa para acender ou apagar as luzes.
</p>

<p align="center">
  <a href="https://github.com/JonJonGf/nexus-rgb/releases/download/v0.1.0-alpha.21/NexusRGB-Setup-0.1.0.exe"><b>⬇️ Baixar instalador para Windows</b></a> ·
  <a href="https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.21">Arquivos da versão</a>
</p>

<p align="center">
  <a href="#instalacao">Instalar</a> ·
  <a href="#celular">Usar no celular</a> ·
  <a href="#alexa">Configurar Alexa</a> ·
  <a href="#ajuda">Resolver problemas</a> ·
  <a href="#desempenho">Consumo</a> ·
  <a href="#desinstalar">Desinstalar</a> ·
  <a href="docs/DESENVOLVIMENTO.md">Desenvolver</a>
</p>

> **v0.1.0-alpha.21 · Gratuito e de código aberto.** Esta prévia inclui mapa espacial do setup, importação experimental de efeitos Canvas e FPS configurável. Esta versão também inclui calibração, organização da biblioteca, backup e diagnóstico local. Os executáveis Nexus ainda não têm assinatura digital própria. A compatibilidade depende do hardware, do efeito e do suporte do OpenRGB.

---

## 📖 Ajuda dentro do aplicativo

Em **Configurações → Ajuda e primeiros passos**, abra o guia local formatado, em português ou inglês, sem Internet. Na pasta instalada, use **LEIA-ME.txt** no Bloco de Notas. O README.md usa formatação Markdown, exibida no GitHub e em leitores compatíveis.

A apresentação inicial aparece somente no primeiro acesso de uma instalação nova. O registro fica na pasta de dados e é preservado ao reabrir ou atualizar; a ajuda continua acessível nas Configurações. Instalações já existentes não recebem a apresentação novamente.

## ✨ O que o Nexus faz

| 🖥️ No computador | 📱 No celular | 🗣️ Com a Alexa |
| :--- | :--- | :--- |
| Cor, brilho e efeitos para o setup inteiro ou por componente. | O mesmo painel no navegador, pelo link da sua rede. | Uma única luz: **Iluminação Nexus**, para ligar e desligar. |
| Perfis salvos e seis cenas prontas para começar. | Sem conta, login ou leitura obrigatória de QR Code. | Preserva as cores, os efeitos e os ajustes individuais ao religar. |

- **OpenRGB incluído:** o instalador prepara o controlador e as dependências. Você não precisa instalar Node.js nem configurar um servidor OpenRGB à parte.
- **Cada componente, do seu jeito:** RAM, placa-mãe, controladoras e periféricos compatíveis aparecem a partir da detecção real do OpenRGB.
- **RGB e ARGB separados:** quando o hardware informa um mapa completo de zonas e permite cor por LED, as portas e a iluminação interna aparecem como componentes independentes.
- **O layout acompanha sua cor:** a cor estática escolhida também muda a identidade visual do painel.
- **Um efeito atravessando o setup:** organize as peças no mapa, divida faixas de LEDs e ajuste rotação, tamanho e ordem.
- **Mapa compartilhado:** acompanhe Iluminação e Perfis pelas cores enviadas a cada LED. Escolha perfis e cenas no mapa; nos efeitos espaciais, solte a peça para aplicar e salvar sua posição sem reiniciar a animação.
- **Sua biblioteca de efeitos:** três efeitos espaciais incluídos, fórmulas Nexus em JSON e importação local experimental de HTML Canvas, com autoria preservada. O criador oferece doze padrões, colagem de HTML/Canvas compatível, prévia isolada antes de aplicar e [documentação dos padrões](docs/EFEITOS.md) ([English](docs/EFFECTS.md)).
- **Português e inglês:** escolha em **Configurações → Idioma da interface**. A preferência é salva por navegador e não muda as luzes ou os nomes dos seus perfis. O instalador também oferece os dois idiomas; na bandeja do Windows, use **Idioma / Language** para as janelas nativas. As preferências do navegador e do Windows são independentes, sem serviço de tradução externo.
- **Mapa calibrado:** vários anéis, primeiro LED, sentido e ordem física por peça; grupos, seleção múltipla, grade e desfazer/refazer. [Veja como configurar](docs/MAPA-E-CALIBRACAO.md).
- **Biblioteca organizada:** favoritos, categorias e cópias de perfis/efeitos. A transição entre perfis é opcional; desligar as luzes continua imediato.
- **Backup completo:** exporte ajustes, mapa e efeitos; revise antes de restaurar. O Nexus guarda uma cópia anterior à restauração e à atualização.
- **Saúde e versão:** acompanhe os processos da instalação e revise um diagnóstico antes de compartilhar. A consulta opcional de atualizações no GitHub funciona por clique, sem baixar nem instalar automaticamente. [Backup, diagnóstico e atualizações](docs/BACKUP-E-DIAGNOSTICO.md).
- **Fluidez configurável:** escolha de 5 a 60 FPS na aba Configurações; padrão de 20 FPS.
- **Início com o Windows:** os serviços são configurados para iniciar automaticamente, mesmo antes do login. Fechar a janela mantém o controle em segundo plano.
- **Recuperação pelo próprio app:** reinicie Nexus e OpenRGB pelas Configurações no PC, pelo ícone da bandeja ou pelo menu Iniciar. Os perfis e configurações são preservados; o Windows pede administrador.
- **Controle na LAN:** o painel e os efeitos funcionam na rede local, sem depender de uma conta ou servidor externo do Nexus.

<a id="instalacao"></a>

## 🚀 Instalação — do executável ao primeiro uso

### 1. Confira o que você precisa

| Requisito | Para que serve |
| :--- | :--- |
| Windows 10 ou 11, em um PC x64 | Executar o aplicativo e seus serviços. |
| Hardware RGB compatível com OpenRGB 1.0 | Detectar e controlar os LEDs. Confira a [lista oficial de dispositivos](https://openrgb.org/devices_1.0.html). |
| Permissão de administrador durante a instalação | Instalar os serviços, preparar o driver e criar as regras locais do Nexus. |
| PC e celular na mesma rede local | Acessar o painel pelo telefone. O PC pode estar no cabo e o celular no Wi-Fi. |
| Echo compatível na mesma rede, se quiser Alexa | Usar os comandos de ligar e desligar. |

### 2. Obtenha o instalador

O arquivo para instalar esta versão se chama:

```text
NexusRGB-Setup-0.1.0.exe
```

Baixe o [instalador compilado](https://github.com/JonJonGf/nexus-rgb/releases/download/v0.1.0-alpha.21/NexusRGB-Setup-0.1.0.exe) ou abra a [página da versão](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.21) para consultar os executáveis, hashes SHA256 e mudanças da prévia.

**Download gratuito e público:** não é necessário ter conta GitHub para baixar o instalador ou o código. O painel na LAN também funciona sem conta ou login.

Se você prefere instalar a partir do código, clone o repositório e siga [como gerar o instalador](docs/DESENVOLVIMENTO.md#gerar-instalador). O executável gerado fica na pasta `dist`.

### 3. Prepare o computador

1. Feche a versão antiga do Nexus, se estiver em execução.
2. Feche outros OpenRGB e os aplicativos de controle RGB do fabricante para evitar que dois programas disputem os mesmos LEDs.
3. Salve seu trabalho antes de continuar, caso o instalador do driver solicite um reinício.

### 4. Instale

1. Dê dois cliques em **NexusRGB-Setup-0.1.0.exe**.
2. Autorize o pedido de administrador do Windows para iniciar a instalação.
3. Escolha se deseja criar o atalho na área de trabalho e mostrar o ícone ao entrar no Windows.
4. Em **Portas da rede**, mantenha os padrões ou escolha portas disponíveis. Consulte [como resolver conflitos de porta](#portas).
5. Para controlar RAM e placas-mãe que precisam do driver, mantenha selecionada a opção **Abrir instalador do driver assinado PawnIO** e conclua a janela do instalador oficial.
6. Aguarde a conclusão e selecione **Abrir Nexus RGB**.

O pacote já inclui **Node.js, OpenRGB 1.0, Microsoft Visual C++ e o instalador oficial do PawnIO**. Essas dependências são preparadas pelo instalador; não é necessário baixá-las separadamente. O Nexus não pede que você desative o antivírus ou as proteções do Windows.

### 5. Faça o primeiro ajuste

1. Abra **Nexus RGB** pelo menu Iniciar ou pelo atalho.
2. Confira o indicador **Controlador conectado** e os componentes detectados.
3. Em **Iluminação**, clique ou arraste a bolinha da roda de cores, ajuste **Intensidade** e escolha um efeito.
4. Para começar com uma combinação pronta, clique em **Aurora**, **Brasa** ou outra cena na barra inferior.
5. Para personalizar separadamente a RAM, a placa-mãe ou uma porta ARGB, abra **Dispositivos**.

Os ajustes são salvos automaticamente. Quando o controlador está desconectado, o Nexus guarda a configuração para aplicar assim que a conexão voltar.

> **Seu PC precisa estar ligado e acordado.** O celular e a Alexa controlam os LEDs desse computador; o painel fica indisponível quando ele está desligado ou suspenso.

<a id="celular"></a>

## 📱 Um link para o celular, o tablet e outro PC

1. Conecte os aparelhos à mesma rede local do computador.
2. No Nexus aberto pelo aplicativo do PC, entre em **Conexões**.
3. Selecione a rede do computador e clique em **Mostrar link e QR Code**.
4. Copie o link ou leia o QR Code uma vez para abrir o painel no celular.
5. Salve nos favoritos ou use **Adicionar à tela inicial** no navegador, quando essa opção estiver disponível.

O endereço tem este formato:

```text
http://IP-DO-SEU-PC:5050/
```

Por exemplo, se o PC tiver o IP `192.168.1.100`:

```text
http://192.168.1.100:5050/
```

Use o endereço mostrado pelo seu Nexus; o IP acima é apenas um exemplo e **5050 é a porta padrão**. Se você escolher outra porta, use-a também no endereço. No próprio computador, abra pelo ícone Nexus, que usa a porta configurada. O endereço `127.0.0.1` funciona somente no PC que executa o aplicativo.

**Não precisa ler o QR Code toda vez.** O favorito ou atalho abre o mesmo link, sem login ou pareamento. Para manter o endereço mesmo após reiniciar o roteador ou o computador, reserve o IP do PC nas configurações DHCP do roteador.

O atalho no telefone abre o painel web. Esta versão não inclui um APK ou aplicativo iOS nativo. Wi-Fi de convidados e redes com isolamento entre aparelhos podem impedir o acesso.

<a id="portas"></a>

### Trocar portas e resolver conflitos

Na instalação, a página **Portas da rede** permite escolher as portas do painel, SDK OpenRGB e ponte Alexa. Depois de instalado, clique com o botão direito no ícone Nexus perto do relógio e escolha **Configurar portas…**. Essa janela funciona mesmo se o painel não abrir. Use **Buscar livre** para sugerir uma porta de painel ou SDK disponível e depois **Aplicar e reiniciar Nexus**. O Windows pede administrador para salvar a configuração e atualizar somente as regras do Nexus no firewall.

| Uso | Padrão | Configuração |
| :--- | :--- | :--- |
| Painel no PC e celular | TCP 5050 | 1024 a 65535 |
| SDK OpenRGB, somente no PC | TCP 6743 | 1024 a 65535 |
| Ponte Alexa | TCP 80 | 1 a 65535; manter 80 favorece compatibilidade com Echos |
| Descoberta Alexa | UDP 1900 | Fixa pelo protocolo SSDP |

As três portas TCP precisam ser diferentes. O configurador recusa uma porta ocupada por outro programa e tenta restaurar a configuração anterior se a troca falhar. Ele não encerra programas de terceiros. Outro OpenRGB controlando o mesmo hardware continua sendo um conflito de controle, mesmo se usar outra porta. A disponibilidade da porta sugerida é conferida novamente ao aplicar, pois outro programa pode ocupá-la nesse intervalo.

As portas ficam salvas em `HKLM\SOFTWARE\NexusRGB` e são reutilizadas após reiniciar e atualizar o Nexus. A alteração não fica disponível pela LAN. Ao mudar a porta do painel, abra o novo endereço pelo ícone e atualize o favorito do celular ou gere outro QR em **Conexões**. O link permanece igual enquanto IP e porta não mudarem. Alterar a porta HTTP da Alexa pode exigir redescoberta e não garante compatibilidade com todos os Echos; o Nexus não muda a porta UDP 1900.

<a id="iluminacao"></a>

## 🎨 Cores, efeitos e perfis

### Controle geral e por componente

| Onde ajustar | O que você pode fazer |
| :--- | :--- |
| **Iluminação** | Sincronizar o setup, escolher cor, brilho, ritmo e efeito. Um ajuste geral substitui as personalizações individuais. |
| **Dispositivos** | Escolher configurações próprias para cada componente, incluindo ligar ou desligar individualmente. |
| **Perfis** | Usar cenas prontas, **+ Criar perfil** com sequência de cores e movimento, ou **Salvar perfil atual** para guardar também os ajustes individuais. Criar, editar e excluir exige abrir o painel no próprio PC (`127.0.0.1`); ativar funciona também pelo telefone. |
| **Zonas**, em Dispositivos | No aplicativo do PC, informar a quantidade real de LEDs de uma zona redimensionável, quando o controlador permite. |

### Efeitos disponíveis

| Efeito | Como fica |
| :--- | :--- |
| **Estático** | Uma cor contínua. |
| **Arco-íris** | Cores mudando por todo o espectro. |
| **Onda** | Cores percorrendo os LEDs. |
| **Respiração** | O brilho sobe e desce suavemente. |
| **Pulso** | Pulsos de intensidade. |
| **Estrobo** | Flashes de luz com ritmo ajustável entre 0,5 e 2 flashes por segundo. |
| **Sequência** | Uma cor por vez, seguindo a ordem que você montou no perfil. |
| **Cometa** | Uma luz atravessa os LEDs deixando uma cauda. |
| **Vai e vem** | Um feixe percorre os LEDs e volta. |
| **Cintilação** | Pontos de luz acendem e diminuem suavemente. |

Os efeitos dependem das capacidades do componente. Em zonas independentes de uma mesma controladora, modos nativos que alterariam toda a placa não são oferecidos por zona.

Na aba **Perfis**, clique em **+ Criar perfil**, dê um nome e escolha o movimento. Adicione de **1 a 8 cores**, ajuste cada uma no seletor e use as setas para mudar a ordem. Escolha intensidade e ritmo e clique em **Salvar**. Depois use **Ativar perfil** para aplicar às luzes. Salvar ou editar não altera a iluminação atual. Os perfis ficam no PC e são restaurados ao iniciar o serviço; você pode ativá-los pelo celular no mesmo link.

O criador oferece os dez movimentos da tabela. A tela principal mantém seis atalhos; os quatro movimentos adicionais ficam no criador e também nos componentes compatíveis em **Dispositivos**. Os modos próprios do hardware continuam nessa aba. Não é preciso instalar outro plugin de efeitos.

Onda e Arco-íris misturam as cores na ordem escolhida. Nos outros movimentos animados, as cores se alternam a cada ciclo. Estático mantém a primeira cor. Cometa e Vai e vem precisam de LEDs individualmente endereçáveis; esses movimentos comuns seguem a ordem de LEDs informada pelo OpenRGB. Editar um perfil que guardava ajustes individuais ou um efeito espacial substitui esses ajustes por uma sequência geral, como indicado no editor. Há um limite de 32 perfis salvos.

### Organizar os dispositivos no espaço

Abra **Mapa do setup** para acompanhar as cores enviadas pela Iluminação e pelos Perfis, incluindo Arco-íris. Use **Trocar efeito** no próprio mapa para abrir a biblioteca visual com busca e filtros. Selecione uma peça para ajustar formato, tamanho e rotação na lateral; os detalhes de conexão e divisão de LEDs ficam recolhidos. Esses controles compartilham as configurações das outras abas.

Arraste as peças para representar seu gabinete e solte para aplicar e salvar a posição. Nos efeitos da **Biblioteca de efeitos** espaciais, a posição de cada LED determina a cor recebida de uma imagem em movimento. Nos movimentos comuns, a sequência segue a ordem física dos LEDs. Mover peças preserva o efeito ativo e os ajustes individuais. Há formatos de fita, anel e matriz, com rotação e inversão da ordem. **Separar em ventoinhas** divide uma faixa em fans consecutivos quando o cabeamento permite endereçamento independente.

Use **Criar efeito** para escolher movimento, cores em sequência, ritmo, direção e escala em um editor visual. O JSON fica na opção avançada. Você pode guardar o modelo também em **Perfis**, ou usar **Salvar como perfil** na biblioteca; salvar não aplica o efeito às luzes.

O mapa inclui **Aurora espacial**, **Cometa no setup** e **Anéis de luz**. No PC, **Importar efeito** adiciona HTML Canvas compatível ou JSON `nexus-effect/1` à biblioteca local. A importação não ativa as luzes automaticamente. As cores das peças mostram os últimos comandos enviados, sem leitura física de cada LED; modos nativos sem essa informação aparecem sem cor conhecida.

A compatibilidade com efeitos do SignalRGB é parcial: áudio, integrações, arquivos externos e APIs avançadas não são suportados. Efeitos de outros criadores não acompanham o pacote. Consulte o [tutorial do mapa, importação, fórmulas e limites](docs/STUDIO.md).

### Ajustar a fluidez

Em **Configurações → Atualização do RGB**, escolha de **5 a 60 FPS** e salve. O padrão é 20. A mudança dispensa reiniciar o controlador; a prévia do mapa usa até 10 FPS para economizar tráfego. A taxa física dos LEDs depende também da controladora e do OpenRGB. O painel mostra os FPS renderizados pelo motor do mapa.

**Estrobo produz luz intermitente.** Evite esse efeito se você ou alguém próximo tiver sensibilidade a flashes. A prévia no editor mostra apenas a paleta, sem piscar.

### Coleção Nexus — seis cenas para começar

| Cena | Paleta e movimento | Clima |
| :--- | :--- | :--- |
| 🌌 **Aurora** | Verde, turquesa e violeta em ondas. | Fluido |
| 🔥 **Brasa** | Âmbar com respiração lenta. | Quente |
| 🪐 **Nebulosa** | Violeta, magenta e azul em uma onda lenta. | Imersivo |
| 🌊 **Abissal** | Azul profundo e ciano, com pouca luz. | Suave |
| ☀️ **Solar** | Laranja em pulsos. | Energia |
| 🌙 **Silêncio** | Branco quente com baixo brilho. | Noturno |

<a id="alexa"></a>

## 🗣️ Alexa — acenda e apague seu setup

A integração é opcional e vem desativada. Você precisa de um Echo compatível na mesma rede do PC. O Nexus apresenta uma ponte Hue local; não é necessário comprar uma ponte física para controlar o Nexus.

### Como conectar

1. Abra **Conexões** pelo aplicativo Nexus no computador.
2. Ative a opção **Amazon Alexa** e confira o estado **Ponte local ativa**.
3. Clique em **Buscar Echo por 2 minutos**.
4. No aplicativo Alexa do telefone, inicie a adição de um dispositivo **Philips Hue Bridge V1 (redonda)**.
5. Quando um IP aparecer no Nexus, confira no roteador ou aplicativo Alexa se ele pertence ao seu Echo e clique em **Autorizar Echo**.
6. Se a primeira busca não concluir, abra novamente a janela de descoberta de dois minutos e repita a busca no aplicativo Alexa.
7. Confirme que a luz **Iluminação Nexus** apareceu e teste os comandos abaixo.

> **“Alexa, acenda a Iluminação Nexus.”**
>
> **“Alexa, apague a Iluminação Nexus.”**

A Alexa controla **somente ligar e desligar**. Cores, brilho, efeitos e perfis ficam no painel Nexus. Ao religar pela Alexa, seus ajustes individuais são preservados; componentes que estavam apagados continuam apagados.

A ponte usa uma apresentação Hue de compatibilidade com brilho virtual. O controle de brilho que aparece na Alexa não representa nem altera o brilho RGB escolhido no Nexus. Pedidos contendo somente brilho mantêm a energia atual; use os comandos explícitos de ligar/desligar. A alpha.20 confirma separadamente energia e brilho virtual para investigar o aviso de falha de alguns Echos; o resultado ainda depende de teste em equipamento físico. Consulte o [comportamento e o roteiro de teste](docs/ALEXA.md).

Use o nome completo **Iluminação Nexus** para evitar confusão com outros dispositivos cadastrados na Alexa. Caso existam entradas antigas de versões anteriores do Nexus, remova-as no aplicativo Alexa e faça a descoberta novamente.

Reserve os IPs do PC e do Echo no roteador. A descoberta pode variar com o modelo e firmware do Echo; a [documentação da emulação Hue](https://www.home-assistant.io/integrations/emulated_hue/) explica as limitações desse protocolo. A integração não é certificada pela Amazon ou Philips.

O painel Nexus atende somente a rede local. Comandos fora de casa pelo aplicativo Alexa dependem do Echo, dos serviços da Amazon e da compatibilidade da integração com o aparelho.

## 🪟 No dia a dia

- **Abrir o painel:** use o atalho, o menu Iniciar ou dê dois cliques no ícone do Nexus ao lado do relógio.
- **Usar a bandeja:** clique com o botão direito para abrir o painel, copiar o link do celular ou abrir a pasta de diagnósticos.
- **Se o controlador travar:** use **Reiniciar Nexus e OpenRGB…** na bandeja ou no menu Iniciar. Em **Configurações**, no PC, **Reiniciar no Windows…** abre a mesma ação. Autorize abrir o aplicativo e o pedido de administrador. A janela confere o painel e o OpenRGB; recarregue o navegador ao terminar. Esse comando reinicia os serviços, sem apagar os ajustes nem reiniciar o computador. No celular, faça essa recuperação pelo PC.
- **Fechar a janela:** os serviços continuam funcionando. A opção **Fechar ícone (manter as luzes)** também mantém o controle ativo.
- **Iniciar com o Windows:** o instalador configura os serviços e a restauração dos ajustes. Não é necessário abrir o painel para ativar os serviços.
- **Atualizar:** no ícone ao lado do relógio, escolha **Fechar ícone (manter as luzes)** e execute o instalador da nova versão. Fechar apenas a aba do navegador não encerra esse ícone. Seus dados locais são mantidos. Reabra pelo atalho e recarregue páginas que já estavam abertas.
- **Guardar seus perfis:** em Configurações, use **Exportar backup**. Para recuperar, escolha **Revisar arquivo de backup**, confira o resumo e confirme a restauração no PC. Os arquivos locais continuam em `%ProgramData%\NexusRGB\app`; cópias automáticas ficam na subpasta `backups`. Recarregar a página não apaga seus dados. Atualização, reinstalação e desinstalação padrão os preservam. [Detalhes e limites](docs/BACKUP-E-DIAGNOSTICO.md).
- **Desinstalar:** use o [assistente de desinstalação](#desinstalar), o atalho **Desinstalar Nexus RGB** no menu Iniciar ou as configurações de aplicativos do Windows.

<a id="desinstalar"></a>

## 🧹 Desinstalar o Nexus RGB

1. Baixe [NexusRGB-Uninstall-0.1.0.exe](https://github.com/JonJonGf/nexus-rgb/releases/download/v0.1.0-alpha.21/NexusRGB-Uninstall-0.1.0.exe).
2. Abra o arquivo e autorize o pedido de administrador do Windows.
3. Confirme a remoção na janela do desinstalador e aguarde a conclusão.

Esse assistente localiza a instalação oficial e abre o desinstalador do Nexus registrado no Windows. Se o aplicativo não estiver instalado ou os arquivos estiverem incompletos, ele informa o problema.

A remoção desativa e remove os serviços e as regras próprias de firewall. Seus perfis e dados locais são preservados para uma futura reinstalação. O driver PawnIO e o runtime Microsoft Visual C++, que podem ser compartilhados com outros programas, também são mantidos.

<a id="desempenho"></a>

## 📊 Quanto o Nexus consome?

**Candidata alpha.15, incorporada na alpha.16 — medição de 16/10/2026:** o navegador com o mapa usou **0,62% de CPU / 489,39 MiB**, contra **0,54% / 486,05 MiB** na interface alpha.14. Em outro ensaio, **somente servidor + motor** com Aurora somaram **0,41% / 132,71 MiB a 20 FPS** e **0,83% / 157,11 MiB a 60 FPS**. CPU considera as 12 threads; RAM soma conjuntos residentes. São janelas curtas com SDK simulado, sem medir LEDs físicos. **OpenRGB, serviços, bandeja e driver ficam fora dessas somas.** Os escopos são separados; veja [método, sete cenários e dados](docs/DESEMPENHO.md#alpha15).

<details>
<summary>Ensaios anteriores e consumo da instalação medida em 2026</summary>

Medição real em **13/10/2026**, em um PC com **Ryzen 5 3600 (6 núcleos / 12 threads), 32 GB de RAM e Windows 11 Pro**, controlando **92 LEDs em 3 controladoras e 5 componentes**. Foram amostrados os serviços, Node.js, OpenRGB e o ícone da bandeja, com o painel do navegador fora da soma.

| Cenário | CPU média | Pico de CPU em 1 s | RAM residente média | Pico de RAM residente |
| :--- | ---: | ---: | ---: | ---: |
| Luzes apagadas · 40 s | 0,065% | 0,395% | 187,38 MiB | 187,41 MiB |
| Cor estática, luzes ligadas · 30 s | 0,035% | 0,393% | 187,68 MiB | 187,71 MiB |
| Onda, luzes ligadas · 30 s | 0,468% | 1,037% | 187,86 MiB | 188,03 MiB |

**Como ler:** CPU é a porcentagem da capacidade total das 12 threads, calculada a partir do tempo de CPU dos processos. RAM é a soma dos conjuntos residentes (*Working Set*), que pode contar páginas compartilhadas mais de uma vez. **1 MiB = 1.048.576 bytes.** As pequenas diferenças entre apagado e estático são variações normais de uma amostragem curta.

Efeitos animados usam a taxa escolhida em Configurações, de 5 a 60 FPS (padrão 20). Na cor estática, o Nexus mantém a configuração aplicada e evita reescrever os LEDs enquanto nada muda. Hardware, quantidade de LEDs, modo e velocidade podem alterar o consumo.

Os números são uma referência da configuração medida em 13/10/2026, anterior a esta prévia; o consumo pode variar em outras versões e máquinas. O navegador acrescenta seu próprio consumo quando o painel está aberto. GPU, energia em watts, inicialização e comportamento durante horas de uso não foram medidos. Consulte o [relatório completo e o método](docs/DESEMPENHO.md).

**Novo motor espacial — ensaio isolado de 15/10/2026:** no mesmo PC, servidor e processo de efeitos somaram **0,372% de CPU / 132,82 MiB** com Aurora a 20 FPS e **0,593% / 156,97 MiB** a 60 FPS, sem prévia aberta. Com prévia a 60 FPS, foram **0,969% / 184,58 MiB**. Um HTML próprio de barras a 60 FPS, sem prévia, usou **1,055% / 250,24 MiB**. São médias de janelas de aproximadamente 26 segundos, com SDK simulado e 92 LEDs; **não incluem OpenRGB, serviços, bandeja ou navegador**, e não medem a taxa física dos LEDs. Os dois efeitos renderizaram cerca de 20/60 FPS conforme solicitado. Veja todos os cenários e limites no [relatório do motor espacial](docs/DESEMPENHO.md#motor-espacial--medição-de-15102026).

**Prévia compartilhada — alpha.10:** com Arco-íris comum e SDK simulado de 92 LEDs, o servidor usou **0,065% de CPU / 51,27 MiB** sem prévia e **0,104% / 54,45 MiB** com prévia. Observar o efeito comum não abriu processo Canvas. Esses números **não incluem OpenRGB, serviços, bandeja ou navegador**. Consulte o [ensaio da prévia e seus limites](docs/DESEMPENHO.md#prévia-compartilhada--v010-alpha10).

**Mapa e inglês — candidata alpha.13, incorporada na alpha.14:** em duas rodadas com Edge isolado, o mapa anterior usou **0,58% de CPU / 520,53 MiB**, o novo em português **0,53% / 519,43 MiB**, em inglês **0,54% / 523,68 MiB** e com a biblioteca aberta **0,60% / 525,54 MiB**. Aqui a RAM é do navegador inteiro, somando processos; o heap JavaScript da página ficou entre **3,54 e 3,91 MiB** em média. CPU é a fração das 12 threads. São janelas curtas de cerca de 13 segundos, com SDK simulado e Aurora a 20 FPS; **não incluem os serviços ou OpenRGB**, não medem LEDs físicos e não comprovam ganho de desempenho ou estabilidade prolongada. Veja o [método e os dados](docs/DESEMPENHO.md#interface-do-mapa-e-inglês--v010-alpha13).

</details>

Os testes de lógica, interface, instalação e recuperação estão descritos no [relatório de validação](docs/VALIDACAO.md), com data, ambiente e limites de cada ensaio. Cada medição informa quais processos foram somados; os ensaios isolados não representam o consumo do aplicativo completo.

<a id="ajuda"></a>

## 🛠️ Algo não funcionou?

| Sintoma | O que conferir |
| :--- | :--- |
| **Nenhum dispositivo foi detectado** | Feche outros programas RGB, confirme a instalação do PawnIO se o hardware precisa dele e consulte a compatibilidade do modelo no OpenRGB. |
| **RAM aparece, mas a porta ARGB fica apagada** | Em **Dispositivos**, confira as zonas e informe a quantidade real de LEDs da porta, quando ela permite redimensionamento. Nem todo header identifica sozinho os LEDs conectados. |
| **O celular não abre o painel** | Use o IP e a porta mostrados em **Conexões**, com `http://`. Confira se o PC está acordado e se os aparelhos estão na mesma sub-rede, sem isolamento de convidados. |
| **O link parou depois de reiniciar** | Confira se o IP do PC mudou. Abra o novo endereço mostrado no Nexus e faça uma reserva DHCP no roteador para manter o link. |
| **O instalador informa porta ocupada** | Volte à página **Portas da rede** e escolha outros números para o painel/SDK. Na instalação existente, use **Configurar portas…** pelo ícone Nexus. Outro OpenRGB disputando o hardware precisa ser fechado por você. |
| **O instalador pede para fechar o Nexus** | Clique com o botão direito no ícone ao lado do relógio e escolha **Fechar ícone (manter as luzes)**. Depois execute novamente o instalador. |
| **Aparece “O Windows protegeu o computador” ou “Editor desconhecido”** | Os executáveis Nexus desta prévia ainda não têm assinatura digital própria. Confira a origem na página oficial da versão e o hash em `SHA256SUMS.txt`. Não desative o SmartScreen ou o antivírus. A assinatura e a reputação de distribuição continuam pendentes. |
| **A ponte Alexa informa porta ocupada** | Outro programa está usando a porta HTTP configurada. Consulte **Configurar portas…** pelo ícone. Alguns Echos exigem a porta 80; o painel continua independente da ponte. |
| **A Alexa não encontrou a luz** | Use a busca **Philips Hue Bridge V1 (redonda)**, abra a janela de descoberta no Nexus e confira a autorização do IP do Echo. Em **Conexões**, veja a última busca e consulta recebidas. |
| **A Alexa oferece desligar o computador** | Confira se **Iluminação Nexus** existe no app Alexa e use o nome completo nos comandos para distinguir a luz de outros dispositivos. |
| **A roda de cores parece arrastar a página** | Atualize para a versão mais recente e recarregue o painel com **Ctrl + F5**. A roda deve acompanhar o arraste sem selecionar o conteúdo da página. |

Ainda precisa investigar? Pelo ícone da bandeja, abra **Abrir pasta de diagnósticos**. Os dados do painel ficam em `%ProgramData%\NexusRGB\app`; erros de instalação ficam em `%ProgramData%\NexusRGB\installation-error.log`. Para relatar um problema, informe a versão do Nexus, o modelo do componente e a mensagem apresentada.

## 🛡️ Sua rede, seus dados

Para relatar uma vulnerabilidade, consulte a [política de segurança](SECURITY.md) e use o [canal privado no GitHub](https://github.com/JonJonGf/nexus-rgb/security/advisories/new). Bugs comuns e sugestões continuam nas Issues públicas.

O painel usa HTTP local e permite que aparelhos da mesma sub-rede privada controlem as luzes **sem autenticação**. Isso torna o link simples de usar; não há criptografia do tráfego local. Ajustes administrativos ficam disponíveis pelo aplicativo do PC, via endereço local.

O instalador cria regras específicas do Nexus para a LAN. Não há telemetria, túnel externo ou atualização automática, e o aplicativo não precisa se conectar ao GitHub para funcionar. **Não abra portas do Nexus no roteador.** A Alexa pode precisar de internet para o próprio funcionamento, mesmo com a ponte Nexus na LAN.

O pacote usa OpenRGB 1.0 e o instalador oficial assinado do **PawnIO**; não inclui WinRing0. A geração do executável recusa drivers ou bibliotecas WinRing encontrados dentro do ZIP do OpenRGB, antes de extrair arquivos. Se o Defender apontar `VulnerableDriver:WinNT/Winring0`, mantenha o arquivo bloqueado e siga a remoção indicada pelo Windows, incluindo reinício quando solicitado. A [Microsoft confirma que essa detecção é válida](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/microsoft-defender-antivirus-alert-vulnerabledriver-winnt-winring0). Não crie exclusões no antivírus para conseguir controlar o RGB.

O suporte depende do dispositivo, e não apenas da marca. Fans ligados à mesma porta ARGB podem aparecer como uma única zona. O Nexus separa componentes quando o controlador fornece as informações necessárias; a instalação automática não garante compatibilidade com todo hardware RGB existente.

---

## 🧪 Ajude a testar

O Nexus precisa de testes reais em diferentes PCs, controladoras e modelos de Echo. Relatos positivos também ajudam a documentar a compatibilidade. Siga o [roteiro de testes da comunidade](docs/TESTAR.md) e abra **Issues → New issue** no GitHub para escolher um modelo:

- [Relatar um problema](https://github.com/JonJonGf/nexus-rgb/issues/new?template=problema.md)
- [Sugerir uma melhoria](https://github.com/JonJonGf/nexus-rgb/issues/new?template=sugestao.md)
- [Contar o resultado de um teste de compatibilidade](https://github.com/JonJonGf/nexus-rgb/issues/new?template=teste-de-compatibilidade.md)

O feedback acontece **somente no GitHub**. O mantenedor responde nos comentários da própria issue; as notificações seguem as preferências da conta de cada participante. É necessário ter uma conta GitHub para publicar. Relatos e comentários são públicos: revise capturas e mensagens antes de enviar e não inclua senhas, tokens ou dados pessoais. Não há coleta ou envio de feedback pelo aplicativo.

## 📄 Código aberto e licença

O código original do Nexus RGB e sua documentação são públicos sob a [licença MIT](LICENSE.md), com autoria de **JonJonGf**. Você pode usar, estudar, modificar e redistribuir, inclusive comercialmente, mantendo o aviso de autoria e a licença. OpenRGB, PawnIO e os demais componentes preservam suas próprias licenças; consulte os [avisos de terceiros](THIRD-PARTY-NOTICES.md).

O instalador inclui a licença do Nexus e os avisos de terceiros. Os executáveis próprios desta prévia ainda não são assinados; consulte [assinatura digital e verificação de downloads](docs/ASSINATURA.md).

## 📚 Para quem desenvolve ou distribui

- [Ambiente de desenvolvimento, testes e geração do instalador](docs/DESENVOLVIMENTO.md)
- [Relatório de consumo e metodologia](docs/DESEMPENHO.md)
- [Validação de segurança, estabilidade e instalação em VM](docs/VALIDACAO.md)
- [Critérios para distribuição pública](docs/COMERCIAL.md)
- [Componentes e licenças de terceiros](THIRD-PARTY-NOTICES.md)

<p align="center">
  <b>MAKE LIGHT YOURS.</b><br>
  Nexus RGB · Desenvolvido por <a href="https://github.com/JonJonGf">JonJonGf</a>
</p>

As funcionalidades ainda planejadas e os problemas conhecidos estão nas [prioridades do projeto](docs/ROADMAP.md).
