# Develop Nexus RGB

[Documentation](README.md) · [Detailed Portuguese guide](../DESENVOLVIMENTO.md)

Nexus is a Windows application with a Node HTTP/render server, isolated effect worker, browser UI, native C# supervisor/tray and bundled OpenRGB Headless. The source tree and installed application are separate. A development build is not an official release.

## Start with the project state

Read [AGENTS.md](../../AGENTS.md), [development context](../CONTEXTO-DESENVOLVIMENTO.md) and [improvement plan](../PLANO-MELHORIAS.md). Confirm branch, local modifications and the current published/installed versions. Preserve recovery tags and private data. Historical context is mostly Portuguese; it is dated evidence, not automatically current behavior.

Use Node.js **24.20.0 or a compatible supported version**. From the repository root:

```powershell
npm ci
npm test
npm run test:ui
npm run test:supervisor
```

Browser tests use Playwright with the project's Windows browser setup. Installer tests require the intended Windows VM environment and administrator/service setup; inspect the detailed guide before running them. Do not mistake a mock or successful compilation for physical hardware validation.

`npm start` uses the normal application configuration and can connect to hardware. For the new cooling UI, use the isolated simulated runner below instead of starting a second controller against the installed OpenRGB instance.

## Cooling development preview

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-cooling.ps1
node scripts/dev-cooling.cjs --simulate --port 5151
```

Open `http://127.0.0.1:5151/`. Data is isolated under `data/cooling-dev/app`; no installed services are restarted. Detection starts a C# fixture process only when requested. It does not open real sensors or change fans. Read [COOLING.md](COOLING.md) before considering `--hardware`.

Additional targeted checks:

```powershell
node --test tests/cooling.test.js tests/resources.test.js
node scripts/test-cooling-native.cjs
npx playwright test tests/ui/cooling.spec.js --retries=0
node scripts/benchmark-cooling.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-diagnostic.ps1
node scripts/test-gpu-report.cjs
```

The benchmark exports a pristine Git baseline into ignored local data. It never resets the checkout. It compares baseline/current-off/monitoring/control with the same synthetic RGB scenario and includes the optional native fixture process. Physical sensor I/O and thermal/acoustic behavior are excluded.

## Packaging and releases

The normal Windows build uses `scripts/build.ps1`, pinned runtime/vendor assets, C# tools and Inno Setup. Check provenance/hashes and the full installer validation procedure in the Portuguese development guide. Do not update tags, bypass gates, install drivers or modify the real installation merely to finish a source task.

The separate development cooling helper and diagnostic collector have their own build scripts. They are not automatically added to the standard installer or its published assets.

`README.md` and `README-en.md` intentionally carry the same English text; update both together. `README-pt.md` preserves the detailed Portuguese entry point. Keep version/download links consistent in all three files. User-facing translations live under `docs/en/`; original historical reports and third-party license texts remain intact.

## Contribute safely

Use the existing public HTTP, SDK/native-protocol and browser interfaces for meaningful regressions. Reproduce a failure before claiming a fix. Measure performance in equivalent scenarios and name excluded processes. Update the continuity record before ending a work block, including incomplete work and actual checks.

Never commit raw diagnostics, credentials, personal IP/MAC/serials or third-party effect source without permission. Use ignored `data/` for private evidence. Compatibility reports and normal issues are posted manually on GitHub; vulnerability reports use the private security channel.
