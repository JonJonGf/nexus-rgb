# Security policy / Política de segurança

## Report a vulnerability privately

Use **Security → Advisories → Report a vulnerability** in this repository:

[Submit a private security report](https://github.com/JonJonGf/nexus-rgb/security/advisories/new)

Please report suspected security issues privately before opening a public issue or pull request with exploitation details. For ordinary bugs, compatibility reports and feature requests, use [Issues](https://github.com/JonJonGf/nexus-rgb/issues/new/choose).

Include the Nexus release/tag, Windows version, affected component, expected and observed behavior, minimal reproduction steps, and potential impact. Review all attachments first: remove tokens, passwords, local addresses, personal information and unrelated files. A complete Nexus backup contains private settings and imported effects; do not attach it as a diagnostic. When available, use **Settings → Review diagnostics to share** and review its contents before submitting.

Test only systems and hardware you own or have explicit permission to assess. Avoid destructive hardware operations, disabling Windows protections, or publishing another person's effect source or private data.

## Supported releases and response

Nexus RGB is currently in alpha. Security fixes target the latest published release, including prereleases, and the current development branch. Older builds do not receive separate backports. Check the [release list](https://github.com/JonJonGf/nexus-rgb/releases) for the current package.

Reports are reviewed by the project maintainer. This volunteer project does not guarantee a response deadline, a fix, or a bounty. Disclosure and any advisory are coordinated through the private report after assessment.

## Security boundaries

The dashboard uses local HTTP. Devices on the permitted private subnet can control lighting without signing in; local traffic is not encrypted. Administrative operations require a local PC session. Do not expose the dashboard, the OpenRGB SDK or the Alexa bridge to the Internet. See the [network and data documentation](README.md#️-sua-rede-seus-dados).

Dependencies such as OpenRGB and PawnIO retain their own security policies and hardware limitations. Include the exact version and evidence if an issue involves one of them. GitHub security scans help detect some problems; they do not certify the application, installer, drivers or hardware as safe.

## Relatar uma vulnerabilidade em português

Use **Security → Advisories → Report a vulnerability** ou o [formulário privado](https://github.com/JonJonGf/nexus-rgb/security/advisories/new). Relatos em português e inglês são bem-vindos. Bugs comuns e sugestões continuam nas [Issues](https://github.com/JonJonGf/nexus-rgb/issues/new/choose).

Informe a versão do Nexus e do Windows, o componente afetado, os passos mínimos para reproduzir e o possível impacto. Remova dados pessoais, IPs, senhas e tokens dos anexos. **Não envie seu backup completo**: ele contém ajustes privados e efeitos importados. Prefira o diagnóstico revisável em **Configurações → Revisar diagnóstico para compartilhar**.

As correções se concentram na versão publicada mais recente, inclusive prévias, e no desenvolvimento atual. Versões antigas não recebem correções separadas. O projeto é voluntário e não garante prazo de resposta, correção ou recompensa. A divulgação é combinada no relato privado após a avaliação.

O controle RGB permanece na LAN. Os recursos de segurança do GitHub analisam o repositório e suas dependências; eles não monitoram o PC nem enviam os dados locais do Nexus.
