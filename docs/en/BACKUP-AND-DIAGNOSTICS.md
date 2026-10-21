# Backup, diagnostics and updates

[Documentation](README.md) · [Português](../BACKUP-E-DIAGNOSTICO.md)

Detailed diagnostics, backup and restore require the panel on the local PC. Ordinary lighting control remains available from the private LAN.

## Back up and restore

**Settings → Export backup** creates a `nexus-backup/1` JSON containing settings, profiles, map positions/calibration, library organization and imported effect sources. Keep it private. It can contain personal names and third-party code; it is not a public diagnostic report.

To restore:

1. Select **Review backup file**. Nexus validates structure, limits, references and effect sources.
2. Review profiles, positions, effects, FPS and Alexa activation.
3. Confirm the reviewed restore on the PC. The review expires after five minutes or when relevant settings/imports change.
4. Reload and verify hardware compatibility and LED counts, especially on another PC.

Restoration replaces saved settings/profiles and retains effects already in the library. Imported effects are added by content identity. Before replacement, Nexus creates a `before-restore-*.json` backup. Updates similarly create `before-update-*.json` after stopping owned services. Automatic backups are not deleted on a schedule.

Data lives in `%ProgramData%\NexusRGB\app`, separately from program files. Normal updates, reinstalls and default uninstall preserve it. Network ports, sessions and Echo authorizations are not transferred by lighting backups.

The development fan module uses separate `cooling.json`; existing RGB backup/restore does not export or activate fan control. It remains off after restarting the development server.

## Review a diagnostic report

**Prepare diagnostics** shows the exact JSON that will be downloaded. Uncheck categories before downloading: build, runtime, health, anonymous component summary, render metrics, Alexa state, process resources and failure categories.

An explicit allowlist excludes credentials, Hue users, IP/MAC addresses, serials, personal paths, computer/user names, imported source and profile contents. No raw logs or hidden attachments are included. Review the result and attach it manually to a GitHub issue if you choose. Nothing is automatically uploaded.

Controller connection, sent-frame counters and requested power/brightness are software observations. They do not confirm the physical color of a device. For a GPU that stays dark, the separate [portable development collector](GPU-DIAGNOSTIC.md) adds driver/model evidence and optional error-signature counts.

## Understand resource usage

Settings measures identified installation processes, not every `node.exe` on the PC. Readings occur about every ten seconds while the Settings page is visible. Restricted access is shown as partial collection.

CPU uses deltas across samples, normalized to the machine's logical processors. The first sample may have no CPU percentage. Memory sums process working sets, which can double-count shared pages. Browser, driver and temporary collection overhead are excluded. Do not interpret the sum as unique physical RAM or total system impact.

## Update or recover

**About and updates → Check GitHub** explicitly queries official release metadata. It does not send profiles or devices. Lighting continues when offline. The page links to the release; it does not execute an update automatically.

Run the official installer, review progress/UAC and reload already-open panels afterwards. The installer prepares shutdown of owned processes and preserves data. If Windows still reports files in use, review the message rather than killing unrelated processes.

For an unresponsive controller, use **Restart Nexus and OpenRGB…** in the tray or the Settings equivalent on the PC. This requires administrator approval, preserves data and does not restart Windows. Capture useful evidence before restarting when investigating a repeated fault.
