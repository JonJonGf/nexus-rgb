# Experiences

[Documentation](README.md) · [Português](../EXPERIENCIAS.md)

**Experiences** contains Live, Scenes, Room/WLED and Sound/context. All are optional; audio and application rules start disabled. Configure scenes, WLED, audio and rules on the local PC. Phone clients can use Live, record/replay gestures and start existing scenes.

## Live and recordings

Calibrate components on the Setup map. In **Live**, touch or drag to create a ripple, trail or sweep with your selected color. Only powered, nonexcluded spatial components receive the overlay. A keyboard with internal modes only remains outside spatial effects.

Record up to 30 seconds / 256 events, stop, name and save, then replay or choose the recording as a scene step. Recordings are timed gesture data, not videos or executable scripts. Limits: 16 recordings and 32 simultaneous gestures; excess old visuals are discarded. The preview shows submitted frames, not physical LED feedback.

## Scenes and focus

Combine ordinary motions, saved profiles and recordings with durations, transitions and repeat counts. The editable **Focus and break** template proposes 25 minutes of static light followed by five minutes of breathing. Limits: 32 scenes, 64 steps each, 99 repeats and 24 hours total.

A scene temporarily takes control without rewriting saved lighting per frame. Finishing restores previous settings; a manual command takes precedence. Scenes preserve disabled components and map exclusions. **Stop and return** stops scenes, playback and pending gestures; restarting Nexus does not automatically resume them.

An optional Alexa scene light can start/stop a scene through the existing Hue bridge. It does not change the main light's identity or interpret unrestricted natural-language commands. Actual Echo compatibility and speech still require physical validation.

## Room / WLED

Use a controller running **WLED firmware**, on the same private LAN. Enter its name, literal IPv4 address and HTTP port. **Check and add** validates identity and actual LED count. No Internet discovery, hostname or HTTP redirect is accepted.

- **Follow lighting and map:** static output uses deduplicated JSON requests; software animation uses DDP over UDP 4048. This does not change the PC RAM's safe refresh limit.
- **Native WLED effect:** choose the controller's own effect ID or preset. WLED runs it locally with less PC traffic; it does not follow the spatial map in this mode.

Limits: eight controllers, 4,096 LEDs per piece and 32,768 map LEDs in total. Disabling/removing/shutdown requests realtime release when the controller responds. Network failure can prevent confirmation; retries back off and frames are not queued without bounds. UDP does not acknowledge a physically displayed frame or guarantee perfect synchronization.

A generic Wi-Fi RGB bulb is not automatically WLED. The separate Steck/Tuya investigation did not deliver a plug-and-play bulb adapter; entering an IP cannot convert its protocol.

## Sound and application context

Audio uses WASAPI loopback on the default Windows output, not the microphone. It records/uploads no sound. Lightweight filters compute bass/mid/treble energies, not BPM, song identification or a detailed FFT. Three bounded values reach the service at up to eight updates per second; stale audio fades within about one second.

For a clear first test, use Static black with power on, low sensitivity and music on the default output. Enable **React to Windows audio**, choose colors and map axis, then save. Increase sensitivity gradually; maximum sensitivity may saturate the bands. Keep the updated tray running in your user session. Changes can take up to five seconds. Closing the tray or disabling the option ends capture. Output failures have up to three retries with 30-second waits; protected/unusual audio formats may not be capturable.

Application rules match a foreground executable basename to a saved profile. They do not read keys, titles, content or personal paths, and a basename is not publisher authentication. Leaving the app restores prior lighting. Manual control wins until the foreground app changes; an explicitly started scene takes priority. Missing tray confirmation expires context in up to 12 seconds. Multiple Windows sessions still need real-world testing.

Scenes, recordings and rules are in the reviewed lighting backup. The local WLED inventory stays in separate `room.json`, preserved across updates and lighting restores. Backups can contain personal app names; keep them private.
