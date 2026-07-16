# Prompt Template

Adapt this structure to the repository. Remove irrelevant sections and replace every placeholder with verified facts or approved policy. Keep the prompt self-contained and concise enough to reread on every execution pass.

````markdown
# <Project> Task Execution Loop

## Autostart Instruction

When this file is referenced or supplied without additional task text, execute the embedded workflow immediately. Do not ask for a task identifier or provide a plan instead of beginning. Read fresh repository and task-source state, mechanically select or resume one executable task, complete exactly one bounded task pass, record a terminal result, and stop. Ask only when a real ambiguity or required decision cannot be resolved from authoritative sources.

## Prompt

```text
Complete exactly one next executable task for <project>.

Repository: <root or current repository root>
Task source of truth: <source and scope>
Target branch: <branch or repository policy>

Do not ask for a task identifier. Resolve one task from fresh authoritative state, complete only that task, record the result, and stop.

Before changing anything:

1. Record start-time evidence using <reporting-clock policy>.
2. Read <applicable instructions, context, ADRs, plans, tracker guidance, and task documents>.
3. Inspect <Git and protected-work preflight>.
4. Read <authoritative task-source state and retry/authentication behavior>.
5. Inspect code, tests, fixtures, and documentation relevant to candidate work.

Select the task mechanically:

1. <Resume exactly one native active/owned task when executable.>
2. <Report inconsistent state for multiple active/owned tasks.>
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
- <Project-specific technical and product rules.>
- <Validation sequence and environment.>
- <Protected-resource and private-data constraints.>
- <Dirty-worktree and non-destructive-editing constraints.>
- Do not implement siblings, successors, speculative work, or unrelated cleanup.

Completion gate:

Mark the task complete only when <acceptance, validation, documentation, review, preview/deployment if applicable, Git, and task-source reconciliation conditions> all pass.

If required validation fails or is skipped, do not claim success. Preserve native active state when work began, record the exact evidence, and stop after an Incomplete or Blocked execution result. Do not invent a task-source status.

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
4. Stop. Do not start another task.
```

## Selection Invariant

No current task identifier is hard-coded in this prompt. Resolve the selected task from fresh authoritative state on every pass, preserve existing work, and stop after one task-level result.
````

## Template rules

- Preserve the structure's behavior, not its placeholder wording.
- Use the repository's canonical domain and lifecycle vocabulary.
- Include project-specific rules only when repository evidence or approved decisions justify them.
- Put commands and paths in the prompt only when stable and authoritative.
- Make completion ordering internally consistent, especially when a local task-file update must be included in a completion commit.
- State external-write authority explicitly; silence must not imply permission to push, deploy, publish, or reorganize trackers.
