# Portable GPU diagnostics — development

[Documentation](README.md) · [Português](../DIAGNOSTICO-GPU.md)

The external Gigabyte RX 7600 still displays video but has dark RGB on alpha.40. A connected SDK does not prove physical color application. This standalone collector gathers evidence; it cannot guarantee a root cause without information from the affected hardware.

## Use it on the affected PC

1. Obtain `NexusRGB-Diagnostic.exe` through the agreed channel and verify its supplied SHA-256. It is an unsigned development candidate; keep antivirus/SmartScreen enabled.
2. Run it normally. No Node, Python, sensor library or driver installation is required.
3. Leave Nexus in the failing state and check the panel port (default 5050).
4. Choose categories and click **Collect**. Log signatures are optional and unchecked by default.
5. Review the exact JSON shown. Changing categories invalidates the old report, requiring a new collection before saving.
6. **Save** writes only that report to your chosen location. Share the JSON manually with a description of the physical LED behavior.

The tool does not change lighting, send SDK writes, probe SMBus/ADL directly, install drivers, restart services or upload anything. Do not repeat already-failed reinstalls/restarts simply to generate a report.

Protected logs may be marked `access-denied`. Manually running as administrator is optional; the collector never elevates itself. It counts known signatures in each log's final 256 KiB without exporting raw lines. Counts cannot by themselves distinguish an unexpected disconnect from a planned service stop.

## What it can include

- Running build/commit when the app API responds; Nexus/PawnIO service state and hashes of known files in the registered installation.
- GPU/board models, graphics-driver version/date and PCI model IDs (vendor/device/subsystem), without unique PNP suffixes or serials.
- GPU zones with anonymous aliases, LED counts, connection state, spatial capability, exposed modes and **requested** power/brightness/native mode. No colors or profiles.
- An allowlisted engine/FPS/error summary. Empty mode lists on split zones do not prove a missing driver.
- Known RGB application process names. Nexus's expected OpenRGB can appear; a process name alone does not prove contention.
- Optional known error signatures, including PawnIO module errors, timeouts and disconnects. A PawnIO error alone does not establish the cause of a GPU fault using another backend.

IP/MAC addresses, credentials, session cookies, serials, personal paths, profiles and effect source are excluded. GPU/mode descriptors are filtered; unknown text becomes generic. Full `/api/state` is filtered in memory, never saved. The tool opens a normal local API session; the cookie stays in memory. On a never-opened installation, this session may consume the first-run welcome flag, so complete normal initial setup first.

The report states `physicalConfirmation: not-measured`. Unavailable categories remain explicit. Further physical comparison or targeted evidence may be needed after reviewing it.

## Build and verify

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-diagnostic.ps1
node scripts/test-gpu-report.cjs
```

Output: `dist/diagnostics/NexusRGB-Diagnostic.exe` and `NexusRGB-GPU-Diagnostic-dev.zip`, including PT/EN instructions, license and executable SHA-256. It uses Windows .NET Framework libraries only. Tests exercise the actual executable with fixtures, privacy canaries and an isolated loopback HTTP server. The review window is rendered with fixture data. These checks do not test the affected RX 7600; that remains the next physical evidence step.

## Collector v2 in alpha.41

The portable ZIP is attached to the release. The log summary now recognizes coded PawnIO initialization aborts and the decimal form of 0x80070490. Counts represent matches in the last 256 KiB, not separate incidents. A module probe may fail for absent hardware without invalidating all other modules. AMD GPU RGB uses ADL; a PawnIO abort alone does not establish the cause.

On alpha.41, `delivery` distinguishes configured mode/brightness from an SDK frame submission; `frameBlack` describes the entire controller. It exports no colors and measures no ADL/I2C acknowledgement or physical LED result. Older builds return null fields. The external GPU failure still has no confirmed physical fix.
