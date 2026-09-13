---
name: execute-task-cycles
description: Run the existing execute-task workflow sequentially across an explicitly requested multi-task backlog, using a default maximum of 100 cycles when no positive limit is supplied. Use only when the user clearly asks to process multiple tasks, work through remaining or all tasks, run tasks repeatedly or in a loop, or continue until the project/backlog is complete. Do not trigger for generic continuation language such as "continue from here," "resume," or "follow the handoff," nor for a request to finish the currently scoped task.
---

# Execute Task Cycles

Run bounded, sequential `execute-task` passes. The cycle limit is a safety ceiling, not a promise to complete that many tasks.

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
2. For cycle `1` through `max_cycles`, run exactly one `execute-task` pass.
3. Start the next cycle only after the preceding pass has produced a terminal `Complete` result and its repository and task-source state are consistent.
4. Begin every next cycle with fresh repository, task-source, Git, and reporting-clock evidence in `America/Chicago`. Treat all changes from earlier successful cycles as current state, while preserving unrelated pre-existing work as protected.
5. Stop immediately after the first non-`Complete` result. Do not select a fallback task, retry a failed or incomplete pass, or begin sibling/cleanup work outside the next cycle.
6. Stop normally when the limit is reached, even if more executable tasks remain.

## Human gates and terminal states

Respect the selected task source's native human-gate and approval rules. If the next task or a declared blocker in its executable frontier is human-gated, approval-required, review-only, or otherwise requires an explicit human decision, stop before implementation and report that gate. Do not skip it to find another task unless the underlying `execute-task` contract explicitly authorizes that selection.

The following are stopping results when emitted by `execute-task`: `Incomplete`, `Blocked`, `Approval Required`, `Inconsistent State`, and a complete frontier with no task to execute. Also stop for failed validation, failed lifecycle reconciliation, failed commit verification, an irreconcilable conflict, or any safety/private-data boundary.

Do not convert a stopping result into `Complete`, and do not claim that the requested number of cycles ran. Report the number of completed cycles and the cycle that stopped.

## Final report

Provide one aggregate report after the controller stops. Include:

- the effective maximum, whether it was supplied or defaulted, and the number of completed cycles;
- each cycle's task identifier/title, execution result, native task-source state, completion commit, changed files, validation evidence, and residual risks;
- the stopping cycle and exact reason, or confirmation that the maximum was reached;
- start/end/elapsed reporting-clock evidence for each cycle, always using `America/Chicago`. Never ask the user to provide or confirm a time zone; change it only if the user explicitly initiates that conversation.

Preserve each underlying `execute-task` result distinctly. Do not compress a failed or human-gated cycle into an overall success merely because earlier cycles completed.
