---
name: execute-task
description: Complete exactly one next executable repository task in a bounded pass. Use when the user invokes `/execute-task`, asks to execute or complete the next task, ticket, or issue, supplies a TASK-EXECUTION-PROMPT.md, or wants one implementation pass from Linear, GitHub Issues, or repository-local Markdown. If the request asks for repeated cycles or a cycle count, delegate to execute-task-cycles. Prefer a repository's canonical task execution prompt when one exists; otherwise use the portable workflow.
---

# Execute Task

Complete one task-level pass from fresh repository and task-source state, record a terminal execution result, and stop.

## Delegate cycle requests

Before reading task-source state or beginning a task pass, inspect the user's request for an explicit repetition signal: `max_cycles`, a positive cycle count, "N times", "next N tasks", "repeatedly", or equivalent wording. When the request clearly asks for more than one pass:

- Hand off to `execute-task-cycles`, preserving the user's requested maximum and any task-source, repository, or canonical-prompt context.
- Let `execute-task-cycles` validate the maximum and control all subsequent passes.
- Do not execute a single task, choose a task, or reinterpret the request as one pass before handing off.
- If the repetition count is missing, invalid, zero, negative, or ambiguous, let `execute-task-cycles` report the invalid invocation without starting task work.

Only continue with this skill's one-pass workflow when the user requests one task or the request contains no clear repetition signal.

## Preserve the outer invariants

- Obey higher-level user, repository, and safety instructions.
- Perform exactly one bounded task pass.
- Preserve pre-existing work and protected resources.
- Stop and report an irreconcilable conflict instead of weakening these boundaries.

Treat a canonical repository prompt as repository policy within these boundaries. Aim to invoke it faithfully, not reinterpret it through the portable workflow.

## Resolve the reporting clock

Read [references/reporting-clock.md](references/reporting-clock.md). Capture the start evidence before task selection. A time-zone anomaly must not interrupt implementation; handle it in the final report as specified there.

## Discover a canonical prompt

Resolve `TASK-EXECUTION-PROMPT.md` in this order:

1. Use a path explicitly supplied by the user.
2. Read every applicable `AGENTS.md` and `CODEX.md`; use a prompt they designate.
3. Search the repository for exact filename matches. Prefer `rg --files -g TASK-EXECUTION-PROMPT.md` when available.
4. If multiple matches remain, search README files, runner documentation, implementation plans, agent documentation, and other repository docs for canonical-path or source-of-truth guidance.
5. Ask the user only when repository documentation cannot resolve multiple plausible canonical prompts.
6. If no prompt exists, use the portable workflow.

Read the resolved prompt completely before acting. If it embeds a prompt or autostart instruction, treat the current invocation as the request to execute it. Do not ask for a task ID or restate a plan when the prompt says to select and begin automatically.

If the canonical prompt requires more than one task pass or conflicts with a higher-level boundary, report the exact conflict and stop. Do not silently substitute portable policy.

## Run the portable workflow

When no canonical prompt exists:

1. Read [references/portable-workflow.md](references/portable-workflow.md) completely.
2. Read [references/task-sources.md](references/task-sources.md) completely, select one authoritative source, and use only the relevant source procedure.
3. Read current repository instructions, domain context, architecture decisions, plans, relevant source and tests, and Git state before selecting work.
4. Execute the portable workflow through one terminal result.

Do not select a tracker merely because its connector is installed or a Git remote exists. Do not invent a task source, lifecycle vocabulary, priority, or task identifier.

## Finish once

Apply either the canonical prompt's report contract or the portable report contract. Report execution result separately from persisted task state. Include failed or skipped validation clearly. Stop after reporting; do not begin a sibling, successor, review task, or adjacent cleanup.
