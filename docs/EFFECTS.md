# Create JSON effects

[Português](EFEITOS.md) · [Setup map documentation (Portuguese)](STUDIO.md)

`nexus-effect/1` describes a color image that Nexus samples at each LED's map position. It is declarative data: it does not execute JavaScript, expressions, audio or integrations.

## Test before applying

1. On the PC's panel, open **Setup map → Change effect → Create effect +**.
2. Use the controls or paste an object into **Edit JSON · advanced**. Valid JSON updates the controls; changing the controls generates JSON. Invalid input stays in the editor and blocks testing/saving until corrected.
3. Click **Test preview**. It follows valid edits without saving settings, importing files or sending commands to the lights. **Pause preview** freezes time; editing still redraws the draft.
4. **Save to library** stores without activating. **Save and apply** stores and selects the effect for the lights. The Profiles option also creates a profile. Master power and disabled components are preserved.

The **Effect and pattern guide** link opens an offline reference in Portuguese or English. Preview draws the color source at up to 10 FPS while the editor is open and playing. It does not simulate device positions, brightness or power. After applying, the map shows the last colors sent; neither view physically reads back the LEDs.

Saving a modified formula creates another library item, preserving existing effects and profiles. Profiles referencing the earlier version are not automatically changed.

## Example: Rainbow Cascade

```json
{
  "format": "nexus-effect/1",
  "name": "Rainbow Cascade",
  "pattern": "wave",
  "palette": [
    "#ff0000", "#ff7f00", "#ffff00", "#00ff00",
    "#00f0ff", "#0000ff", "#7f00ff"
  ],
  "speed": 40,
  "angle": 90,
  "scale": 1.2
}
```

This moves the rainbow from top to bottom. Replace `wave` with `gradient` for a stationary color distribution: **`speed` does not animate `gradient`**.

## Supported patterns

| `pattern` | Behavior | Direction |
| --- | --- | --- |
| `wave` | Continuous wave with smooth color transitions. | Follows `angle`. |
| `comet` | Bright band with a trail and dark gaps. | Follows `angle`. |
| `rings` | Color rings expanding from the center. | Radial; `angle` has no visual effect. |
| `gradient` | Static gradient. | `angle` orients the bands; `speed` does not animate it. |

## Fields and limits

All fields are required. Numbers accept decimals and use a decimal point in JSON.

| Field | Values | Meaning |
| --- | --- | --- |
| `format` | `"nexus-effect/1"` | Format identifier. |
| `name` | String, 1 to 60 characters | Library name. |
| `pattern` | One of the four names above | Drawing pattern. |
| `palette` | 1 to 8 `#RRGGBB` colors | Ordered sequence, wrapping from the last color back to the first. A single color is valid; `comet` still has a dark trail. |
| `speed` | 0 to 100 | Animation speed, independent of FPS. Zero freezes the frame; does not animate `gradient`. |
| `angle` | −360 to 360 degrees | 0: left → right; 90: top → bottom; 180: right → left; −90: bottom → top. |
| `scale` | 0.1 to 10 | Higher values repeat the palette more across space, making narrower bands. |

`speed: 40` is not 40 FPS or a duration in seconds. Choose RGB FPS under **Settings → RGB refresh rate**. The editor uses the engine's drawing formula, but the browser and controller may refresh at different rates.

## Pasting and importing

The editor accepts a leading `JSON` label or Markdown fences when pasting. Imported `.json` files must contain only the JSON object, without labels, fences, comments or trailing commas. Short colors (`#f00`), CSS names (`red`) and alpha channels are unsupported.

Limits: 128 KiB per file and 64 imported effects. Colors normalize to lowercase. Extra fields do not create patterns or parameters; use the documented format. File import stores without activating; select its library card to apply it.

## Hardware looks different

Use **Direct with per-LED color**, enable the component and check LED count, ranges, first LED, direction, rotation and map position. A spatial wave samples each LED's X/Y position: correctly mapped fans show the same region of a vertical wave on LEDs at the same height. Common Lighting movements follow cable order instead of spatial position.

For individually addressable fans in series, configure the actual port LED count and split ranges in the map. A mirroring hub still repeats the signal without independent fan control. See [map and calibration (Portuguese)](MAPA-E-CALIBRACAO.md).
