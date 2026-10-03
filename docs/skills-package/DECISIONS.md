# Uppercut Skills package decisions

## Scoped npm identity

Status: accepted

Context: The package distributes a specific owned catalog, not the entire Agent Skills ecosystem.

Decision: Publish as `@uppercut-labs/skills`. Keep `devin-thomas/skills` as the canonical source repository for now.

Reason: The Uppercut Labs scope communicates a reusable product while the source repository already contains the manifest and maintained skills.

Consequences: Package metadata must make the source repository explicit. A repository transfer is not required for v1.

Revisit when: The source repository itself is intentionally moved into the Uppercut Labs organization.

## Do not compete with the generic skills CLI

Status: accepted

Context: The existing `skills` npm package already supports many agents and generic repositories.

Decision: Uppercut Skills is a curated catalog/package manager for this owned manifest. It does not become a general skill marketplace or arbitrary-source installer in v1.

Reason: The value is automatic owned-skill dependencies, stable/latest revisions, host-aware receipts, Grok Bot, and Agent Native integration.

Consequences: Host path conventions may be cross-checked against the generic ecosystem, but the package has its own small five-host adapter layer and no added telemetry.

Revisit when: Maintaining host adapters becomes materially more expensive than consuming a stable public library API from the generic installer.

## Automatic dependencies

Status: accepted

Context: Users should not need to know that `execute-task-cycles` requires `execute-task` or that `surface-sweep-showcase` requires `surface-sweep`.

Decision: Resolve and install skill dependencies automatically and transitively without confirmation.

Reason: Dependency knowledge is package-manager responsibility, not user complexity.

Consequences: `--no-dependencies` / `-nd` is the deliberate escape hatch. Dependency cycles and unavailable dependencies are preflight failures.

Revisit when: Never for ordinary dependencies; only if a future dependency performs a separate privileged external action at install time.

## Stable package plus live catalog

Status: accepted

Context: Skill content can change much more frequently than installer code.

Decision: Bundle stable catalog metadata with each npm release, but fetch skill payloads from their canonical repositories at pinned revisions. `--latest` fetches the current GitHub manifest.

Reason: Stable installs remain reproducible without requiring daily npm releases.

Consequences: First install normally needs network access. A future cache may improve offline reuse without changing channel semantics.

Revisit when: A trustworthy packaged-content release pipeline becomes preferable to source-revision fetching.

## Portable project path where hosts agree

Status: accepted

Context: Codex, Cursor, and Antigravity all support project skills under `.agents/skills/`.

Decision: Use `.agents/skills/` for their project-level projection rather than creating three copies.

Reason: One portable skill installation can serve all three hosts.

Consequences: Global locations remain host-specific. Claude Code retains its native `.claude/skills/` project destination.

Revisit when: A host stops honoring the portable Agent Skills path.

## Grok Bot is not a filesystem adapter

Status: accepted

Context: Grok Bot's skills are account-level and available across Bots. Official documentation exposes the library/plugin concept, not a local skills directory contract.

Decision: Treat Grok Bot as a remote/account-library adapter. Prefer a verified programmatic transport when available; the current viable v1 bridge is optional `grok-bot-cli` support. Never claim installation from a local copy.

Reason: This keeps support honest and matches the product's actual persistence model.

Consequences: The adapter may have an optional third-party integration until Cursor exposes a documented programmatic import surface. Missing transport yields an actionable blocked state, not fake success.

Revisit when: Cursor documents an official Grok Bot skill import API or CLI.

## Agent Native underneath, custom UX above

Status: accepted

Context: Agent Native 0.1.0 is now published and can define typed local capabilities, authorization, diagnostics, and future MCP/HTTP projections. Its generated CLI is contract-oriented, while this package needs concise commands such as `add quick-build`.

Decision: Define installer operations with `@uppercut-labs/agent-native`, but keep a thin custom CLI parser that maps ergonomic commands to those capabilities.

Reason: This dogfoods Agent Native and prevents CLI, programmatic, and future MCP behavior from diverging without forcing Agent Native's generic command grammar on beginners.

Consequences: Node.js 22+ is the baseline. Normal use remains local; no server is required.

Revisit when: Agent Native gains a first-class application-command layer that exactly fits this CLI.

## No automatic dependency removal

Status: accepted

Context: A prerequisite may be shared by several installed skills.

Decision: `remove` deletes requested package-owned skills only. It does not garbage-collect dependencies in v1.

Reason: Conservative removal avoids destroying a still-needed skill.

Consequences: A future `prune` command can use the receipt graph explicitly.

Revisit when: Install receipts have enough field evidence for safe orphan detection and there is a clear user need.
