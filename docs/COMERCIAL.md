# Critérios para distribuição pública

O Nexus RGB é gratuito, com código original público sob [MIT](../LICENSE.md). Este documento reúne os requisitos de qualidade e distribuição que ainda precisam ser validados antes de uma versão estável.

Esta é uma versão de validação. Os testes automatizados validam comportamentos do software; não certificam todo hardware, instalador, driver, firmware Echo ou rede.

A [revisão de 14/10/2026](VALIDACAO.md) inclui testes adicionais de segurança, recuperação do supervisor e instalação/atualização/desinstalação/reinstalação reais numa VM descartável Windows Server 2025. O ciclo da VM passou em 45 verificações. Ainda é necessário completar a matriz Windows 10/11 e hardware físico descrita abaixo.

Antes de considerar a distribuição amplamente validada:

1. Assinar o aplicativo, assistente de remoção, desinstalador gerado e instalador final com um certificado de distribuição reconhecido. Os executáveis Nexus ainda não são assinados. O processo deve verificar a origem dos artefatos e exigir aprovação do mantenedor; consulte a [política de assinatura](ASSINATURA.md).
2. Instalar e desinstalar em VMs/PCs limpos Windows 10/11 x64, com usuários não administradores e contas diferentes. Confirmar ACLs, contas LocalService/SYSTEM, firewall, atualização e rollback de instalação.
3. Reiniciar, iniciar sem usuário conectado, suspender/retomar, trocar IP e interromper processos. Verificar restauração real das luzes e recuperação dos dois serviços.
4. Validar placa-mãe, RAM, USB, headers e periféricos de uma matriz de fabricantes/modelos; documentar incompatibilidades e interações com outros programas RGB. O OpenRGB usa protocolos de hardware e também exige esse cuidado.
5. Testar o driver PawnIO oficial com integridade de memória e Defender ativos. As instruções de suporte devem manter as proteções do Windows habilitadas.
6. Testar celulares Android/iOS em redes comuns/isoladas e múltiplos Echos. Documentar que o painel de celular é um atalho web HTTP na LAN e que não há garantia de controle remoto por Alexa até validar o modelo.
7. Revisar e cumprir as licenças de terceiros, o fornecimento de fontes correspondentes completas e os direitos de redistribuição. A licença original é MIT; manter os avisos de autoria e documentar suporte e titularidade/marca.
8. Fazer revisão independente de segurança do serviço privilegiado e da superfície SDK; loopback limita exposição, mas programas locais também podem acessar o SDK do OpenRGB.

## Modelo de acesso local

O painel permite controle RGB sem senha por aparelhos da mesma sub-rede, via HTTP. Não há criptografia do tráfego local. Criar, editar e excluir perfis, configurar zonas e autorizar Echos exige acesso pelo próprio PC; configurar portas exige administrador. Esses limites precisam permanecer documentados e cobertos pelos testes de regressão.

O instalador inclui os binários para funcionar offline após a instalação. A Alexa pode precisar de internet para o seu próprio funcionamento; isso não adiciona acesso externo ao painel Nexus.
