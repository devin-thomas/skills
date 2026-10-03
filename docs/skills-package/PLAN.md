# Uppercut Skills package plan

Status: approved

## Intended result

Publish `@uppercut-labs/skills` as the focused distribution layer for Devin Thomas's public skill catalog. A user names a skill once, and the CLI resolves its required skill dependencies automatically, selects the active supported host, installs the complete skill bundle, and records enough provenance to update or remove it safely.

The package is intentionally not a generic Agent Skills marketplace. The canonical catalog remains `devin-thomas/skills/manifest/skills.json`.

## First use

The first useful action is:

```sh
npx @uppercut-labs/skills add quick-build
```

The CLI uses the stable catalog snapshot bundled with that npm release unless `--latest` is supplied. It detects the active supported host when practical. If multiple detected hosts require different destinations and no active-host signal resolves the ambiguity, interactive use asks which host; non-interactive use fails with the valid `--host` values.

Skill prerequisites expressed as `prerequisites[].skillId` are installed transitively and automatically. The CLI never asks for confirmation merely because a dependency was added. `--no-dependencies` / `-nd` is the explicit escape hatch.

## Devices and evidence

Target environments are macOS, Windows, and Linux wherever the selected host and Node.js 22+ are supported.

Initial host surfaces:

- Codex
- Claude Code
- Cursor
- Google Antigravity, including its CLI surface
- Grok Bot

Codex, Cursor, and Antigravity share the portable project-level `.agents/skills/` destination. Claude Code uses its native `.claude/skills/` destination. Grok Bot is account-level and must use a real library/plugin transport; copying a directory on the local filesystem is not accepted as Grok Bot installation evidence.

Host activation is verified through each host's supported discovery surface. A copied directory alone is not proof that a host loaded the skill.

## Included

- npm package identity `@uppercut-labs/skills`
- one CLI executable, exposed through `npx @uppercut-labs/skills ...`
- `list`, `add`, `update`, `remove`, and `doctor`
- stable bundled catalog metadata
- explicit `--latest` GitHub-backed catalog/source channel
- recursive automatic skill dependency resolution
- `--no-dependencies` / `-nd`
- project and global installs where the host supports both
- Codex, Claude Code, Cursor, Antigravity, and Grok Bot adapters
- install receipts/provenance sufficient for safe update/remove behavior
- JSON output for automation
- Agent Native capability contracts underneath the CLI
- programmatic exports so the same capability registry can later be projected to MCP/HTTP without rewriting the installer

## Outside this build

- arbitrary third-party skill repositories or URLs
- private-skills
- a general-purpose skills search engine or marketplace
- support for hosts beyond the five named above
- automatic removal of dependencies when a requested skill is removed
- silently modifying host settings to force discovery
- claiming Grok Bot support from a filesystem copy
- a hosted service or required MCP server for ordinary CLI use
- daily npm releases just to pick up skill-content changes

## Delivery sequence

1. Harden this repository's portable Agent Skills contract and document the five host surfaces.
2. Build the catalog resolver, prerequisite planner, source fetcher, and install receipt model.
3. Add local host adapters for Codex, Claude Code, Cursor, and Antigravity.
4. Add the Grok Bot account-library adapter with a verified transport and a truthful fallback when that transport is unavailable.
5. Define the operations as Agent Native capabilities and map the human-friendly CLI onto them.
6. Verify clean installs, transitive dependencies, stable/latest behavior, update/remove, host discovery, and failure paths before publishing.

## Completion

The build is complete when:

- `npx @uppercut-labs/skills add execute-task-cycles` installs both `execute-task` and `execute-task-cycles` without a dependency confirmation prompt;
- `-nd` suppresses that automatic dependency expansion;
- the default channel resolves the npm release's pinned manifest snapshot while `--latest` resolves the current GitHub manifest without a new npm release;
- the same selected skill can be installed and discovered in Codex, Claude Code, Cursor, Antigravity, and Grok Bot through their real supported surfaces;
- repeated installs are idempotent or produce a clear conflict rather than silently destroying user changes;
- update/remove operate only on content the package can prove it owns;
- `doctor` distinguishes copied, discovered, unavailable, and unverified states;
- the package uses `@uppercut-labs/agent-native` for typed capability contracts/execution without requiring a server for normal CLI use;
- package tests, repository validation, and `npm pack` inspection pass.

## Approval

Approved choices from the design interview:

- package: `@uppercut-labs/skills`
- host behavior: auto-detect, ask only when host ambiguity changes the destination
- sources: owned public catalog only
- dependencies: automatic, recursive, no confirmation; `--no-dependencies` / `-nd` escape hatch
- update model: stable bundled catalog plus explicit latest/GitHub channel
- initial hosts: Codex, Claude Code, Cursor, Antigravity, Grok Bot
- Agent Native: integrate where it strengthens the package without adding user-facing setup
