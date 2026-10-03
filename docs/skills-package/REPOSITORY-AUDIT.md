# Repository audit and targeted fixes

Snapshot: `devin-thomas/skills` main commit `5b60a950066113fbaad5fd183d91962b2b98dc4d`, read October 3, 2026.
This is a focused source audit, not an execution of every skill. Source references are in [SOURCES](SOURCES.md).

## Reuse, do not rebuild

The repository now has `manifest/skills.json`, its schema, manifest documentation, and validation integration.
The manifest contains 15 owned records. Twelve point to local skill directories; Starter Pack, Computer Setup,
and VidChopper CLI remain sourced from their product/curriculum repositories. Dependencies are already modeled
for execute-task-cycles and surface-sweep-showcase. `relatedSkills` must not become an install dependency list. [R2, R3]

Do not duplicate this catalog in `catalog.json`, hard-code a second list inside the CLI, or move every root-level
skill into a new hierarchy merely for packaging. Extend distribution policy separately and compile from the canonical data.

## Supplied source changes

The `repo-fixes/` change set targets five files:

1. `AGENTS.md`: replace ambiguous "install dependencies explicitly" maintenance wording with automatic required-skill
   inclusion, no dependency confirmation, and a clear distinction from external applications/credentials.
2. `README.md`: remove Codex-only onboarding as the only install example; explain host-aware installation and automatic
   paired skills without claiming the new npm command already exists.
3. `execute-task/SKILL.md`: discover the active host's applicable instructions and rules, rather than only AGENTS/CODEX.
4. `task-execution-prompt/SKILL.md`: the same scoped instruction discovery fix for prompt authoring.
5. `execute-task/references/portable-workflow.md`: the same fix for the portable preflight.

These changes preserve trigger conservatism, task-cycle limits, reporting-clock policy, task selection, Git authority,
and all skill completion contracts. They do not convert prompts to host-specific variants or add new private data.
The additive `docs/host-compatibility.md` documents researched paths and unperformed native qualification.

## Remaining implementation audit

Check every distributed entry point and its complete support-file graph. Preserve references, scripts, templates,
assets, README files when referenced, and optional agent metadata. Keep install discovery and invocation verification
separate. Audit external owned entries' relative paths at their pinned revisions: their current SKILL.md path is not
proof every required supporting file is in the same directory. Preserve the upstream source of truth.

Keep required resources within approved public source roots; make any broader mount explicit. Do not silently drop
an essential resource because it lives above the entry directory, and do not include a whole product repository to
avoid doing the closure work. Correct canonical relative references or declare a reviewed resource mount and source map.

Do not interpret the user's Matt Pocock example as permission to vendor his skills. Do not auto-install optional
model/connector tooling. Do not remove existing optional OpenAI metadata solely to make other hosts work. [R1, R4]

## Publication gate

The README states there is no collection-wide LICENSE selection. Package code, authored prompts, adapted resources,
and referenced owned product skills need an explicit redistribution policy. Preserve existing notices and source revisions.
This pack does not choose a license for Devin and does not authorize publication. [R1]
