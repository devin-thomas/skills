# Skills package releases

## 1.0.1 complete public skill refresh

Owner-approved release: all sixteen public-repository skill snapshots are pinned to source commit `2f245b58d25cf0da5aeb61f137e8909ef7a10891`, including the new portable `agent-cli` and `immutable-reports` additions. Together with the three retained external snapshots, the package contains nineteen skills. The public style skill references all nine finalized guides. The execution skills default to automatic repair and asynchronous human questions while independent ready work continues; an unspecified backlog run follows its authorized scope endpoint.

Private skills and the private layout migration are outside this npm payload. The dvn and dvn-internal compatibility review remains a separate owner-led follow-up after this release.

Published to [npm](https://www.npmjs.com/package/@uppercut-labs/skills/v/1.0.1), with `latest` pointing to 1.0.1. Registry publication timestamp: `2026-10-24T01:25:21.886Z`. The [GitHub release](https://github.com/devin-thomas/skills/releases/tag/v1.0.1) tags release source `3e2c4846e798a94110b6d57fde51b83fca7af241` and includes the exact tested archive and SHA-256 sidecar.

The tested, GitHub-downloaded and registry-downloaded archives are byte-identical: 283820 bytes, 74 files, SHA-256 `06cc15e3d2171cb614941066afe5c998ac9ce1cc45b1006a3c8db9bea58e098c`. Registry integrity is `sha512-rP+Wv4m0bPBsoVdEhXxQGq8Z6xBXSeAKhcSXamPVYO0PjgOWy3zD0bv7QK22aZgTCP46SlkHYSGsPSfwAd1tcQ==`.

Validation passed: 16 source entry points; the 19-entry catalog and 27 manifest checks; 6 artifact-contract tests; 4 PWA-helper tests; TypeScript checks and 50 package tests; packed consumer CLI/MCP checks. A fresh npm-registry consumer installed all 19 skills, passed doctor/update/remove, and matched all 107 public source files against their pinned Git bytes. Both legacy and current read-only MCP protocols and the loopback launcher passed from the registry installation. Node 26.10.0/npm 11.19.1 built the release. No new native-host acceptance is claimed.

## 1.0.0 stable public release

The owner requested a stable version of at least 1.0.0 for the already public
`@uppercut-labs/skills` package. This release promotes the existing installer,
CLI, read-only MCP catalog and reviewed bundled skill snapshots to 1.0.0.
The repository and CLI guides now describe the published installer and show
pinned 1.0.0 commands. Bundled source revisions and runtime behavior are unchanged.

Published to npm as [`@uppercut-labs/skills@1.0.0`](https://www.npmjs.com/package/@uppercut-labs/skills/v/1.0.0),
with `latest` pointing to 1.0.0. npm accepted the upload at
2026-10-21T02:58:37.711Z; its publish-time processing completed with registry
publication timestamp 2026-10-21T03:02:46.460Z. Fresh registry consumer verification
finished at 2026-10-21T03:04:55.554Z. The matching
[GitHub release](https://github.com/devin-thomas/skills/releases/tag/v1.0.0) is tagged
at source commit `3bac53a9b330acd4e09f1884a4b8d32c90c7aae0` and includes the exact
archive plus its adjacent SHA-256 checksum.

Both GitHub- and registry-downloaded archives match the retained tested archive
byte-for-byte: 226181 bytes, 74 files, SHA-256
`479573713445487a57c9a7c1df2f98189492cd0206cbab62d60b3486aca59443`.
Registry integrity is
`sha512-Oib6/hf8YYpyUrCOF2aU55A2lvOiD2yaG+Y6zgKD70Zm+6ZYHJLUbb+3955mz0ZYHVjXo0K1OQAbAS8MxFltQA==`.

Validation passed: 14 skill entry points and the 17-entry catalog, 6 artifact
contract tests, 4 PWA helper tests, 50 package tests, TypeScript checks, and
packed consumer verification. A fresh consumer installed exact npm version
1.0.0, listed all 17 skills, installed `execute-task-cycles` with `execute-task`,
passed doctor/update/remove, and exercised legacy and current read-only MCP
protocols plus the CLI loopback launcher. Node 26.10.0/npm 11.19.1 built the
archive. This release adds no new native-host acceptance claim.

Historical 0.1.2 was distributed through GitHub only; npm previously served 0.1.1.

## 0.1.2 autonomous task recovery

Released from tag `v0.1.2` at `d86ef8b4951d8a9b97760f159ba1a33889256f62`,
with the three updated execution skill snapshots pinned to
`2a5aea5ceb22a76a6635d24a089dfe13394a82f7`. `execute-task-cycles` counts completed
tasks, keeping diagnosis, retries and recovery inside the current task.
`execute-task` and the task-prompt authoring skill/template preserve current user
intent and existing authorization without manufacturing confirmation checkpoints.
Required checks and genuine access, decision and protected-data boundaries remain.

The exact GitHub-downloaded 74-file archive is 226157 bytes with SHA-256
`277412f79c443df1463d313a9ddbe9b45d6d4e8039eaf93a01e37e624ba45489`.
Its adjacent `.sha256` verified. A fresh consumer installed the cycle skill,
its execute-task dependency and task-execution-prompt from that downloaded
archive; every tracked resource matched the reviewed source commit byte-for-byte.
The bundle now includes all 17 catalog skills; the installer's source allowlist
also recognizes the already-approved `branded-sign-in` catalog entry.

Local checks passed: three Skill Creator validations, the 17-entry catalog/source
validator, 27 manifest checks, 6 artifact-contract checks, 4 PWA helper checks,
50 package tests, packed CLI/MCP consumer verification and diff checks. An
independent instruction review exercised dependency/test repair, an unavailable
external permission, scoped continuation, prompt revision and tracker timeout.
GitHub Actions was manually disabled before this change and remains in that
configured state; no CI run is claimed. Node 26.9.0/npm 11.19.1 built the artifact.

The authorized npm publish of the retained archive returned `ENEEDAUTH`; no npm
0.1.2 publication is claimed. The GitHub release archive/checksum and current
GitHub source channel deliver these changes now. A later npm publication should
use this verified archive and verify registry bytes rather than rebuilding it.

## 0.1.1 registry and GitHub distribution

Released from source tag `v0.1.1` at `f5d64828ebb915c10b6797199fea4ce5d2e6f84e`.
The registry-downloaded 74-file archive matches the reviewed GitHub archive exactly:
SHA-256 `ab9afb090c9ad7081489774e1f2f92e6c3fbb715f21dff050dfff1175123c9f9`,
217214 bytes. The official compiler pins all six `programmatic-harness` resources
to source commit `50ce5dce91c49fcf896aa887e11b4c3a529e40e5`.

A fresh public registry consumer ran the pinned CLI to install `programmatic-harness`
for Codex. Project package.json stayed byte-identical and no project runtime
node_modules were created. Actual Codex discovery found the enabled repo skill
with zero errors. Adapter installation and inference remain separate opt-ins.
The existing installer Agent Native 0.1.0 dependency is unchanged.

The [GitHub release](https://github.com/devin-thomas/skills/releases/tag/v0.1.1)
archive and adjacent SHA-256 file remain a fallback. Verify the sidecar before
invoking the archive with `npm exec --package=./uppercut-labs-skills-0.1.1.tgz --
uppercut-skills ...`. Initial unauthenticated attempts failed; subsequent
authenticated publication succeeded and registry availability was verified.

## Historical 0.1.0 release

Released from source tag `v0.1.0` at `c5f4358bfff6c9d97995e19915b15baeea2f2b17`.
The reviewed and registry-downloaded 74-file archive has SHA-256
`a86386d38125e978a6b835f184f3a7ed8097e3ac24dd0d5b02f2eb1cd9b48055`.
The [GitHub release](https://github.com/devin-thomas/skills/releases/tag/v0.1.0)
includes that archive and `SHA256SUMS`; npm `latest` pointed to `0.1.0` at that release.

## Native acceptance

The user's Grok Bot installed `0.1.0-rc.2` globally and invoked `starter-pack`
from its account library, while leaving a conflicting `grill-to-build` folder
unmanaged. Devin reports testing the remaining harnesses and has authorized
merge and final publication. The Bot screenshots are retained in the task;
detailed versions and results for the other hosts were not supplied. Keep that
distinction in release notes and future support reports.

## Historical 0.1.0 candidate gate

1. Confirm the selected collection license and the rights notices for every
   bundled skill. Keep the Starter Pack grant scoped to the bundled skills; its
   upstream repository has its own rights notice.
2. Record the owner's acceptance of the remaining advertised hosts separately
   from the Bot account-library invocation shown in the supplied screenshots.
3. Confirm the candidate commit is on `main`, the tree is clean, and the
   `Skills CLI` checks passed on that commit.
4. In a clean checkout of that commit, run `npm ci`, the repository validators,
   `npm test`, and `npm run smoke` from `packages/skills-cli` as applicable.
   Review the actual `npm pack --json` file list, package metadata, license,
   notices, and the packed consumer result. Retain the exact `.tgz`, its SHA-256,
   source commit, and Node/npm versions outside the repository.

## Historical 0.1.0 publish sequence

1. Check that `@uppercut-labs/skills@0.1.0` is absent from npmjs.com. A network
   or authentication failure is not proof that a version is available.
2. Publish the retained tarball to the public npm registry with the authorized
   `uppercut-labs` account. Do not rebuild a different archive for publication.
3. Verify `npm view @uppercut-labs/skills@0.1.0` and install that exact version
   in a new consumer. Compare its registry integrity and packed file list with
   the candidate, then run `list`, an offline bundled add/doctor/remove flow,
   and the read-only MCP consumer check with its optional peer installed.
4. Tag the reviewed source commit `v0.1.0` and create a GitHub release with the
   candidate tarball and checksum. Record the registry URL, source commit,
   tarball digest, and native-host acceptance evidence in the release notes.

If npm accepts the package but a later verification step fails, treat it as a
partial release. Inspect the registry before retrying; npm versions cannot be
replaced in place.
