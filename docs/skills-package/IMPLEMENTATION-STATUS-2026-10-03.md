# Skills package implementation checkpoint

Branch: `skills-package-v1-plan` (draft PR #1).
This is a local `0.1.0` release candidate, not an npm release. `@uppercut-labs/skills` is packageable under MIT; native host and final artifact release gates are tracked below.

| Ticket | Current state | Evidence or remaining gate |
| --- | --- | --- |
| SKP-001 | Implemented | Reused the 15-entry manifest and portable skill sources; repository validators pass. |
| SKP-002 | Implemented | Public npm candidate metadata, bin, list/show, and packed consumer start; the candidate is versioned `0.1.0`. |
| SKP-003 | Implemented locally | Six filesystem host routes and the guarded Grok Bot account-library route are implemented; native discovery remains unqualified. |
| SKP-004 | Implemented | Complete 74-file stable bundle at pinned commits, dependency closure, and verified GitHub source adapter. |
| SKP-005 | Implemented locally | Packed consumer installed `execute-task-cycles` and `execute-task` with no dependency prompt; native discovery remains SKP-011. |
| SKP-006 | Implemented locally | Update/remove, ownership hashes, locks, and recovery journal work; disjoint bundled/GitHub roots update together in one transaction, while shared-dependency channel conflicts stop before writes. |
| SKP-007 | Implemented locally | Read-only doctor checks managed hashes and required skill presence. |
| SKP-008 | Implemented locally | Agent Native 0.1.0 registry, scoped capabilities, CLI path, and authorization denial tests. |
| SKP-009 | Partial | Reviewed bundle and installable tarball built; candidate version, MIT license, source notices, and npm links prepared. Final artifact review remains open. |
| SKP-010 | Automated verification complete | Node 22 on Windows/macOS/Linux and Node 24 on Linux passed source tests and installed-tarball CLI/MCP smoke. Native host acceptance remains SKP-011. |
| SKP-011 | Pending native acceptance | No complete add/discovery/invocation/update/remove evidence across all six hosts. Grok Bot account scope is accepted only on its qualified Linux runtime; real Bot discovery and invocation remain unverified. |
| SKP-012 | Pending | MIT and public-release authority granted; native acceptance and final artifact verification remain open. |
| SKP-013 | Implemented locally | Opt-in loopback `serve-mcp` mounts only catalog list/show through Agent Native; no writers. |
| SKP-014 | Automated verification complete | Clean tarball consumer passed legacy `2025-11-25`, sessionless one-POST `2026-07-28`, and the CLI launcher on Windows/macOS/Linux CI. |

## Verification completed

- macOS `research` checkout: `npm ci`, TypeScript build, and 27 package tests passed after the macOS physical-path fix.
- The mixed-channel update change passed 30 local package tests and TypeScript typecheck; the focused tests cover one combined transaction and rejection of incompatible shared dependencies before writes.
- Release preparation passed 38 local package tests, including the guarded Grok Bot route and global npm postinstall. The packed consumer smoke passed with LICENSE and NOTICE in the allowlist. Rebuild and inspect the final tarball after the candidate commit.
- Existing source checks: 12 portable skill entry points, 15 manifest records, 26 manifest tests, and 4 PWA helper tests passed.
- Clean installed tarball: host-free list/show, offline add/doctor/update/remove, automatic required dependency, and preservation of an unowned neighboring skill passed.
- Clean installed tarball: live `--latest` add and later update followed the saved GitHub channel; the source adapter verified pinned tree/blob IDs.
- Clean installed tarball with `@modelcontextprotocol/server@2.3.0`: both protocol request shapes and the `serve-mcp` launcher passed with exactly two catalog tools.
- The draft PR's `Skills CLI` workflow run [37142266205](https://github.com/devin-thomas/skills/actions/runs/37142266205) passed Node 22 on Windows/macOS/Linux, Node 24 on Linux, source validation, and installed-tarball CLI/MCP smoke on every package job after the mixed-channel change.

## Release gates

1. MIT is selected for the approved npm bundle and its bundled snapshots, including the two pinned Starter Pack skills; this is not a blanket grant for the source repository. Verify the final tarball includes LICENSE and NOTICE and preserves source attribution.
2. Qualify all six native hosts without stealing focus from the user's computer; the Bot-reported account path and automated tests do not establish native Bot discovery or invocation.
3. Review the final tarball and metadata after remaining changes. Devin authorized merge and npm publication if the release candidate qualifies.
