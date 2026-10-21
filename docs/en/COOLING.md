# Optional cooling — development

[Documentation](README.md) · [Português](../VENTILACAO.md)

This candidate is separate from the published/installed alpha.40. It adds fan curves using pinned LibreHardwareMonitor 0.9.6 and an on-demand native helper. RGB power remains independent from fan speed. Nothing reads sensors or starts the helper while the module is off.

## Try the isolated simulation

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

Choosing another preset replaces saved custom curves. Configuration is stored separately in private `cooling.json`, outside RGB backups. Restarting the development server **does not reactivate fan control**.

## Failure behavior and compatibility

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
