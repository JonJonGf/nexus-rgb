# Contexto de desenvolvimento

Este é o registro público de continuidade entre sessões e ferramentas. Leia também [AGENTS.md](../AGENTS.md), o [plano de melhorias](PLANO-MELHORIAS.md) e o [guia de desenvolvimento](DESENVOLVIMENTO.md). Confirme o estado atual no Git e no ambiente antes de agir; versões instaladas em outros computadores podem ser diferentes.

## Situação atual — 16/10/2026

- **Entrega de código:** alpha.20, commit `b00c3f687bdd9509dd3d9d9d79a362034cb7c397`.
- **Distribuição:** [release alpha.20](https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.20), com instalador, desinstalador, hashes e origem do build. Evidências adicionadas ao main em `dc6b8f8`; esse commit posterior só altera documentação.
- **PC de validação:** alpha.20 instalada com autorização do usuário, instalação encerrada com código zero e sem reinício do Windows. Os cinco componentes voltaram sem erro; hashes dos ajustes e dos arquivos de efeitos permaneceram iguais aos capturados antes da atualização. Contagens, nomes pessoais e logs locais não são publicados.
- **Resultado físico:** usuário testou a alpha.20 e informou que a Alexa continua anunciando falha. A hipótese de confirmação de brilho não resolveu esse equipamento. Nos pedidos observados desse teste, o Echo enviou somente `on`, sem `bri`; respostas HTTP 200 terminaram em poucos milissegundos, e consultas posteriores devolveram energia apagada e controlador disponível. Dados identificadores do equipamento e da rede permanecem privados.
- **Pendente principal:** confirmar se o aviso acontece nas duas direções e investigar o protocolo a partir desse resultado. Grupos e rotinas precisam de teste separado. Não declarar o defeito corrigido nem repetir a hipótese de `bri` como causa comprovada.
- **Demais melhorias:** registradas no [plano](PLANO-MELHORIAS.md) e adiadas por decisão do usuário. Não iniciá-las automaticamente.
- **Mudança documental após o instalador:** regras de continuidade em `AGENTS.md` e `.agents/rules/continuidade.md`, este registro e sua referência no guia de desenvolvimento. Os arquivos de instruções não alteram o binário da alpha.20. Conferir commit correspondente no histórico do Git; ele não é conhecido antes de sua criação.

## Decisões de produto que devem ser preservadas

- Controle de RGB Windows pelo OpenRGB, com painel local no PC/celular; acesso LAN aberto por padrão e sem QR obrigatório a cada uso.
- Alexa controla fisicamente apenas ligar/desligar. Preservar brilho, cor, efeito, mapa, perfis e ajustes individuais ao alternar energia.
- Interface PT/EN; apresentação inicial uma vez por pasta de dados, preservada ao atualizar.
- Dados existentes precisam sobreviver à atualização e à desinstalação padrão. Executáveis publicados devem corresponder ao código/tag e aos testes indicados.
- Perguntar antes de abrir instalador/UAC ou reiniciar serviços no PC real, pois o usuário pode estar em acesso remoto. Não reiniciar/desligar Windows automaticamente.
- Projeto público MIT; sem assinatura digital própria no momento. Não prometer compatibilidade universal ou certificação de segurança.

## Histórico de entregas

### 16/10/2026 — Alpha.20: respostas Hue da Alexa

**Objetivo:** investigar o caso em que o Echo acende/apaga as luzes e anuncia falha, mantendo a integração somente liga/desliga.

**Implementação:** `server/alexa.js` confirma `on` e `bri` separadamente; mantém `bri` virtual na memória, com GET posterior coerente; valida inteiro 0..254 antes de aplicar energia. Só `on` explícito modifica energia: pedidos apenas de brilho não reacendem/apagam, não gravam ajustes e não comandam LEDs. Aceita barra final nas rotas Hue sem alterar identidade da ponte/luz ou verificações de Host, origem, sub-rede e aprovação. Diagnóstico acrescenta brilho virtual e indicação de energia explícita, sem registrar campos arbitrários.

**Arquivos principais:** `server/alexa.js`, `tests/alexa.test.js`, `tests/alexa-http.test.js`, [Alexa e teste físico](ALEXA.md), [planejamento](PLANO-MELHORIAS.md), [notas alpha.20](releases/v0.1.0-alpha.20.md), README e índices de documentação.

**Validação:** 124 testes de lógica/integração locais e no CI; 34 de interface no CI; supervisor e estabilidade de 60 segundos/171 requisições/dez reinícios abruptos. Nove testes específicos de Alexa, incluindo transporte HTTP real em loopback com identidade LAN simulada. Duas VMs Windows passaram em 75 verificações cada. As três análises CodeQL do mesmo commit/tag passaram sem erros/avisos e sem alertas abertos, sem descartar novos alertas para esta alteração. Assets oficiais baixados e confrontados com hashes e metadados; instalação local e preservação dos dados verificadas. Consulte o [relatório](validation/2026-10-16-alexa-feedback.md), o [CI](https://github.com/JonJonGf/nexus-rgb/actions/runs/38957323136) e a [publicação](https://github.com/JonJonGf/nexus-rgb/actions/runs/38957323137).

**Resultado físico posterior à instalação:** o usuário informou que o aviso persiste. O diagnóstico local mostrou PUT com apenas `on`, sem `bri`, respostas 200 concluídas em aproximadamente 5–8 ms e GETs posteriores com `on: false`, `reachable: true`. Isso enfraquece a hipótese de confirmação de brilho para a falha observada. A finalização da resposta pelo servidor não comprova a interpretação dela pelo firmware. O ajuste melhora coerência do protocolo, mas não resolveu o aviso nesse Echo.

**Limites:** brilho virtual não corresponde ao brilho RGB e reinicia em 254 com um novo processo. Campos Hue não suportados permanecem sem implementação. O efeito em grupos/rotinas precisa de observação física.

**Próximo passo:** confirmar as duas direções e investigar a compatibilidade da resposta/estado anunciado com o firmware antes de modificar novamente o protocolo. O resultado informado foi registrado. Não alterar brilho RGB nem identidade/cadastro da luz como tentativa automática.

### 16/10/2026 — Continuidade entre agentes

**Pedido:** manter no Git um contexto atualizado para permitir que outra ferramenta continue o trabalho e que as mudanças sejam compreendidas ao retornar.

**Implementação:** instruções na raiz e regra sempre ativa do Antigravity direcionam a este registro. Exigem atualização após blocos relevantes e antes de encerrar/pausar, incluindo tarefa incompleta, testes, pendências e distinção entre fonte, release e instalação. O guia de desenvolvimento oferece o mesmo ponto de entrada.

**Validação:** conferir os links locais e as mudanças documentais; não é necessária outra compilação para publicar apenas estas instruções. Nenhum comportamento do aplicativo é alterado por elas.

## Modelo para novas entradas

```text
Data / ferramenta / objetivo:
Mudanças e arquivos:
Decisões e motivo:
Testes executados e resultados:
Limites e testes pendentes:
Git (branch, alterações locais, commit/tag conhecidos, workflows):
Release e instalação (distinguir fonte de binário instalado):
Pendências / próximo passo / autorização necessária:
```
