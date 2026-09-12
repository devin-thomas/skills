# Service Workers and Updates

## Lifecycle Contract

A registration points to a worker URL and scope. A changed script installs and normally waits while an old worker controls existing clients. The browser may terminate a worker between events; in-memory variables are not durable state. Extend asynchronous event work with `event.waitUntil()` and persist required state elsewhere.

## Safe Default

- Keep the worker URL stable, commonly `/sw.js`.
- Install a complete new revisioned asset set into an app-owned cache namespace. Fail the install if a required shell asset fails.
- Let the new worker wait unless mixed old-page/new-worker protocols are proven compatible.
- Surface an accessible update-ready action and reload at a deliberate boundary.
- Delete only known old app caches during activation after the new set is complete.
- Keep API and IndexedDB transitions backward-compatible for at least the active/waiting client overlap, or enforce a safe reload/migration boundary.
- Revalidate HTML, manifest, and worker while long-caching content-hashed assets.

`skipWaiting()` and `clientsClaim()` are tools, not defaults. Together they can make an old document issue requests through new fetch logic. If used, test two tabs, first load, `controllerchange`, one-shot reload protection, and rollback.

## Strategy Selection

| Resource | Usual starting point | Constraint |
| :--- | :--- | :--- |
| Fingerprinted static asset | Cache-first | URL changes with bytes |
| HTML navigation | Network-first or a versioned shell | Must define offline and stale behavior |
| Replaceable public response | Stale-while-revalidate | Label stale data where it matters |
| Sensitive/personal response | Network-only or explicitly keyed private cache | Never leak authorization or another user |
| Mutation | Network plus durable outbox if offline writes are required | A cache must not pretend a write succeeded |

Precache only what is required for a meaningful boot. Never broad-delete caches owned by other apps on the origin.

## Update Acceptance

Test at least:

1. Fresh first load and worker registration.
2. Returning controlled load.
3. Old tab open while a new worker deploys.
4. New worker install failure with old version still usable.
5. Waiting notification, declined/deferred update, accepted update, and exactly one reload.
6. Two tabs crossing the update boundary.
7. Offline navigation before and after update.
8. Old cache and obsolete worker cleanup after adoption.

## Recovery

Keep a same-URL recovery worker that installs/activates promptly and has no fetch handler, then ship the repaired worker. Preserve user data. `Clear-Site-Data: "storage"` is destructive and browser-dependent; use it only as an explicitly communicated last resort with a disposable-profile test first.

## Sources

- [W3C Service Workers](https://www.w3.org/TR/service-workers/)
- [MDN Using service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [web.dev service-worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [web.dev PWA update guidance](https://web.dev/learn/pwa/update/)
- [Workbox lifecycle](https://developer.chrome.com/docs/workbox/service-worker-lifecycle)
- [Workbox recovery](https://developer.chrome.com/docs/workbox/remove-buggy-service-workers)
- [MDN Clear-Site-Data](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Clear-Site-Data)
