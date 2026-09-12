# Agent Skills

Practical skills by Devin Thomas for shaping an idea, building a bounded piece of work, checking the result, and making it useful to someone else. Start with an observable outcome, keep decisions and progress in files you own, and introduce tools when the work needs them.

For guided onboarding, start at [Starter Pack](https://starter.devthomas.site). This repository is a toolbox, not a required installation bundle.

## Choose by the job

| User's need | Skill | Output / boundary |
| --- | --- | --- |
| Build a small meaningful app | [quick-build](quick-build/SKILL.md) | Compact interview, approved plan, working build and requested delivery |
| Resolve uncertainty in a larger idea | [grill-to-build](grill-to-build/SKILL.md) | Context, decisions, specification, ordered tickets; implementation when requested |
| Complete the next scoped task | [execute-task](execute-task/SKILL.md) | One verified task pass from local Markdown, GitHub, or Linear |
| Establish a repeatable project workflow | [task-execution-prompt](task-execution-prompt/SKILL.md) | Repository execution contract and read-only rehearsal |
| Run several bounded task passes | [execute-task-cycles](execute-task-cycles/SKILL.md) | Sequential passes with stop conditions; requires execute-task |
| Find and fix visual/interaction defects | [surface-sweep](surface-sweep/SKILL.md) | Corrected app, reviewed browser evidence, honest coverage gaps |
| Present a working product | [surface-sweep-showcase](surface-sweep-showcase/SKILL.md) | Corrected app and screenshot-led showcase; requires surface-sweep |
| Remove unhelpful UI wording | [no-useless-copy](no-useless-copy/SKILL.md) | Scoped copy improvements with necessary guidance preserved |
| Build or repair PWA behavior | [pwa-development](pwa-development/SKILL.md) | Install, offline, update, and recovery behavior with platform evidence |
| Make or inspect an exact Spotify playlist | [perfect-playlist](perfect-playlist/SKILL.md) | Deterministic selected-track workflow; requires its CLI and Spotify access for service operations |

Quick Build and Grill to Build are alternative starting points, not mandatory consecutive interviews. Use a sweep when an app exists; add a showcase when requested. Repeated execution and specialist tools are optional. See each skill's README where supplied for examples and dependencies.

## Install and invoke

Ask a skill-capable agent to install only the needed directories. For Codex with skill-installer available:

```text
Use $skill-installer to install quick-build and no-useless-copy from https://github.com/devin-thomas/skills.
Use $skill-installer to install surface-sweep and surface-sweep-showcase from https://github.com/devin-thomas/skills.
```

Each skill is a directory whose entry point is `SKILL.md`. Keep its references, templates, scripts, and agent metadata together. Install paired dependencies together. Native discovery varies by host: verify it through the host's supported mechanism instead of treating a copied file as proof of activation. If native installation is unavailable, supply the selected entry point and references as context without claiming installation.

No skill requires the author's global AGENTS.md, account memory, or private setup. [Grill to Build preferences](grill-to-build/references/preferences-and-diagrams.md) travel in explicit files; the default diagram format is Markdown/Mermaid. External services still require the user's own access and authorization.

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

The PWA tests require Node.js 22+ and use temporary local fixtures. They do not prove installability or physical-device behavior. Browser-probe validation needs a permitted real browser. See [validation notes](docs/validation.md) for observed publication checks.

Keep project evidence, credentials, private preferences, local runtimes, and generated artifacts out of this repository. Preserve attribution and source revisions. This repository currently has no LICENSE file; a collection-wide license has not yet been selected.
