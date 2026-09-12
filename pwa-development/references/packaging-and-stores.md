# Packaging and Stores

The HTTPS web origin is the independently releasable product. A store wrapper is an optional distribution product, not proof of PWA correctness and not a source of universal native capabilities.

## Routes

| Destination | Common route | Adds | Does not add |
| :--- | :--- | :--- | :--- |
| Google Play | Trusted Web Activity/Bubblewrap and Digital Asset Links | Store discovery and Android package identity | A native data layer or uniform browser storage |
| Microsoft Store | PWABuilder/MSIX/app bundle | Store listing, signing, distribution, some Windows integration | Freedom from origin/web API limits |
| Apple App Store | Native wrapper such as WKWebView plus deliberate native integration | Store channel and native shell | Automatic approval or Safari Home Screen equivalence |
| Other stores | Vendor-specific wrapper/packager | Local distribution reach | Universal update/capability/policy behavior |

Choose packaging only for a concrete need such as required discovery, enterprise deployment, platform integration, billing, or audience policy. If the goal is an icon and offline launch, validate native web install surfaces first.

## Separate Acceptance

Test web origin and package as separate release artifacts. Record identity, signing, deep links, cookies/session, storage boundary, push, native bridge version, icon/listing assets, review metadata, update cadence, wrapper/web compatibility, rollback, and uninstall. A wrapper can lag the web release or load a web version incompatible with its bridge.

Do not create accounts, sign packages, submit listings, or mutate store state without explicit authorization.

## Sources

- [Android Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities)
- [Microsoft Store packaging for PWAs](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store)
- [Windows distribution paths](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path)
- [web.dev installation and stores](https://web.dev/learn/pwa/installation)
