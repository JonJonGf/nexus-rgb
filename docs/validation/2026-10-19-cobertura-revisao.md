# Cobertura da revisão integral — 19/10/2026

Base: `00625c150a431bcb4ccfaa293470d6f3b065594f`. Consulte o [relatório e limites](2026-10-19-revisao-integral.md).

A matriz inventaria todos os arquivos próprios de execução/interface, ferramentas, testes e configuração de entrega. “Leitura” indica revisão manual do módulo e dos caminhos relevantes, não prova formal de cada linha ou compatibilidade física. Os 59 arquivos de teste/fixture foram inventariados e verificados sintaticamente; a leitura manual de testes focou os contratos sob investigação. A suíte já executada (220 gerais/43 navegador) não cobre automaticamente os novos probes.

Dependências e executáveis gerados não foram auditados linha a linha. O lockfile/manifesto foi examinado como configuração de dependências e integridade. As regras de continuidade/domínio foram lidas separadamente; documentação histórica e imagens não são contabilizadas como código executável.

| Arquivo | Cobertura nesta ampliação | Verificação automatizada |
| --- | --- | --- |
| `.gitattributes` | Configuração e uso no ciclo do produto | Sem nova execução de ciclo real |
| `.github/workflows/build-release.yml` | Leitura do fluxo e permissões | Não executado remotamente nesta ampliação |
| `.github/workflows/ci.yml` | Leitura do fluxo e permissões | Não executado remotamente nesta ampliação |
| `.github/workflows/codeql.yml` | Leitura do fluxo e permissões | Não executado remotamente nesta ampliação |
| `.github/workflows/installer.yml` | Leitura do fluxo e permissões | Não executado remotamente nesta ampliação |
| `.github/workflows/publish-release.yml` | Leitura do fluxo e permissões | Não executado remotamente nesta ampliação |
| `.gitignore` | Configuração e uso no ciclo do produto | Sem nova execução de ciclo real |
| `installer/NexusRGB.iss` | Leitura do módulo/caminhos | Sem nova execução de ciclo real |
| `installer/backup-before-upgrade.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `installer/service-preflight.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `native/AppInfo.cs` | Leitura do módulo/caminhos | Compilação C# aprovada |
| `native/Locale.cs` | Leitura do módulo/caminhos | Compilação C# aprovada |
| `native/NexusHidBridge.cs` | Leitura do módulo/caminhos | Compilação C# aprovada |
| `native/NexusRGB.cs` | Leitura do módulo/caminhos | Compilação C# aprovada |
| `native/NexusRGBUninstall.cs` | Leitura do módulo/caminhos | Compilação C# aprovada |
| `package-lock.json` | Configuração e uso no ciclo do produto | Sintaxe/JSON aprovada |
| `package.json` | Configuração e uso no ciclo do produto | Sintaxe/JSON aprovada |
| `playwright.config.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/app.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/backups.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/calibration.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/code-preview.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/effects-guide.css` | Leitura do módulo/caminhos | Estrutura/estilos; ensaio das rotas principais descrito no relatório |
| `public/effects-guide.html` | Leitura do módulo/caminhos | Estrutura/estilos; ensaio das rotas principais descrito no relatório |
| `public/en.js` | Estrutura/chaves e amostras de tradução | Sintaxe/JSON aprovada |
| `public/health.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/help.html` | Leitura do módulo/caminhos | Estrutura/estilos; ensaio das rotas principais descrito no relatório |
| `public/i18n.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/index.html` | Leitura do módulo/caminhos | Estrutura/estilos; ensaio das rotas principais descrito no relatório |
| `public/library.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/manifest.json` | Configuração e uso no ciclo do produto | Sintaxe/JSON aprovada |
| `public/map-model.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/recipe.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/release-model.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/spatial.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/studio.css` | Leitura do módulo/caminhos | Estrutura/estilos; ensaio das rotas principais descrito no relatório |
| `public/studio.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/style.css` | Leitura do módulo/caminhos | Estrutura/estilos; ensaio das rotas principais descrito no relatório |
| `public/sw.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/updates.css` | Leitura do módulo/caminhos | Estrutura/estilos; ensaio das rotas principais descrito no relatório |
| `public/updates.html` | Leitura do módulo/caminhos | Estrutura/estilos; ensaio das rotas principais descrito no relatório |
| `public/updates.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `public/workspace.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/audit-installed-config.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/benchmark-engine.cjs` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/benchmark-ui.cjs` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/build-info.cjs` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/build-native.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/build.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/check-release.cjs` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/check-security-gate.cjs` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/configure-ports.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/download-vendor.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/github-create.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/install-path.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/install-services.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/licenses.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/measure-resources.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/ports.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/restart-services.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/test-installed-package.ps1` | Leitura do módulo/caminhos | AST PowerShell aprovada |
| `scripts/test-installer-smoke.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/test-installer-tray.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/test-offline-firewall.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/test-stability.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `scripts/test-supervisor.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/about.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/alexa.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/backup.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/conflicts.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/hid-bridge.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/index.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/protocol-coolermaster.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/protocol-corsair.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/protocol-keyboard.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/protocol-lianli.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/protocol-motherboard.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/protocol-nollie.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/protocol-nzxt.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/controllers/protocol-razer.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/diagnostics.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/draft-preview.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/first-use.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/hardware.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/index.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/network.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/ports.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/presets.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/resources.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/security.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/store.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/studio-render.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/studio-sandbox.txt` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/studio-schema.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/studio-worker.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `server/studio.js` | Leitura do módulo/caminhos | Sintaxe/JSON aprovada |
| `tests/adversarial.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 7 declarações de teste |
| `tests/alexa-http.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/alexa.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 10 declarações de teste |
| `tests/api.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/backups.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/conflicts.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/controllers-expansion.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 8 declarações de teste |
| `tests/controllers-matrix.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/draft-preview.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/effects.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/first-use.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 2 declarações de teste |
| `tests/fixtures/hid-protocol-worker.cjs` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada |
| `tests/fixtures/stability-worker.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada |
| `tests/fixtures/ui-benchmark-worker.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada |
| `tests/hardware.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 46 declarações de teste |
| `tests/helpers/http-app.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada |
| `tests/hid-bridge.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 3 declarações de teste |
| `tests/install-path.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/installer.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 11 declarações de teste |
| `tests/library.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/map-model.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/native-controllers.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 6 declarações de teste |
| `tests/native-language.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/native-recovery.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 11 declarações de teste |
| `tests/network-async.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/port-settings.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 3 declarações de teste |
| `tests/ports.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/preserved-json.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/profiles.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/recipe.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/recovery-integrity.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 2 declarações de teste |
| `tests/recovery.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 2 declarações de teste |
| `tests/release.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/releases.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 2 declarações de teste |
| `tests/resource-ownership.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/resources.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 3 declarações de teste |
| `tests/security-files.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 8 declarações de teste |
| `tests/security-gate.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 2 declarações de teste |
| `tests/security.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 6 declarações de teste |
| `tests/spatial-capability.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/state.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 8 declarações de teste |
| `tests/studio.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 19 declarações de teste |
| `tests/traffic-control.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 19 declarações de teste |
| `tests/ui/app.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 10 declarações de teste |
| `tests/ui/backups.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/ui/code-effect.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 3 declarações de teste |
| `tests/ui/fixture.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada |
| `tests/ui/formula.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 5 declarações de teste |
| `tests/ui/generic-matrix.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/ui/health.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 3 declarações de teste |
| `tests/ui/keyboard-ui.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/ui/language.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 4 declarações de teste |
| `tests/ui/library.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/ui/spatial-capability.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/ui/studio.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 9 declarações de teste |
| `tests/ui/updates.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/ui/welcome.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `tests/ui/workspace.spec.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 2 declarações de teste |
| `tests/upgrade-backup.test.js` | Inventário de casos; leitura seletiva dos contratos | Sintaxe/JSON aprovada · 1 declarações de teste |
| `vendor-manifest.json` | Configuração e uso no ciclo do produto | Sintaxe/JSON aprovada |

## Contagem

- 156 arquivos inventariados.
- 118 fontes JavaScript/bridge verificadas sem erro de sintaxe.
- 13 fontes PowerShell analisadas sem erro sintático.
- Três executáveis C# compilados, sem instalação ou execução dos binários compilados nesta saída.
- Teste do supervisor executado em fixture separada, com filhos artificiais.
- VMs de instalação, CodeQL remoto e testes físicos não foram executados por esta ampliação.

As referências de sintaxe não significam aprovação funcional. Os novos defeitos reproduzidos estão listados no relatório; arquivos sem novo achado continuam sujeitos a falhas não exercitadas.
