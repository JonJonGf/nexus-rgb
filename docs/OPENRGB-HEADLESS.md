# Arquitetura OpenRGB Headless e Integração ao Nexus RGB

> **Estado conferido em 20/10/2026:** este documento é um estudo e contém propostas; **o fork headless não está integrado ao instalador Nexus RGB**. `vendor-manifest.json`, o build e a alpha.38 continuam usando o OpenRGB oficial 1.0. Houve implementação de classificação de dispositivos/barramentos e controles no Nexus, sem substituir o executável C++. Não interpretar a seção de compilação como procedimento validado nesta entrega, nem os valores abaixo como benchmark comparável do Nexus: faltam método/artefatos que comprovem essas estimativas. A descrição de deadlock é uma hipótese de engenharia, não causa demonstrada de todo travamento de DRAM ou do relato atual de GPU. Esta nota corrige explicitamente a impressão de implantação/validação deixada pelo texto anterior, que foi preservado para histórico.

Este documento consolida o estudo de engenharia sobre a execução do OpenRGB em modo *headless* (sem interface gráfica Qt), a resolução de deadlocks em barramentos SMBus/DRAM e o mapeamento de periféricos e controladoras no **Nexus RGB Studio**.

---

## 1. Motivação e Redução de Footprint

O Nexus RGB utiliza o OpenRGB exclusivamente como serviço de plano de fundo (*daemon* local), comunicando-se através do protocolo de rede do SDK na porta local (padrão `6742` ou `6743`):

$$\text{Navegador / PC} \longleftrightarrow \text{Nexus RGB (Node.js)} \xrightarrow[\text{SDK OpenRGB}]{\text{127.0.0.1:6742}} \text{OpenRGB Daemon} \xrightarrow[\text{PawnIO}]{\text{SMBus / USB}} \text{LEDs Físicos}$$

Como o Nexus RGB já disponibiliza um estúdio espacial completo em HTML5 Canvas, a interface nativa do OpenRGB (baseada em Qt6) nunca é exibida ao usuário:

| Componente | OpenRGB GUI Padrão | OpenRGB Headless | Economia / Impacto |
| :--- | :--- | :--- | :--- |
| **Executável** | `OpenRGB.exe` (~10.6 MB) | `OpenRGB-headless.exe` (~8.5 MB) | Redução de tamanho |
| **Bibliotecas Qt6** | `Qt6Core.dll`, `Qt6Gui.dll`, `Qt6Widgets.dll`, `Qt6OpenGL.dll`, `platforms/qwindows.dll` (~24 MB) | **0 MB** (removidas) | 100% de remoção de DLLs Qt |
| **DirectX Shader Compiler** | `dxcompiler.dll`, `dxil.dll` (~13.8 MB) | **0 MB** (removidas) | 100% de remoção de DLLs DX |
| **Peso total na instalação** | ~48 MB | **~9 MB** | **Redução de ~80% do pacote** |
| **Consumo de memória ociosa** | ~60–90 MiB | ~15–25 MiB | Redução de ~70% de RAM |

---

## 2. Causa Raiz do Travamento em DRAM ENE (`std::shared_mutex`)

### O Problema Físico e Concorrência

Em módulos de memória RAM DDR4/DDR5 com chips controladores ENE (amplamente utilizados por G.Skill Trident Z, Kingston Fury, Corsair Vengeance, GeIL, TeamGroup, etc.), o barramento de comunicação é o SMBus/I2C da placa-mãe (Intel PCH ou AMD PIIX4), que opera a 100 kHz.

No OpenRGB upstream, a sincronização de threads entre o servidor de rede (`NetworkServer`) e as controladoras de hardware utilizava `std::shared_mutex` do C++17. No Windows, essa classe é mapeada diretamente sobre a API nativa `SRWLOCK` (*Slim Reader/Writer Lock*).

### O Deadlock de Lock Reentrante

1. Uma thread de rede do OpenRGB adquire um *shared lock* (leitura) para responder a um comando do cliente (como `getControllerData` ou status de zonas).
2. Concomitantemente, o streaming contínuo de efeitos despacha pacotes de escrita rápida (`updateLeds`), solicitando um *exclusive lock* (escrita).
3. Conforme a especificação do `SRWLOCK` no kernel do Windows, quando uma solicitação de escrita exclusiva fica pendente na fila, **nenhuma nova leitura compartilhada é concedida** para evitar inanição (*starvation*) do escritor.
4. Se o fluxo de execução interna do driver requisitar uma leitura aninhada ou se uma função de callback reentrar no leitor, ocorre um **deadlock fatal irreversível**:
   - A thread leitora fica bloqueada esperando o leitor liberar.
   - O leitor nunca libera porque aguarda a conclusão da rotina aninhada.
   - O processo para de responder aos pacotes do SDK, resultando no erro reportado pelo Nexus RGB: *"OpenRGB não respondeu ao consultar um componente"*.

### A Solução em Duas Frentes

1. **No Nexus RGB (Camada de Aplicação):**
   - **Ritmo Duplo por Barramento (Dual-Rate Engine):** contenção estrita de envio a no máximo 20 FPS para dispositivos SMBus DRAM (`isSmbusRam(device)`), eliminando o represamento de pacotes no transporte.
   - **Deduplicação de Cores (`colorsEqual`):** suprime escritas repetidas de cores inalteradas.
2. **No OpenRGB Headless (Camada de Driver):**
   - Substituição de `std::shared_mutex` por `ReentrantSharedMutex` (mutex compartilhado reentrante com contagem de threads), permitindo que threads leitoras aninhadas concluam sem colidir com solicitações exclusivas pendentes.

---

## 3. Timeouts por Detector I2C / SMBus

No OpenRGB padrão, o gerenciador de descoberta (`DetectionManager.cpp`) define um timeout global:

```cpp
#define DETECTION_WAIT_TIMEOUT_MS 60000 // 60 segundos
```

Se qualquer detector SMBus encontrar um endereço I2C em estado de *clock stretching* infinito (muito comum em barramentos compartilhados com sensores SuperIO ou portas de hardware com falha), o OpenRGB trava sua thread de inicialização por até um minuto completo.

Na arquitetura headless recomendada:
- A varredura de cada detector é encapsulada em uma thread separada com timeout estrito de **3000 ms** (3 segundos).
- Se o detector não responder em 3 segundos, a controladora específica é cancelada e o OpenRGB segue detectando os demais componentes normalmente, evitando travamentos na inicialização do serviço.

---

## 4. Matriz de Controladoras e Mapeamento de Periféricos no Nexus RGB

O Nexus RGB classifica automaticamente o ecossistema de dispositivos detectados pelo OpenRGB através de `detectBusArchitecture` e `classifyDeviceType`:

```
Dispositivo Detectado
       │
       ├─► [USB / HID] ──────────► Teclados (5), Mouses (6), Mousepads (7), Headsets (8), Dongles
       ├─► [Intel PCH SMBus] ────► DRAM ENE / Corsair / Kingston em barramento i801 (limitado a 20 FPS)
       ├─► [AMD PIIX4 SMBus] ────► DRAM em barramento AMD (limitado a 20 FPS)
       ├─► [SuperIO / LPC] ──────► Sensores de Placa-Mãe, Conectores ARGB Header
       └─► [GPU Bus / I2C] ──────► Placas de Vídeo GeForce / Radeon (Direct ou Modos Fixos)
```

### Formatos Espaciais Automáticos no Studio

Ao posicionar peças no mapa espacial, o Nexus RGB adapta o layout físico:
- **Teclados (`type === 5`):** proporção retangular horizontal ampla (~3:1).
- **Mouses (`type === 6`):** proporção compacta oval (~1:1.6).
- **Coolers / Fans (`type === 3`):** formato de anel circular (`shape: 'fan'`).
- **Memórias RAM (`type === 1`):** formato de pente vertical fino (`shape: 'strip'`).

---

## 5. Procedimento para Compilação Headless

Para compilar uma versão headless a partir do código fonte em `vendor/openrgb-source/openrgb`:

1. **Remoção de Módulos Qt no Arquivo de Projeto:**
   - Desabilitar `QT += widgets opengl` e substituir por build CLI padrão `QT = core network` ou compilação C++ nativa com `winsock2`.
2. **Flags de Compilação (MinGW ou MSVC):**
   ```bash
   qmake "CONFIG+=headless" "CONFIG+=release" OpenRGB.pro
   make -j4
   ```
3. **Binários Resultantes:**
   - Um executável único `OpenRGB.exe` sem dependência de DLLs do Qt na pasta de distribuição.
   - Conserva apenas os microcódigos e bibliotecas de driver assinadas: `PawnIOLib.dll`, `hidapi-hotplug.dll`, `libusb-1.0.dll`, `SmbusI801.bin`, `SmbusPIIX4.bin`, `SmbusNCT6793.bin`, `SmbusIntelSkylakeIMC.bin`.
