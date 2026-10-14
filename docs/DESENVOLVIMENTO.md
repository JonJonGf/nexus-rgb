# Desenvolvimento do Nexus RGB

Este guia é para quem quer executar o código, contribuir ou gerar o instalador. Para usar o aplicativo, siga o [tutorial de instalação](../README.md#instalacao).

## Preparar o ambiente

Use Windows 10/11 x64, Git, Node.js **24.20.0 ou superior** e npm disponíveis no terminal. O instalador final inclui seu próprio runtime; os comandos de desenvolvimento usam o Node.js instalado no seu ambiente.

```powershell
git clone https://github.com/JonJonGf/nexus-rgb.git
cd nexus-rgb
npm ci --ignore-scripts
```

O repositório é privado nesta fase. O clone exige uma conta GitHub com acesso autorizado. Dados, binários, dependências, logs e credenciais são excluídos pelo `.gitignore`.

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

O workflow [Validar Nexus RGB](https://github.com/JonJonGf/nexus-rgb/blob/main/.github/workflows/ci.yml) executa a auditoria de dependências e as duas suítes no Windows. Essas verificações não substituem testes em PCs limpos, reinício real, uma matriz de hardware e diferentes Echos.

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

Na [prévia do GitHub](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.2), esses arquivos ficam em **Assets**. O ZIP do código-fonte é oferecido pelo próprio GitHub na mesma página. O acesso aos arquivos depende da permissão no repositório privado.

Leia os [avisos de terceiros](../THIRD-PARTY-NOTICES.md) e as [condições comerciais](COMERCIAL.md) antes de distribuir. O build não assina os executáveis Nexus com um certificado próprio.

## Estrutura do repositório

```text
nexus-rgb/
├── public/                   # Interface, estilos e controles do navegador
├── server/                   # API local, estado, OpenRGB e ponte Hue
│   ├── index.js              # HTTP, sessões e sincronização das telas
│   ├── hardware.js           # Detecção, zonas e escrita nos LEDs
│   ├── alexa.js              # Descoberta Hue e comandos de energia
│   ├── store.js              # Persistência e validação dos ajustes
│   └── presets.js            # As seis cenas da Coleção Nexus
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
| TCP `5050` · LAN | Interface do PC, celular e tablet. |
| TCP `6743` · loopback | SDK OpenRGB, acessível somente no próprio PC. |
| TCP `80` e UDP `1900` · LAN | Ponte Hue e descoberta da Alexa, quando ativada. |

Os serviços são instalados em `Program Files\Nexus RGB`, com permissões protegidas. Os dados do painel ficam em `%ProgramData%\NexusRGB\app`, e os dados privilegiados do controlador em `%ProgramData%\NexusRGB\hardware`. As ACLs separam essas pastas.

O instalador libera apenas a sub-rede local por Ethernet/Wi-Fi, inclusive quando o Windows classifica a rede doméstica como Pública. A API valida Host e origem, rejeita proxies, limita requisições e restringe controles administrativos ao loopback. As regras de saída bloqueiam internet para o serviço de rede e acesso do OpenRGB para fora do próprio PC. A ponte Hue aceita comandos somente de IPs autorizados.

O controle RGB na LAN usa HTTP sem autenticação, conforme a proposta do produto. Não há CORS aberto, abertura de portas no roteador, telemetria, túnel externo ou atualização automática. A desinstalação preserva perfis e dados e mantém o driver e runtime compartilhados.
