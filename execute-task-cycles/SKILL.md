---
name: execute-task-cycles
description: Execute the existing execute-task workflow for up to a caller-specified positive number of sequential cycles, selecting and completing one task per cycle. Use when the user asks to process the next N repository tasks, run execute-task repeatedly, or continue task execution until a bounded cycle limit or a stop condition is reached.
---

# Execute Task Cycles

Run bounded, sequential `execute-task` passes. The cycle limit is a maximum, not a promise to complete that many tasks.

## Invocation

Require one explicit argument: `max_cycles`, a positive base-10 integer. Accept natural-language forms such as `max_cycles=3`, `for 3 cycles`, or `up to 3 tasks` when the intended limit is unambiguous.

- Reject missing, non-integer, zero, negative, or otherwise ambiguous limits without starting a task.
- Do not silently choose a default, reinterpret an unbounded request, or exceed the supplied limit.
- Treat each cycle as one fresh invocation of the complete `execute-task` skill, including its canonical-prompt resolution or portable workflow, reporting clock, validation, lifecycle reconciliation, Git policy, and final report.

## Cycle controller

1. Validate `max_cycles` before repository or task-source mutation.
2. For cycle `1` through `max_cycles`, run exactly one `execute-task` pass.
3. Start the next cycle only after the preceding pass has produced a terminal `Complete` result and its repository and task-source state are consistent.
4. Begin every next cycle with fresh repository, task-source, Git, and reporting-clock evidence. Treat all changes from earlier successful cycles as current state, while preserving unrelated pre-existing work as protected.
5. Stop immediately after the first non-`Complete` result. Do not select a fallback task, retry a failed or incomplete pass, or begin sibling/cleanup work outside the next cycle.
6. Stop normally when the limit is reached, even if more executable tasks remain.

## Human gates and terminal states

Respect the selected task source's native human-gate and approval rules. If the next task or a declared blocker in its executable frontier is human-gated, approval-required, review-only, or otherwise requires an explicit human decision, stop before implementation and report that gate. Do not skip it to find another task unless the underlying `execute-task` contract explicitly authorizes that selection.

The following are stopping results when emitted by `execute-task`: `Incomplete`, `Blocked`, `Approval Required`, `Inconsistent State`, and a complete frontier with no task to execute. Also stop for failed validation, failed lifecycle reconciliation, failed commit verification, an irreconcilable conflict, or any safety/private-data boundary.

Do not convert a stopping result into `Complete`, and do not claim that the requested number of cycles ran. Report the number of completed cycles and the cycle that stopped.

## Final report

Provide one aggregate report after the controller stops. Include:

- the requested maximum and the number of completed cycles;
- each cycle's task identifier/title, execution result, native task-source state, completion commit, changed files, validation evidence, and residual risks;
- the stopping cycle and exact reason, or confirmation that the maximum was reached;
- start/end/elapsed reporting-clock evidence for each cycle when required by `execute-task`.

Preserve each underlying `execute-task` result distinctly. Do not compress a failed or human-gated cycle into an overall success merely because earlier cycles completed.
