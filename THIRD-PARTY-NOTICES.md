# Componentes de terceiros

O Nexus controla o OpenRGB como um processo separado por seu protocolo SDK. Os componentes preservam suas próprias licenças; o código original do Nexus é licenciado sob [MIT](LICENSE.md), que não substitui esses termos.

| Componente | Versão do pacote | Licença / origem |
| --- | --- | --- |
| OpenRGB Headless | commit 18e2c95f5e6d5d9f45a948df1e3d0b882e605b45, build upstream 39457060004 | GPL-2.0-or-later; [fonte correspondente](https://github.com/hello-nexus/openrgb-headless/tree/18e2c95f5e6d5d9f45a948df1e3d0b882e605b45), derivado de OpenRGB |
| PawnIO | instalador oficial 2.2.0 | [site](https://pawnio.eu/), [fontes](https://github.com/namazso/PawnIO); GPL-2.0-or-later ou licença específica do fornecedor |
| Node.js | 24.20.0 | MIT e avisos de dependências; [licença](https://github.com/nodejs/node/blob/v24.20.0/LICENSE) |
| Bibliotecas HID/USB, PawnIO e módulos do OpenRGB | conforme inventário em dependencies/openrgb-headless/provenance.json | Licenças específicas upstream e fontes correspondentes; o pacote headless não contém bibliotecas Qt |
| openrgb-sdk | 0.6.0 | MIT |
| qrcode | 1.5.4 | MIT e licenças transitivas |
| quickjs-emscripten | 0.32.0 | MIT; [fontes e avisos](https://github.com/justjake/quickjs-emscripten); inclui variantes QuickJS em WASM com suas licenças |
| @napi-rs/canvas | 1.0.11 | MIT; [fontes](https://github.com/Brooooooklyn/canvas/tree/v1.0.11); biblioteca nativa Skia e dependências com licenças próprias |
| Visual C++ Redistributable | 14.44.35211 | Termos de redistribuição da Microsoft |
| Inno Setup | 6.4.3 | Licença Inno Setup; versão usada permite uso comercial |

O build inclui a licença e o arquivo de fontes do commit exato do OpenRGB em `licenses/` e `sources/`, bem como as licenças disponíveis nos pacotes npm. `sources/OpenRGB-BUILD-INFO.json` registra origem e hashes do bundle, módulos e bibliotecas. O manifesto registra os hashes dos arquivos obtidos dos fornecedores. A MIT do Nexus aplica-se ao seu código original e documentação. Ela não relicencia OpenRGB, PawnIO ou outros componentes. A distribuição histórica alpha.39 utilizava OpenRGB oficial 1.0 com Qt; a troca de base faz parte da alpha.40.

O pacote preserva o inventário upstream `sbom.cdx.json` da biblioteca Canvas nativa e os [avisos de suas dependências](docs/licenses/canvas-1.0.11-NOTICES.txt), coletados das revisões registradas nesse inventário. As licenças dos pacotes QuickJS/WASM acompanham os pacotes npm e a pasta `licenses` do instalador. Esses componentes são bibliotecas da aplicação; não acrescentam um driver de hardware.

Efeitos HTML importados localmente mantêm as licenças e a autoria de seus criadores. A MIT do Nexus não se aplica a esses arquivos, e a importação não autoriza sua redistribuição. Nenhum pacote de efeitos do SignalRGB ou de criadores externos é incluído no repositório ou no instalador.

**Obrigações para quem redistribui o pacote:** conferir fontes correspondentes completas, submódulos, módulos PawnIO e bibliotecas Qt, instruções de construção, avisos e direitos de redistribuição do instalador assinado PawnIO e do runtime Microsoft. O arquivo upstream de fontes, sozinho, não constitui garantia de cumprimento de todas essas obrigações. Preservar a MIT do Nexus e revisar as condições dos fornecedores. Não anunciar o produto como certificado pela Amazon, Philips ou fabricantes de hardware.
