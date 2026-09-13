---
name: execute-task
description: Complete exactly one next executable repository task in a bounded pass. Use only when the user explicitly invokes `/execute-task`, explicitly asks to select and execute one next task/ticket/issue, explicitly supplies a TASK-EXECUTION-PROMPT.md for execution, or clearly requests one task pass from Linear, GitHub Issues, or repository-local Markdown. Do not trigger for generic continuation language such as "continue from here," "resume," or "follow the handoff," nor for ordinary implementation work already scoped by the conversation. If the request explicitly asks for multiple tasks, repeated execution, a loop, or completion of a backlog/project, delegate to execute-task-cycles. Prefer a repository's canonical task execution prompt when one exists; otherwise use the portable workflow.
---

# Execute Task

Complete one task-level pass from fresh repository and task-source state, record a terminal execution result, and stop.

## Trigger conservatively

Enter this workflow only when the user clearly asks for one repository task to be selected and executed. Generic continuation or handoff phrases alone do not invoke this skill. When the user says `continue from here`, `resume`, `keep going`, or `follow the handoff`, continue the already scoped work through the standard agent workflow unless the request separately contains an explicit task-selection signal.

Do not infer task execution merely because a handoff mentions a tracker issue, a task connector is installed, or repository task files exist.

## Delegate cycle requests

Before reading task-source state or beginning a task pass, inspect the user's request for an explicit repetition signal: `max_cycles`, a positive cycle count, "N times", "next N tasks", "repeatedly", "in a loop", "all remaining tasks", "until the project is complete", or equivalent wording. When the request clearly asks for more than one pass:

- Hand off to `execute-task-cycles`, preserving any user-supplied maximum and all task-source, repository, or canonical-prompt context.
- When the user does not supply a valid positive maximum, let `execute-task-cycles` apply its default of `100` without asking the user to confirm a number.
- Do not execute a single task, choose a task, or reinterpret the request as one pass before handing off.

Only continue with this skill's one-pass workflow when the user explicitly requests one task. If there is neither an explicit one-task request nor a clear multi-task repetition signal, do not use either task-execution skill.

## Preserve the outer invariants

- Obey higher-level user, repository, and safety instructions.
- Perform exactly one bounded task pass.
- Preserve pre-existing work and protected resources.
- Stop and report an irreconcilable conflict instead of weakening these boundaries.

Treat a canonical repository prompt as repository policy within these boundaries. Aim to invoke it faithfully, not reinterpret it through the portable workflow.

## Resolve the reporting clock

Use `America/Chicago` for every reporting-clock timestamp. Never ask the user for their time zone, offer a time-zone choice, or pause execution because of time-zone information. Change this setting only when the user explicitly initiates a conversation requesting a different time zone.

Capture start evidence before task selection and include start/end/elapsed evidence in the final report.

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
