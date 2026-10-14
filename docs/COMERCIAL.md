# Critérios para distribuição pública

O Nexus RGB será disponibilizado gratuitamente. O nome deste arquivo foi preservado para manter válidos os links de versões anteriores. Os cuidados abaixo se aplicam também a software gratuito.

Esta é uma versão de validação. Os testes automatizados validam comportamentos do software; não certificam todo hardware, instalador, driver, firmware Echo ou rede.

A [revisão de 14/10/2026](VALIDACAO.md) inclui testes adicionais de segurança, recuperação do supervisor e instalação/atualização/desinstalação/reinstalação reais numa VM descartável Windows Server 2025. O ciclo da VM passou em 45 verificações. Ainda é necessário completar a matriz Windows 10/11 e hardware físico descrita abaixo.

Antes de considerar a distribuição amplamente validada:

1. Assinar `NexusRGB.exe` e o instalador com um certificado de assinatura de código do titular do produto; testar SmartScreen e as políticas do Windows. Não há certificado próprio nesta entrega.
   Assinar também o assistente e o desinstalador gerado. A assinatura identifica o editor; um binário novo ainda pode receber aviso até acumular reputação. Certificado autoassinado não resolve esse aviso para os clientes. Consulte a [documentação da Microsoft sobre reputação SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).
2. Instalar e desinstalar em VMs/PCs limpos Windows 10/11 x64, com usuários não administradores e contas diferentes. Confirmar ACLs, contas LocalService/SYSTEM, firewall, atualização e rollback de instalação.
3. Reiniciar, iniciar sem usuário conectado, suspender/retomar, trocar IP e interromper processos. Verificar restauração real das luzes e recuperação dos dois serviços.
4. Validar placa-mãe, RAM, USB, headers e periféricos de uma matriz de fabricantes/modelos; documentar incompatibilidades e interações com outros programas RGB. O OpenRGB usa protocolos de hardware e também exige esse cuidado.
5. Testar o driver PawnIO oficial com integridade de memória/Defender ativos. Nunca pedir que o cliente desative proteções para conseguir suporte.
6. Testar celulares Android/iOS em redes comuns/isoladas e múltiplos Echos. Documentar que o painel de celular é um atalho web HTTP na LAN e que não há garantia de controle remoto por Alexa até validar o modelo.
7. Revisar e cumprir as licenças de terceiros, o fornecimento de fontes correspondentes completas e os direitos de redistribuição. Definir a licença do código original, suporte e titularidade/marca antes da publicação.
8. Fazer revisão independente de segurança do serviço privilegiado e da superfície SDK; loopback limita exposição, mas programas locais também podem acessar o SDK do OpenRGB.

Decisão solicitada pelo proprietário: controles RGB acessíveis sem autenticação a todos os aparelhos da mesma sub-rede, via HTTP e link permanente. Ajustes administrativos só pelo PC. Nunca anunciar essa configuração como autenticação ou criptografia da rede local.

O instalador inclui os binários para funcionar offline após a instalação. A Alexa pode precisar de internet para o seu próprio funcionamento; isso não adiciona acesso externo ao painel Nexus.
