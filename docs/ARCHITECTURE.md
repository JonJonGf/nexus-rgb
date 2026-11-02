# Nexus RGB: task-oriented code map

Read [current context](CONTEXTO-DESENVOLVIMENTO.md) and [plan](PLANO-MELHORIAS.md), then choose a row. Historical reports are optional task-specific evidence, not mandatory reading for every update. Verify source before editing.

| Task | Starting files | Behavioral tests |
| --- | --- | --- |
| HTTP wiring, sessions, LAN | `server/index.js`, `server/security.js`, `server/network.js`, `public/app.js` | HTTP/security/network and browser connection tests |
| LAN policy and network preferences | `server/access.js`, `server/network-settings.js` | `tests/access.test.js`, `tests/network-settings.test.js`, `tests/ui/access.spec.js` |
| Reconnect saved identity | `server/device-reconnect.js`, `public/device-reconnect.js` | `tests/device-reconnect.test.js`, `tests/ui/device-reconnect.spec.js` |
| Discovery, modes, RGB cadence | `server/hardware.js`, `server/openrgb-client.js`, `server/controllers/` | `tests/hardware.test.js`, `tests/traffic-control.test.js`, `tests/controllers-expansion.test.js` |
| Lighting intent and profiles | `server/store.js`, `server/presets.js`, `server/backup.js`, `public/app.js` | Store/profile/backup and browser profile tests |
| Spatial execution and sandbox | `server/studio.js`, `server/studio-worker.js`, `server/studio-render.js`, `server/studio-sandbox.txt` | Studio/HTML/Canvas/recovery tests |
| Map and effect editor | `public/studio.js`, `public/map-model.js`, `public/workspace.js`, `public/calibration.js` | Browser Studio/map/editor: revisions and undo |
| Preview connection lifecycle | `public/preview-stream.js` | `tests/ui/preview-lifecycle.spec.js`, browser Studio reconnection tests |
| Fan configuration validation | `server/cooling-config.js` | `tests/cooling.test.js`, `tests/cooling-startup.test.js` through HTTP |
| Fan graph and curve math | `public/cooling-model.js`, `public/cooling.js`, `public/cooling.css` | Same HTTP tests and `tests/ui/cooling.spec.js` |
| Fan execution/startup/helper | `server/cooling.js`, `server/cooling-bridge.js`, `server/cooling-installation.js`, `native/NexusCoolingBridge.cs`, `native/CoolingLaunchBroker.cs` | Cooling/startup, bridge/launch-service and browser startup tests |
| Live, scenes, audio/context, WLED | `server/experiences.js`, `server/room.js`, `public/experiences.js`, `public/live-model.js` | Experiences/room and browser tests |
| Native ownership/installation | `native/NexusRGB.cs`, `installer/`, `scripts/install-services.ps1`, `scripts/build.ps1` | Supervisor/installer; VM cycle for lifecycle changes |
| Appearance/translations | `public/style.css`, feature CSS, `public/en.js`, `public/i18n.js` | Feature browser tests: PT/EN, desktop/mobile |

Locate exact tests using `rg --files tests`. Commands: [development guide](DESENVOLVIMENTO.md).

## Ownership and invariants

- `server/index.js` composes modules, authorizes HTTP and owns application startup/shutdown. Extracted routes must preserve authorization/rate-limit ordering.
- Store owns saved lighting intent; Hardware resolves capabilities/submits output; Studio owns spatial state and workers. Do not copy mutable state into competing managers.
- SDK, native keyboard, WLED and cooling are separate transports. One owner per device; submission is not physical confirmation. Preserve 20 FPS SMBus RAM ceiling, bounded queues, generation checks, deduplication and explicit off.
- Pure shared models have no timers, storage, DOM, network or hardware access. Host code validates and applies results.

## Cooling contracts

`cooling-config.js`: `{profiles, validate}`. `validate(saved)` returns cloned, normalized configuration or the existing validation error. No I/O or activation. Presets are read-only definitions; clone user data before mutation.

`cooling-model.js`: `{valueAt, plot}` via CommonJS and browser `NexusCoolingModel`. Ordered `[temperature, percent]` pairs; `valueAt` expects a nonempty validated curve and clamps beyond endpoints; `plot` also handles an empty draft. Linear or monotone smoothstep between points. Both use the same interpolation; neither performs thermal protection.

`cooling.js` retains identity/freshness checks, critical-temperature protection, safety floors, hysteresis, bounded retries and firmware release. No bypass through graph/preset. Private `cooling.json` is written on configuration changes, not frames. Startup uses the last successfully applied configuration; explicit off disarms it.

`sensorId` remains the first/legacy source; optional `sensorIds` lists up to eight distinct sources, with that same first ID. All readings must be valid; the highest temperature drives the curve. Persisted identity bindings include every selected source. Optional `group` owns the shared temperature/curve/minimum/protection template; `effectiveAssignments(config)` overlays it on selected channels while retaining their saved independent assignments and RPM links. Grouping shares percentages subject to per-channel limits, not equal mechanical RPM. Preview selection is local SVG rendering with the shared model, without opening sensors or posting configuration.

## Access, reconnection and capability contracts

- `AccessPolicy` owns persisted LAN mode and link hash, never an administrator role. `Security.session` combines socket scope, admin cookie and LAN policy. HTTP origin/host/CSRF checks remain in the request handler. Policy updates must prune both state and preview streams. `NetworkSettings.set` changes memory only after persistence succeeds.
- `DeviceReconnect` exposes `catalog/review/apply`. Review validates a disconnected source and conflict-free online destination, clones saved intent and captures a three-minute digest. Apply requires the matching unchanged review, acknowledgement of omissions, preserved original and atomic Store save. It never resizes hardware or guesses equivalence of native mode IDs. Caller invalidates Studio layout revision and output caches.
- `NexusPreviewStream.create({enabled,refresh,onFrame})` owns one EventSource, retry timer and generation. `start/stop` invalidate old asynchronous work; refresh/frame rendering still belong to the Studio UI. No polling while closed is introduced.
- `device-capabilities.js` interprets mode descriptors without I/O. Native power-off fallback requires a declared zero-brightness range without automatic-save; it does not claim physical validation or enable new USB protocols.

## Small future changes

1. Read the responsible row and callers before expanding scope.
2. Test through existing HTTP/browser/IPC interfaces; avoid tests of private names.
3. Extract repeated domain knowledge or independent responsibilities, not every repeated syntax fragment.
4. Update this map when ownership/contracts change. Detailed evidence belongs in a dated report linked from current context.
5. Regenerate optional graph with `scripts/update-code-map.ps1` after source edits. No external AI API or permanent watcher.

[Maintenance/style decision](adr/0001-maintenance-and-styles.md) explains Tailwind and refactoring limits.
