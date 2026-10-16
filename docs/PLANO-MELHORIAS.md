# Melhorias avaliadas em 16/10/2026

Este registro mantém as melhorias aceitas para avaliação e implementação futura. Ele não anuncia recursos disponíveis nem uma data de entrega. A revisão do código identificou diferenças em relação às hipóteses do relatório externo; cada alteração precisa de reprodução e testes próprios.

## Em desenvolvimento: comunicação da Alexa

- Confirmar separadamente energia e brilho virtual no protocolo Hue, sem mudar o brilho RGB, cores, perfis ou parâmetros do mapa.
- Preservar a energia em pedidos que contêm somente brilho. Um `on` explícito determina a energia, mesmo com `bri: 0`.
- Manter consultas posteriores coerentes com o brilho virtual aceito e validar tipos/faixas antes de aplicar energia.
- Aceitar barra final nas rotas Hue sem ampliar o acesso a Echos não aprovados.
- Validar com HTTP real e testes isolados; o desaparecimento do aviso de falha depende de teste com Echo físico. Consulte [Alexa](ALEXA.md).

## Próxima etapa: estabilidade e hardware

- Otimizar a redescoberta sem perder a detecção inicial por etapas, os eventos do SDK, a reconexão e uma recuperação limitada caso eventos sejam perdidos. A primeira peça detectada não significa que a varredura terminou.
- Medir o custo da descoberta antes de atribuir engasgos a ela. O caminho do SDK consulta descrições mantidas pelo OpenRGB; isso não comprova nova varredura SMBus a cada consulta.
- Evitar reenvios de preto quando a prévia espacial continua gerando revisões com as luzes apagadas. Considerar Off nativo quando todas as zonas estiverem apagadas, preservando zonas independentes e identificação temporária.
- Implementar encerramento normal dos processos por um canal compatível com serviços Windows, com prazo máximo e Job Object como recuperação forçada.
- Diferenciar painel pronto de hardware ainda em detecção no reinício manual; espera limitada, mensagem de progresso e tratamento de descoberta parcial.

## Clareza visual e rede

- Indicar personalização individual nas peças excluídas do mapa e oferecer **Voltar a seguir o mapa** por dispositivo. Pausar/reativar o mapa não deve apagar exclusões intencionais.
- Melhorar seleção de interface considerando gateway/rotas locais, interfaces Hyper-V válidas e VPNs; manter escolha manual coerente entre painel e bandeja, sem depender da Internet.
- Separar orçamentos de leitura, escrita e operações caras, inclusive no acesso local. O salvamento do mapa já agrupa alterações em intervalos de 350 ms.
- Reservar capacidade limitada da prévia ao administrador sem remover o limite global ou o controle de clientes lentos.
- Deixar rotas `/api/` fora do interceptador do Service Worker e validar reconexão dos streams.

## Recursos opcionais

- Acesso LAN aberto por padrão, link/QR autorizado com revogação e renovação, e somente neste PC. Definir separadamente o comportamento da ponte Alexa. Links HTTP não fornecem criptografia.
- **Reconectar dispositivo** com revisão da origem/destino e das configurações migradas; aproveitar número de série confiável quando disponível e exigir escolha em casos ambíguos. Não adivinhar por fabricante, nome e contagem de LEDs.
- Melhorar diagnóstico da porta da Alexa, incluindo possível uso pelo Windows/HTTP.sys, sem encerrar serviços alheios ou impedir desnecessariamente o controle RGB pelo painel.

## Critério de conclusão

Preservar dados existentes, testar o comportamento anterior e a recuperação, documentar limites e publicar executáveis correspondentes à versão do código. Instalações que pedem administrador exigem a confirmação do usuário. Problemas sem reprodução permanecem identificados como hipóteses.
