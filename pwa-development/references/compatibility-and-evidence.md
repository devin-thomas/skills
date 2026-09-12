# Compatibility and Evidence

## Layers Of Truth

Keep these separate in analysis and handoff:

1. **Standard:** a W3C/WHATWG algorithm, field, or security boundary.
2. **Vendor behavior:** a browser or OS exposes a surface with versioned behavior.
3. **Product policy:** the project chooses targets, fallbacks, and support promises.
4. **Observation:** a named build/browser/device/profile produced recorded evidence.

An implementation recommendation may be strongly supported without being a standard. A vendor release note is not proof that the user's deployed app behaves correctly.

## Target Policy

Honor an existing project matrix. If none exists, propose the current stable generation plus the immediate prior shipping generation only for platforms the product actually supports. Use feature detection and preserve the browser-tab path.

The research snapshot used to create this skill was verified on **2026-08-22**:

| Product | Current stable observation | Immediate prior observation |
| :--- | :--- | :--- |
| Chrome desktop/Android | 151 | 150 |
| Microsoft Edge | 151 | 150 |
| Firefox desktop | 154 | 153 |
| Safari/WebKit | 26.6 | 18.6 |

Apple moved the public Safari version from 18 to 26; there was no stable Safari 19-25 line. Safari 27 was beta at the snapshot and is not a stable target. These numbers are volatile examples, not permanent defaults. Re-open primary release sources before making a current-version claim:

- [Chrome stable releases](https://chromereleases.googleblog.com/)
- [Microsoft Edge release schedule](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-release-schedule)
- [Mozilla release calendar](https://wiki.mozilla.org/Release_Management/Release_owners)
- [Apple Safari release notes](https://developer.apple.com/documentation/safari-release-notes)

## Capability Record

For every optional API or installed integration that matters, record:

```text
capability, target surfaces, detection, permission, fallback,
data risk, test, volatility, last verified
```

Baseline and compatibility datasets can help with ordinary Web APIs, but they do not establish install UI, WebAPK versus shortcut behavior, launcher icon rendering, storage isolation, push delivery, or store-package behavior.

## Acceptance Boundaries

Keep these gates distinct:

- Build/type/lint/test success.
- Local browser behavior.
- Deployed response/metadata/header correctness.
- Browser-tab runtime behavior.
- Installed-surface behavior per platform.
- Offline, stale-client, worker-update, and recovery behavior.
- Storage migration, quota, eviction, and synchronization behavior.
- Optional wrapper/store artifact behavior.

Use `verified`, `guidance`, `inference`, and `unknown` labels. Include the exact browser/OS/device/profile for runtime observations. A simulator or another Chromium browser is not interchangeable with the claimed surface.

## Volatile Unknowns

Do not universalize exact launcher metadata refresh timing, quota/eviction timing, background execution, installed storage isolation, store-review behavior, or a particular `controllerchange` ordering. Test them for the product and retain the uncertainty when they remain unobserved.

## Sources

- [W3C Web Application Manifest](https://www.w3.org/TR/appmanifest/)
- [W3C Service Workers](https://www.w3.org/TR/service-workers/)
- [web.dev Baseline](https://web.dev/baseline/)
- [web-platform-dx web-features](https://github.com/web-platform-dx/web-features)
