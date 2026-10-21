# Ventilação: canais úteis e perfis personalizados

## Pedido e entrega

Usuário pediu identificação semelhante ao HWiNFO, menos canais sem utilidade, modo manual para editar curvas, três perfis próprios nomeados e traçados Linear/Suave. Implementação permanece em desenvolvimento, separada da alpha.40 oficial. Nada desta etapa instalou pacote, reiniciou serviço, abriu sensores reais ou alterou rotações.

### Identificação e filtragem

Helper retorna apenas fabricante/modelo de placa já disponíveis no SMBIOS da biblioteca quando aberto. Novo módulo `server/cooling-identification.js` conserva IDs e descritores originais; o perfil exato TUF GAMING A520M-PLUS II/NCT6798D sugere CHA_FAN1, CPU_FAN e CHA_FAN2. [Manual oficial ASUS](https://dlcdnets.asus.com/pub/ASUS/mb/SocketAM4/TUF_GAMING_A520M-PLUS_II/E17795_TUF_GAMING_A520M-PLUS_II_WEB.pdf) confirma três conectores. Observação de rótulos no HWiNFO e layout da família ASUS/Nuvoton no fonte fixado LHM fundamentam sugestões de apresentação. Não foi importado código proprietário, criado requisito de HWiNFO aberto ou validado mecanicamente o PWM de cada canal. A UI informa confirmar conector/RPM antes do controle; não há associação automática persistida.

Saídas reconhecidas/GPU, leituras com RPM, canais selecionados e canais previamente vistos girando ficam visíveis. Canais genéricos sem sinal são ocultados, não apagados. Mostrar todos não reconstrói campos nem perde edições. Zero RPM não prova falha ou ausência. Placas não correspondentes não recebem o perfil ASUS; teste confere esse bloqueio. Nenhum mapeamento universal foi anunciado.

### Curvas e biblioteca

- Modo explícito por canal: seguir perfil ou curva manual. Editor comum a canal/biblioteca, 2–8 pontos por arraste ou número, sem cruzamento durante arraste; servidor continua validando temperaturas crescentes e velocidade não decrescente.
- Linear usa segmentos afins. Suave usa `s(t)=3t²−2t³` em cada trecho, contínua/monotônica/sem overshoot, não uma exponencial. Preview e motor aplicam a mesma definição; mínimos, limite do hardware, proteção térmica e falha de sensor prevalecem.
- `cooling.json` admite até três perfis nomeados, com pontos e interpolação. Criar/editar biblioteca não abre auxiliar nem envia comandos. Se editar um perfil em execução, a versão aplicada permanece congelada até reaplicar; aviso de alteração pendente só para canais seguindo o perfil. Exclusão do perfil selecionado exige trocar antes. Reinício restaura biblioteca, nunca reativa controle.
- Corrigido defeito real reproduzido: manual herdava TURBO e solicitava 100% apesar dos pontos. Agora manual explícito usa seus pontos; clicar TURBO limpa pontos/interpolação individuais e solicita 100% conforme os limites existentes.

## Verificação

- 286 testes gerais passaram; 65 Edge passaram sem retries na suíte completa. Após últimos ajustes locais de layout/legenda, cinco testes específicos passaram novamente, incluindo PT/EN e 390 px. Contratos HTTP cooling totalizam 12, com exemplos literais Linear=40% e Suave=33%, rejeição de modo inválido, limite de três perfis, persistência/reinício off, edição sem aplicação imediata e mapeamento condicionado à placa.
- Defeitos foram observados antes das implementações: 100 em vez de 55 na curva manual; rejeição HTTP da biblioteca/interpolação; ausência de campos/filtro/gestão no navegador. Falha intermediária de edição movendo perfil para o fim e perda de rascunho em atualização foram corrigidas preservando ordem e campos.
- Compilação e protocolo/watchdog/identidade nativos passaram; integração real navegador→HTTP→C# fixture passou com seis canais, TURBO simulado e desligamento. Job continua independente. Nenhum ensaio físico foi executado. Visual desktop/celular inspecionado, inclusive gráfico e tabela; evidências privadas em `data/cooling-dev/manual-visual/`.
- Eficiência estrutural: nenhuma dependência nova, processo extra permanente, varredura adicional ou novo temporizador de sensores. Metadados vêm do objeto já aberto; amostragem segue 1 Hz. Gráfico só recalcula em edição; cadastro de perfis grava por ação, não por quadro. Sem nova medição quantitativa de RAM/CPU/watts desta revisão; números anteriores não são benchmark desta versão.

## Distribuição

Código em branch `codex/fan-control-dev`; gerar candidata privada R3 após commit. Não publicar tag/release nem substituir instalação R2 automaticamente. Validar pacote e registrar hash no contexto antes de entregar. Novo teste real exige atualização pelo usuário e confirmação de quais fans respondem; nomes sugeridos não comprovam ligação física.
