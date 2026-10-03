# Skills package implementation checkpoint

Branch: `skills-package-v1-plan` at `5e46e44ab6c0cd9b8b4cfc53b996599ce59419e8` (draft PR #1).
This is a local package preview, not an npm release. `@uppercut-labs/skills` remains `0.0.0` and `private: true`.

| Ticket | Current state | Evidence or remaining gate |
| --- | --- | --- |
| SKP-001 | Implemented | Reused the 15-entry manifest and portable skill sources; repository validators pass. |
| SKP-002 | Implemented | Private npm subpackage, bin, list/show, and packed consumer start. |
| SKP-003 | Partial | Six filesystem host routes implemented; Grok Bot account-library transport and real host discovery remain unqualified. |
| SKP-004 | Implemented | Complete 74-file stable bundle at pinned commits, dependency closure, and verified GitHub source adapter. |
| SKP-005 | Implemented locally | Packed consumer installed `execute-task-cycles` and `execute-task` with no dependency prompt; native discovery remains SKP-011. |
| SKP-006 | Partial | Update/remove, ownership hashes, locks, and recovery journal work in the tested single-channel flow. Disjoint roots saved on different channels still return an explicit conflict on a combined update. |
| SKP-007 | Implemented locally | Read-only doctor checks managed hashes and required skill presence. |
| SKP-008 | Implemented locally | Agent Native 0.1.0 registry, scoped capabilities, CLI path, and authorization denial tests. |
| SKP-009 | Partial | Reviewed bundle and installable tarball built; license and final release metadata remain open. |
| SKP-010 | Partial | Source tests passed in Node 22 on Windows/macOS/Linux and Node 24 on Linux; native host acceptance remains SKP-011. Packed-consumer CI is pending. |
| SKP-011 | Pending | No complete native add/discovery/invocation/update/remove evidence across all six hosts. Grok Bot account scope reports unsupported rather than claiming success. |
| SKP-012 | Pending | License, native acceptance, mixed-channel update, CI, final artifact, and release authority remain open. |
| SKP-013 | Implemented locally | Opt-in loopback `serve-mcp` mounts only catalog list/show through Agent Native; no writers. |
| SKP-014 | Implemented on macOS | Clean tarball consumer passed legacy `2025-11-25`, sessionless one-POST `2026-07-28`, and the CLI launcher; cross-platform CI is pending. |

## Verification completed

- macOS `research` checkout: `npm ci`, TypeScript build, and 27 package tests passed after the macOS physical-path fix.
- Existing source checks: 12 portable skill entry points, 15 manifest records, 26 manifest tests, and 4 PWA helper tests passed.
- Clean installed tarball: host-free list/show, offline add/doctor/update/remove, automatic required dependency, and preservation of an unowned neighboring skill passed.
- Clean installed tarball: live `--latest` add and later update followed the saved GitHub channel; the source adapter verified pinned tree/blob IDs.
- Clean installed tarball with `@modelcontextprotocol/server@2.3.0`: both protocol request shapes and the `serve-mcp` launcher passed with exactly two catalog tools.
- The draft PR's first `Skills CLI` workflow passed Node 22 on Windows/macOS/Linux, Node 24 on Linux, and source validation. The follow-up workflow will exercise the installed tarball on each platform.

## Release gates

1. Select a license for this collection and review notices for adapted/bundled content. The earlier MIT choice applied to Agent Native, not this package.
2. Qualify all six native hosts without stealing focus from the user's computer; Grok Bot account-library registration needs an actual supported transport or an explicit scope decision.
3. Support a combined update of disjoint roots saved on bundled and GitHub channels without partial writes, or revise the release contract with the owner.
4. Finish packed-consumer cross-platform CI, review the final tarball and metadata, then obtain explicit npm publication authorization.
