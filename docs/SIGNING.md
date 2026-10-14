# Code signing policy

**Current status: unsigned; SignPath Foundation approval has not been granted.** Nexus RGB is preparing an application for the free open-source program. No signing account, certificate or API token is configured in this repository.

## Project and responsibility

Nexus RGB is a free local RGB controller for compatible Windows PCs, with a browser panel and optional Alexa on/off control. The original code and documentation are [MIT-licensed](../LICENSE.md). This is a newly public early-stage project; no established adoption or independent endorsements are claimed.

Committer, reviewer and intended release-signing approver: [JonJonGf](https://github.com/JonJonGf). External contributions must be reviewed. The maintainer has confirmed GitHub two-factor authentication; it must also be enabled for the future SignPath account. Signing requests will require manual approval if the project is accepted.

## Build and signing scope

The manual [Windows artifact workflow](../.github/workflows/build-release.yml) builds on a GitHub-hosted Windows runner, verifies vendor hashes and expected upstream signatures, audits dependencies, and uploads unsigned Nexus binaries with their hashes and source commit. `BUILD-INFO.json` is a build record, not an independent cryptographic attestation. SignPath origin verification is not configured yet.

Only binaries maintained by Nexus are intended for signing: the application, uninstall helper, setup and generated uninstaller. Dependencies keep their original signatures and licenses; they must not be signed as Nexus code. The current setup contains unsigned Nexus binaries. After approval, packaging must incorporate signed application/helper binaries and sign the generated uninstaller and final setup. A signature on the setup alone would not sign its installed contents.

The [third-party notices](../THIRD-PARTY-NOTICES.md) disclose bundled components and the remaining redistribution review. Eligibility of the complete package must be assessed by the provider. No certificate or private signing key is included in the project.

## Privacy

There is no Nexus telemetry, remote tunnel or automatic updater. The application exchanges RGB controls with devices on the user's LAN and OpenRGB on loopback. Alexa discovery and Echo authorization are optional user actions. The Echo and Alexa app depend on Amazon services and [Amazon's privacy notice](https://www.amazon.com.br/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ). Development/build scripts download dependencies separately from normal installed use.

The installer explains the Windows services, hardware driver and firewall changes. The [uninstaller](../README.md#desinstalar) removes Nexus services and rules while preserving settings and shared dependencies.

## Downloads

[Official releases](https://github.com/JonJonGf/nexus-rgb/releases) provide unsigned previews and SHA256 checksums. No claim of SignPath-provided signing is made before approval. The Foundation's [conditions](https://signpath.org/terms.html) apply; if accepted, its certificate would identify SignPath Foundation as publisher. Portuguese details are available in [ASSINATURA.md](ASSINATURA.md).
