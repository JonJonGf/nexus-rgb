# GPU RGB compatibility

[Documentation](README.md) · [Português](../COMPATIBILIDADE-GPU.md)

Alpha.40 bundles OpenRGB Headless pinned to commit `18e2c95f5e6d5d9f45a948df1e3d0b882e605b45`. Nexus enumerates the controllers and uses reported modes, zones and LED counts. It does not maintain a brand-wide promise of support.

The pinned source includes GPU controller families for ASUS Aura, ASRock, Colorful, EVGA, Galax/KFA2, Gigabyte RGB Fusion/Fusion 2/Blackwell, Intel Arc A770 LE, Manli, MSI, NVIDIA Illumination, Palit, PNY, PowerColor Red Devil, Sapphire Nitro Glow and Zotac. **A family being present does not mean every model works.** PCI/subsystem IDs, PCB revision, Windows support, driver and firmware matter. A newer upstream device list is not proof of support in this installer.

## Capabilities Nexus can use

| Reported capability | Behavior |
| --- | --- |
| Direct per-LED control | Spatial output and software effects; one composed frame preserves independent zones |
| Static/Custom color | Color and brightness according to the mode's actual flags |
| Hardware-native mode | Uses the mode's scope; a whole-controller mode is not treated as independent per-zone control |
| No exposed RGB control | No invented LEDs, geometry or protocol writes |

Modes that automatically save to device storage are not used for continuous spatial streaming. Devices are grouped by stable controller identity; separate same-name controllers remain separate. Adjustable zero-LED ARGB outputs require the real count from the user.

## Known unresolved Gigabyte RX 7600 report

An external **Gigabyte Radeon RX 7600 GAMING OC 8G** was detected but its RGB stayed dark. Static red with master power on and service recovery had already failed before alpha.40. The user has now reported that **alpha.40 still does not restore it**. Display output continues working. This is a physical RGB-control failure, not proof that the graphics card itself stopped rendering.

Do not conclude “missing driver”, “fixed by Headless” or “working because connected” without evidence. The SDK has no physical per-LED acknowledgment. The next step is a reviewed report from the affected PC using the [portable GPU collector](GPU-DIAGNOSTIC.md). It can narrow the investigation but cannot guarantee a root cause without additional physical comparison.

The RAM 20 FPS limit, bounded queues and deduplication remain unchanged. No firmware update or speculative writes to unknown hardware are part of this investigation.

Bundled engine source/provenance and licenses accompany the installer under `sources/` and `licenses/`. The dated [alpha.40 validation report](../validation/2026-10-20-alpha40.md) distinguishes protocol/browser/VM tests from physical evidence.
