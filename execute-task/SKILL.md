---
name: execute-task
description: Complete a selected repository task through automatic repair, verification and authorized delivery. Use only when the user explicitly invokes `/execute-task`, explicitly asks to select and execute one next task/ticket/issue, explicitly supplies a TASK-EXECUTION-PROMPT.md for execution, or clearly requests one task pass from Linear, GitHub Issues, or repository-local Markdown. Do not trigger for generic continuation language such as "continue from here," "resume," or "follow the handoff," nor for ordinary implementation work already scoped by the conversation. If the request explicitly asks for multiple tasks, repeated execution, a loop, or completion of a backlog/project, delegate to execute-task-cycles. Prefer a repository's canonical task execution prompt when one exists; otherwise use the portable workflow.
---

# Execute Task

Complete one selected task from fresh repository and task-source state. Work through implementation, diagnosis, repair, verification and authorized delivery before reporting its result. One task means one scope, not one attempt.

## Autonomous progress and human blockers

Automatic diagnosis, repair, and verification are the default. Carry forward the user's existing authorization. Resolve routine dependency, environment, implementation, validation, Git and transient service failures without a new confirmation. Retry with evidence and a changed approach; reconcile uncertain writes before repeating them.

A human blocker is a material owner decision, unavailable permission or credential that cannot be recovered through authorized means, or a protected/destructive boundary outside the task. Ask a concise actionable question through the available asynchronous input surface and send an authorized owner notification when a configured route exists. Missing optional notification tooling is work to repair or route around, not a reason to abandon the task. Respect message recipients and transport authorization.

While an answer is pending, preserve the blocked task and continue authorized independent investigation, preparation, repairs, or other ready backlog tasks. Record dependencies and return to the blocked item when the answer arrives. Never infer approval from elapsed time. Do not consume the run in repeated slow question waits, and do not report the whole workflow blocked while useful authorized work remains. Stop only at an explicit user/resource limit, completion of the authorized scope, or when every remaining useful action depends on a genuine human blocker. Record unfinished work honestly.


## Trigger conservatively

Enter this workflow only when the user clearly asks for one repository task to be selected and executed. Generic continuation or handoff phrases alone do not invoke this skill. When the user says `continue from here`, `resume`, `keep going`, or `follow the handoff`, continue the already scoped work through the standard agent workflow unless the request separately contains an explicit task-selection signal.

Do not infer task execution merely because a handoff mentions a tracker issue, a task connector is installed, or repository task files exist.

## Delegate cycle requests

Before reading task-source state or beginning a task pass, inspect the user's request for an explicit repetition signal: `max_cycles`, a positive cycle count, "N times", "next N tasks", "repeatedly", "in a loop", "all remaining tasks", "until the project is complete", or equivalent wording. When the request clearly asks for more than one pass:

- Hand off to `execute-task-cycles`, preserving any user-supplied maximum and all task-source, repository, or canonical-prompt context.
- When the user does not supply a valid positive maximum, let `execute-task-cycles` continue to the authorized scope endpoint without asking for a number.
- Do not execute a single task, choose a task, or reinterpret the request as one pass before handing off.

Only continue with this skill's one-pass workflow when the user explicitly requests one task. If there is neither an explicit one-task request nor a clear multi-task repetition signal, do not use either task-execution skill.

## Preserve the outer invariants

- Obey higher-level user, repository, and safety instructions.
- Keep the selected task as the unit of ownership and verified completion; repair attempts are part of that task.
- Preserve pre-existing work and protected resources.
- Stop and report an irreconcilable conflict instead of weakening these boundaries.

Follow the user's current intent and existing authorization when applying workflow instructions. Use judgment for routine implementation choices, dependency setup, debugging, retries and reversible recovery. A failed test, review finding or transient tool error normally calls for diagnosis and repair within the task, not an immediate handoff or permission request. Report a task-level human dependency when needed; continue independent preparation, and return it to an authorized backlog controller so other ready work proceeds.

Use a canonical repository prompt for project-specific policy and task selection. Preserve real constraints while interpreting procedural steps in context; historical examples and intermediate failure labels must not override the user's current direction. Do not replace the canonical workflow with portable defaults merely for convenience.

## Resolve the reporting clock

Use `America/Chicago` for every reporting-clock timestamp. Never ask the user for their time zone, offer a time-zone choice, or pause execution because of time-zone information. Change this setting only when the user explicitly initiates a conversation requesting a different time zone.

Capture start evidence before task selection and include start/end/elapsed evidence in the final report.

## Discover a canonical prompt

Resolve `TASK-EXECUTION-PROMPT.md` in this order:

1. Use a path explicitly supplied by the user.
2. Read the active host's applicable repository instructions and enabled rules; use a prompt they designate. Include scoped `AGENTS.md`, `CLAUDE.md`, documented host rule files, and any repository-designated instruction files such as `CODEX.md` when applicable. Respect the host's scope and precedence; do not assume every host automatically loads every filename.
3. Search the repository for exact filename matches. Prefer `rg --files -g TASK-EXECUTION-PROMPT.md` when available.
4. If multiple matches remain, search README files, runner documentation, implementation plans, agent documentation, and other repository docs for canonical-path or source-of-truth guidance.
5. Ask the user only when repository documentation cannot resolve multiple plausible canonical prompts.
6. If no prompt exists, use the portable workflow.

Read the resolved prompt completely before acting. If it embeds a prompt or autostart instruction, treat the current invocation as the request to execute it. Do not ask for a task ID or restate a plan when the prompt says to select and begin automatically.

Apply the current user-authorized scope when a canonical prompt assumes a different task count or earlier scope. Use `execute-task-cycles` for an authorized multi-task request. Resolve apparent procedural conflicts from the conversation and repository evidence; ask only when a consequential decision remains unresolved. Report an actual irreconcilable conflict with its exact source.

## Run the portable workflow

When no canonical prompt exists:

1. Read [references/portable-workflow.md](references/portable-workflow.md) completely.
2. Read [references/task-sources.md](references/task-sources.md) completely, select one authoritative source, and use only the relevant source procedure.
3. Read current repository instructions, the applicable `GLOSSARY.md` files (follow `GLOSSARY-MAP.md` if present), `PROJECT.md` when available, architecture decisions, plans, relevant source and tests, and Git state before selecting work. Do not automatically turn an unrelated `CONTEXT.md` task brief into a glossary.
4. Execute the portable workflow through one terminal result.

Do not select a tracker merely because its connector is installed or a Git remote exists. Do not invent a task source, lifecycle vocabulary, priority, or task identifier.

## Finish once

Apply either the canonical prompt's report contract or the portable report contract after completing the task or exhausting reasonable authorized recovery. Report execution result separately from persisted task state, including failed or skipped validation. For a single-task request, stay within that scope. For an authorized AFK or backlog run, return the result and any pending human dependency to the controller so useful ready work continues.
