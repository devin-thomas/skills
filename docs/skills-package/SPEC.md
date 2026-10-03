# Uppercut Skills specification

## Audience and purpose

People and coding agents who want a selected Devin/Uppercut-owned public skill installed correctly.
Hide dependency and path machinery; keep the action and its result understandable.

## Primary flow

1. The user runs `add <skill-id...>` in a project or explicitly selects `--global`.
2. Resolve a known host, the catalog snapshot, and the complete required skill closure.
3. Verify all source files and destinations before mutation. Install the transaction with no dependency prompt.
4. Report the requested skill, destination, source channel/revision, and the actual discovery evidence state.

A normal result can be one sentence: `Installed execute-task-cycles and its required skill for Cursor.`
Do not label native activation verified when only bytes were installed. More detail belongs behind `--verbose`
or in JSON. Do not print an interactive package-plan screen that requires accepting dependencies.

## Required behavior

### CLI surface

| Command | Behavior |
|---|---|
| `list` | Show the selected catalog; include installed status. No host required for catalog-only reads. |
| `show <id>` | Show purpose, included resources, content provenance, and any external runtime/access requirements. |
| `add <id...>` | Install explicit roots plus transitive skill dependencies. Repeated identical add is a no-op. |
| `update [id...]` | Update selected managed roots, or all managed roots at the selected scope, using saved channels. |
| `remove <id...>` | Remove selected explicit roots and unmodified, owned dependencies no longer required anywhere in scope. |
| `doctor` | Read-only diagnosis of managed files, conflicts, dependencies, host evidence, and source receipts. |

Shared flags: `--host codex|claude|cursor|antigravity|grokbot|grokcli`, `--project <directory>`, `--global`,
`--latest`, `--channel bundled|github`, `--json`, `--verbose`, `--dry-run`, and `--help`.
`--latest` is an alias for `--channel github`; contradictory channel flags fail before writes.
`--project` and `--global` conflict. Bare project scope resolves to the current Git worktree root, or CWD
outside Git; an explicit `--project` directory is used exactly. Do not initialize Git.

`--no-dependencies` and the exact whole-token alias `-nd` apply to `add` only. They suppress adding missing
required skills, leave a clearly recorded degraded result, and never remove existing dependencies.
Do not interpret `-nd` as two grouped short options. Normal installs need neither `--yes` nor `--apply`.
The package does not control npm/npx's own first-use install prompt or a host's security permissions.

### Host selection

An explicit host wins, then a saved selection for this target, then an unambiguous active-host signal,
then one positively detected supported installation. A shared `.agents` directory alone does not identify a host.
When zero or multiple plausible hosts remain, ask one host-selection question in a terminal; remember the choice.
In noninteractive/JSON mode, return `host-required` with candidates and an example `--host` command, with no writes.
Do not install to every detected host unless separately requested. A host identity is not authorization.

### Dependencies

Read only `prerequisites[].skillId` as required skill edges. `relatedSkills`, optional delegation, and
platform/application prerequisites are not edges. Detect missing IDs and cycles before copying anything.
Install a deduplicated, dependency-first closure automatically. `execute-task-cycles -> execute-task` and
`surface-sweep-showcase -> surface-sweep` are mandatory positive controls. Do not turn execute-task's optional
handoff to cycles into a reverse dependency cycle. Do not add an upstream `grilling` package from an analogy.

Do not install Python, browsers, Spotify credentials, MCP servers, or other applications just because a skill
mentions them. They remain runtime requirements reported by `show`/`doctor` where relevant.

### Sources and channels

Use [CHANNELS](CHANNELS.md). A new default install uses the packaged stable snapshot; a GitHub-channel install
pins current allowed source revisions and remembers that choice. A later `update` follows the saved channel.
A content-only change must not require a new npm installer release for GitHub-channel consumers.
No arbitrary URL, repo, branch, filesystem source, or private repository is accepted as skill input in v1.

### Files, ownership, and state

Copy complete declared resource closures, not just `SKILL.md`. Preserve bytes and executable-mode intent;
never execute downloaded skill scripts during installation. Reject escaping paths, archive links, case-fold
collisions, Windows reserved names, malicious archives, unsupported manifest versions, and missing resources.

Stage and verify first, acquire a scope lock, recheck the plan, then use a journaled transaction. Store originals
for rollback outside host discovery paths. Restore on failure and recover interrupted transactions on restart.
Never promise a single atomic rename across several host directories or filesystems.

Store project state under `.uppercut-skills/`, not in the source catalog. Keep portable source locks separate
from machine-local absolute paths and native-registration IDs. Use OS-appropriate user data directories for
user-global installer state. The default filesystem policy refuses unowned or changed destinations without
altering them. No destructive `--force` shortcut in v1. Recovery guidance can ask the user to move or preserve a
conflicting file; that is not a dependency question.

Track explicit roots, automatically installed dependencies, each physical destination, owners, and source hashes.
A shared destination used by two host selections is one owned artifact with multiple references. Removal never
breaks a remaining root or deletes user-added files. An add of an automatic dependency promotes it to an explicit root.

### Results and errors

JSON stdout contains one versioned `uppercut.skills.result/v1` envelope; progress goes to stderr.
Fields include command, outcome, requested IDs, resolved closure, host/scope, channel and source receipts,
changes, warnings, error code, and discovery evidence. No tokens, environment dump, or private source contents.
Outcome values include `complete`, `unchanged`, `degraded`, `registration-required`, and `failed`.

Exit 0: requested operation complete or unchanged; 2: usage/unknown skill/host selection; 3: denied authorization;
4: source/integrity/compatibility failure; 5: local conflict or lock; 6: native registration still required;
7: explicit no-dependency degraded installation; 1: other operational failure. `doctor` uses 0 for a healthy
managed state, 7 for degraded content, and 6 when required native registration is incomplete.
Pending optional manual discovery evidence is reported as unverified, not silently treated as a file-copy failure.

## Content and presentation

No UI application is needed. Support plain terminals, redirected output, narrow widths, Windows path quoting,
Unicode filenames, keyboard-only selection, and `NO_COLOR`. Do not require color, animated spinners, or browser login.
Skill descriptions and shared resource references stay portable; optional host metadata stays optional.

## Boundaries

An opt-in local MCP listener mounts loopback `POST /mcp` for public `catalog.list` and `catalog.show` only.
It uses Agent Native 0.1.0 and peer `@modelcontextprotocol/server@2.3.0`; see [SKP-013](tickets/SKP-013.md)
and [SKP-014](tickets/SKP-014.md). The mount has no installation writes or local-state reads.

The original ZIP delivery made no GitHub or npm writes. The implemented CLI writes only its selected local
scope. For Grok Bot account scope, explicit CLI operations and a global npm postinstall on the Bot's own qualified
Linux runtime write the reported existing `/home/box/agent-data/workflows` library through its owned physical path.
A fresh global install places the bundled catalog there, adopting complete byte-identical existing skills and
rejecting differing or extra files; an existing managed installation is preserved for an explicit update. npm must
permit this package's postinstall script. This does not
publish a Bot template, grant new permissions, or enable a remote MCP service. See [GROKBOT](GROKBOT.md) for the
runtime checks and the separate native-discovery gate.
The initial release includes six hosts, with distinct Grok Bot and Grok CLI contracts. See
[GROKBOT](GROKBOT.md) and [GROK-CLI](GROK-CLI.md).

## Acceptance

| Evidence | Check and responsible person/agent | Result and provenance |
|---|---|---|
| Build/type checks | Implementer: Node/TypeScript checks, repository validators, dependency tests | Passed in [Skills CLI CI](https://github.com/devin-thomas/skills/actions/runs/37142266205); see [implementation checkpoint](IMPLEMENTATION-STATUS-2026-10-03.md) |
| Terminal accessibility | Implementer: non-TTY JSON, narrow terminal, no-color, spaces/Unicode paths | JSON and packed-consumer paths tested; complete terminal matrix pending |
| Release availability | Release owner: exact npm artifact after separate publication approval | Not published by this pack |
| Primary behavior | Implementer: external tarball installation, add/update/remove, closure and conflicts | Packed-consumer smoke passed on Windows/macOS/Linux; mixed-channel combined update and shared-dependency conflict passed focused tests |
| Native host behavior | Implementer plus Devin where needed: all six real hosts, versions and evidence | Pending; cannot be inferred from filesystem and protocol tests |
