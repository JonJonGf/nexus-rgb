# Optional cooling backend — development

This directory pins the **unmodified LibreHardwareMonitor 0.9.6** dependency used by the experimental on-demand cooling helper. It is separate from the OpenRGB lighting backend and is not included by `scripts/build.ps1` or the alpha.40 installer.

- Repository: https://github.com/LibreHardwareMonitor/LibreHardwareMonitor
- Pinned source: `3d331e3370efb858411f19511373eff65a218701`
- Official binary archive and SHA-256: `manifest.json`
- Corresponding source URL/hash: `manifest.json`
- Library license: MPL 2.0, preserved in `LICENSE`
- Upstream notices, including PawnIO modules: `THIRD-PARTY-NOTICES.txt`, preserved verbatim

`scripts/build-cooling.ps1` verifies the archive, then verifies each of 23 selected non-GUI DLLs before extracting them to ignored `dist/cooling`. The manifest records size and SHA-256 for every selected file. WinRing0, `.sys` payloads and path traversal are rejected. The native adapter is original Nexus code; no Fan Control GUI code was copied.

The selected libraries total 5,048,376 bytes before the small Nexus helper. Loading library metadata in the test fixture does not open `Computer`, sensors or a driver. Real mode opens only CPU/GPU/motherboard monitoring after an explicit detection request; RAM/SPD/storage/network/generic controller monitoring is disabled.

The library backend can require separately installed PawnIO support. This build script does not install a driver, request administrator access or run the compiled executable.

This is a local development integration, not a reviewed public binary distribution. Before adding it to an official installer, finish the transitive dependency/license/source inventory, package the corresponding source/notices as required, and validate physical read/control/release and resource contention. The original notice file includes components not selected for this helper; it must not be read as a complete per-DLL inventory.

See [development guide](../../docs/en/COOLING.md) for compatibility, failure behavior, benchmarks and remaining physical validation.
