# Test strategy

## Fast deterministic tests

Test catalog schema handling, approved source paths, dependency closure order/deduplication, missing dependencies,
cycle rejection, unknown IDs, related-skill non-edges, and the two actual dependency pairs. Test `-nd` as a single token
and explicit degraded state. Assert the normal add path calls no dependency-confirmation function.

Use temporary directories and fake network/native ports. Cover no host, ambiguous host, saved host, explicit override,
and noninteractive failure without writes. Include deliberately misleading `.agents` directories and an unrelated
`agent` binary. Do not assert guessed vendor environment signals as facts.

## Filesystem and update tests

Fresh add, identical add, promotion of an automatic dependency, complete support files, path-with-spaces, Unicode,
case collisions, reserved Windows names, symlink/reparse escape, archive traversal, size limits, permission failure,
interrupted write, journal recovery, scope lock contention, source changing during fetch, and edited/unowned destination.

Snapshot all files before every negative test and compare after. Updating/removing must not delete unknown files,
user modifications, retained dependencies, or another host's references. Test source conflicts across two roots and
host targets sharing a physical directory. Verify rollback after the second skill fails, not just the first.

## Channel tests

Install bundled snapshot A offline. Install GitHub snapshot B using the same CLI version. Publish simulated source C,
then update without changing that CLI version; result becomes C. Verify channel persistence, one commit per source repo
per transaction, complete resource hashes, invalid-schema refusal, stale provenance handling, and no silent fallback
when `--latest` fails. Assert no refresh happens when running help, importing the package, or invoking bundled-only paths.

## Agent Native tests

Install the exact published dependency in an external fixture. Verify registry creation has no side effects, invalid
input is rejected, local read/write scopes are enforced, denied requests never reach handlers, and output schemas are
checked. Compare CLI and API domain outcomes. The required read-only HTTP/MCP fixture must not expose local installation
state or writers. Do not rely on framework devDependencies being present in the monorepo.

## Tarball and platform tests

Test the actual `npm pack` output in a clean directory outside the source repo. Verify `bin` startup, exports, all runtime
dependencies, complete bundle resources, absent private files, correct notices, and a working offline bundled path after
installation. Run Node 22+ on Windows, macOS, and Linux in CI. Validate the minimum supported Node version independently
from the newest development environment. Avoid shell-only commands in the installed runtime.

Exercise Grok Bot postinstall with fresh managed state, existing managed state, unowned or edited destinations, and
wrong-user, wrong-home, a symlinked `workflows` leaf, root, and non-global installs. Include the reported symlinked
`agent-data` parent and verify writes use the owned physical `workflows` directory. Test adoption of a complete
byte-identical skill without rewriting it, and rejection of differing, extra, and unsafe entries. Assert that an
eligible global install places the complete 15-skill bundle with receipts and that other environments do not write
the account library.

Continue existing repository checks: `python3 scripts/validate-skills.py`, `python tests/test-manifest.py`,
`node --test tests/pwa-helpers.test.mjs`, and `git diff --check`. Discover and honor additional current checks.
These command names were found in repository instructions; their success is not claimed by this planning pack.

## Six real-host tests

All six are mandatory. Record version, OS, execution computer, scope, actual discovery UI/tool output, resource access,
and a safe invocation. Prove update and removal in each native context. In Grok Bot prove both the reported repository
route and, for account scope, that global npm installation on the Bot computer changes the account library and is
discoverable by the Bot. Test complete support files, dependencies, guarded failure, and existing-state preservation.
Test Grok CLI separately through its documented `.grok/skills` route. In Antigravity explicitly
qualify IDE/CLI surface and global route. In Cursor distinguish local discovery from cloud sync.

## Release gates

No release marked complete with a deferred initial host, missing licensing decision, missing resource closure, unmanaged
file deletion, dependency prompt, or content update that requires republishing installer code. Public availability is
checked only after separate publication authorization. Keep execution evidence separate from plans and test fixtures.
