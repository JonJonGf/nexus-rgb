# Diagnóstico de Iluminação Dinâmica — 19/10/2026

## Problema confirmado e causa

S01, anteriormente um risco estático da [revisão integral](2026-10-19-revisao-integral.md), foi reproduzido sem alterar o Windows: o serviço instalado informou que não conseguiu verificar a preferência, enquanto a leitura na conta interativa encontrou a opção ativada. A aplicação estava conectada aos seis componentes; isso **não** demonstra que a opção causou os travamentos anteriores do OpenRGB.

`HKCU` identifica a conta do processo. O servidor instalado executa como LocalService, que tem sua própria chave de usuário, conforme a [documentação Microsoft sobre LocalService](https://learn.microsoft.com/en-us/windows/win32/services/localservice-account). A Microsoft também [orienta serviços a evitar HKCU](https://learn.microsoft.com/en-us/windows/win32/services/services-and-the-registry). A investigação não mudou preferências, permissões, drivers ou proteções para demonstrar o defeito.

## Correção no repositório

- `server/conflicts.js` enumera chaves de perfis de usuário já carregados em `HKU` e consulta somente `Software\Microsoft\Lighting\AmbientLightingEnabled`, com argumentos separados e sem shell. Reconhece identificadores usuais de contas locais/domínio e Entra; ignora os perfis de serviço e sufixos `_Classes`. Nenhum perfil é carregado ou descarregado.
- No máximo dezesseis perfis, quatro consultas simultâneas, limite de saída de 256 KiB e prazo compartilhado de três segundos. O cache existente de quinze segundos permanece. Não existe consulta por quadro RGB.
- Resultado expõe apenas ativação observada, escopo agregado, quantidade verificada e indicação de leitura parcial; não retorna nomes, SIDs ou caminhos dos perfis. Se não houver valor legível, houver falha, resposta malformada, excesso de perfis ou prazo esgotado, não afirma ter verificado todas as contas.
- `public/health.js` e `public/en.js` explicam em PT/EN que a preferência foi encontrada em pelo menos uma conta carregada e exibem quando a verificação ficou incompleta, inclusive sem conflito confirmado. Não desativam a opção nem recomendam alterar proteções do Windows.

**Limites:** perfil carregado não significa sessão ativa. Preferência ativada não comprova interferência em um dispositivo. Leitura pode ser negada ao serviço por políticas locais; nesse caso o painel deve dizer que não conseguiu verificar, sem pedir mais privilégios ou enfraquecer ACLs. A correção do repositório ainda precisa ser instalada e observada sob a identidade real do serviço; o ensaio de leitura local no usuário não comprova acesso em todos os computadores.

## Regressões observadas

1. Adaptador externo `reg.exe` representa preferência desligada na conta do serviço e ligada em perfil carregado: a implementação original falhou, a nova identificou a ativação e preservou a privacidade.
2. Oito casos cobrem todos desligados, ativação com outra conta ilegível, leitura parcial sem ativação conhecida, resposta malformada, lista vazia, enumeração negada, vinte perfis limitados a dezesseis e prazo esgotado após enumerar. Confirmados limites de processo/saída e ausência de SIDs no resultado.
3. Falha geral da consulta mantém o resultado desconhecido/parcial. Antes a informação de incompletude era perdida; regressão vermelho/verde.
4. Edge real mostrou que o aviso antigo afirmava estado genérico e ocultava leitura parcial sem conflito confirmado. Os dois fluxos foram corrigidos e exercitados em PT/EN e viewport móvel de 390×844, sem transbordamento horizontal observado.

Suítes completas após o último ajuste: **243/243 gerais**, **47/47 Edge com retries desativados**. O novo teste de adaptador carrega o módulo real em processo isolado com chamadas externas Windows inertes; não muda o Registro real. A consulta real somente de leitura no contexto do usuário também identificou a preferência ativa. Análise CodeQL remota anterior não valida automaticamente esta alteração local.

## Código, instalação e observação

Neste registro inicial, alteração local ainda não commitada/empacotada/instalada. PC permanece na candidata `5b3e246`, com confirmação visual de Neon/RAM adiada pelo usuário até chegar em casa; a Release pública continua alpha.37. Nenhum UAC, reinício, comando RGB físico ou alteração de configuração do Windows foi feito nesta retomada.

Observação passiva de cinco minutos da candidata instalada está em execução, com consultas de estado/recursos, sem controlar iluminação ou repetir descoberta. Não exercita a correção nova e não equivale a estabilidade por horas. Logs, dados brutos e resultado da observação ficam privados em `data/audit-20261019-082159/`; o contexto registra sua conclusão real.

**Fechamento posterior:** correção commitada em `400544ad3f51d951566bbc79174626207303ded9`, pacote de desenvolvimento concluído e 160 arquivos fonte/payload conferidos sem divergência. Endpoint empacotado executado com hardware desativado retornou escopo de perfis carregados e identificou a preferência no contexto do usuário; permanece pendente o ensaio da atualização sob LocalService. Sem binários WinRing no payload e sem vulnerabilidades conhecidas reportadas pela auditoria de dependências de produção durante o build.

A observação de `5b3e246` terminou após 313,6 s e 61 amostras, sempre com seis componentes online e zero estados inesperados. Recursos foram parciais, sem medir o conjunto completo de processos; [escopo e números](../DESEMPENHO.md#observação-passiva-da-candidata-instalada--19102026). A correção nova `400544a` não foi instalada, publicada ou enviada nesta retomada. Ambos os pacotes privados foram preservados; nenhum dado bruto foi publicado.
