# Nexus RGB

Controle RGB de PCs Windows 10/11 x64 pelo computador, celular e Alexa compatível. O projeto está em desenvolvimento para uso comercial; a versão 0.1.0 é uma versão de validação, sem assinatura digital própria.

## Usar

Execute `dist/NexusRGB-Setup-0.1.0.exe`. O instalador inclui Node.js, OpenRGB 1.0, o runtime Microsoft Visual C++ e o instalador oficial assinado do PawnIO. O usuário não precisa instalar Node.js ou configurar o OpenRGB. Para RAM e algumas placas-mãe, conclua a janela do PawnIO usando a edição oficial assinada.

Feche a versão anterior, outros OpenRGB e programas RGB do fabricante antes de instalar. O instalador verifica conflitos nas portas 5050/6743 e não encerra programas alheios. Não desativa antivírus, integridade de memória ou bloqueio de drivers vulneráveis.

Abra o aplicativo pelo atalho. Fechar a janela ou o ícone da bandeja mantém os serviços funcionando. Dois serviços Windows iniciam automaticamente antes do login, restauram a configuração e supervisionam seus processos:

- `NexusRGB`: interface e API, conta limitada LocalService.
- `NexusRGBHardware`: OpenRGB, conta SYSTEM para acesso ao driver, SDK somente em `127.0.0.1:6743`.

No celular, tablet ou outro PC, abra `http://IP-DO-PC:5050/`. É sempre o mesmo link enquanto o IP do computador permanecer igual. Não há conta, login, token, pareamento ou QR obrigatório. O QR em Conexões apenas abre o mesmo endereço. Salve nos favoritos ou adicione à tela inicial. Isso cria um atalho web; esta versão não inclui APK ou aplicativo iOS nativo.

Reserve o IP do PC no DHCP do roteador para que o endereço não mude. O instalador permite o Nexus apenas na sub-rede local das interfaces Ethernet/Wi-Fi, sem mudar a classificação da rede no Windows. Wi-Fi de convidados com isolamento de clientes impede o acesso.

## Funcionalidades

- Dispositivos, nomes, zonas e modos reais, obtidos dinamicamente pelo SDK.
- Portas e LEDs internos aparecem como componentes independentes quando a controladora informa um mapa completo de zonas e permite cor por LED. Cada zona tem cor, brilho, ligar/desligar e efeitos próprios, sem depender de uma marca ou placa-mãe fixa.
- Cor, brilho, ligar/desligar, velocidade e efeitos estático, onda, arco-íris, respiração e pulso quando suportados.
- Modos nativos por dispositivo e ajuste da quantidade de LEDs de zonas redimensionáveis.
- Perfis locais, persistência atômica e sincronização das telas por SSE.
- Seis cenas prontas com brilho e ritmo próprios: Aurora, Brasa, Nebulosa, Abissal, Solar e Silêncio. As cenas de ondas usam suas próprias paletas, aplicadas nos LEDs reais.
- Console compacto com roda de cores interativa e identidade visual que acompanha a cor estática. Quantidades configuradas de LEDs são restauradas após reiniciar o controlador.
- Bandeja, início no Windows e recuperação automática do processo/controlador.
- Ponte Hue/Alexa opcional e desativada inicialmente.

Quando o controlador estiver desconectado, os ajustes são salvos para aplicar depois. A interface informa a indisponibilidade; não apresenta hardware, temperatura ou áudio simulados. A prévia circular da interface é ilustrativa.

Não é possível garantir suporte a todo componente RGB existente. Confira a [lista de dispositivos do OpenRGB](https://openrgb.org/devices_1.0.html). Headers ligados ao mesmo controlador podem não permitir identificar ou controlar individualmente cada fan. LEDs que dependem de um número configurável exigem informar a quantidade real, sem adivinhação automática.

## Alexa

No PC, abra Conexões e ative a ponte. Inicie a busca por dois minutos. No aplicativo Alexa, adicione **Philips Hue Bridge V1 (redonda)**, autorize o IP do seu Echo no Nexus e repita a descoberta se necessário. Há uma única luz, **Iluminação Nexus**, com comandos “Alexa, acenda a Iluminação Nexus” e “Alexa, apague a Iluminação Nexus”. A Alexa controla somente ligar/desligar: preserva cor, brilho, paleta, efeito e ajustes individuais dos componentes. Componentes que estavam desligados continuam desligados ao religar. Cores, modos e perfis são escolhidos pelo painel Nexus. Ao atualizar da versão que anunciava cinco luzes de efeitos, exclua essas entradas antigas no aplicativo Alexa; elas não são mais anunciadas nem aceitam comandos. A identidade da luz principal permanece a mesma. Reserve os IPs do PC e Echo no roteador. Conexões mostra a última busca, consulta da ponte e comando efetivamente recebido, sem gravar credenciais Hue. O Nexus não oferece comandos de desligar o Windows.

O serviço usa TCP 80 e UDP 1900. Conflito na porta 80 é exibido no diagnóstico e não prejudica o painel RGB. A ponte só aceita controles vindos dos IPs autorizados. A descoberta Hue depende do modelo e firmware do Echo; não é integração certificada Amazon. Controle à distância no aplicativo Alexa precisa ser validado no aparelho. Não há acesso externo ao painel Nexus. Consulte a [documentação da emulação Hue](https://www.home-assistant.io/integrations/emulated_hue/) para limitações do protocolo.

## Segurança e dados

A configuração solicitada permite que qualquer dispositivo da mesma sub-rede privada controle as luzes por HTTP. Não há criptografia do tráfego local nem autenticação dos controles RGB. Essa escolha simplifica o acesso; ela não transforma os demais dispositivos da LAN em confiáveis. Os ajustes administrativos exigem sessão do PC via loopback.

O firewall libera somente a sub-rede local por Ethernet/Wi-Fi, em qualquer perfil Windows. A API restringe adicionalmente a origem à sub-rede IPv4 privada do adaptador físico e exclui VPNs conhecidas. Assim, uma rede doméstica classificada como Pública pelo Windows continua funcionando, sem alterar proteções globais. O firewall também bloqueia saída à internet do serviço de rede e saída do OpenRGB para fora do próprio PC. A API valida origem/Host, rejeita encaminhamento por proxies, limita requisições/corpos/conexões e aplica CSP. Não há CORS aberto, UPnP para abrir portas, túnel externo, telemetria ou atualização automática. Não configure encaminhamento de portas no roteador. Os serviços são instalados somente em Program Files para proteger seus executáveis.

Dados em `%ProgramData%/NexusRGB/app`; configuração privilegiada do OpenRGB em `%ProgramData%/NexusRGB/hardware`. As ACLs separam essas pastas. A desinstalação remove os serviços e regras próprias e preserva perfis/dados. O driver e runtime compartilhados não são removidos automaticamente.

## Desenvolver e verificar

```powershell
npm ci --ignore-scripts
npm test
npm run test:ui
```

Para executar ao lado do projeto antigo sem acessar hardware:

```powershell
$env:NEXUS_PORT='5070'
$env:NEXUS_DISABLE_HARDWARE='1'
npm start
```

O modo de desenvolvimento precisa ter seu firewall configurado pelo desenvolvedor se houver acesso a partir de outro aparelho. Não reutilize o OpenRGB antigo com WinRing0 para o pacote comercial.

## Gerar o instalador

```powershell
powershell -NoProfile -File scripts/download-vendor.ps1
npm run build
```

O build verifica hashes dos artefatos de terceiros, assinaturas do driver/runtime e `npm audit`; inclui somente dependências de produção. Ferramenta de empacotamento: Inno Setup 6.4.3, cuja licença permite uso comercial. Não contém certificados, senhas, perfis ou dados particulares do PC. [Avisos de terceiros](THIRD-PARTY-NOTICES.md) e [critérios comerciais](docs/COMERCIAL.md) devem acompanhar a distribuição.

## GitHub

Repositório privado: [JonJonGf/nexus-rgb](https://github.com/JonJonGf/nexus-rgb). O código não envia nada ao GitHub em execução. O workflow executa testes de segurança/estado e de interface. Binários, dados locais, dependências, logs e credenciais ficam fora do Git.
