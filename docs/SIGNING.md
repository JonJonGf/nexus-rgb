# Code signing policy

**Current status: Nexus RGB binaries are unsigned.** The project has no SignPath Foundation certificate or configured signing integration. No signing certificate, private key or API token is included in this repository. Nexus RGB is free and open source.

## Project and responsibility

Nexus RGB is a local RGB controller for compatible Windows PCs, with a browser panel and optional Alexa on/off control. The original code and documentation are [MIT-licensed](../LICENSE.md). Releases are early previews; their test coverage and limitations are documented in the [validation reports](VALIDACAO.md).

Project maintainer and intended release-signing approver: [JonJonGf](https://github.com/JonJonGf). External contributions require review. Any future signing integration must use multifactor authentication for the maintainer's GitHub and signing-provider accounts, with manual approval of signing requests.

## Build and signing scope

The manual [Windows artifact workflow](../.github/workflows/build-release.yml) builds on a GitHub-hosted Windows runner, verifies vendor hashes and expected upstream signatures, audits dependencies, and uploads unsigned Nexus binaries with their hashes and source commit. `BUILD-INFO.json` is a build record, not an independent cryptographic attestation. SignPath origin verification is not configured yet.

The [release workflow](../.github/workflows/publish-release.yml) publishes installers, uninstall helpers and checksums from version tags after its build and installation checks. Published artifacts remain unsigned; this workflow does not implement code signing.

Only binaries maintained by Nexus are intended for signing: the application, uninstall helper, setup and generated uninstaller. Dependencies keep their original signatures and licenses; they must not be signed as Nexus code. The current setup contains unsigned Nexus binaries. After approval, packaging must incorporate signed application/helper binaries and sign the generated uninstaller and final setup. A signature on the setup alone would not sign its installed contents.

The [third-party notices](../THIRD-PARTY-NOTICES.md) disclose bundled components and the remaining redistribution review. Eligibility of the complete package must be assessed by the provider. No certificate or private signing key is included in the project.

## Privacy

There is no Nexus telemetry, remote tunnel or automatic updater. The application exchanges RGB controls with devices on the user's LAN and OpenRGB on loopback. Alexa discovery and Echo authorization are optional user actions. The Echo and Alexa app depend on Amazon services and [Amazon's privacy notice](https://www.amazon.com.br/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ). Development/build scripts download dependencies separately from normal installed use.

The installer explains the Windows services, hardware driver and firewall changes. The [uninstaller](../README.md#desinstalar) removes Nexus services and rules while preserving settings and shared dependencies.

## Downloads

[Official releases](https://github.com/JonJonGf/nexus-rgb/releases) provide unsigned previews and SHA256 checksums. Checksums confirm that a download matches the published file; they do not authenticate its publisher. Keep Windows security protections enabled. Portuguese verification instructions are available in [ASSINATURA.md](ASSINATURA.md).
