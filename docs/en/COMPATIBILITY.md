# Nexus RGB compatibility

[Português](../COMPATIBILIDADE.md)

Nexus uses capabilities reported by the hardware rather than requiring one brand. Installation, detection and working physical control are different milestones. A descriptor or accepted command does not prove that LEDs or fan motors responded.

| Feature | Support source | Current limit |
| --- | --- | --- |
| PC RGB | OpenRGB headless mode/zone descriptors | Model, revision and protocol matter; current upstream lists may differ from the bundled revision |
| Spatial LED effects | A safe Direct mode reported by the controller | Static/native-only devices do not receive spatial streaming |
| ARGB headers | Resizable OpenRGB zones | LED count requires configuration; the ARGB signal cannot discover chain length |
| Keyboards | OpenRGB-supported models; a native USB transport for the validated RK61 descriptor | A vendor ID alone never authorizes sending one protocol to all models |
| Temperature and RPM | Pinned LibreHardwareMonitor 0.9.6 through an optional development helper | Availability depends on board, drivers and firmware |
| Fan curves | Reported SuperIO, AMD and NVIDIA controls within safe limits | Detection does not verify wiring or mechanical response; unsafe ranges remain read-only |
| USB hubs, AIOs, Intel GPU fans and laptops | Additional device-specific adapters are needed | No universal control claim or automatic loading of external plugins |
| WLED | WLED network API/protocol | An unrelated Wi-Fi bulb does not become WLED through its IP address |

## Identify without guessing

Cooling preserves backend names. **Identify channel** lets you save a name and explicitly hide an output you have checked. Preferences are scoped to the reported board/channel identity instead of list position. Zero RPM never automatically hides an output. Board hints remain visibly unconfirmed and never choose an RPM sensor. Saving identification does not change fan speeds, and **Show all channels** restores hidden entries.

Parallel fans may share a command and one RPM return. RGB wiring and motor control are separate; LED count is not the number of independently controlled fans.

## Reporting a failure

Check the installed build in Settings and prepare the reviewable diagnostic. Include model/revision, which function worked, which failed and whether another program controls the same hardware. Do not publish credentials, serials or raw private reports. Arrange physical tests with the owner and avoid random firmware, DLL or driver replacements.

## Expanding support

Adapters need verifiable source/licenses, appropriate protocol identification, declared limits, regression coverage and physical validation before a model is called confirmed. Pinned dependencies keep upgrades reviewable and recoverable. Cooling remains optional: disabled mode opens no sensors and runs no helper.

References: [Fan Control compatibility](https://github.com/Rem0o/FanControl.Releases#issues-and-hardware-compatibility), [sensor pairing](https://getfancontrol.com/docs/), [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor), [ARGB limitations](https://openrgb.org/resize.html), [bundled headless base](https://github.com/hello-nexus/openrgb-headless/tree/18e2c95f5e6d5d9f45a948df1e3d0b882e605b45).
