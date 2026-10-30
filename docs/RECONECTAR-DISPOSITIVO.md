# Reconectar um dispositivo que mudou de identificação

Na aba **Dispositivos**, use **Reconectar dispositivo** no PC:

1. Escolha uma configuração salva cuja peça esteja desconectada.
2. Escolha o dispositivo atual e clique em **Revisar transferência**.
3. Confira origem/destino, iluminação, quantidade de peças no mapa e perfis afetados.
4. Se houver ajustes que não podem ser transferidos, revise a lista e aceite explicitamente sua omissão antes de aplicar.
5. Clique em **Aplicar transferência** e confira fisicamente o resultado.

São transferidos os ajustes individuais de iluminação, referências nos perfis, posições/calibração do mapa e exclusões correspondentes. O formato/ordem dos LEDs é preservado, mas a fiação física não é detectada: pode ser preciso recalibrar no novo equipamento. A escolha de energia é preservada; peça desligada não é religada por intenção de migração.

Modos internos numéricos não identificam o mesmo efeito em outra controladora. Eles não são transferidos. Vínculo de teclado incompatível e quantidades ARGB também exigem configuração própria; a tela solicita aceite dessas omissões. Não migra regras de ventilação, drivers, firmware ou pareamento de transportes.

O Nexus recusa destino com ajustes salvos em conflito, efeito não suportado e mapa que exceda a contagem disponível. Configure a quantidade real de LEDs antes de tentar migrar um mapa para uma porta ARGB vazia. Não trunca o mapa automaticamente.

A revisão dura três minutos e perde validade se a configuração ou os dispositivos mudarem. Uma cópia privada `before-reconnect-*.json` é preservada antes de aplicar; o arquivo contém ajustes pessoais e não deve ser publicado. O salvamento é atômico e a revisão antiga de outro editor de mapa não pode sobrescrever silenciosamente a transferência.
