# Mapa por capacidade e escolha do destino — 18/10/2026

Alterações locais posteriores ao candidato instalado `52b9ac9`. Não publicadas nem instaladas no PC real.

## Comportamento

- O mapa considera a capacidade de saída Direct por LED (`spatialCapable`), não o nome ou a quantidade de efeitos anunciados. O RK61 de modos internos permanece na aba Dispositivos; outros teclados com Direct continuam no mapa.
- Posições antigas de componentes explicitamente incompatíveis não são exibidas nem amostradas. A consulta não modifica os dados salvos. Componentes desconhecidos/offline conservam suas posições; não se presume que uma peça ausente deixou de ser compatível.
- Aviso traduzido explica a diferença e abre Dispositivos. Reorganização automática aplica o mesmo filtro. Apenas componentes incompatíveis não provocam recargas repetidas de um mapa vazio.
- O instalador mostra a escolha do destino, com o padrão do Windows e o diretório anterior sugeridos. O caminho registrado no HKLM orienta serviços, recuperação, configuração de portas, desinstalador e ferramentas de inventário/verificação.
- Novos destinos precisam ser exclusivos, locais, NTFS e protegidos. Rejeitados caminho relativo/UNC, raiz do disco, ADS, links, pasta ocupada não registrada, ancestrais substituíveis por usuários comuns e proprietários não confiáveis. A preparação cria a pasta com permissões protegidas antes de copiar executáveis.
- Mantida a política anterior do destino padrão Program Files, com proteção da pasta do aplicativo; não se alteram permissões de volumes ou pastas compartilhadas. Isso não garante proteção dos ancestrais de um Program Files realocado. As exigências adicionais de ancestrais são aplicadas aos destinos personalizados.
- Atualizações permanecem na instalação registrada. Para mudar sua localização, desinstale preservando os dados e reinstale. Não foi implementada migração automática de instalação ativa.
- Se a pasta/portas mudarem depois da preparação, o instalador solicita cancelar/reabrir. A restauração usa o destino preparado, evitando consultar a pasta recém-editada por engano.

## Evidências locais

| Verificação | Resultado |
| --- | --- |
| Regressão HTTP com teclado nativo, posição antiga e segundo teclado Direct | Passou; teclado nativo fora do mapa e disponível em Dispositivos; Direct mantido |
| Navegador real isolado | 43/43 testes aprovados |
| Aviso e navegação em PC/celular, sem overflow horizontal | Teste específico passou em 1366 e 390 px |
| Testes gerais | 212/212 aprovados |
| Supervisor | Reinício do filho, encerramento normal e fallback do Job aprovados |
| Fixture compilado do pós-instalação | 12 cenários PT/EN com códigos esperados |
| Compilação dos três executáveis nativos | Concluída em pasta privada |
| Compilação da receita completa Inno | Concluída somente para verificar sintaxe; payload anterior, não distribuir |
| Política do diretório instalado | Consulta somente de leitura passou; nenhuma ACL alterada no PC |
| Documentação, links, workflows e whitespace | Verificados |

Os testes de caminhos usam ACLs sintéticas e adaptadores de filesystem/registro. Os testes de recuperação/portas/preflight simulam operações do SO, sem alterar serviços reais. As fixtures existentes foram atualizadas para importar/substituir a nova dependência de validação de caminho; o teste de descoberta espacial ganhou um descritor Direct explícito. As expectativas de conflito, restauração e descoberta foram mantidas.

Logs privados: `data/map-install-*`. O arquivo de `data/map-install-compile-only/` usa payload antigo e **não é um instalador candidato**. O pacote em `dist/` e a instalação real continuam anteriores a este bloco.

## Pendências

A VM de publicação agora possui cenários separados de pasta padrão e pasta personalizada protegida. O ciclo completo de instalar, atualizar, recuperar, desinstalar e reinstalar nessa segunda pasta ainda não foi executado. Isso é requisito antes de publicar a alteração do instalador. Nenhum workflow remoto, tag, push ou atualização física foi executado neste bloco. Instalação no PC do usuário exige nova confirmação.

Confirmação humana anterior: o usuário relatou que o RK61 aparece, responde ao controle e continua digitando normalmente com o candidato `52b9ac9`. Não houve medição de latência ou teste prolongado, nem validação física das alterações deste bloco.
