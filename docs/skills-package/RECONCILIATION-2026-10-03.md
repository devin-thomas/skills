# Reconciliation of the two Skills package plans

The earlier draft PR had seven tickets. The later `uppercut-skills-build-pack.zip` supersedes it where they differ;
the first plan supplies compatible details. The user's subsequent direct Grok Bot report adds Grok CLI as a separate
sixth host and distinguishes Grok Bot repository work from its chat-wide private library. This document records
the mapping so old text is not mistaken for current acceptance.

| Topic | Current contract |
| --- | --- |
| Package and catalog | Keep `@uppercut-labs/skills` in the existing `devin-thomas/skills` source repository. Reuse `manifest/skills.json`; do not create a second authoring catalog. |
| Stable channel | Bundle the complete reviewed skill resource closures with the npm package so default installs can work offline. This replaces the first plan's manifest-only bundle and remote content fetch. |
| GitHub channel | `--latest` / `--channel github` resolves the allowed manifest and source refs to immutable commits once per operation, then remembers that channel for update. |
| Dependencies | Install `prerequisites[].skillId` transitively without a dependency prompt; `--no-dependencies` / `-nd` is a degraded expert option. `relatedSkills` is not an edge. |
| Removal | The later plan removes only unmodified, package-owned dependencies no longer required by any retained root. This replaces the first plan's blanket no-auto-removal rule. |
| Hosts | Codex, Claude Code, Cursor, Antigravity, Grok Bot, and Grok CLI are first-release targets. Grok Bot repo `.agents/skills` is a user-supplied Bot observation awaiting native verification; Bot account-library registration remains distinct. Grok CLI uses documented `.grok/skills` routes. |
| Capability layer | Preserve the first plan's friendly `npx ... add` UX and Agent Native local capability layer. A later user scope change adds an opt-in, loopback read-only `POST /mcp` mount. Ordinary installation does not need the listener. |
| Work sequence | The later twelve-ticket graph replaces the earlier seven-ticket graph. SKP-003 resolves native host contracts early; SKP-011 supplies real-host acceptance. |
| Publication | The collection license and resource redistribution review remain open. A built artifact is not an npm release. |

The earlier PR's portable frontmatter validator and normalized `long-horizon-dashboard` description remain useful
and are preserved. Its Codex-only manual install example and metadata-only stable-channel description are replaced.
The later ZIP's guarded source-fix helper found a conflict in the already-edited PR `AGENTS.md`; the five targeted
source changes were reconciled manually so intervening PR content is preserved.

The ZIP's `VERIFICATION.md` describes checks of that original planning archive. It does not prove this repository
integration, a working CLI, or native host acceptance. Record new implementation evidence against the active tickets.
