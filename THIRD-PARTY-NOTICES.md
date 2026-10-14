# Componentes de terceiros

O Nexus controla o OpenRGB como um processo separado por seu protocolo SDK. Os componentes preservam suas próprias licenças; o código original do Nexus é licenciado sob [MIT](LICENSE.md), que não substitui esses termos.

| Componente | Versão do pacote | Licença / origem |
| --- | --- | --- |
| OpenRGB | 1.0, build 81bbe18 | GPL-2.0; [fonte oficial](https://codeberg.org/OpenRGB/OpenRGB/src/tag/release_1.0) |
| PawnIO | instalador oficial 2.2.0 | [site](https://pawnio.eu/), [fontes](https://github.com/namazso/PawnIO); GPL-2.0-or-later ou licença específica do fornecedor |
| Node.js | 24.20.0 | MIT e avisos de dependências; [licença](https://github.com/nodejs/node/blob/v24.20.0/LICENSE) |
| Qt 6 e bibliotecas do OpenRGB | conforme binário upstream | Licenças específicas Qt/LGPL/GPL; conferir avisos e fonte correspondente da versão distribuída |
| openrgb-sdk | 0.6.0 | MIT |
| qrcode | 1.5.4 | MIT e licenças transitivas |
| Visual C++ Redistributable | 14.44.35211 | Termos de redistribuição da Microsoft |
| Inno Setup | 6.4.3 | Licença Inno Setup; versão usada permite uso comercial |

O build inclui a licença e o arquivo de fontes da tag exata do OpenRGB em `licenses/` e `sources/`, bem como as licenças disponíveis nos pacotes npm. O manifesto registra os hashes dos arquivos obtidos dos fornecedores. A MIT do Nexus aplica-se ao seu código original e documentação. Ela não relicencia OpenRGB, PawnIO, Qt ou outros componentes.

**Obrigações para quem redistribui o pacote:** conferir fontes correspondentes completas, submódulos, módulos PawnIO e bibliotecas Qt, instruções de construção, avisos e direitos de redistribuição do instalador assinado PawnIO e do runtime Microsoft. O arquivo upstream de fontes, sozinho, não constitui garantia de cumprimento de todas essas obrigações. Preservar a MIT do Nexus e revisar as condições dos fornecedores. Não anunciar o produto como certificado pela Amazon, Philips ou fabricantes de hardware.
