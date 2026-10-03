# Uppercut Skills package specification

## Audience and purpose

This package is for people and agents who want one of Devin Thomas's public skills without learning repository layout, dependency relationships, or host-specific installation paths first.

The package turns the existing owned-skill manifest into an installable product while preserving the source repositories as canonical authoring locations.

## Primary flow

Starting state: the user has Node.js 22+ and at least one supported host, but no selected Uppercut skill installed.

Primary command:

```sh
npx @uppercut-labs/skills add <skill-id>
```

The CLI:

1. resolves the stable catalog snapshot, or the live catalog when `--latest` is supplied;
2. validates the requested skill;
3. expands transitive `skillId` prerequisites automatically unless `--no-dependencies` / `-nd` is present;
4. detects the active host or uses `--host`;
5. resolves the host's project/global destination or account-library transport;
6. fetches each complete skill directory at the catalog's immutable source revision;
7. validates every fetched bundle before mutation;
8. installs requested skills and dependencies as one planned operation;
9. writes provenance/ownership receipts;
10. reports installation and host-discovery evidence separately.

## Required behavior

### Catalog channels

**Stable** is the default. The npm package includes a snapshot of `manifest/skills.json`. Skill content is fetched from each entry's canonical repository at its pinned `sourceRevision`. The npm package therefore does not need a release for every skill edit.

**Latest** is explicit through `--latest` and may also be represented internally as `--channel latest`. It fetches the current manifest from `devin-thomas/skills` and follows that manifest's current source metadata.

A fetched manifest or skill that fails validation aborts before installation.

### Dependency behavior

`prerequisites[].skillId` forms the install graph.

- Resolve transitively.
- Deduplicate.
- Detect cycles before mutation.
- Install prerequisites before dependents.
- Never prompt for confirmation because prerequisites were added.
- `--no-dependencies` and `-nd` install only the explicitly requested skill IDs.
- Platform/application prerequisites are reported by `doctor`; the package does not install unrelated applications.

### Commands

```text
list
add <skill...>
update [skill...]
remove <skill...>
doctor
```

Common options:

```text
--host <codex|claude|cursor|antigravity|grokbot>
--global
--latest
--json
--dry-run
--no-dependencies, -nd
```

`remove` does not automatically remove prerequisite skills because another installed skill may still depend on them.

### Host projections

| Host | Project | Global/account |
| --- | --- | --- |
| Codex | `.agents/skills/<skill>/` | `~/.codex/skills/<skill>/` |
| Claude Code | `.claude/skills/<skill>/` | `~/.claude/skills/<skill>/` |
| Cursor | `.agents/skills/<skill>/` | `~/.cursor/skills/<skill>/` |
| Antigravity | `.agents/skills/<skill>/` | active IDE/CLI global skill location |
| Grok Bot | not filesystem-scoped | account skill library / packaged-skill transport |

For Antigravity global installs, the adapter distinguishes the IDE and CLI global locations documented by Google. If both relevant surfaces are installed, the operation may project the same canonical skill to both rather than asking a dependency-style confirmation.

For Grok Bot, v1 may use the established `grok-bot-cli` `gbot skills` transport when present, but it must remain optional and identified as third-party. The package must not copy or extract Grok Bot session credentials. If no verified programmatic transport is available, `doctor` and `add` return an actionable account-library/plugin path rather than claiming success.

### Host detection

Resolution order:

1. explicit `--host`;
2. reliable active-host runtime/environment evidence;
3. repository-local host markers;
4. installed supported host executables;
5. interactive choice only when remaining candidates require different destinations.

Codex, Cursor, and Antigravity project installs collapse to one `.agents/skills/` destination, so their coexistence alone is not an ambiguity.

Non-interactive ambiguity fails with a compact list of valid `--host` values.

### Ownership and updates

Each package-managed installation has a receipt containing at least:

- skill ID
- requested vs dependency role
- package version
- catalog channel
- source repository
- source path
- source revision
- installed file inventory/hash
- host adapter
- destination
- install timestamp/version marker suitable for diagnostics

Update refuses to overwrite files that differ from the last package-owned hashes unless an explicit replacement policy is introduced later. Remove deletes only package-owned files and leaves unrelated user files intact.

### Agent Native integration

The package depends on `@uppercut-labs/agent-native` and defines versioned local capabilities for:

- catalog/list
- skill/add
- skill/update
- skill/remove
- doctor

A thin user-facing parser keeps the ergonomic commands above and invokes those capabilities. Agent Native supplies schemas, registry/executor behavior, authorization boundaries, diagnostics, and programmatic reuse.

Normal CLI use remains local and requires no HTTP or MCP server. The package exports its definitions/registry so the same operations can later be projected through Agent Native's MCP or HTTP adapters without duplicating business logic.

## Content and presentation

The CLI should be understandable without knowledge of Agent Skills internals.

Normal success output names the explicitly requested skill first and may note automatically installed dependencies afterward. Dependency expansion is informational, never a permission question.

`--json` produces stable machine-readable results. Human output does not expose credentials, session locations, raw auth material, or unnecessary internal paths.

## Boundaries

- Public catalog only.
- No `private-skills`.
- No arbitrary repositories in v1.
- No account creation or credential prompts.
- No shell-string execution for installer operations.
- No telemetry added by Uppercut Skills.
- No hidden delegation to a third-party installer that changes the package's privacy contract.
- Existing generic `skills` tooling may be used as a compatibility reference, but Uppercut Skills owns its five adapters and curated-catalog semantics.

## Acceptance

| Evidence | Check and responsible person/agent | Result and provenance |
| --- | --- | --- |
| Build/type checks | TypeScript build, tests, repository validators, `npm pack --dry-run` | pending |
| Layout/accessibility | CLI help remains readable at ordinary terminal widths; no interactive prompt for dependencies | pending |
| Package availability | npm package `@uppercut-labs/skills` and provenance inspected after publish | pending |
| Primary behavior | Install a skill with a transitive prerequisite, stable and latest channels | pending |
| Host-specific promise | Real discovery checks in Codex, Claude Code, Cursor, Antigravity, and Grok Bot | pending |
