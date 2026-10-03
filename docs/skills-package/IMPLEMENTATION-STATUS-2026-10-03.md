# Skills package implementation checkpoint

Branch: `skills-package-v1-plan` (draft PR #1).
This is a local package preview, not an npm release. `@uppercut-labs/skills` remains `0.0.0` and `private: true`.

| Ticket | Current state | Evidence or remaining gate |
| --- | --- | --- |
| SKP-001 | Implemented | Reused the 15-entry manifest and portable skill sources; repository validators pass. |
| SKP-002 | Implemented | Private npm subpackage, bin, list/show, and packed consumer start. |
| SKP-003 | Partial | Six filesystem host routes implemented; Grok Bot account-library transport and real host discovery remain unqualified. |
| SKP-004 | Implemented | Complete 74-file stable bundle at pinned commits, dependency closure, and verified GitHub source adapter. |
| SKP-005 | Implemented locally | Packed consumer installed `execute-task-cycles` and `execute-task` with no dependency prompt; native discovery remains SKP-011. |
| SKP-006 | Implemented locally | Update/remove, ownership hashes, locks, and recovery journal work; disjoint bundled/GitHub roots update together in one transaction, while shared-dependency channel conflicts stop before writes. |
| SKP-007 | Implemented locally | Read-only doctor checks managed hashes and required skill presence. |
| SKP-008 | Implemented locally | Agent Native 0.1.0 registry, scoped capabilities, CLI path, and authorization denial tests. |
| SKP-009 | Partial | Reviewed bundle and installable tarball built; license and final release metadata remain open. |
| SKP-010 | Automated verification complete | Node 22 on Windows/macOS/Linux and Node 24 on Linux passed source tests and installed-tarball CLI/MCP smoke. Native host acceptance remains SKP-011. |
| SKP-011 | Pending | No complete native add/discovery/invocation/update/remove evidence across all six hosts. Grok Bot account scope reports unsupported rather than claiming success. |
| SKP-012 | Pending | License, native acceptance, final artifact, and release authority remain open. |
| SKP-013 | Implemented locally | Opt-in loopback `serve-mcp` mounts only catalog list/show through Agent Native; no writers. |
| SKP-014 | Automated verification complete | Clean tarball consumer passed legacy `2025-11-25`, sessionless one-POST `2026-07-28`, and the CLI launcher on Windows/macOS/Linux CI. |

## Verification completed

- macOS `research` checkout: `npm ci`, TypeScript build, and 27 package tests passed after the macOS physical-path fix.
- The mixed-channel update change passed 30 local package tests and TypeScript typecheck; the focused tests cover one combined transaction and rejection of incompatible shared dependencies before writes.
- Existing source checks: 12 portable skill entry points, 15 manifest records, 26 manifest tests, and 4 PWA helper tests passed.
- Clean installed tarball: host-free list/show, offline add/doctor/update/remove, automatic required dependency, and preservation of an unowned neighboring skill passed.
- Clean installed tarball: live `--latest` add and later update followed the saved GitHub channel; the source adapter verified pinned tree/blob IDs.
- Clean installed tarball with `@modelcontextprotocol/server@2.3.0`: both protocol request shapes and the `serve-mcp` launcher passed with exactly two catalog tools.
- The draft PR's `Skills CLI` workflow run [37142266205](https://github.com/devin-thomas/skills/actions/runs/37142266205) passed Node 22 on Windows/macOS/Linux, Node 24 on Linux, source validation, and installed-tarball CLI/MCP smoke on every package job after the mixed-channel change.

## Release gates

1. Select a license for this collection and review notices for adapted/bundled content. The earlier MIT choice applied to Agent Native, not this package.
2. Qualify all six native hosts without stealing focus from the user's computer; Grok Bot account-library registration needs an actual supported transport or an explicit scope decision.
3. Review the final tarball and metadata after remaining changes, then obtain explicit npm publication authorization.
