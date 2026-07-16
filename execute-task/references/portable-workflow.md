# Portable Workflow

Use this workflow only when no canonical repository task execution prompt exists.

## 1. Preflight

1. Record reporting-clock start evidence.
2. Read all applicable `AGENTS.md`, `CODEX.md`, README files, context maps and glossaries, ADRs, implementation plans, task-source guidance, and Git/publishing policy.
3. Inspect the current branch, worktree status, remotes, and recent history when the workspace is a Git repository.
4. Record every pre-existing dirty path as protected. Do not overwrite, stage, revert, delete, or absorb those changes into the task.
5. Discover protected resources from instructions, ignore files, example environment files, and documentation. Never open a real credential file merely to discover variable names.
6. Inspect the source, tests, fixtures, and documentation relevant to candidate work before deciding implementation details.

## 2. Select one task

Use [task-sources.md](task-sources.md) to identify one authoritative task source and normalize its native facts without changing them.

1. If exactly one incomplete task is natively active or assigned to the current actor and its blockers are complete, resume it.
2. If several tasks are active or assigned to the current actor, report `Inconsistent State`; do not guess.
3. Otherwise form the executable frontier from autonomous incomplete tasks whose declared blockers are complete.
4. Exclude human-decision, approval-only, and review-only tasks unless the user explicitly selected one.
5. Order the frontier by:
   1. authoritative critical or security signals;
   2. declared plan or ticket order;
   3. stable task identifier.
6. Recognize priority only from native priority fields, repository-recognized labels, repository-defined title markers, or explicit plan declarations. Never infer it from prose or tone.
7. Select the first task and announce its identifier and goal before implementation.

If no task is executable, report the accurate terminal result: complete frontier, approval required, blocked dependency, or inconsistent source state. Make no implementation or lifecycle changes.

## 3. Establish authority and scope

Use this default authority order unless repository policy defines another:

1. Selected task scope, acceptance criteria, and authoritative comments.
2. Product contract, specification, and domain glossary.
3. Architecture decisions and implementation plan.
4. Repository instructions and Git/publishing policy.
5. Existing code and tests as the implementation baseline.

Own only the selected task. Implement the smallest complete vertical slice satisfying its criteria. Include necessary task-scoped prefactoring, tests, and documentation, but exclude successor work, speculative behavior, unrelated cleanup, and broad refactors not required by the task.

## 4. Apply native lifecycle updates

- Mutate only lifecycle concepts the task source already defines.
- Claim, assign, or mark active only when implementation actually begins and only when that native convention exists.
- If the source has checkboxes but no formal statuses, use its checkboxes; introduce no status vocabulary.
- If meaningful implementation began but cannot finish, preserve the native active state when one exists and record the reason. Do not invent a `Blocked` state.
- Treat `Complete`, `Incomplete`, `Blocked`, `Approval Required`, and `Inconsistent State` as execution results, not automatically as task states.

For a real tracker, update only the selected task. Do not mutate siblings, parents, labels, milestones, projects, dependencies, or releases unless repository policy explicitly requires it.

## 5. Implement and validate

1. Use acceptance criteria as the primary validation contract.
2. Discover checks from repository instructions, README files, package scripts, build configuration, and CI configuration.
3. Run focused checks after meaningful slices, then the complete applicable suite.
4. Treat a failing check or unintended skip as incomplete. Resolve task-owned causes when safe.
5. If no automated checks exist, perform the strongest available manual or static verification and disclose the testing gap. Do not invent a test framework merely to satisfy this workflow.
6. Do not hide failures with broad catches, skipped checks, destructive cleanup, or success-shaped fallbacks.

## 6. Protect private material

- Never print, quote, commit, or paste credentials or protected data into a task source.
- Prefer example environment files for variable names.
- Use credentials only through an already-approved runtime, connector, or code path required by the task.
- Inspect candidate and staged changes for credentials, private data, generated artifacts, unexpected binaries, caches, and unrelated paths.
- Stop and report when safe completion would require exposing or relocating protected material.

## 7. Prepare lifecycle reconciliation

After non-Git validation passes, determine where native completion is stored:

- For an external tracker, defer the Done/closed transition until after any required completion commit succeeds.
- For repository-local Markdown, update only the selected task and satisfied acceptance-criterion boxes now so the lifecycle edit can enter the task's completion commit. Preserve blocker text, ordering, and unrelated boxes. If the commit fails, the execution result remains Incomplete and the local task must not be represented as durably complete.
- Add completion evidence to a local file only when an existing repository convention requires it.

## 8. Complete through Git

Follow explicit repository Git policy first. When it is silent:

1. Do not initialize Git in a non-Git workspace.
2. Require all non-Git completion conditions to pass before committing.
3. Stage only exact task-owned paths; never use broad staging when unrelated or protected work could exist.
4. Inspect staged names and the staged patch, then run the repository's diff validation such as `git diff --cached --check`.
5. Create one non-empty task-scoped completion commit with a professional subject referencing the task identifier when available.
6. Verify the commit and ensure pre-existing dirty paths remain protected.
7. Never push, open a pull request, deploy, publish, or create a remote without explicit user, task, or repository authority.

If validation, staging, or commit verification fails, do not mark the task complete.

## 9. Reconcile the task source

After validation and any required completion commit succeed:

- Add concise implementation, changed-file, validation, commit, and risk evidence when the source supports notes or comments.
- Mark only the selected external task complete using its native mechanism.
- For local Markdown already included in the verified commit, confirm the committed lifecycle edit matches the selected task and actual acceptance evidence.
- If external finalization fails, preserve the verified repository commit, report the task-source inconsistency clearly, and do not conceal it with a success result.

Do not claim completion until repository and task-source state are consistent.

## 10. Report and stop

Report:

- Task identifier and title, or `None`.
- Execution result.
- Task source and resulting native state.
- Implemented outcomes.
- Exact validation commands or evidence, including failures and skips.
- Completion commit SHA and subject, or why none exists.
- Changed files.
- Task-source updates.
- Residual risks, blockers, or testing gaps.
- Start, end, and elapsed time from [reporting-clock.md](reporting-clock.md).

Do not start another task after reporting.
