# Desenvolvimento do Nexus RGB

Este guia é para quem quer executar o código, contribuir ou gerar o instalador. Para usar o aplicativo, siga o [tutorial de instalação](../README.md#instalacao).

## Preparar o ambiente

Use Windows 10/11 x64, Git, Node.js **24.20.0 ou superior** e npm disponíveis no terminal. O instalador final inclui seu próprio runtime; os comandos de desenvolvimento usam o Node.js instalado no seu ambiente.

```powershell
git clone https://github.com/JonJonGf/nexus-rgb.git
cd nexus-rgb
npm ci --ignore-scripts
```

O código original é licenciado sob [MIT](../LICENSE.md). Dados locais, dependências, binários e credenciais ficam fora do versionamento. O campo `private: true` no `package.json` impede publicação acidental no registro npm.

O mapa usa QuickJS em WASM e o pacote nativo `@napi-rs/canvas`. Instale as dependências opcionais da plataforma com `npm ci --ignore-scripts`; não use `--omit=optional`. Os binários Windows x64 vêm do pacote npm fixado no lockfile, sem compilar ou instalar um novo driver.

## Executar sem disputar o hardware da instalação

Para trabalhar na interface, use outra porta e uma pasta de dados de desenvolvimento:

```powershell
$env:NEXUS_PORT='5070'
$env:NEXUS_DISABLE_HARDWARE='1'
$env:NEXUS_DATA_DIR=Join-Path $PWD 'data\dev'
npm start
```

Abra `http://127.0.0.1:5070/`. A ausência de hardware é apresentada na interface; não há dispositivos, áudio ou temperaturas simulados.

Para testar hardware real pelo código, encerre o serviço de rede Nexus que disputa o controle SDK e use um único servidor OpenRGB em `127.0.0.1:6743`. Remova `NEXUS_DISABLE_HARDWARE` do ambiente da sessão. Não execute dois clientes escrevendo nas mesmas luzes ao mesmo tempo.

O instalador configura o firewall para seus próprios executáveis. No desenvolvimento, acesso por outro aparelho exige configurar explicitamente o firewall do ambiente. Não reutilize o OpenRGB antigo com WinRing0 no pacote.

## Verificar as alterações

```powershell
npm test
npm run test:ui
```

Os testes unitários cobrem estado, segurança, ponte Hue e controle do hardware. Os testes de interface usam Playwright com Microsoft Edge no Windows; o teste do seletor usa arraste real do mouse e verifica que a página não é selecionada ou arrastada.

`npm run test:supervisor` executa o supervisor C# real com dados e um processo filho de teste isolados. `npm run test:stability` exercita a API em um processo dedicado por dez minutos; use `NEXUS_STABILITY_SECONDS` para outra duração entre 60 e 86400 segundos. O resultado fica em `data/validation/stability.json`, separado da saída do Playwright. O [relatório de validação](VALIDACAO.md) explica o escopo e os limites desses testes.

O workflow [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/blob/main/.github/workflows/ci.yml) executa a auditoria de dependências e as duas suítes no Windows. Essas verificações não substituem testes em PCs limpos, reinício real, uma matriz de hardware e diferentes Echos.

O workflow [Validar instalador em VM descartável](https://github.com/JonJonGf/nexus-rgb/blob/main/.github/workflows/installer.yml) pode ser disparado manualmente para compilar o pacote e testar seu ciclo completo num runner hospedado Windows Server 2025. `scripts/test-installed-package.ps1` recusa execução no PC normal ou em uma máquina que já tenha instalação/dados Nexus. Esse script instala e remove o produto e deve permanecer restrito ao runner descartável.

<a id="gerar-instalador"></a>

## Gerar o instalador

Na raiz do projeto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/download-vendor.ps1
npm run build
```

O primeiro comando precisa de internet para obter os artefatos registrados em `vendor-manifest.json`, verificar hashes e assinaturas e preparar o Inno Setup. O build prepara as dependências npm, audita os pacotes de produção e compila o executável C# usando o compilador do .NET Framework do Windows.

Com o Inno Setup disponível, execute também `npm run test:installer`. Esse teste compila o evento real de pós-instalação com operações de processo e leitura de diagnóstico simuladas. Confere retorno `0` no sucesso, `1` nas falhas, `3010` quando o runtime exige reinício e que mensagens antigas não sejam mostradas como erros atuais. A simulação não instala arquivos, drivers, serviços ou regras; não substitui instalar o pacote completo em uma VM.

O resultado fica em:

```text
dist\NexusRGB-Setup-0.1.0.exe
dist\NexusRGB-Uninstall-0.1.0.exe
dist\SHA256SUMS.txt
```

O instalador inclui os arquivos necessários para a instalação offline: runtime Node.js, OpenRGB 1.0, Visual C++ e instalador oficial PawnIO. Fontes, licenças e a documentação de uso acompanham o pacote. Não são incluídos dados do seu PC, senhas, perfis pessoais ou certificados de assinatura.

O assistente de desinstalação é um executável separado e também integra o pacote. Ele consulta o registro oficial do produto e abre o desinstalador Inno existente, que remove os serviços e as regras próprias. O argumento `--check` verifica a instalação sem abrir UAC ou remover nada; retorno `0` indica validação bem-sucedida. Na execução normal, retorno `0` indica que o desinstalador foi aberto, não que a remoção já terminou. O arquivo `SHA256SUMS.txt` permite conferir os dois executáveis distribuídos.

Nas [versões do GitHub](https://github.com/JonJonGf/nexus-rgb/releases), esses arquivos ficam em **Assets**, junto com os hashes e o registro do build. O ZIP do código-fonte é oferecido pelo próprio GitHub na mesma página.

Leia os [avisos de terceiros](../THIRD-PARTY-NOTICES.md) e os [critérios de distribuição](COMERCIAL.md) antes de distribuir. O build não assina os executáveis Nexus com um certificado próprio. Veja a [Code signing policy](ASSINATURA.md).

<a id="publicar-versao"></a>

## Publicar uma versão

Cada versão deve reunir código, documentação e instalador correspondentes. O workflow [Publicar versão Windows](../.github/workflows/publish-release.yml) é acionado ao enviar uma tag de versão, como `v0.1.0-alpha.9`.

Antes de criar a tag:

1. Confira a versão base em `package.json`, `native/AppInfo.cs` e `installer/NexusRGB.iss`. O sufixo da prévia aparece na tag; os executáveis desta série usam a versão numérica `0.1.0`.
2. Atualize os links de download do README para a mesma tag e crie as notas em `docs/releases/TAG.md`, descrevendo recursos, correções e limitações.
3. Execute `node scripts/check-release.cjs TAG` e revise o commit completo.
4. Envie o commit e a tag para o repositório.

O workflow verifica essa correspondência, compila o pacote e executa as suítes de lógica, interface, supervisor e instalação. O instalador é exercitado em VMs descartáveis com portas padrão e alternativas. Somente após as duas configurações passarem, o pacote testado nas portas padrão é anexado à versão com o assistente de remoção, `SHA256SUMS.txt` e `BUILD-INFO.json`.

Os arquivos são enviados primeiro a um rascunho. A versão torna-se pública após o upload e a conferência dos hashes. Tags com sufixo são publicadas como prévias. Uma execução com falha não deve ser anunciada como versão disponível; consulte os logs, corrija o problema e confira a publicação antes de divulgar o download. Arquivos de versões públicas anteriores não são substituídos.

Esse processo não assina os executáveis nem comprova compatibilidade com hardware físico. O workflow manual [Preparar artefatos Windows para assinatura](../.github/workflows/build-release.yml) permanece separado da publicação.

## Estrutura do repositório

```text
nexus-rgb/
├── public/                   # Interface, estilos e controles do navegador
├── server/                   # API local, estado, OpenRGB e ponte Hue
│   ├── index.js              # HTTP, sessões e sincronização das telas
│   ├── hardware.js           # Detecção, zonas e escrita nos LEDs
│   ├── alexa.js              # Descoberta Hue e comandos de energia
│   ├── store.js              # Persistência e validação dos ajustes
│   ├── presets.js            # As seis cenas da Coleção Nexus
│   ├── studio.js             # Biblioteca local, supervisão e prévia do mapa
│   ├── studio-schema.js      # Formatos e limites de importação/layout
│   ├── studio-worker.js      # Processo filho que renderiza os efeitos
│   └── studio-render.js      # QuickJS WASM e ponte restrita para Canvas
├── native/                   # Executável C#, bandeja e serviços Windows
├── installer/                # Configuração do instalador Inno Setup
├── scripts/                  # Dependências, build, serviços e licenças
├── tests/                    # Testes unitários e de interface
├── docs/                     # Instalação, desenvolvimento e distribuição
├── .github/workflows/        # Validação automática no GitHub
└── vendor-manifest.json      # Origens e hashes dos artefatos de terceiros
```

## Serviços, portas e dados

| Serviço ou porta | Responsabilidade |
| :--- | :--- |
| `NexusRGB` · LocalService | Painel e API com conta limitada. |
| `NexusRGBHardware` · SYSTEM | Controlador OpenRGB e acesso ao driver. |
| TCP `5050` por padrão · LAN | Interface do PC, celular e tablet; configurável. |
| TCP `6743` por padrão · loopback | SDK OpenRGB, somente no próprio PC; configurável. |
| TCP `80` por padrão e UDP `1900` · LAN | HTTP da ponte Hue configurável; descoberta SSDP permanece em 1900. |

Os serviços são instalados em `Program Files\Nexus RGB`, com permissões protegidas. Os dados do painel ficam em `%ProgramData%\NexusRGB\app`, e os dados privilegiados do controlador em `%ProgramData%\NexusRGB\hardware`. As ACLs separam essas pastas.

O arquivo `settings.json` guarda também FPS, posições e perfis espaciais; `app\effects` guarda as importações originais. O processo de renderização herda a conta limitada do servidor e pertence à árvore supervisionada pelo serviço. Código importado é avaliado somente em QuickJS WASM, com a ponte de desenho permitida; nunca use `eval`, `vm` do Node ou inserção de HTML na página para esses arquivos. O [guia do mapa](STUDIO.md) descreve formato, orçamento e limites de compatibilidade.

O executável instalado lê `PanelPort`, `SDKPort` e `AlexaPort` como DWORDs de `HKLM\SOFTWARE\NexusRGB`, com padrões 5050/6743/80 se os valores estiverem ausentes. O serviço passa os três números validados ao Node e o SDK ao OpenRGB. A janela **Configurar portas…** roda elevada e chama o script protegido `scripts/configure-ports.ps1`; o serviço limitado e a interface web não podem gravar essa configuração. Em desenvolvimento, `NEXUS_PORT`, `NEXUS_RGB_PORT` e `NEXUS_ALEXA_PORT` configuram os listeners. Valores inválidos ou portas TCP repetidas causam erro explícito.

Na instalação silenciosa, `/PANELPORT=5151 /SDKPORT=6754 /ALEXAPORT=8081` seleciona portas alternativas. Sem esses argumentos, uma atualização reutiliza os valores já salvos. O workflow de instalação em VM tem uma matriz de portas padrão e alternativas. O teste destrutivo continua proibido no PC normal. `test:offline` e o inventário da instalação consultam a porta persistida, sem presumir 5050.

O instalador libera apenas a sub-rede local por Ethernet/Wi-Fi, inclusive quando o Windows classifica a rede doméstica como Pública. A API valida Host e origem, rejeita proxies, limita requisições e restringe controles administrativos ao loopback. As regras de saída bloqueiam internet para o serviço de rede e acesso do OpenRGB para fora do próprio PC. A ponte Hue aceita comandos somente de IPs autorizados.

O controle RGB na LAN usa HTTP sem autenticação, conforme a proposta do produto. Não há CORS aberto, abertura de portas no roteador, telemetria, túnel externo ou atualização automática. A desinstalação preserva perfis e dados e mantém o driver e runtime compartilhados.
