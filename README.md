# Agent Skills

Practical skills by Devin Thomas for shaping an idea, building a bounded piece of work, checking the result, and making it useful to someone else. Start with an observable outcome, keep decisions and progress in files you own, and introduce tools when the work needs them.

For guided onboarding, start at [Starter Pack](https://starter.devthomas.site). This repository is a toolbox, not a required installation bundle.

## Choose by the job

| User's need | Skill | Output / boundary |
| --- | --- | --- |
| Build a small meaningful app | [quick-build](quick-build/SKILL.md) | Compact interview, approved plan, working build and requested delivery |
| Control a coding-agent session from code | [programmatic-harness](programmatic-harness/SKILL.md) | Optional local Codex session proof through Agent Native; no dependency or credentials on skill install |
| Resolve uncertainty in a larger idea | [grill-to-build](grill-to-build/SKILL.md) | Context, decisions, specification, ordered tickets; implementation when requested |
| Complete the next scoped task | [execute-task](execute-task/SKILL.md) | One verified task pass from local Markdown, GitHub, or Linear |
| Establish a repeatable project workflow | [task-execution-prompt](task-execution-prompt/SKILL.md) | Repository execution contract and read-only rehearsal |
| Run several bounded task passes | [execute-task-cycles](execute-task-cycles/SKILL.md) | Sequential passes with stop conditions; requires execute-task |
| Follow extended work and resume safely | [Long Horizon Dashboard](long-horizon-dashboard/SKILL.md) | Committed status snapshots, checked localhost serving; optional Claude artifacts or private Tailscale access |
| Find and fix visual/interaction defects | [surface-sweep](surface-sweep/SKILL.md) | Corrected app, reviewed browser evidence, honest coverage gaps |
| Present a working product | [surface-sweep-showcase](surface-sweep-showcase/SKILL.md) | Corrected app and screenshot-led showcase; requires surface-sweep |
| Follow my coding conventions | [style](style/SKILL.md) | Report of guide deviations (starter.devthomas.site/style); `refactor` applies them |
| Remove unhelpful UI wording | [no-useless-copy](no-useless-copy/SKILL.md) | Scoped copy improvements with necessary guidance preserved |
| Build or repair PWA behavior | [pwa-development](pwa-development/SKILL.md) | Install, offline, update, and recovery behavior with platform evidence |
| Make or inspect an exact Spotify playlist | [perfect-playlist](perfect-playlist/SKILL.md) | Deterministic selected-track workflow; requires its CLI and Spotify access for service operations |

Quick Build and Grill to Build are alternative starting points, not mandatory consecutive interviews. Use a sweep when an app exists; add a showcase when requested. Repeated execution and specialist tools are optional. See each skill's README where supplied for examples and dependencies.

## Install and invoke

Ask the active skill-capable agent to install the selected skill for its own supported host. Include declared required sibling skills automatically; do not ask the user to identify or approve each dependency. For example:

```text
Install quick-build from https://github.com/devin-thomas/skills for this host.
Install surface-sweep-showcase from https://github.com/devin-thomas/skills for this host, including its required skills.
```

Use the host's supported installation mechanism; for Codex, skill-installer is one available route when installed. Each skill is a directory whose entry point is `SKILL.md`. Keep its references, templates, scripts, and agent metadata together. Required skill dependencies belong to the same installation operation; external applications and service access remain separate prerequisites. Native discovery varies by host: verify it through the host's supported mechanism instead of treating a copied file as proof of activation.

The portable skill content targets **Codex, Claude Code, Cursor, Google Antigravity, Grok Bot, and Grok CLI**. Grok Bot can load project skills while working in a repository; its chat-wide private library is a separate account surface. Grok CLI has its own local skill directories. See [host compatibility](docs/host-compatibility.md) for researched paths and the native acceptance boundary.

A focused npm distribution layer, `@uppercut-labs/skills`, is planned in [docs/skills-package](docs/skills-package/PLAN.md). It will use this repository's manifest as the owned catalog, install skill prerequisites automatically, bundle complete stable skill content, and offer an explicit live GitHub channel for faster content updates. The installer is not published yet.

No skill requires the author's global AGENTS.md, account memory, or private setup. Grill to Build uses [automatic host-native presentation](grill-to-build/references/presentation-and-interaction.md) (rich ChatGPT chat, Claude Artifacts where supported, or text fallback) while preserving an editable Markdown/Mermaid living model by default. [Explicit model preferences](grill-to-build/references/preferences-and-diagrams.md) travel in project or skill files. External services still require the user's own access and authorization.

## Starter Pack relationship

[Quick Build](quick-build/README.md) includes a standalone adaptation plus explicit curriculum mode sourced from Starter Pack 0.2.0. Starter Pack remains authoritative for phase requirements and graduation. Standalone use does not require the curriculum's computer setup or private progress protocol.

Starter Pack also publishes [starter-pack](https://starter.devthomas.site/skills/starter-pack/current/SKILL.md), its progress-aware companion, and [computer-setup](https://starter.devthomas.site/skills/computer-setup/current/SKILL.md). Those remain in the curriculum repository rather than being duplicated here. Their numbered directories are releases, not additional skills.

Upstream engineering skills, including selected Matt Pocock skills, can complement this collection. They are not vendored or required as a full bundle. Additional recommendations belong to the curriculum and should identify their source/version and the job they help with.

## For agents and contributors

Use this table as a routing index, then read the selected entry point and only relevant references. Do not activate every workflow just because this repo is open. [AGENTS.md](AGENTS.md) explains maintenance checks.

```sh
python3 scripts/validate-skills.py
node --test tests/pwa-helpers.test.mjs
git diff --check
```

The skill validator enforces the portable frontmatter subset used by the supported hosts in addition to local-link and machine-path checks. The PWA tests require Node.js 22+ and use temporary local fixtures. They do not prove installability or physical-device behavior. Browser-probe validation needs a permitted real browser. See [validation notes](docs/validation.md) for observed publication checks.

Keep project evidence, credentials, private preferences, local runtimes, and generated artifacts out of this repository. Preserve attribution and source revisions. The approved `@uppercut-labs/skills` bundle is [MIT licensed](packages/skills-cli/LICENSE); see the [source notice](NOTICE.md) for its scope and attribution. This repository as a whole has no blanket license.
