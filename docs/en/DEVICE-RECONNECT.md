# Reconnect a device with a new identity

On the PC, open **Devices → Reconnect device**. Select a saved disconnected source and the current online destination, then **Review transfer**. Check lighting, map items and affected profiles before applying. Explicit acknowledgement is required for settings that cannot be transferred.

The transfer updates individual lighting settings, profile references, map positions/calibration and exclusions. It preserves the saved power choice. It cannot identify physical wiring or LED order on a different device; recalibration may still be necessary.

Native mode numbers do not identify equivalent effects on different controllers, so they are omitted. Incompatible keyboard synchronization settings and ARGB size settings require separate configuration. The wizard does not migrate fan controls, firmware, drivers or transport pairing.

Conflicting saved destination settings, unsupported motions and map ranges exceeding destination LEDs are rejected. Configure the real ARGB count before transferring a map to an empty header; geometry is never silently truncated.

Reviews expire after three minutes or any relevant configuration/device change. A private `before-reconnect-*.json` settings copy is preserved before atomic save. Do not publish it. Existing map editors must refresh their revision after transfer. Confirm the physical result rather than assuming SDK delivery proves hardware response.
