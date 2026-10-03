# Architecture

## One catalog, one service layer, host-specific edges

```text
manifest/skills.json + canonical public source directories
                 |
       validated bundle compiler
                 |
    bundled stable / pinned GitHub snapshot
                 |
  resolver -> dependency closure -> transaction service
                 |                       |
          managed source lock      host adapter + receipts
                 |
       Agent Native capability registry
                 |
      friendly CLI / programmatic adapter
```

The drawing describes call relationships, not a background service. Ordinary use is one local process.

## Suggested repository layout

Preserve root skill directories, `manifest/`, current Python validation, and existing PWA tests.
Create `packages/skills-cli/` for the npm package, with `src/catalog`, `src/sources`, `src/dependencies`,
`src/transactions`, `src/hosts`, `src/state`, `src/capabilities`, and `src/cli`.
Use `distribution/` for author-maintained packaging policy and generated-bundle scripts, not a second skill index.
Generated bundles, test archives, native receipts, and compiled output stay out of canonical source directories.

Package runtime code is TypeScript/ESM, targeting Node.js 22+. Select and lock actual available build-tool versions
when implementing. Include `bin`, `exports`, explicit `files`, `engines`, source repository metadata, and the
approved license information. A root application `private: true` flag must not accidentally prevent publishing
the distribution subpackage, and publishing the subpackage must not leak the entire repository.

## Domain services

`readCatalog`, `resolveSnapshot`, `resolveClosure`, `planInstall`, `applyInstall`, `planUpdate`,
`applyUpdate`, `removeManaged`, and `diagnose` are domain service names proposed by this plan, not claims
about functions already in the repository. Keep fetch, filesystem, clock, native-registration, and output ports
injectable. The same services back human CLI and Agent Native bindings.

The normal `add` internally plans and applies in one invocation. A plan object is not a new mandatory user gate.
It captures source hashes, pre-existing file hashes, expected destinations, dependencies, and scope. Before applying,
recheck those expectations. Source selection must never change between dependency calculation and copying.

## Host adapter contract

An adapter resolves an execution environment, install destination, host-specific guards, and a read-only
verification procedure. File-copy hosts, including Grok CLI and both Grok Bot scopes, share the managed transaction
engine. Grok Bot account scope is limited to the reported `/home/box/agent-data/workflows` library on its qualified
Linux execution computer. The adapter resolves the reported symlinked parent to the owned physical `workflows`
directory before passing it to the transaction engine. A permitted global npm postinstall installs the bundled
catalog there on a fresh managed state and adopts pre-existing exact file matches without replacing them.

Host evidence records version, surface, execution computer, scope, discovery mechanism, invocation check, and
timestamp. A guarded write and its ownership receipt establish installation, while native Bot discovery and
invocation require a separate real-session check.

## Filesystem transaction

Preflight all destinations and source bounds; lock the selected state scope; stage verified bytes on the appropriate
filesystem; persist a journal; apply directory changes; persist state; finalize. Store backups outside discovery roots.
After a crash, recover from the journal before accepting a new write. Check symlink/reparse-point escapes at each boundary;
never follow archive links or delete an unowned parent directory. Refuse concurrent operations rather than racing.

Keep the portable source lock deterministic and versioned. Store host-specific absolute paths and registration receipts
separately, ignored by Git. Do not silently edit a user's Git configuration or auto-commit installed skills.

## Shared discovery

Codex and current Antigravity can share `.agents/skills`; Cursor also reads it. Reuse a compatible managed physical
installation and add an owner reference rather than creating duplicate copies. A separately requested Claude target may
require `.claude/skills`. Diagnose multiple independently edited copies rather than deleting one to force consistency.
