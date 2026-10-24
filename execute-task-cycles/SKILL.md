---
name: execute-task-cycles
description: Continue an authorized backlog or multi-task workflow through repair, verification and delivery, including AFK runs. Resume an existing run from its saved scope. Keep human-blocked items pending while completing independent ready work.
---

# Execute Task Cycles

Complete the authorized backlog using `execute-task` for each task. One completion is one verified task, not one debug attempt or retry. Resume saved run scope when the user says to continue; an ordinary request to resume a single task does not expand it into a backlog run.

## Autonomous progress and human blockers

Automatic diagnosis, repair, and verification are the default. Carry forward the user's existing authorization. Resolve routine dependency, environment, implementation, validation, Git and transient service failures without a new confirmation. Retry with evidence and a changed approach; reconcile uncertain writes before repeating them.

A human blocker is a material owner decision, unavailable permission or credential that cannot be recovered through authorized means, or a protected/destructive boundary outside the task. Ask a concise actionable question through the available asynchronous input surface and send an authorized owner notification when a configured route exists. Missing optional notification tooling is work to repair or route around, not a reason to abandon the task. Respect message recipients and transport authorization.

While an answer is pending, preserve the blocked task and continue authorized independent investigation, preparation, repairs, or other ready backlog tasks. Record dependencies and return to the blocked item when the answer arrives. Never infer approval from elapsed time. Do not consume the run in repeated slow question waits, and do not report the whole workflow blocked while useful authorized work remains. Stop only at an explicit user/resource limit, completion of the authorized scope, or when every remaining useful action depends on a genuine human blocker. Record unfinished work honestly.

## Scope and limits

Use an explicit task count or resource limit when the user supplies one. Otherwise continue until the authorized scope is complete; do not invent a default task-count cutoff or ask for a number. Honor host execution limits and preserve a resumable checkpoint when one is reached. Keep task selection tied to the user's project and current task-source state.

## Controller

1. Refresh repository, task-source, dependency and Git state. Reuse the established canonical prompt and user decisions.
2. Resume the current ready task or select the next ready task in the authoritative order. Treat recorded human blockers as pending dependencies, not a reason to reselect the same blocked item forever.
3. Diagnose failures, repair ordinary implementation/environment problems and verify uncertain external writes before retrying. Use evidence to change a failing approach. Technical retries do not consume a completed-task count.
4. If a material owner decision is necessary, send one actionable asynchronous question and an authorized notification. Record what is needed and continue independent preparation or another ready task. Avoid repeated unchanged notices. Revisit pending items when answers or external state change.
5. Count a task complete only after required checks and repository/task-source reconciliation pass. Keep partial, blocked and failed results distinct. Follow the repository's actual commit, push and delivery policy.
6. Continue until the requested scope or explicit limit is reached, the user stops the run, a host limit requires a checkpoint, or every remaining useful authorized action depends on the owner. Do not terminate because a procedural label or failed intermediate check says Incomplete.

One task is owned at a time by default. Background work must fit existing authorization and avoid competing writes. Use parallel agents only when the active environment and user authorize them. Creating an unattended scheduled watcher or messaging a new recipient requires its own authorization; ordinary continued work within this run does not.

## Progress and completion

Maintain a compact run record with completed task IDs, pending dependencies/questions, current work, checks, delivery state and next steps. Give concise progress updates while working. On a checkpoint or final result, report the actual completed count, remaining work, evidence and exact stopping condition. Preserve useful work and a clear resume path; never turn partial progress into overall success.
