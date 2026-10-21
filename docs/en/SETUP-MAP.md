# Setup map, calibration and profiles

[Documentation](README.md) · [Português](../MAPA-E-CALIBRACAO.md)

## Arrange your setup

Open **Setup map**. Drag components to match your case and release to save. Select a component to adjust strip/ring/matrix shape, size, rotation and LED order. Positions are shared between profiles. Moving a component does not restart an effect or change its individual lighting override.

The number and capabilities of LEDs come from the controller, or from explicit calibration where supported. Software cannot infer every fan's physical LED count. If a resizable ARGB header reports zero LEDs, enter the real count in **Devices → Zones and LED count** first.

**Split into fans** divides consecutive LEDs into separately positioned pieces. It cannot make a hub that electrically mirrors one signal independently addressable. Use the actual wiring and LED sequence; do not guess a large count to create nonexistent pieces.

## Calibrate geometry and order

1. Select a component and choose its shape.
2. Set the actual geometry: strip length or matrix columns, ring layout and dimensions.
3. Adjust first LED, reversed order and rotation to match the wiring.
4. Use a known simple effect to compare the layout with the physical lights. The map itself is not physical feedback.
5. Save after changes. Use visible **Undo/Redo** controls for map edits, or Ctrl+Z / Ctrl+Shift+Z on the PC. One completed drag is one action.

If another client has saved a newer map revision, Nexus rejects a stale overwrite instead of silently replacing it. Refresh and review that revision before editing further. The code editor retains its own native undo behavior while focused.

## Choose an effect

**Change effect** opens the searchable library of profiles, Nexus scenes and effects. **Adjust effect** opens the selected effect's parameters. General movements such as Wave follow hardware LED order; spatial JSON/Canvas effects sample the shared image using map positions.

**Create effect +** supports ordered palette, motion, speed, angle and scale. **Test preview** tests a draft without sending RGB commands or saving it. Valid advanced JSON updates the visual controls. **Save to library** stores only; **Save and apply** also activates. The optional Profiles checkbox stores a profile too. See [JSON and Canvas reference](../EFFECTS.md).

## Edit a spatial profile

In **Profiles → Edit**, choose the **Map effect** type to adjust the saved effect parameters. **Edit code** opens its JSON or HTML Canvas source with preview. Saving updates that profile without changing the active lights; **Save and activate profile** also applies it. Source edits create a separate effect version so other profiles keep their original effect.

Switching explicitly to **Color sequence** replaces the profile's spatial effect and individual settings with a general sequence, as the editor warning explains. Up to 32 profiles and 64 imported effects are supported. Imported files are at most 128 KiB, with Canvas at most 640 × 400.

## Individual overrides and power

Changing a component individually can exclude it from the spatial map. The device card and map properties show **Individual adjustment · outside map**. Use **Follow map again** to explicitly rejoin it. Pausing or changing a map effect preserves exclusions. Power/brightness changes preserve the selected effect; individually switched-off components stay off when the master is turned on.

The map displays the last output requested by the software. A successful SDK write is not proof that a GPU, motherboard or fan physically accepted it. Hardware-native effects can lack known per-LED colors. Browser preview refresh is capped at about 10 FPS; physical hardware refresh is separate.
