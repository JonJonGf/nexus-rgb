# Placas de vídeo no Nexus RGB

[English](en/GPU-COMPATIBILITY.md)

**Retorno físico de 21/10/2026:** a Gigabyte Radeon RX 7600 GAMING OC 8G do teste externo continua com RGB apagado na alpha.40, embora dê imagem. Portanto, a migração não resolveu esse caso. Próximo passo: [coletor portátil de diagnóstico](DIAGNOSTICO-GPU.md), sem novos comandos físicos automáticos.

A alpha.40 incorpora o catálogo de controladores do [OpenRGB Headless no commit 18e2c95](https://github.com/hello-nexus/openrgb-headless/tree/18e2c95f5e6d5d9f45a948df1e3d0b882e605b45), sem uma lista de marcas permitidas no Nexus. O motor enumera as GPUs encontradas e lê seus modos, zonas e quantidades reais. Ter uma GPU detectada não comprova que seu firmware aceitou fisicamente a última cor: o SDK não fornece essa confirmação.

## Famílias presentes na base

Os fontes dessa revisão incluem controladores de GPU para ASUS Aura, ASRock, Colorful, EVGA (Pascal/GP102/Turing/Ampere), Galax/KFA2, Gigabyte RGB Fusion (incluindo Fusion 2 e Blackwell), Intel Arc A770 LE, Manli, MSI, NVIDIA Illumination, Palit, PNY, PowerColor Red Devil, Sapphire Nitro Glow e Zotac. **Isso não significa todos os modelos dessas marcas**: IDs, revisão da placa, sistema operacional, driver e firmware determinam a detecção. A [lista upstream](https://openrgb.org/devices.html) pode mudar e não substitui a revisão efetivamente distribuída no instalador.

## O que fica disponível

- **Direct por LED:** mapa e efeitos de software quando o descritor confirma essa capacidade. O Nexus compõe um quadro para a controladora inteira, preservando o controle individual de suas zonas.
- **Cor estática/Custom:** cor e brilho conforme os parâmetros reais do modo. Modos que gravam automaticamente no dispositivo não são tratados como streaming espacial.
- **Modos internos:** controles oferecidos pelo descritor, respeitando o alcance do modo. Modos internos de uma controladora dividida em zonas não são apresentados como se fossem efeitos independentes de cada zona.
- **Sem controle RGB exposto:** nenhuma geometria, quantidade ou suporte de cor é inventado. Alguns modelos têm somente um logo iluminado ou uma cor física fixa.

A interface agrupa as zonas pelo ID estável da controladora, mantendo aparelhos de mesmo nome separados. Abra **Zonas e controles individuais** para ajustar cada parte. Saídas ARGB redimensionáveis com zero LEDs exibem orientação para configurar a quantidade realmente conectada; o Nexus não deduz quantos LEDs existem nas ventoinhas.

## Estabilidade e diagnóstico

Filas limitadas, deduplicação, coordenação dos ticks e o limite de 20 FPS da RAM continuam ativos. A nova base não autoriza aumentar essa cadência nem executar gravação de firmware. O protocolo agora preserva valores zero e capacidades de modo mais recentes; a alteração de cor em modos nativos por LED foi corrigida.

O diagnóstico revisável identifica zonas da mesma controladora com aliases e inclui energia, brilho e modo **solicitados**, sem nomes, IDs reais, cores, perfis ou código dos efeitos. Uma exportação com estado conectado e zero erros ainda pode acompanhar uma falha física de aplicação. O caso externo da GPU Gigabyte apagada requer teste no hardware afetado; não foi declarado resolvido apenas com simulação ou migração do motor.

Fonte/licença e origem do motor acompanham o instalador em `sources/` e `licenses/`. Consulte o [relatório da entrega](validation/2026-10-20-alpha40.md) para separar testes de protocolo/navegador, instalação em VM e ensaios físicos realmente executados.
