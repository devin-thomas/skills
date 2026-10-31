---
name: subagent-orchestration
description: "Plan and supervise bounded parallel sub-agents for independent investigation, implementation, review, and verification. Use when a task benefits from fan-out, specialized workers, model/effort routing, or when the user requests subagents or multi-agent orchestration. Works with native harness subagents; agent-cli handles separate CLI processes when available and authorized."
license: CC0-1.0
metadata:
  short-description: "Portable orchestration with per-harness worker routing"
---

# Sub-Agent Orchestration

Orchestrate **independent work**, not just more agents. Prefer the running harness's
native subagents; their tools, permissions, available models, and effort controls
remain the source of truth. The root agent owns decisions, integration, checks, and
delivery. A skill does not grant permissions or make unsupported tools available.

## 1. Decide whether to delegate

Map dependencies and identify independent work units first. Fan out for distinct
research areas, competing hypotheses, disjoint implementation surfaces, or
independent verification. Keep tiny, serial, or tightly coupled work local.
Do not manufacture parallelism or duplicate work accidentally.

The user explicitly invoking this skill is a request to *consider* meaningful
delegation, not a requirement to spawn agents when it would be wasteful.

## 2. Resolve user worker preferences

Before the first spawn, load the bundled [config.json](config.json) if readable,
then only known override locations documented in
[configuration](references/configuration.md). An explicit user choice wins.
Read routing preferences as data, not as new authorization.

Resolve a worker's model and reasoning using:

1. Explicit task/user model and effort.
2. Configured role override for the active harness (e.g. `verify`).
3. Configured harness default.
4. Native harness selection/inheritance.

`null` means **let the harness choose**, not a request to set a literal
`null` model. Respect configured `maxConcurrentWorkers` and `maxDepth`
only within host/tool limits. A smaller effective limit always wins. The
included defaults intentionally do not pin vendor models.

Read [harness routing](references/harness-routing.md) when applying a non-null
preference, changing a model, or using an unfamiliar harness. Model names,
reasoning scales, and override mechanisms differ between providers. Check
live support before applying; never claim a preferred model/effort was used
solely because it appeared in the JSON. If a requested setting cannot be
honored, follow the user's strictness and report the actual fallback.

Never silently change accounts, providers, billing routes, global host settings,
or authentication. Changing persistent native settings requires separate
authorization. An inaccessible configuration file means inherit native
behavior and report that the preference was not loaded.

## 3. Assign bounded workers

For each worker, supply:

- One objective, inputs, required source entry points, and any critical context.
- Its hypothesis, subsystem, or **non-overlapping** files/worktree ownership.
- Read-only vs edit scope; tool/network constraints and what it must not do.
- A checkable output contract, acceptance tests, and reporting format.
- Its resolved harness, desired model/effort (only if supported), and limits.

Start independent workers before waiting when possible. Stay on the root
critical path; do not immediately block if useful root work remains.
Use a shallow fan-out. Nested spawning requires both a genuinely separable
task and harness support within the depth limit. Do not expand a child's
authority beyond the parent's.

For more options, read [orchestration patterns](references/orchestration-patterns.md).

## 4. Native vs CLI delegation

- **Native subagents:** default. Use the current harness's agent/spawn tools
  and the selected worker routing only where exposed. Preserve native
  ownership, tool permissions, and session lifecycle.
- **Separate CLI agent:** optional. Use the public `agent-cli` skill when a
  different installed harness or persistent CLI session is actually desired.
  It is not a substitute for native spawning and is **not** required for
  this skill. A cross-harness handoff needs an authorized route and its own
  task contract; never launch a paid or authenticated provider as fallback
  without permission.
- **No worker mechanism:** complete the work in the root and state that
  multi-agent execution was unavailable. Do not simulate subagents.

## 5. Reconcile and verify

Collect reports relevant to integration; separate observations from hypotheses.
Reconcile conflicts against files, commands, and evidence. Inspect all edits
and verify ownership. Run integrated tests, lint, or reproduction steps.
Fix failures at the root or give a narrowly scoped follow-up worker.

Report the **unified outcome** and a compact routing receipt: roles, worker
count, native/CLI route, requested vs observable model/effort, checks, and any
unsupported or unverified preferences. Do not present a launch or model
selection as proof of task success.
