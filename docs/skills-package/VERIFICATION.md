# Delivery verification and remaining product evidence

Historical scope: this file records the second ZIP's original five-host planning delivery. The reconciled
[current plan](RECONCILIATION-2026-10-03.md) adds Grok CLI as a sixth host and Grok Bot repository-scope evidence.
Do not interpret this archive record as the current installer or native acceptance result.

Date: October 3, 2026. This record concerns the planning/fix ZIP, not a released npm installer.

## Work actually performed

| Check | Result | Evidence boundary |
|---|---|---|
| Read Quick Build and its four authoring templates | Passed | Fetched current SKILL, PLAN, SPEC, DECISIONS, and TICKET through GitHub |
| Inspect the current catalog, instructions, and affected workflow text | Passed | Source identifiers and exact blob SHAs recorded in SOURCES and changes.json |
| Confirm the source revision | Passed | GitHub ref identified commit `5b60a950066113fbaad5fd183d91962b2b98dc4d` |
| Inspect Agent Native's declared version and APIs | Passed | Repository manifest declares 0.1.0; capability and CLI guides read |
| Research the five hosts | Performed, with explicit gaps | Primary docs support the routes recorded in HOSTS; native registration is not proved |
| Run the guarded patch-helper unit suite | Passed: 14 tests, 0 failures, 0 skips | Synthetic source-excerpt fixtures in this Linux container; not the full original repository |
| Validate Markdown links, JSON, ticket graph, catalog edges, and fixed product constraints | Passed | `python tools/validate_pack.py`; counts are emitted by the validator |
| Check final ZIP members and integrity | Passed | ZIP CRC check and SHA-256 checksum manifest verified during delivery |
| Apply fixes to Devin's checkout | Not performed | The ZIP supplies a guarded local helper and the exact reviewed changes |
| GitHub writes or npm publication | None | No branches, files, issues, releases, or packages changed remotely |

The patch suite exercises read-only checks, five-file application and backups, idempotency, unique-match conflicts,
CRLF preservation, mixed-newline rejection, missing files, symlink/path rejection, changed-source detection,
best-effort ordinary-error rollback, and preservation of unrelated newer text. It does not establish crash recovery
for a future installer or verify all Windows filesystem behavior.

## Not performed — do not turn these into completed claims

The complete source checkout could not be cloned/downloaded into this runtime. The named source files were read
through GitHub, but the original repository's Python/PWA validation suites were **not run**. Run them after applying
the fixes in the real checkout. This ZIP's tests do not replace them.

The npm installer is **not implemented** in this pack. No npm build, external tarball installation, end-to-end skill
operation, or registry publication was run. The user reported Agent Native's npm release and its repository declares
0.1.0; independent retrieval and import testing of that published artifact remains an implementation check.

No Codex, Claude Code, Cursor, Antigravity, or Grok Bot application was launched here. Real discovery, complete support
file access, and a safe invocation are pending for all five. The early host-contract ticket must establish Grok Bot's
actual native registration mechanism and Antigravity's applicable global/surface path, rather than inventing a path
or reducing the required host set. These remain initial-release acceptance requirements.

The collection license and any adapted/external skill redistribution rights remain a publishing gate. No license
was added or changed in this delivery. This record is not legal clearance or authorization to publish.

## Repeat the pack checks

From the unzipped pack root:

```sh
python tools/validate_pack.py
python -m unittest discover -s repo-fixes -p 'test_*.py' -v
```

`CHECKSUMS.sha256` covers the delivered files, excluding the checksum file itself. Do not commit helper-generated
`__pycache__` or patch backups. After integrating the overlay, maintain future application/host results here and in
each ticket's Outcome without overwriting this delivery's historical evidence.
