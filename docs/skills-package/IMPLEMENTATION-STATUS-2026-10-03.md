# Skills package implementation checkpoint

Branch: `skills-package-v1-plan` (draft PR #1).
The `0.1.0-rc.2` npm preview was published from commit `992fecd`. The Bot confirmed that `rc.2` installed globally, managed `starter-pack` and `computer-setup`, preserved the differing `grill-to-build`, and invoked `starter-pack` from its account library. Devin reports testing the remaining harnesses and has instructed the agent to merge and publish final `0.1.0`; detailed per-host logs were not supplied. Final artifact review and publication are in progress.

| Ticket | Current state | Evidence or remaining gate |
| --- | --- | --- |
| SKP-001 | Implemented | Reused the 15-entry manifest and portable skill sources; repository validators pass. |
| SKP-002 | Implemented | Public npm candidate metadata, bin, list/show, and packed consumer start; `0.1.0-rc.2` is published. |
| SKP-003 | Implemented, owner accepted | Six filesystem host routes and the guarded Grok Bot account-library route are implemented. The user's Bot invoked `starter-pack` from the installed library; Devin reports testing the other harnesses. |
| SKP-004 | Implemented | Complete 74-file stable bundle at pinned commits, dependency closure, and verified GitHub source adapter. |
| SKP-005 | Implemented locally | Packed consumer installed `execute-task-cycles` and `execute-task` with no dependency prompt; native discovery remains SKP-011. |
| SKP-006 | Implemented locally | Update/remove, ownership hashes, locks, and recovery journal work; disjoint bundled/GitHub roots update together in one transaction, while shared-dependency channel conflicts stop before writes. |
| SKP-007 | Implemented locally | Read-only doctor checks managed hashes and required skill presence. |
| SKP-008 | Implemented locally | Agent Native 0.1.0 registry, scoped capabilities, CLI path, and authorization denial tests. |
| SKP-009 | Preview artifact verified | The 74-file MIT `rc.2` tarball matches the downloaded npm archive byte-for-byte. Final `0.1.0` artifact review remains open. |
| SKP-010 | Automated verification complete | Node 22 on Windows/macOS/Linux and Node 24 on Linux passed source tests and installed-tarball CLI/MCP smoke. Native host acceptance remains SKP-011. |
| SKP-011 | Accepted by owner | The Bot confirmed successful `rc.2` global install and a real `starter-pack` invocation. Devin reports testing the remaining harnesses; detailed per-host logs and versions were not supplied. |
| SKP-012 | Final release in progress | MIT and public-release authority granted; final `0.1.0` artifact review, merge, publication, and registry verification remain. |
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
- The preview commit [f3fd49a](https://github.com/devin-thomas/skills/commit/f3fd49ac3ab8652eb0a163644dc3633d3b017ec9) passed all five jobs in [run 37151866864](https://github.com/devin-thomas/skills/actions/runs/37151866864). npm accepted `0.1.0-rc.0`; a fresh registry install listed 15 skills. The registry download matched SHA-256 `8e49bc1959dedad2928ee976622c9e67a672113a6117ed922227485151da768d`. The same tarball and checksum are attached to the [GitHub prerelease](https://github.com/devin-thomas/skills/releases/tag/v0.1.0-rc.0).
- The repair commit [7ce23ff](https://github.com/devin-thomas/skills/commit/7ce23ffc66705e75a9f876a4a6d7dbb366b31aba) passed all five jobs in [run 37153776033](https://github.com/devin-thomas/skills/actions/runs/37153776033), including 45 package tests and packed consumer smoke. A fresh npm install listed all 15 skills. The registry download matched the reviewed `0.1.0-rc.1` tarball at SHA-256 `49a3ccc7046514455ec73aed68d76765b2ae2249ebba485d379a891d03b86d3b`; the same archive and checksum are attached to the [GitHub prerelease](https://github.com/devin-thomas/skills/releases/tag/v0.1.0-rc.1). The npm `next` and `latest` tags both resolve to `rc.1`.
- The user's Bot reported that `rc.1` postinstall accepted `/home/box/sand-data/workflows` but aborted on a differing `grill-to-build`; npm rolled the package install back and no skill files changed. `rc.1` doctor reached the library but found no managed skills. This is evidence for the path fix and the new conflict-selection requirement, not discovery or invocation acceptance. [H14 in SOURCES.md]
- The conflict-selection commit [992fecd](https://github.com/devin-thomas/skills/commit/992fecda0dd3e54f06783b0acdaa6ec68b6c3e42) passed all five jobs in [run 37155782443](https://github.com/devin-thomas/skills/actions/runs/37155782443), including 48 package tests and packed consumer smoke. An isolated conflict test preserved local `grill-to-build`, installed the other 14 skills, and confirmed doctor lists them. A fresh npm registry install listed all 15 catalog entries. The registry download matched the reviewed `0.1.0-rc.2` archive at SHA-256 `8d0f895e2f8f540108e26d19450c9947ef18b44bd2f8f7d920155684437f98b0`; the same archive and checksum are attached to the [GitHub prerelease](https://github.com/devin-thomas/skills/releases/tag/v0.1.0-rc.2). Both npm `next` and `latest` tags resolve to `rc.2`.
- The user's Bot reported a successful global `rc.2` install. Doctor found healthy managed `starter-pack` and `computer-setup` in `/home/box/sand-data/workflows`, while pre-existing skills and `grill-to-build` remained untouched. The Bot loaded and invoked `starter-pack` from that library, read existing Phase 2 progress, and stopped before Quick Build as requested. This is real account-library invocation evidence, though doctor cannot receive a native discovery callback. It does not establish update/remove or the other native hosts. [H15 in SOURCES.md]
- Devin reported testing the remaining harnesses and explicitly authorized merge and final publication. This clears the owner acceptance gate without adding agent-observed per-host logs. [H16 in SOURCES.md]
- On the `research` Mac, isolated installs of the `rc.0` npm preview into Codex and Claude project roots passed add, doctor, unchanged update, and managed remove; both installed the sibling `README.md`. Native Codex explicitly read the installed skill and README. Automatic discovery was not established because Codex reported a global skill-description budget warning. Claude's native invocation stopped at `Not logged in` before a model turn.

## Release gates

1. MIT is selected for the approved npm bundle and its bundled snapshots, including the two pinned Starter Pack skills; this is not a blanket grant for the source repository. Verify the final tarball includes LICENSE and NOTICE and preserves source attribution.
2. Native acceptance is owner-reported for the remaining harnesses. The Bot account-library invocation is supported by the user's screenshots; doctor cannot independently mark its discovery field verified.
3. Review the final tarball and metadata, merge the PR, publish exact `0.1.0`, and verify the npm registry artifact and fresh consumer.
