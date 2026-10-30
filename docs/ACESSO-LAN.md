# Acesso pelo celular e pela rede

Na aba **Conexões**, escolha:

- **Aberto na rede local:** padrão. Dispositivos na mesma sub-rede podem controlar iluminação, sem administração.
- **Somente com link autorizado:** clique em **Mostrar link e QR Code**. Abra esse link no celular/tablet da mesma rede. O navegador guarda uma autorização local; não precisa reler o QR a cada uso. O cookie dura até 30 dias, mas pode ser revogado antes. O link permanece válido até renovação/revogação.
- **Somente neste PC:** acesso de controle pela LAN bloqueado. A administração permanece no painel `localhost`/loopback do PC.

**Gerar outro link autorizado revoga o anterior e seus acessos.** O botão **Revogar link e acessos** invalida também sessões abertas e prévias. Após reiniciar o serviço, o link continua válido pelo hash salvo; gerar outro link continua sendo renovação. Não é revogação individual por telefone: este primeiro formato usa um link compartilhado.

O link autorizado não concede acesso a configurações administrativas, importação de efeitos, ventilação, rede ou reconexão. A Alexa mantém sua lista de Echos autorizados, independente destes modos; “somente PC” restringe o painel, não desliga a ponte Alexa.

## Privacidade e recuperação

HTTP local não criptografa comandos nem o envio inicial da autorização; use uma rede confiável e não publique/encaminhe portas para a Internet. O segredo vai no fragmento do link, é removido do endereço pelo navegador e trocado por cookie HttpOnly/SameSite. O arquivo privado `access.json` guarda somente hash, separado de perfis e backups de iluminação. Não compartilhe o link autorizado ou cookies em diagnósticos.

Se um link parar de funcionar, abra Conexões no PC e gere um novo ou escolha outro modo. Se esse arquivo ficar inválido, o Nexus restringe o controle LAN e permite corrigir a escolha pelo PC. Ajustes RGB não são apagados.
