# Code signing policy — assinatura digital

**Status: os executáveis próprios do Nexus RGB ainda não são assinados.** Não há aprovação nem certificado concedido pela SignPath Foundation. A licença MIT permite distribuir o código; ela não autentica o editor de um executável.

## Responsabilidade

[JonJonGf](https://github.com/JonJonGf) mantém o projeto e é o responsável pelo código, revisão e aprovação de versões. Contribuições externas precisam ser revisadas antes de integrar uma versão. Se um serviço de assinatura for aprovado, o mantenedor deverá confirmar a autenticação multifator no GitHub e no provedor e aprovar manualmente cada solicitação de assinatura.

## Caminho gratuito em avaliação

A [SignPath Foundation](https://signpath.org/terms.html) oferece assinatura para projetos de código aberto elegíveis. A aceitação depende da análise do projeto, de sua reputação verificável e do cumprimento das condições; publicar sob MIT não garante aprovação. Nesse programa, o certificado identifica **SignPath Foundation** como editor, não o nome pessoal do autor.

Antes de solicitar o serviço, é necessário conferir a elegibilidade do pacote completo, incluindo bibliotecas e runtimes de terceiros; validar a procedência dos binários em um build automatizado; configurar as restrições de metadados e a aprovação de assinaturas. O nome do produto e a versão dos executáveis próprios e do instalador são definidos no código e no build. Nenhum certificado, chave privada ou segredo de assinatura está incluído no repositório ou no instalador.

Uma eventual assinatura será aplicada somente aos artefatos próprios construídos a partir do código versionado do Nexus: aplicativo, assistente de remoção, instalador e desinstalador gerado. Node.js, OpenRGB, PawnIO, Qt e runtime Microsoft conservam as licenças e assinaturas fornecidas pelos respectivos fornecedores. O manifesto de dependências fixa origens e hashes; o build verifica esses hashes e as assinaturas previstas. A revisão das obrigações de redistribuição está documentada nos [avisos de terceiros](../THIRD-PARTY-NOTICES.md).

## Privacidade e alterações no computador

O Nexus não tem telemetria nem atualizador remoto. O painel permite controle das luzes por dispositivos da mesma sub-rede, conforme a opção de acesso local sem senha descrita no [README](../README.md). A conexão SDK com OpenRGB fica no próprio computador. Ao ativar a integração Alexa, o operador autoriza a descoberta local e os IPs do Echo. O funcionamento do Echo e do aplicativo Alexa envolve a infraestrutura da Amazon e suas [condições de privacidade](https://www.amazon.com.br/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ).

O instalador informa os serviços, o acesso ao hardware/driver e as regras locais que serão criadas. A [desinstalação](../README.md#desinstalar) remove os serviços e regras do Nexus e preserva dados e dependências compartilhadas. Os scripts de desenvolvimento precisam de internet para baixar ferramentas e dependências; isso é separado do uso local do aplicativo instalado.

## Conferir um download hoje

Baixe os executáveis pela [página oficial de versões](https://github.com/JonJonGf/nexus-rgb/releases) e compare seu SHA256 com o arquivo `SHA256SUMS.txt` da mesma versão:

```powershell
Get-FileHash .\NexusRGB-Setup-0.1.0.exe -Algorithm SHA256
Get-AuthenticodeSignature .\NexusRGB-Setup-0.1.0.exe
```

Nesta prévia, a assinatura do instalador Nexus retorna `NotSigned`. Os hashes permitem conferir se o download corresponde ao arquivo publicado; não substituem uma assinatura digital. Mesmo depois de assinado, um binário novo pode receber avisos de reputação do [SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation). Mantenha as proteções do Windows ativas.
