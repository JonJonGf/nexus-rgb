# Optional cooling — experimental

[Documentation](README.md) · [Português](../VENTILACAO.md)

Version 1.0.0 includes optional fan curves with pinned LibreHardwareMonitor 0.9.6 and an on-demand native helper. RGB power remains independent from fan speed. Nothing reads sensors or starts the helper while the module is off.

## Shared curve and CPU + GPU

Available starting with alpha.44 for individual channels and the optional shared group.

Enable **One curve for selected channels** to set temperature sources, minimum output, thermal protection and curve in one place. Select the channels you have identified. **Select visible channels** checks visible writable channels without enabling control; hidden and read-only channels are not automatically included. Apply curves or enable control to use the selection.

Choose one source and use **Add sensor** for CPU, GPU or another available reading (up to eight distinct sources). Each sample uses the **highest temperature in °C**, rather than an average: CPU at 45 °C and GPU at 75 °C drive the curve at 75 °C. The hottest source can switch without reapplying. Multiple sources also work on individual channels with linking disabled.

Each selected source shows its current temperature next to its selector. With two or more valid readings, the hottest is highlighted; unavailable readings are labeled explicitly. Values reuse existing samples. Editing source selectors still requires applying the form to change control.

Linking shares the **requested percentage**, not an exact RPM. Each channel retains its hardware limits and explicit RPM association. Different or parallel fans can run at different RPM. Independent settings stay saved separately; disable linking and apply to use them again. Startup preserves the shared curve and checks the identity of every selected sensor.

An invalid selected reading requests maximum permitted protective output; it is not silently ignored in favor of a cooler sensor. A missing or changed sensor/channel stops control and requests firmware release. No extra monitoring process is added: the existing helper already samples CPU/GPU sensors sequentially.

**View profile curves** opens a single collapsible preview. Its profile selector inspects the built-in or custom curves without applying speeds, activating control or opening sensors. The profile buttons above remain the apply action.

## Installation and activation

Update with the official version 1.0.0 installer without uninstalling the previous version. Fresh installations start off. A successful activation saves the selected channels, sensors, RPM readings, curve and active choice, then resumes them when the PC starts. Previous installations need one successful activation on the new version; startup intent is not inferred from a legacy file. **Detect sensors** starts monitoring; speed control requires explicit channel/sensor pairing and activation. Zero RPM does not prove an unused channel; parallel fans share the connector's output. The helper requests automatic control when its parent service disappears. Physical compatibility and response require confirmation on each machine; automated tests use simulated channels.

Stable packages starting at 1.0.0, alpha and development packages require a matching commit marker to enable this backend. Stable version and tag must also match. Hardware fan control remains experimental and optional. `scripts/build.ps1 -CoolingDevelopment` remains available for private candidates and does not install or start sensors.


## Automatic startup resumption

Alpha.42 replaces the previous always-off startup policy with remembering the last successful activation. Resumption runs in the background without opening the dashboard or clicking Detect sensors. Reported IDs, names and model must match; this does not identify physical fan wiring. A fresh valid temperature is checked before taking control. Late dependencies are retried with backoff, up to eight attempts, without deleting saved settings. Identity changes block resumption for review. Exhausted retries leave the configuration intact and show the failure.

**Turn module off** cancels startup resumption while retaining curves and assignments. Read-only detection and closing monitoring do not change the saved startup choice. Stopping the service releases control to firmware but retains the choice for the next start.

Resumption uses the curve actually applied. Editing the profile library without reapplying does not change the next boot's output. Damaged startup metadata disarms resumption and preserves valid base settings for review without overwriting the source file on load.

## Try the isolated simulation

### Manual curves and three saved profiles

Select **Control mode → Manual curve** on a channel. Drag points or enter 2–8 increasing temperature/speed pairs. **Curve shape** selects Linear (straight segments) or Smooth (monotone cubic smoothstep `3t² − 2t³` between points, without overshoot). Hardware limits, minimum speed and thermal protection still apply.

Use **My custom profiles → Create custom profile** to save up to three named curves, or copy a channel with **Save as custom profile**. Editing the library never starts sensors or applies a new speed. Select a saved profile to apply it; a running version stays unchanged until explicitly reapplied. Choose another profile before deleting the selected one. Restarting keeps the library but leaves control off.

Recognized outputs and channels reporting RPM are shown by default; selected channels and those previously seen spinning remain visible. **Show all channels** restores the others without losing edits. Zero RPM does not prove disconnection or failure. GPU control remains visible at zero speed. Exact board/chip profiles may suggest connector names, which must be confirmed before controlling hardware; other boards retain backend labels. Parallel fans share one channel, not one independent control per physical fan.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-cooling.ps1
node scripts/dev-cooling.cjs --simulate --port 5151
```

Open `http://127.0.0.1:5151/` and choose **Cooling**. The page clearly identifies simulation. Six channels, CPU/GPU temperatures and RPM values are synthetic. It uses `data/cooling-dev/app`, does not start installed OpenRGB and does not change services or physical fans.

1. **Detect sensors** starts read-only monitoring.
2. Select each channel to control and explicitly choose its temperature sensor. Pair an RPM reading only when you know the correspondence; nothing is inferred from list order or similar names.
3. Choose a preset, or expand **Edit curve** and enable a custom curve with 2–8 ascending points.
4. Set a minimum where the actual fan keeps spinning, and a thermal threshold appropriate to the selected sensor/component.
5. Enable **Control with Nexus**. **Apply curves** saves the current associations. Shown percentages are requested duty values, not mechanical acknowledgments.
6. **Turn module off** requests default/automatic control, closes the helper and stops polling. Leaving the tab stops monitoring-only mode; active control continues while using other tabs.

## Presets

| Preset | Temperature °C → requested % |
| --- | --- |
| Silent | 30→25, 50→35, 65→55, 75→75, 85→100 |
| Balanced | 30→35, 50→45, 65→65, 75→85, 85→100 |
| Performance | 30→45, 50→60, 65→80, 75→100, 85→100 |
| Aggressive | 30→60, 45→75, 60→90, 70→100, 85→100 |
| TURBO | 100% for selected channels, within the hardware-reported maximum |

Interpolation is linear. The configured minimum takes precedence: default 40%, adjustable 20–100% within channel limits. Silent therefore does not request 25% when the selected minimum is 40%. Zero-RPM stop and automatic startup-speed calibration are not implemented. Percentage is not a universal RPM conversion.

Choosing another preset replaces saved custom curves. Configuration is stored separately in private `cooling.json`, outside RGB backups. Restarting the server resumes the last successfully activated control after identity and reading checks; turning the module off cancels resumption.

## Failure behavior and compatibility

All library-reported channels are initially visible, including zero RPM. Zero does not prove an empty connector. Use **Identify channel** to save a name and explicitly hide channels you have checked. **Show all channels** restores hidden entries; selected channels remain visible. Saving identification never applies fan curves or starts sensors, and preserves unsaved curve edits. Preferences in private `cooling.json` are scoped to the reported board/channel identity rather than list position.

Backend names remain intact. Board-specific hints are marked unconfirmed, do not replace identities and never pair RPM sensors or write outputs. Pairing is explicit: equal indices do not prove an electrical association. See [compatibility and limits](COMPATIBILITY.md).

Activation and curve changes sample current temperatures before writing. Fractional hardware limits are respected without rounding above the maximum. Channels without a safe integer output stay read-only. A failed release during reassignment disables control rather than continuing with mismatched state.

The module samples sequentially once per second, deduplicates identical writes, uses about 2 °C hysteresis and limits downward changes to 12 percentage points per second. Temperature rises and TURBO can increase output immediately.

Invalid temperatures request maximum protective output. Stale readings, missing channels and communication failures stop control and request release. A separate native watchdog detects five seconds without communication or a lost parent; shutdown/EOF also requests `SetDefault` on owned channels. There is no automatic reconnect/re-arm.

These mechanisms do not guarantee physical firmware recovery after a hung driver, blocked hardware call or abrupt helper failure. Simulation does not establish thermal safety. Existing firmware/CPU/GPU protections remain essential.

Initial writes are limited to generic controls exposed by SuperIO, AMD GPU and NVIDIA GPU backends. Many devices have no writable channel. Specific USB fan hubs and Intel GPU fan control are not implemented. RGB compatibility does not imply fan-control compatibility. Use only one active speed-control program per channel.

An explicitly agreed physical trial can use `--hardware`; **Detect sensors** then requests administrator access. This does not install a driver automatically. Real sensor/bus contention, driver availability and physical release still need validation. No physical trial was performed during this implementation.

## Measured software overhead

On 21 October 2026, two reverse-order repetitions compared a clean Git baseline with the candidate, using the same synthetic SDK setup: 3 controllers, 5 components, 92 LEDs, Aurora 20 FPS, six simulated fan channels. Windows CPU and summed working sets include Node, effect worker and optional native fixture helper. No browser, OpenRGB, supervisors, tray, driver or physical sensor I/O is included. Each measured window is about 10.4 seconds after four seconds of warmup; CPU uses 12 logical processors.

| Scenario | Mean machine CPU | Mean summed working set |
| --- | ---: | ---: |
| Baseline `78f2735`, no module | 0.350% | 129.06 MiB |
| Candidate off | 0.348% | 131.16 MiB |
| Simulated monitoring | 0.286% | 159.88 MiB |
| Balanced, six simulated channels | 0.386% | 160.64 MiB |
| TURBO, six simulated channels | 0.342% | 160.73 MiB |

Balanced added about **29.48 MiB and 0.038 CPU percentage points** versus candidate-off. CPU noise between repetitions is larger than some differences; lower monitoring CPU is not evidence of an optimization. Renderer output remained around 19.93–20.13 FPS. No helper exists when off.

Working-set sums can double-count shared pages. Real sensor I/O, watts, noise, temperatures, gaming performance and long-term stability were not measured. See [raw measurements and scope](../benchmarks/2026-10-21-cooling.json); reproduce with `node scripts/benchmark-cooling.cjs`.
