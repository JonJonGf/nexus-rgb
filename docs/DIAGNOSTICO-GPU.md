# Diagnóstico portátil de GPU — desenvolvimento

[English](en/GPU-DIAGNOSTIC.md) · [Compatibilidade](COMPATIBILIDADE-GPU.md)

O teste externo da Gigabyte RX 7600 continua negativo na alpha.40: a GPU dá imagem, mas seu RGB permanece apagado. O SDK estar conectado não comprova que o controlador aceitou a cor. Este coletor reúne evidências para investigar, sem prometer descobrir sozinho uma causa que depende do hardware afetado.

## Para o usuário do computador afetado

1. Receba `NexusRGB-Diagnostic.exe` pelo canal combinado e confira o SHA-256 fornecido com o pacote. É uma candidata de desenvolvimento sem assinatura própria; não desative antivírus ou SmartScreen para executá-la.
2. Abra normalmente. Não precisa instalar Node, Python, biblioteca de sensores ou driver.
3. Deixe o Nexus no estado em que a GPU está falhando. Confira a porta do painel (padrão 5050).
4. Escolha as categorias e clique em **Coletar / Collect**. O resumo dos logs é opcional e vem desmarcado.
5. Leia o JSON exibido. Trocar categorias invalida a coleta anterior, exigindo coletar novamente antes de salvar.
6. **Salvar relatório / Save** grava somente esse conteúdo em um local escolhido. Envie manualmente o JSON, acompanhado do que observou nos LEDs.

Não é necessário reinstalar RGB Fusion ou repetir reinícios que já falharam só para gerar o arquivo. O coletor não altera RGB, não abre SMBus/ADL diretamente, não executa comandos SDK de escrita, não instala drivers, não reinicia serviços e não envia arquivos pela Internet.

Logs protegidos podem aparecer como `access-denied`. Executar manualmente como administrador é uma escolha posterior do proprietário; a ferramenta não pede UAC nem se eleva sozinha. O resumo contabiliza somente assinaturas conhecidas nas últimas 256 KiB de cada log; não exporta texto bruto. Contagens não distinguem automaticamente falhas espontâneas de desligamentos planejados.

## Conteúdo revisável

- Versão/commit do serviço em execução quando a API responde, serviços Nexus/PawnIO e hashes dos arquivos conhecidos da instalação registrada.
- Modelos de GPU/placa-mãe, versão/data do driver gráfico e IDs de modelo PCI (fabricante/dispositivo/subsistema); não inclui o sufixo identificador individual PNP nem serial.
- Zonas GPU com aliases, contagem de LEDs, estado de conexão, capacidade espacial, modos expostos e energia/brilho/modo **solicitados**, sem cores ou perfis.
- Resumo de motor/FPS/falhas por campos permitidos. Em zonas divididas, lista vazia de modos pode ser comportamento do adaptador, não falta de driver.
- Nomes de processos RGB conhecidos. A presença do OpenRGB esperado do próprio Nexus não comprova disputa; serviços não listados ainda podem interferir.
- Categorias de erro e resumo opcional das assinaturas de log, como HRESULT de módulo PawnIO, timeout e desconexão. Erro PawnIO isolado não comprova a causa de uma GPU controlada por outro backend.

O relatório não inclui IP/MAC, credenciais, cookies de sessão, serial, caminho de usuário, nomes/conteúdo de perfis ou fontes de efeitos. Nomes de descritores GPU/modos são filtrados; resultados não reconhecidos ficam genéricos. Não se coleta backup completo. Uma sessão local temporária é aberta na API normal do Nexus; o cookie fica somente em memória, e a ferramenta não exporta o corpo bruto de `/api/state`. Esse fluxo pode consumir o sinal de primeira apresentação de uma instalação nunca aberta; use após a configuração inicial normal.

O relatório registra `physicalConfirmation: not-measured`: nenhuma leitura confirma a cor física. Categorias indisponíveis são explícitas. É necessário confrontar o JSON com o comportamento visto no PC, e talvez coletar evidência adicional depois, sem sondagens especulativas.

## Compilar e verificar

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-diagnostic.ps1
node scripts/test-gpu-report.cjs
```

Saída: `dist/diagnostics/NexusRGB-Diagnostic.exe` e pacote `NexusRGB-GPU-Diagnostic-dev.zip`, com instruções PT/EN, licença e SHA-256 do executável. Usa apenas bibliotecas do .NET Framework do Windows. Os ensaios exercitam o executável com fixture, filtragem de segredos e servidor HTTP loopback isolado, sem escrever LEDs. A tela também é renderizada com fixture para inspeção. Isso não é teste na RX 7600 afetada, que continua pendente.
