---
name: execute-task-cycles
description: Run the existing execute-task workflow sequentially across an explicitly requested multi-task backlog, using a default maximum of 100 cycles when no positive limit is supplied. Use only when the user clearly asks to process multiple tasks, work through remaining or all tasks, run tasks repeatedly or in a loop, or continue until the project/backlog is complete. Do not trigger for generic continuation language such as "continue from here," "resume," or "follow the handoff," nor for a request to finish the currently scoped task.
---

# Execute Task Cycles

Complete the requested sequence of tasks, one at a time, using `execute-task`. Treat the requested count as the completion target within the authorized scope. Debugging attempts, retries and recovery work belong to the current task; they do not consume additional cycles.

## Trigger conservatively

Use this skill only after an explicit multi-task repetition signal, such as:

- `process the next 10 tasks`
- `work through all remaining Linear issues`
- `continue executing tasks in a loop`
- `keep completing tasks until the project is done`

Do not use this skill, and do not route to `execute-task`, for generic continuation or handoff language alone. Requests such as `continue from here`, `resume`, `keep going`, or `follow the handoff` normally mean to continue the already scoped work with the standard agent workflow.

## Invocation

Treat `max_cycles` as optional. Use an explicitly supplied positive base-10 integer when present; otherwise use `100`. Accept natural-language forms such as `max_cycles=3`, `for 3 cycles`, or `up to 3 tasks` when the intended limit is unambiguous.

- Never ask the user to provide or reconfirm a cycle count merely because it is missing, malformed, non-positive, or ambiguous. When the multi-task intent is clear and no valid positive count is available, start immediately with the default maximum of `100`.
- Treat requests such as `until the project is complete` or `work through the backlog` as bounded by the default maximum of `100`; do not characterize them as unbounded.
- Do not exceed an explicitly supplied valid limit or the default limit.
- Treat each cycle as one fresh invocation of the complete `execute-task` skill, including its canonical-prompt resolution or portable workflow, reporting clock, validation, lifecycle reconciliation, Git policy, and final report.

## Cycle controller

1. Resolve `max_cycles` without user interaction: use a supplied positive integer or default to `100`.
2. Work on the current task until it is verified complete or a genuine blocker prevents further authorized progress. Investigate failures, fix defects, resolve routine environment/setup issues, and rerun affected checks as part of that task.
3. Count one completed cycle only after the task has a verified `Complete` result and its repository and task-source state are consistent. Then select the next task from fresh state.
4. Begin every next cycle with fresh repository, task-source, Git, and reporting-clock evidence in `America/Chicago`. Treat all changes from earlier successful cycles as current state, while preserving unrelated pre-existing work as protected.
5. Continue through recoverable failures without asking the user to restart the workflow. A failed check, transient network error, review finding, commit failure or intermediate `Incomplete` note is work to resolve, not an automatic end to the run. Retry with evidence and a changed approach when needed; avoid repeating the same failing action without learning or making progress.
6. Stop normally when the limit is reached, even if more executable tasks remain.

## Human gates and terminal states

Respect actual human decisions and authorization boundaries. Read the current request and prior conversation before treating an approval as missing; existing authorization continues to apply to the underlying routine work. A planning label, example, historical approval note or procedural checkpoint does not by itself require asking again. If a required new decision or unavailable permission genuinely prevents the selected task, complete useful independent preparation and report the precise blocker. Do not silently skip it for an easier task unless the task-selection contract permits that.

Stop when the requested count is reached, the authorized backlog is exhausted, the user asks to stop, reasonable authorized technical recovery is exhausted without meaningful progress, or safe progress genuinely requires unavailable access, a new human decision, an irreconcilable conflict, or crossing a protected-data boundary. Exhaust reasonable diagnosis and recovery within the current authorization before reporting a terminal `Incomplete`, `Blocked`, `Approval Required` or `Inconsistent State`. Do not declare a terminal result merely to satisfy a procedural stopping clause.

Never hide failing required checks or mark an unfinished task complete. If a genuine blocker remains, preserve the work, record what was tried and what is needed, and report the actual completed count and stopping task. A workflow boundary limits task scope, not ordinary engineering autonomy.

## Final report

Provide one aggregate report after the controller stops. Include:

- the effective maximum, whether it was supplied or defaulted, and the number of completed cycles;
- each cycle's task identifier/title, execution result, native task-source state, completion commit, changed files, validation evidence, and residual risks;
- the stopping cycle and exact reason, or confirmation that the maximum was reached;
- start/end/elapsed reporting-clock evidence for each cycle, always using `America/Chicago`. Never ask the user to provide or confirm a time zone; change it only if the user explicitly initiates that conversation.

Preserve each underlying `execute-task` result distinctly. Do not compress a failed or human-gated cycle into an overall success merely because earlier cycles completed.
