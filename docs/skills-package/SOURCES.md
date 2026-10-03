# Sources and evidence ledger

Research date: October 3, 2026. Repository content was read through the connected GitHub reader. External host
contracts were checked against primary documentation. Native applications were not launched in this environment.

## Repository sources

- **R1 — Skills README:** https://github.com/devin-thomas/skills/blob/5b60a950066113fbaad5fd183d91962b2b98dc4d/README.md
  Blob `c9ae8309f335b35b4dc9653b1f9792831a57f5fc`. Whole-directory skills, optional upstream recommendations, license unresolved.
- **R2 — Canonical owned manifest:** https://github.com/devin-thomas/skills/blob/5b60a950066113fbaad5fd183d91962b2b98dc4d/manifest/skills.json
  Blob `088f0b83cff350cd560aba91f300c7c0e4c5504b`. Fifteen owned records and the two required skill edges.
- **R3 — Manifest contract:** https://github.com/devin-thomas/skills/blob/5b60a950066113fbaad5fd183d91962b2b98dc4d/manifest/README.md
  Blob `0d4aa1534d43c4f45d8bbb8195f8e99d1845dab8`. Preserve editorial metadata and external canonical ownership.
- **R4 — Repository instructions:** https://github.com/devin-thomas/skills/blob/5b60a950066113fbaad5fd183d91962b2b98dc4d/AGENTS.md
  Blob `9f161c10a23467782ab4bfce6e71fddec2f4ad33`. Required pairs, privacy, current validation commands.
- **R5 — Execute Task:** https://github.com/devin-thomas/skills/blob/5b60a950066113fbaad5fd183d91962b2b98dc4d/execute-task/SKILL.md
  Blob `48b11b0749d7d8d47d1e863fd9ab0788b65b7447`. Scoped task behavior and current AGENTS/CODEX enumeration.
- **R6 — Task Execution Prompt:** https://github.com/devin-thomas/skills/blob/5b60a950066113fbaad5fd183d91962b2b98dc4d/task-execution-prompt/SKILL.md
  Blob `1af2135fdef6db7807a484c39ecc679c67887afb`. Prompt-authoring discovery and self-contained prompt requirement.
- **R7 — Portable Workflow:** https://github.com/devin-thomas/skills/blob/5b60a950066113fbaad5fd183d91962b2b98dc4d/execute-task/references/portable-workflow.md
  Blob `ccf1d488a1b9a2b327a680f2c5752a913b6dc0c3`. Preflight and task/Git invariants.
- **R8 — Agent Native package:** https://github.com/uppercut-labs/agent-native/blob/main/package.json
  Blob `76bc61b927bbab43a464ad4a8bf775ef60141b3a`. Version 0.1.0, exports, optional peers, Node floor. npm publication
  was reported by the user; direct registry-page retrieval failed, so independent registry verification remains a build task.
- **R9 — Agent Native capability/binding guide:** https://github.com/uppercut-labs/agent-native/blob/main/docs/capabilities-and-bindings.md
  Blob `55a09e593b04aec5137329c767ad6c5125d978b4`. Explicit bindings, authorization, validation.
- **R10 — Agent Native CLI guide:** https://github.com/uppercut-labs/agent-native/blob/main/docs/cli.md
  Blob `4cb539a881a8636a132e24a4f8d16e849cf28c0e`. Runner, mode selection, envelope and CLI command aliases.
- **R11 — Quick Build and templates:** https://github.com/devin-thomas/skills/tree/5b60a950066113fbaad5fd183d91962b2b98dc4d/quick-build
  SKILL blob `718c0b2967cd09ab7877bc3a572b4f68dda8cf20`. PLAN, SPEC, DECISIONS and TICKET templates were fetched.
- **R12 — Execute Task Cycles:** https://github.com/devin-thomas/skills/blob/5b60a950066113fbaad5fd183d91962b2b98dc4d/execute-task-cycles/SKILL.md
  Blob `235b7debe23ba1ee91d9bfe1dafed63bab01b194`. Complete inner execute-task passes; no extra cycle-count interrogation.

## Host primary sources

- **H1 — Codex local skills:** https://developers.openai.com/codex/skills/ (redirected to https://learn.chatgpt.com/docs/build-skills).
  Local project and user `.agents/skills` routes; native discovery is distinct from copied files.
- **H2 — Claude Code skills:** https://code.claude.com/docs/en/skills.
  `.claude/skills` routes, support files, scoping, and separate cloud/Cowork behavior.
- **H3 — Cursor skills:** https://cursor.com/docs/skills.
  Shared and `.cursor` directories, compatibility discovery, and explicit user-global cloud-sync boundary.
- **H4 — Antigravity skills:** https://antigravity.google/docs/skills.
  Current `.agents/skills` default and legacy `.agent/skills` compatibility; multiple surfaces are distinguished.
  The fetched page did not establish a complete current global path table, so this pack does not invent one.
- **H5 — Antigravity CLI reference:** https://antigravity.google/docs/cli/reference.
  Documents `/skills` for inspecting loaded local/global skills; useful for the native qualification step.
- **H6 — Grok Bot skills:** https://docs.x.ai/grok-bot/skills-routines-and-automations.
  Native saved-skill library, slash selection, and skill/plugin management; no universal filesystem install path established.
- **H7 — Work with Grok Bot:** https://prod.cursor.com/docs/grok-bot/work.
  Native Bot context, shared execution computer, skills and plugin concepts.
- **H8 — Cursor plugin reference:** https://cursor.com/docs/reference/plugins.
  Documents Cursor plugin packaging. This is not, by itself, a Grok Bot import/API contract.
- **H9 — Agent Skills format:** https://agentskills.io/home.
  Portable SKILL.md directory format and supporting resources.
- **H10 — Grok CLI skills:** https://docs.x.ai/build/features/skills-plugins-marketplaces.
  Official xAI documentation lists project and user `.grok/skills`, plus Claude Code and user `.agents` compatibility.
- **H11 — User-supplied Grok Bot repository observation, October 3, 2026:** the user's Bot reported that repo work
  discovers `.agents/skills/<id>/SKILL.md` with supporting files. This is a direct report, not a public native test
  by this implementation and not an account-library installation contract.
- **H12 — User-supplied Grok Bot account-library report, October 3, 2026:** the user's Bot identified its execution
  computer library as `/home/box/agent-data/workflows/<skill-id>/SKILL.md`, with `scripts/`, `references/`, and
  `assets/` beside the entrypoint. It said Node's global modules are not scanned and proposed running a global npm
  install on that computer to copy complete skill directories into the library. This is a direct Bot report from a
  screenshot, not a public filesystem contract or confirmation that the Bot discovers this package's output.
- **H13 — User-supplied Grok Bot account-install diagnosis, October 3, 2026:** the Bot reported that
  `/home/box/agent-data` resolves to `/home/box/sand-data`, while `workflows` itself is an owned normal directory.
  It reported npm 11 requires `--allow-scripts=@uppercut-labs/skills` or an equivalent user npm config for postinstall.
  It also reported existing skills in the library and asked that exact byte matches be adopted into managed state
  without replacing differing files. This is a direct Bot report from a screenshot; native discovery remains to be
  verified after installation.
- **H14 — User-supplied `rc.1` Grok Bot attempt, October 3, 2026:** the Bot reported that global npm postinstall ran
  and accepted the physical library path, but `grill-to-build` differed from the bundled copy. The all-catalog add
  aborted, npm rolled back its package install, and no skill files changed. Doctor reached the library with an empty
  installed list; the Bot did not discover or invoke a skill. This screenshot is runtime feedback, not native acceptance.
- **H15 — User-supplied `rc.2` Grok Bot acceptance screenshots, October 3, 2026:** the Bot reported a successful
  global `0.1.0-rc.2` install. Doctor exited clean with `starter-pack` and `computer-setup` managed in
  `/home/box/sand-data/workflows`; pre-existing skills were left alone and `grill-to-build` remained unmanaged.
  The Bot then loaded and invoked `starter-pack` from that library. It located an existing Phase 2 progress file
  and private progress repository, recognized Computer Setup as complete, and did not start Quick Build without
  a request. The screenshot does not show a complete Starter Pack run, lifecycle update/remove, or other host checks.

## Limits

The audit read the named source files, manifests, templates, and targeted search results, not every file in every
upstream product repo. Public Git clone/download was unavailable in this runtime. No credentials were requested.
No native host, npm install, npm publish, or complete original-repository test suite was executed here.
The source-change helper is tested on isolated text fixtures; applying it to the real checkout is a separate check.
