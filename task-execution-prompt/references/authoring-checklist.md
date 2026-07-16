# Authoring Checklist

Use this checklist to separate discoverable facts from decisions. Inspect first; interview only for unresolved consequential choices.

## Repository and domain

- Applicable instruction-file hierarchy.
- Canonical domain terms from `CONTEXT-MAP.md` and `CONTEXT.md`.
- Relevant ADRs, product/spec authority, implementation plans, and existing code's role.
- Repository root, project surface, target branch, runtime, and validation environment.
- Existing runner, automation, preview, deployment, or publication conventions.

## Task source

- Linear project/team, GitHub repository/project, local Markdown path, or another documented source.
- How the repository proves that source is authoritative.
- Native task identity, lifecycle values, ownership, comments/notes, dependencies, priority fields, labels, and human gates.
- Parent/container/review tasks that must never be selected.
- Retry and authentication behavior for authoritative reads and writes.

Do not choose Linear because a connector exists or GitHub because a remote exists. If several task sources remain plausible after documentation search, ask.

## Selection

- Resume semantics for already-active or assigned work.
- Inconsistent-state behavior when several tasks are active.
- Definition of incomplete and executable.
- Blocker completion semantics, including whether canceled/superseded blockers count.
- Authoritative critical/security signals; never infer them from prose.
- Declared plan/ticket ordering and stable-identifier tie-breaker.
- Human-decision, approval-only, review-only, release, or final-gate exclusions.
- Empty-frontier and blocked-frontier terminal outcomes.

Every generated prompt must derive selection from fresh state and must not hard-code the current next task.

## Authority and scope

- Selected task versus product contract, domain glossary, ADRs, plans, repository instructions, and existing code.
- Smallest complete vertical slice and permitted task-scoped prefactoring.
- Explicit exclusions: siblings, successors, speculative features, unrelated cleanup, broad refactors, release work, and publication.

## Lifecycle and external writes

- When claiming, assigning, or moving active state occurs.
- Completion prerequisites and when native Done/closed/checkmark updates occur.
- Behavior after meaningful but incomplete work.
- Selected-task comments or evidence.
- Parent bookkeeping, labels, milestones, blocker links, and project updates only when explicitly required.
- Absence of formal statuses: do not invent any.

Keep execution-result vocabulary separate from persisted task state.

## Validation and completion

- Acceptance criteria as public verification seams.
- Focused and full checks, interpreter/runtime choice, dependency setup, test temp paths, live-test boundaries, and expected skips.
- Required reviews, previews, deployments, or credentialed checks.
- Documentation updates and completion evidence.
- Failure behavior: never call a task complete with failing or unintentionally skipped required checks.

## Git and publishing

- Dirty-worktree protection and staged-index policy.
- Whether a completion commit is required and its subject convention.
- Exact-path staging, staged-diff inspection, secret scanning, and commit verification.
- Push, pull request, deployment, release, or publication authority and order.
- Bootstrap behavior when Git or a remote does not exist.

Do not let a generated prompt silently broaden publishing authority.

## Protected resources

- Credentials, environment files, token caches, private datasets, certificates, ROMs, binaries, generated outputs, local databases, logs, and user-global state.
- Allowed access path, approved runtime use, integrity/hash requirements, ignore rules, and reporting restrictions.
- Example files that may reveal variable names without exposing values.

## Reporting clock and terminal report

- Resolve the reporting zone from an explicit prompt rule, repository policy, or user preference first; otherwise query the OS-native setting. Never infer it from locale, language, IP/geolocation, assistant defaults, or repository location.
- On Windows, use `Get-TimeZone` with OS local and UTC clocks. On Linux, use `timedatectl` when available and corroborate it with `/etc/localtime` or `/etc/timezone`. On macOS, use the system zone setting and corroborate it with `/etc/localtime`. Do not require elevation merely to name the zone.
- Capture the identifier and source, local ISO-8601 timestamp with numeric offset, UTC timestamp, and offset at start. Cross-check them against the OS clock.
- Re-resolve at end for daylight-saving or configuration changes. Calculate elapsed time from UTC instants or a monotonic clock, not local display values.
- Treat failed queries, missing identifiers, disagreement, offset mismatch, fixed-offset-only resolution, or unexpected zone changes as anomalous. Do not interrupt implementation; report verified numeric-offset timestamps and ask `Which named time zone should future task reports use?` in the final report.
- Required fields: selected task, execution result, native state, outcomes, exact validation, commit, changed files, task-source updates, residual risks, and failures/skips.
- Final stop instruction.

## Prompt destination and invocation

- Existing canonical prompt or repository documentation convention.
- Default `docs/agents/TASK-EXECUTION-PROMPT.md` only when no convention exists.
- Autostart behavior when the file is referenced or supplied without additional task text.
