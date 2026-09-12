# Offline Data and Storage

## Choose Authority First

| Product need | Canonical authority | Browser role |
| :--- | :--- | :--- |
| Synchronized account/business records | Server API/database | IndexedDB read model, pending outbox, conflict state |
| Intentionally local-only records | Local database plus explicit export/backup contract | Primary storage with quota, migration, repair, and user-clear warnings |
| Small non-sensitive preference | Local storage or a small IndexedDB record | Convenience state |
| Static/safe HTTP responses | Origin/server; Cache Storage holds copies | Versioned request/response cache |
| Large origin-private files | Product-defined authority; OPFS where supported | Quota-aware file storage/cache |
| Session/authentication | Server/session design | Prefer protected cookies where suitable; never general cache/localStorage secrets |

Do not turn a synchronized app into local-first or an offline mutation system unless the product requires it.

## Durable Offline Mutation

When offline writes are required:

1. Validate locally.
2. In one IndexedDB transaction, write the optimistic record state and an outbox operation with an idempotency key.
3. Acknowledge durable local intent only after transaction commit.
4. Attempt delivery from foreground startup/focus and explicit retry; background sync is only an optimization.
5. Reconcile with a server version, ETag, updated token, or explicit conflict policy.
6. Keep `pending`, `synced`, `conflict`, and `failed` visible. Never silently overwrite newer canonical data.

`navigator.onLine` is a hint. Request outcomes, timeouts, aborts, DNS/captive failures, authentication responses, and server errors determine reachability.

## Storage And Migration

- Use IndexedDB for structured data and related transactional writes.
- Use Cache Storage for request/response pairs, not as the business database.
- Limit localStorage to small, non-sensitive, infrequently written values.
- Version schemas and test migrations from every supported prior version.
- Keep migrations bounded; surface aborts and provide forward repair/export rather than silently wiping.
- Do not depend on unload events to finish critical writes.

## Quota, Eviction, And Security

Treat quota denial, eviction, private mode, and user clear as normal product states. `navigator.storage.persist()` is a request, not a guarantee. On quota failure, stop unbounded retry, preserve user-authored/outbox data, evict derived content, retry once with a bounded size, and offer cleanup/export or online-only operation.

Same-origin pages and injected script can access origin storage. XSS can read/modify IndexedDB and localStorage. Review service-worker caching of credentials, personalized bodies, redirects, and errors. Enforce authorization on the server for every request.

## Acceptance

Test mutation then immediate kill/reload, offline restart, reconnect/replay, duplicate replay, conflict, authentication expiry, schema upgrades, transaction abort, quota error, eviction/clear, export/repair, and logout cache cleanup where applicable.

## Sources

- [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [OWASP HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
