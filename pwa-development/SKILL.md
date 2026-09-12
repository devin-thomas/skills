---
name: pwa-development
description: Design, implement, audit, debug, validate, or release Progressive Web Apps when installation, manifests, service workers, offline data, update recovery, icons, or cross-platform installed behavior matters. Do not use for ordinary web UI work with no PWA lifecycle impact.
---

# PWA Development

Build a web-first product whose browser-tab, installed, offline, update, storage, and recovery behavior is explicit and testable. Preserve the project's framework, product model, support policy, and authorization boundaries.

## Shared Contract

- Treat standards, browser behavior, OS integration, product policy, and observed runtime evidence as different layers of truth.
- Do not infer installability, offline correctness, update safety, icon rendering, or storage durability from a build, deploy, Lighthouse score, or HTTP `200`.
- Keep the ordinary browser route useful when installation or an optional capability is missing, denied, interrupted, or unsupported.
- Feature-detect optional APIs and define a behavioral fallback. Hiding a control without preserving the user's goal is not a fallback.
- Use the project's declared browser/OS matrix. If it has none, propose the current stable and immediate prior shipping generation for relevant targets, then label every untested target. Refresh exact version claims from primary vendor sources.
- For synchronized business data, keep the server authoritative and use local storage as a read model/outbox. For intentionally local-only products, define export, backup, quota, and recovery instead.
- Keep sensitive credentials out of localStorage and general-purpose caches. Review service-worker cache keys and personalized responses.
- Do not deploy, submit a store package, clear origin storage, or exercise destructive recovery unless the user authorized that action.

## Start With Scope

Inspect the existing app before changing it. Locate the manifest link and file, service-worker registration/script/scope, cache rules, storage schema and migrations, API/auth boundary, install UI, icon assets, build output, deployment configuration, and tests. Record:

1. Requested mode: build, repair, audit, debug, validate, release, or recover.
2. Target platforms, browser/OS generations, browser-tab and installed surfaces.
3. Required online, offline, persistence, update, and packaging behavior.
4. What can be automated now and what requires a live origin, clean profile, physical device, store account, or human observation.

Do not add offline mutation queues, background APIs, install prompts, or store packaging merely because they are associated with PWAs. Add them only when they serve the product requirement.

For a blank project, establish the product and target contracts first, then create the smallest useful browser-tab application. Add a manifest and installed identity deliberately; add a service worker, offline storage, synchronization, or packaging only when the requested behavior requires them.

## Load Only Relevant Guidance

- Manifest identity, launch scope, icons, and install metadata: [references/manifest-and-icons.md](references/manifest-and-icons.md)
- Worker lifecycle, caching, coherent updates, reloads, and recovery: [references/service-worker-and-updates.md](references/service-worker-and-updates.md)
- IndexedDB, Cache Storage, local-only data, synchronized outboxes, quotas, and migrations: [references/offline-data-and-storage.md](references/offline-data-and-storage.md)
- iOS/iPadOS, Android, Windows, macOS, Linux, and Firefox install surfaces: [references/platform-installation.md](references/platform-installation.md)
- Compatibility targets, evidence labels, volatile facts, and acceptance boundaries: [references/compatibility-and-evidence.md](references/compatibility-and-evidence.md)
- Release headers, security, accessibility, performance, deployed probes, and acceptance: [references/release-and-validation.md](references/release-and-validation.md)
- TWA, MSIX, PWABuilder, wrappers, and store distribution: [references/packaging-and-stores.md](references/packaging-and-stores.md)

## Work The Lifecycle

1. Establish the current contract and reproduce the relevant failure or baseline behavior.
2. Make manifest, worker, cache, storage, API, and deployment decisions explicit before editing.
3. Implement within existing repository patterns. Keep worker/page/data protocols compatible across the transition or require a deliberate reload/migration boundary.
4. Run repository gates plus focused PWA checks. Test negative paths: offline, denied permission, failed precache, stale tab, quota/migration failure, and missing optional API where relevant.
5. If release is authorized, verify the deployed bytes and headers separately from local output. Preserve old hashed assets long enough for old clients and record a rollback/repair path.
6. Test the claimed browser-tab and installed surfaces. If a required device or install surface is unavailable, mark it untested rather than generalizing from another platform.

## Deterministic Helpers

The optional helpers require Node.js 22 or later and no npm dependencies. Resolve script paths from this installed skill directory, not the project working directory. Use absolute project paths for local inputs. These helpers provide evidence only for the checks they perform; without Node, continue other work and label helper checks unperformed.

```text
node scripts/audit-manifest.mjs --manifest <path> [--root <public-root>] [--json]
node scripts/probe-release.mjs --url <https-url> [--manifest <url-or-path>] [--worker <url-or-path>] [--json]
```

The manifest helper checks an operational baseline and local icon files. It does not prove browser installability or launcher rendering. The release helper checks HTTP responses, metadata, icons, and cache headers. It does not install the app, run the worker lifecycle, or prove offline behavior.

## Evidence And Handoff

Report verified facts, implementation guidance, inferences, and unknowns separately. For completed work include:

1. Scope and target matrix.
2. Files changed and manifest, worker, cache, storage, data-authority, and migration decisions.
3. Exact validation commands and results.
4. Browser-tab, installed-surface, offline, reload, update, icon, persistence, accessibility, and recovery evidence actually observed.
5. Deployment URL and release, worker, cache, and schema identifiers when applicable.
6. Known platform limits, denied permissions, unavailable devices, and untested targets.
7. Rollback or same-URL service-worker recovery procedure.

Never label the work cross-platform accepted while a claimed install surface, update transition, or data migration remains untested.
