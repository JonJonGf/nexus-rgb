# Alexa power control

[Documentation](README.md) · [Português](../ALEXA.md)

Nexus uses a local Hue-compatible bridge to expose one light named **Iluminação Nexus**. It supports power on/off only and is disabled by default. No separate Hue bridge or Nexus cloud account is needed. Your compatible Echo and awake PC must share the local network.

1. On the PC, open **Connections** and enable **Amazon Alexa**.
2. Check that the local bridge is active. Its default HTTP port is 80; discovery uses UDP 1900.
3. Open **Find Echo for 2 minutes**.
4. In the Alexa app, add **Philips Hue Bridge V1 (round)**.
5. Verify that the address discovered by Nexus belongs to your Echo, then authorize it.
6. Check that **Iluminação Nexus** appears in Alexa and test explicit on/off commands using the full light name.

Repeat with another discovery window if necessary. Old duplicate Nexus lights can be removed from the Alexa app before rediscovery. DHCP reservations for the PC and Echo help keep their addresses stable.

## What changes

The light's power changes; RGB colors, saved brightness, effects and individual power settings stay in Nexus. Components previously switched off remain off when master power is restored.

The bridge advertises virtual brightness for Hue compatibility. That value does not represent or change physical RGB brightness. A brightness-only request preserves power; use explicit on/off commands. Protocol response tests cannot prove what a specific Echo will announce aloud.

## When discovery or commands fail

- Check the Echo model/firmware and local network isolation. Not all Echo combinations support the same Hue emulation behavior.
- Check **Connections** for bridge errors and recent discovery/query activity.
- Use **Configure ports…** in the tray if another application occupies the bridge HTTP port. Some Echos require port 80; changing it does not guarantee compatibility.
- If lights respond but Alexa announces failure, record both outcomes separately. A spoken failure is not evidence that the LEDs rejected the power command, and a successful HTTP response does not guarantee correct speech.
- Avoid broad voice names that collide with other Alexa devices or routines.

This integration is not certified by Amazon or Philips. Echo's own speech and remote features may depend on Amazon services and Internet access. Nexus does not expose router ports or provide an external tunnel.
