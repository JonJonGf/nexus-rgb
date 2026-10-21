# Compatibilidade do Nexus RGB

[English](en/COMPATIBILITY.md)

O Nexus procura usar capacidades reais do equipamento, sem exigir uma marca única. Instalar o aplicativo, detectar um aparelho e conseguir controlá-lo são etapas diferentes. Um descritor ou pedido aceito pelo software não confirma que os LEDs ou motores responderam fisicamente.

| Recurso | De onde vem o suporte | Limite atual |
| --- | --- | --- |
| RGB do PC | OpenRGB headless e descritores de modos/zonas | Depende do modelo, revisão e protocolo; a lista do OpenRGB atual pode diferir da versão empacotada |
| Mapa e efeitos por LED | Modo Direct seguro informado pelo equipamento | Aparelhos apenas estáticos/nativos não recebem streaming espacial |
| ARGB da placa/controladora | Saída redimensionável informada pelo OpenRGB | Quantidade de LEDs precisa de configuração; não é descoberta pelo sinal ARGB |
| Teclados | OpenRGB para modelos suportados; transporte USB próprio validado para o descritor RK61 correspondente | Um fabricante/VID não autoriza enviar o protocolo a todos os seus modelos |
| Temperatura e RPM | LibreHardwareMonitor 0.9.6, em auxiliar opcional de desenvolvimento | Sensores disponíveis variam entre placas, drivers e firmware |
| Curvas de fan | Controles SuperIO, AMD e NVIDIA informados pela biblioteca e dentro dos limites seguros | Não comprova ligação do conector nem resposta mecânica; canais sem faixa segura ficam somente leitura |
| Hubs USB, AIOs, GPU Intel e notebooks | Exigem adaptadores específicos além do suporte atual | Não há promessa de controle universal ou carregamento automático de plugins externos |
| WLED | API e protocolo de rede WLED | Uma lâmpada Wi-Fi de outro ecossistema não se torna WLED pelo endereço IP |

## Identificar sem adivinhar

Na Ventilação, preserve o nome original e use **Identificar canal** para registrar a ligação que você conferiu. A preferência não depende da posição na lista. Não atribuímos automaticamente CPU_FAN por ser o primeiro controle, nem ocultamos uma saída por estar em zero RPM. Sugestões de modelos conhecidos são mostradas separadamente como não confirmadas. Salvar nome/visibilidade não muda rotações. Mostrar todos recupera canais ocultos.

Fans em paralelo podem compartilhar um único comando e retorno de RPM. RGB e alimentação/controle do motor são conexões distintas. A configuração de LEDs não determina quantos motores podem ser controlados.

## Quando não funcionar

Confira a versão instalada em Configurações e prepare o diagnóstico revisável. Registre modelo/revisão, qual recurso respondeu e qual falhou, e se outro programa controla o mesmo aparelho. O diagnóstico compartilhável exclui dados privados por padrão; não publique tokens, seriais ou relatórios crus. Um teste físico precisa ser combinado com o proprietário. Não instale firmware, DLLs ou drivers de origem incerta como tentativa genérica.

## Como ampliamos o suporte

Cada adaptação deve ter fonte/licença verificável, identificação específica quando o protocolo exigir, limites declarados, teste de regressão na interface real e validação física antes de anunciar o equipamento como confirmado. Manter bibliotecas fixadas por hash permite revisar atualizações e preservar recuperação. Monitorar/controlar são funções opcionais: o módulo desligado não abre sensores nem mantém o auxiliar ativo.

Referências: [compatibilidade do Fan Control](https://github.com/Rem0o/FanControl.Releases#issues-and-hardware-compatibility), [sensores e pareamento](https://getfancontrol.com/docs/), [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor), [limite físico do ARGB](https://openrgb.org/resize.html) e [base headless empacotada](https://github.com/hello-nexus/openrgb-headless/tree/18e2c95f5e6d5d9f45a948df1e3d0b882e605b45).
