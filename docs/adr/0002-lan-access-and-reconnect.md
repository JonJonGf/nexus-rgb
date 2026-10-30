# 0002: Keep remote authorization and identity migration explicit

Date: 2026-10-30. Status: implemented for alpha.43.

LAN defaults to the existing same-subnet guest behavior. Users may choose one revocable authorized link or PC-only panel access. Admin sessions still require loopback. Alexa keeps its own authorization; this policy does not silently disable voice control.

Only a link-secret hash is persisted in private `access.json`; it is outside lighting backups. The link fragment is removed by the browser and exchanged through the protected same-origin POST for an HttpOnly/SameSite cookie. A shared link makes revocation simple and bounded, at the cost of not revoking one phone independently. Renewal revokes every old link/cookie. HTTP LAN is not encrypted; no TLS, cloud account or permanent external service is introduced.

Reconnection is a reviewed migration of saved intent, not automatic identity guessing. Source must be disconnected, destination online and free of conflicting saved references. Review captures configuration/capability state and expires. Apply preserves an original, atomically saves and invalidates map revisions. It never assumes that native mode numbers, physical LED ordering, ARGB size or fan sensor identities are equivalent across devices. Unsupported fields need explicit acknowledgement of omission.

Physical support remains a separate claim from SDK delivery and synthetic tests. Existing RAM cadence, experimental-protocol blocks and privilege separation remain unchanged.
