# Phone and LAN access

Choose a mode in **Connections**:

- **Open on the local network:** default. Same-subnet devices can control lighting, without administrator access.
- **Authorized link only:** select **Show link and QR Code**, then open the link on a phone/tablet on the same network. The browser stores a local authorization cookie for up to 30 days; the link itself remains valid until renewed/revoked.
- **This PC only:** LAN panel control is blocked; administration stays on the local loopback panel.

Generating another authorized link revokes the previous link and associated access. **Revoke link and access** also closes revoked event/preview streams. The saved hash survives service restart. This version shares one link; it does not offer separate per-phone revocation.

Guests cannot administer settings, import effects, configure fans/network or reconnect devices. Alexa retains its separate approved-Echo list; PC-only panel mode does not disable the Alexa bridge.

Local HTTP is not encrypted. Use a trusted LAN and do not expose the panel to the Internet. The fragment secret is removed from the address bar and exchanged for an HttpOnly/SameSite cookie. Private `access.json` stores only its hash, outside lighting backups. Never share authorized links or cookies in diagnostics.

For a revoked/expired browser session, reopen a valid link. If the link is revoked, generate another on the PC. Invalid access configuration restricts LAN control while allowing local administration to repair it; RGB settings are preserved.
