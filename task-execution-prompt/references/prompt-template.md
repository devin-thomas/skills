# Prompt Template

Adapt this structure to the repository. Remove irrelevant sections and replace every placeholder with verified facts or approved policy. Keep the prompt self-contained and concise enough to reread on every execution pass.

````markdown
# <Project> Task Execution Loop

## Autostart Instruction

When this file is referenced or supplied without additional task text, execute the embedded workflow immediately. Do not ask for a task identifier or provide a plan instead of beginning. Read fresh repository and task-source state, mechanically select or resume one executable task, complete the selected task through repair and verification, record its result, and continue within the user-authorized run. Ask only when a real ambiguity or required decision cannot be resolved from authoritative sources.

## Prompt

```text
Complete the user-authorized task or backlog scope for <project>, one verified task at a time.

Repository: <root or current repository root>
Task source of truth: <source and scope>
Target branch: <branch or repository policy>

Do not ask for a task identifier. Resolve one task from fresh authoritative state, complete that task, record the result, and return to the authorized run controller.

Before changing anything:

1. Record start-time evidence using <reporting-clock policy>.
2. Read <applicable instructions, GLOSSARY-MAP.md and mapped GLOSSARY.md files, PROJECT.md if present, ADRs, plans, tracker guidance, and task documents; check unresolved legacy context migration>.
3. Inspect <Git and protected-work preflight>.
4. Read <authoritative task-source state and retry/authentication behavior>.
5. Inspect code, tests, fixtures, and documentation relevant to candidate work.

Select the task mechanically:

1. <Apply the current request's scope; resume its executable native active/owned task.>
2. <Resolve several in-scope candidates through explicit user selection or authoritative plan order; report inconsistency only when that evidence cannot resolve the choice.>
3. <Form the autonomous executable frontier from native incomplete state and blockers.>
4. <Exclude human/review/final-gate work.>
5. <Order authoritative critical/security work first, then declared plan order, then stable identifier.>
6. <Define empty, approval-required, blocked, and inconsistent outcomes.>
7. Read the selected task, blockers, comments, and acceptance criteria completely.
8. Announce the selected task and goal before implementation.

<Define native claim/active transition only if the task source supports it.>

Authority order:

1. <Selected task scope and acceptance criteria.>
2. <Product/specification and domain language.>
3. <ADRs and implementation plan.>
4. <Repository/Git policy.>
5. <Existing code and tests.>

Execution rules:

- Own only the selected task and implement the smallest complete vertical slice.
- Work through normal debugging, dependency setup, retries, review fixes and reversible recovery within the user's existing authorization. One task is a scope boundary, not an attempt limit.
- Apply the current request and prior approvals before treating a procedural checkpoint or historical note as a new permission requirement.
- <Project-specific technical and product rules.>
- <Validation sequence and environment.>
- <Protected-resource and private-data constraints.>
- <Dirty-worktree and non-destructive-editing constraints.>
- Do not implement siblings, successors, speculative work, or unrelated cleanup.

Completion gate:

Mark the task complete only when <acceptance, validation, documentation, review, preview/deployment if applicable, Git, and task-source reconciliation conditions> all pass.

If required validation fails or is skipped, investigate, fix and rerun affected checks within the task. Preserve native active state while working and record relevant failures honestly. Report terminal Incomplete or Blocked only when reasonable authorized recovery cannot make further progress. Never mark incomplete work done or invent a task-source status.

Git and publication:

- <Exact staging, commit subject, verification, push/PR/deployment/publish policy.>
- <For local Markdown, place the verified completion checkbox update in the task commit; for external trackers, finalize native completion only after the required commit succeeds.>

At the end:

1. Capture end-time evidence and elapsed time.
2. <Update only the selected task using native lifecycle and evidence mechanisms.>
3. Report:
   - Task and execution result.
   - Task source and native state.
   - Implemented outcomes.
   - Exact validation, including failures and skips.
   - Commit and publication result.
   - Changed files.
   - Task-source updates.
   - Residual risks or blockers.
   - Start, end, and elapsed time.
4. End the selected task's pass. For an explicitly requested multi-task run, return the verified result to its controller and continue until the requested completed count, scope completion, or a human blocker prevents all useful authorized progress; otherwise stop without taking unrelated work.
```

## Selection Invariant

No current task identifier is hard-coded in this prompt. Resolve the selected task from fresh authoritative state on every pass, preserve existing work, and return each task-level result to the authorized controller.
````

## Template rules

- Preserve the structure's behavior, not its placeholder wording.
- Make procedural guidance support the user's intent and ordinary autonomy. Distinguish recoverable failures from actual stopping conditions, and existing permission from a genuinely new decision.
- Use the repository's canonical domain and lifecycle vocabulary.
- Include project-specific rules only when repository evidence or approved decisions justify them.
- Put commands and paths in the prompt only when stable and authoritative.
- Make completion ordering internally consistent, especially when a local task-file update must be included in a completion commit.
- State external-write authority explicitly; silence must not imply permission to push, deploy, publish, or reorganize trackers.

## AFK recovery and notifications

Diagnose and repair automatically within existing authority. Ask asynchronously only for a material owner decision or unavailable access that cannot be recovered. Notify through an authorized configured channel and continue independent preparation or another authorized ready task while waiting. Preserve blocked items and revisit them after an answer; elapsed time is never approval. End the run only when its explicit limit or scope is complete, the user stops it, or all remaining useful work genuinely depends on the owner.
