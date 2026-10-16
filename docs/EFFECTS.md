# Create JSON effects

[Português](EFEITOS.md) · [Setup map documentation (Portuguese)](STUDIO.md)

`nexus-effect/1` describes a color image that Nexus samples at each LED's map position. It is declarative data: it does not execute JavaScript, expressions, audio or integrations.

For SignalRGB HTML/JavaScript, select **SignalRGB · HTML / Canvas** in the editor or import an `.html` file. HTML is not JSON. See [HTML/Canvas compatibility](#signalrgb-htmlcanvas).

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
| `scanner` | A beam crossing the map and returning. | Follows `angle`. |
| `rain` | Trails with varied positions and speeds. | Use 90 for top-to-bottom rain. |
| `spiral` | Three color arms rotating around the center. | `angle` orients the drawing. |
| `plasma` | Smoothly mixing color clouds. | `angle` orients the field. |
| `fire` | Heat and turbulence using the palette. | Use −90 for heat at the bottom and rising flames; try yellow, orange and red. |
| `sparkle` | Points fading in and out without synchronized full-screen flashes. | `angle` orients the distribution. |
| `ripples` | Intersecting waves from two centers. | `angle` orients the centers. |
| `blocks` | Moving mosaic of colored blocks. | Follows `angle`. |

## Fields and limits

All fields are required. Numbers accept decimals and use a decimal point in JSON.

| Field | Values | Meaning |
| --- | --- | --- |
| `format` | `"nexus-effect/1"` | Format identifier. |
| `name` | String, 1 to 60 characters | Library name. |
| `pattern` | One of the twelve names above | Drawing pattern. |
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

## SignalRGB HTML/Canvas

1. Choose **SignalRGB · HTML / Canvas** in the editor, or paste complete HTML containing `<canvas>` and `<script>` for automatic detection. JSON and HTML drafts remain separate while the editor is open.
2. Include the `<head>`, `<title>`, control metatags, `<canvas>` and `<script>`. **Test preview** validates and runs an isolated process without importing to the library or changing the active effect.
3. Metatag controls appear after validation. Changing a control or editing code pauses preview; click **Test preview** to restart with the new values.
4. **Save to library** imports without activating. **Save and apply** imports and activates with the selected parameters. The Profiles option saves these parameters too. HTML names and authorship are preserved.

HTML preview sends only PNG images from the isolated process to the browser, at up to 10 FPS. Imported code is never inserted into the page or executed by Node. Pausing or closing ends the process; resuming starts from the beginning. There is one code preview per server, a five-minute expiry, idle cleanup and memory/time limits. Creation is available only on the local PC panel.

Support is **partial for Canvas 2D effects**, not the full SignalRGB application. Supported: `window.requestAnimationFrame`, bounded timers, Canvas `document.getElementById`, permitted shapes, paths, gradients and transforms. Metatag types `color`, `number`, `boolean` and `combobox` produce controls; booleans reach the script as `0` or `1`. Audio, game/peripheral integrations, files, network, external scripts/images, WebGL and complete browser APIs are unsupported. See [engine limits (Portuguese)](STUDIO.md#execução-dos-arquivos-importados).

Compatible APIs do not prevent errors in the original effect. Random colors should be initialized before drawing; hexadecimal generators should pad to six digits with `.padStart(6, '0')`. Nexus does not automatically translate arbitrary JavaScript into JSON patterns or promise equivalence with every SignalRGB effect. Check source and licensing before importing.
