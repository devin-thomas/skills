# Release and Validation

## Release Invariants

- Serve the app, manifest, worker, icons, and API over HTTPS; localhost is a development exception.
- Publish hashed assets before HTML references them. Retain old assets long enough for old clients/workers.
- Revalidate HTML, manifest, and worker. Long-cache only immutable content-hashed assets.
- Scope the worker intentionally and use `Service-Worker-Allowed` only after review.
- Verify deployed status, redirects, MIME types, bytes, cache headers, CSP, cookies, and routing. A catch-all HTML `200` is not a valid manifest, icon, or worker.
- Never expose secrets, debug endpoints, private source maps, or personalized cached responses.

Roll CSP out in report-only mode first, resolve required worker/connect/image/font/style behavior, then enforce. CSP is defense in depth, not a replacement for authorization, output encoding, dependency review, or secure cookies.

## Validation Layers

1. **Repository:** install dependencies, lint, type-check, test, build, and run framework-specific checks.
2. **Static PWA:** manifest parse/identity/scope, icons present/decode, worker syntax/scope, storage migration tests, and offline fixtures.
3. **Local runtime:** clean and returning profiles, browser-tab online/offline, slow/failing requests, first registration, update transition, two tabs, and recovery.
4. **Deployed origin:** exact content and headers for HTML/manifest/worker/icons/assets/API, old-client/new-deploy transition, release identifiers, and rollback availability.
5. **Installed surfaces:** install path, launcher identity, cold start, display mode, offline restart, update, storage/permission behavior, and uninstall on every claimed platform.
6. **Quality:** keyboard/focus, screen reader announcements, reduced motion, contrast/targets, responsive/orientation/keyboard UI, Core Web Vitals, offline boot time, and cache/storage growth.

Automated audits and Lighthouse are supporting signals. They cannot prove installed cold start, launcher rendering, offline reload, coherent worker adoption, quota recovery, or data migration.

## Helper Use

Run the package helpers from the skill directory or by absolute path:

```text
node scripts/audit-manifest.mjs --manifest <path> --root <public-root>
node scripts/probe-release.mjs --url <origin-or-app-url> --worker /sw.js
```

Record their output as manifest/filesystem and HTTP metadata evidence only. Continue with runtime and device tests.

## Rollback And Observability

Record release/app version, worker version, cache names, schema version, installed surface, and capability failures without sensitive payloads. Monitor navigation/asset failures, worker rejection/adoption/reload loops, migration/quota errors, outbox age/conflicts, push failures, storage growth, and performance.

Rollback may require coherent HTML/asset restoration, old asset retention, forward data repair, and a same-URL no-op worker. Do not delete the database as the first response.

## Handoff Evidence

Include exact commands/results, deployed URL and response checks, browser/OS/device/profile, screenshots or logs where appropriate, current/old worker state, cache/schema identifiers, failed/denied paths, untested targets, and rollback/recovery instructions.

## Sources

- [MDN HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [Chrome DevTools PWA inspection](https://developer.chrome.com/docs/devtools/progressive-web-apps)
- [web.dev PWA checklist](https://web.dev/articles/pwa-checklist)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [OWASP HTTP Headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
