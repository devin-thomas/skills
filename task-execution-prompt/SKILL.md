---
name: task-execution-prompt
description: Create or revise a repository-specific TASK-EXECUTION-PROMPT.md for autonomous, scope-aware agent execution. Use when the user invokes `/task-execution-prompt`, wants a repeatable task execution loop, needs an AFK workflow or wants to customize how agents select and complete Linear, GitHub, or Markdown tickets, or has finished planning/spec/ticket workflows and wants a bounded implementation prompt.
---

# Task Execution Prompt

Design or revise a self-contained repository workflow contract from the user's intent and existing decisions, write the canonical prompt, and validate it through a read-only preflight rehearsal.

Do not execute an implementation task while authoring or rehearsing the prompt.

## Autonomous progress and human blockers

Automatic diagnosis, repair, and verification are the default. Carry forward the user's existing authorization. Resolve routine dependency, environment, implementation, validation, Git and transient service failures without a new confirmation. Retry with evidence and a changed approach; reconcile uncertain writes before repeating them.

A human blocker is a material owner decision, unavailable permission or credential that cannot be recovered through authorized means, or a protected/destructive boundary outside the task. Ask a concise actionable question through the available asynchronous input surface and send an authorized owner notification when a configured route exists. Missing optional notification tooling is work to repair or route around, not a reason to abandon the task. Respect message recipients and transport authorization.

While an answer is pending, preserve the blocked task and continue authorized independent investigation, preparation, repairs, or other ready backlog tasks. Record dependencies and return to the blocked item when the answer arrives. Never infer approval from elapsed time. Do not consume the run in repeated slow question waits, and do not report the whole workflow blocked while useful authorized work remains. Stop only at an explicit user/resource limit, completion of the authorized scope, or when every remaining useful action depends on a genuine human blocker. Record unfinished work honestly.


## 1. Inspect before interviewing

Read [references/authoring-checklist.md](references/authoring-checklist.md) completely.

Discover facts from the repository and configured task source before asking questions:

- the active host's applicable repository instructions and enabled rules, including scoped `AGENTS.md`, `CLAUDE.md`, documented host rule files, and repository-designated instruction files such as `CODEX.md` when applicable; preserve host scope and precedence;
- README and agent/runner documentation;
- `GLOSSARY-MAP.md` and all applicable `GLOSSARY.md` files, plus `PROJECT.md` where present; inspect legacy `CONTEXT-MAP.md`, `CONTEXT.md`, or `Context.md` only to identify unmigrated projects;
- relevant ADRs, product contracts, specifications, and implementation plans;
- tracker guidance, local ticket conventions, and current task-source state;
- Git, commit, branch, push, PR, deployment, and publishing policy;
- build, test, lint, type-check, CI, and runtime configuration;
- ignore rules, example environment files, and protected-resource guidance;
- an existing canonical task execution prompt when revising one.

Use canonical domain vocabulary from repository context. When several prompt copies exist, search documentation for source-of-truth guidance before asking which one is canonical.

Keep authoring notes temporary or outside the repository unless the user explicitly requests a repository artifact.

## 2. Resolve only decisions

Ask only consequential questions whose answers cannot be discovered. Ask concise consequential questions through asynchronous input when available; continue independent authoring while the decision is pending. Wait only for work that depends on that decision.

At minimum resolve the checklist's task source, selection, lifecycle, authority, validation, Git/publishing, protected resources, failure outcomes, reporting, and time-zone decisions. Do not ask the user to restate facts already present in repository context or task-source configuration.

Sharpen ambiguous terms against the applicable `GLOSSARY.md`. If only a legacy `CONTEXT.md` or `Context.md` exists, flag migration before generating a parallel glossary. Preserve the task source's native vocabulary; do not introduce statuses, labels, or priority semantics merely to make the prompt uniform.

## 3. Resolve remaining authoring decisions

After resolving material ambiguities, present one concise synthesized contract covering:

- task source and canonical project/repository;
- deterministic selection and critical/security priority signals;
- human gates and native lifecycle mutations;
- authority order and one-task scope;
- validation and completion gate;
- commit, push, PR, deployment, and publishing behavior;
- protected resources and private-data boundaries;
- terminal results, reporting fields, and reporting clock.

Use decisions and authorization already supplied by the user. An explicit request to create or revise the prompt authorizes reversible drafting; make the result concrete and reviewable. Ask only for a consequential policy choice that remains unresolved, explaining its source and effect. Do not add a mandatory approval checkpoint or repeat a confirmation solely because this workflow lists one.

## 4. Choose the destination

Resolve the output path in this order:

1. Update the existing canonical prompt when the user is revising it.
2. Honor an explicit destination.
3. Follow an established repository agent-documentation convention.
4. Otherwise create `docs/agents/TASK-EXECUTION-PROMPT.md`.

Do not create auxiliary README, notes, or changelog files beside the prompt.

## 5. Write the prompt

Read [references/prompt-template.md](references/prompt-template.md) completely. Adapt the template to repository facts and approved decisions.

Generate a self-contained prompt. Do not require installation of `execute-task` or any sibling skill. Do not embed the identifier of whichever task happens to be next today. Do not copy personal paths, project IDs, labels, time zones, commands, or safety rules from examples unless they are authoritative for the target repository.

When revising an existing prompt, preserve sound project-specific rules and make the smallest coherent change. Present the resulting diff.

## 6. Rehearse without executing

Read [references/preflight-rehearsal.md](references/preflight-rehearsal.md) completely and perform the rehearsal.

The rehearsal may read repository, Git, documentation, and task-source state. It must not claim or assign a task, change lifecycle state, add tracker comments, edit implementation files, stage, commit, push, open a PR, deploy, publish, or begin the selected task.

Report the predicted task or terminal state, the evidence that made selection deterministic, validation of the prompt structure, and any remaining ambiguity. If rehearsal exposes a defect, revise the prompt, show the new diff, and repeat the rehearsal.
