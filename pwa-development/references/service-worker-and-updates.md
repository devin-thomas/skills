# Service Workers and Updates

## Lifecycle Contract

A registration points to a worker URL and scope. A changed script installs and normally waits while an old worker controls existing clients. The browser may terminate a worker between events; in-memory variables are not durable state. Extend asynchronous event work with `event.waitUntil()` and persist required state elsewhere.

## Safe Default

- Keep the worker URL stable, commonly `/sw.js`.
- Install a complete new revisioned asset set into an app-owned cache namespace. Fail the install if a required shell asset fails.
- Let the new worker wait unless mixed old-page/new-worker protocols are proven compatible.
- Explain a waiting update and provide a deliberate adoption route: close all app windows and controlled browser tabs, then reopen; or explicitly activate and reload when compatibility is proven. Reload alone can leave the old worker controlling the page.
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

## Account And Identity Boundaries

For an account app, start with an explicit allowlist of public static resources and a non-personal offline fallback. Keep API/MCP routes, sign-in/callback/logout navigations, bearer requests, and the shared identity origin outside that cache. Treat authentication queries and redirected, opaque, failed, or personalized responses as network-only unless a separate reviewed private-storage contract requires them. Cache API writes do not enforce HTTP `Cache-Control: no-store`; the worker must enforce its own exclusions.

Review HTTP caching separately from Cache Storage: `fetch()` can still use the browser's HTTP cache. Where the contract requires a fresh network outcome, choose appropriate request/response cache controls and test a returning page with the connection disabled.

When the product requires connectivity for private data, show that requirement honestly on offline launch. Installing the app does not create offline sync or authorize replaying a mutation. Test the complete identity redirect and return path in the claimed installed surface; a successful browser-tab sign-in does not prove installed-session behavior.

## Update Acceptance

Test at least:

1. Fresh first load and worker registration.
2. Returning controlled load.
3. Old tab open while a new worker deploys.
4. New worker install failure with old version still usable.
5. Waiting notification and deferral, then the chosen adoption route; an explicit reload fires exactly once when used.
6. Two tabs crossing the update boundary.
7. Offline navigation before and after update.
8. Old cache and obsolete worker cleanup after adoption.

## Recovery

Keep a same-URL recovery worker that installs/activates promptly and has no fetch handler, then ship the repaired worker. Preserve user data. `Clear-Site-Data: "storage"` is destructive and browser-dependent; use it only as an explicitly communicated last resort with a disposable-profile test first.

## Sources

- [W3C Service Workers](https://www.w3.org/TR/service-workers/)
- [MDN Using service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [MDN Cache API and HTTP caching headers](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [web.dev service-worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [web.dev PWA update guidance](https://web.dev/learn/pwa/update/)
- [Workbox lifecycle](https://developer.chrome.com/docs/workbox/service-worker-lifecycle)
- [Workbox recovery](https://developer.chrome.com/docs/workbox/remove-buggy-service-workers)
- [MDN Clear-Site-Data](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Clear-Site-Data)
