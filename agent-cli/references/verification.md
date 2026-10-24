# Result verification and saved recovery

Read after headless execution or when examining saved CLI evidence.

## Verify the execution and the product separately

For a newly executed headless task require:

1. The owned worker exited successfully without a timeout, output/storage limit,
   cancellation, or cleanup failure.
2. Its documented terminal envelope contains no error indicator. Error fields,
   denied required operations, and missing terminal events override success-like
   text. Parse the provider's payload field; do not guess JSON out of mixed logs.
3. The task payload matches the expected schema, types, and required fields.
4. The expected artifact is from this attempt, exists at its intended path,
   is within budget, and passes the task's substantive acceptance checks.

For a parent-written artifact, validate the worker's structured response, write
the agreed file, and read it back. For child-written artifacts, compare the
actual files with the pre-run baseline, including relevant untracked files.
Verify canonical paths and reject outputs outside the allowed write scope.
Preserve user edits; do not reset a working tree to simplify inspection.

Use a unique per-attempt marker or challenge for integration tests where replay
or stale-file acceptance matters. This is a freshness aid, not proof of model
identity, authenticity, or an operating-system sandbox.
For an intentional update to an existing file, use its baseline/diff and task
checks instead of assuming every successful result must create a new file.

A partial useful output can be recovered from a failed attempt. Label it as
partial/recovered and keep the execution failure visible. A later passing retry
does not rewrite the earlier outcome.

**Complete when:** process evidence and independently inspected product evidence
support the reported result, or the failed layer is identified.

## Keep a proportionate receipt

Retain mode, attempt/session ID, executable/version, requested model/effort,
reported identity when exposed, sanitized argv/cwd, task/source hashes where
needed, start/end/duration, exit/stop reason, terminal status, artifact paths and
hashes, acceptance results, and publication owner. Use task-local paths in reports
shared outside the workspace.

Preserve output/log evidence privately within its storage budget. Keep credentials,
credential hashes, private account identifiers, raw prompts, and unnecessary
source contents out of shared receipts. Report evidence that is unavailable
instead of inventing defaults. Follow an existing project ledger when required;
this skill imposes no report numbering, index format, or status vocabulary.

After a repair, check affected behavior and required dependencies, then run the
project's required final gate. Broaden testing only for a remaining risk or a
required gate. Verify remote commits, deployment, or delivery only when those
actions are in the task's authorization.

**Complete when:** another reviewer can trace the outcome without exposing
unnecessary private inputs.

## Recover without rerunning

Keep original evidence files and metadata unchanged. Recompute hashes and compare
with retained seals when available; a newly computed hash alone does not prove
historical integrity. Validate the saved envelope and output against the original
contract. Write a new verification record linked to the original attempt.

Saved command text, model labels, and claimed exits establish only what was
recorded. Without reliable process evidence, claim content recovery and current
content checks, not independently attested execution or model identity.
A new run is a new attempt requiring the task's execution authorization; recovery
itself does not launch a worker.

**Complete when:** recovered content and its current checks are available with
clear provenance and explicit limits on historical claims.

## Continue or retry deliberately

Classify the failing layer before choosing a repair: command/transport,
authentication/quota, model/effort, worker execution, output schema, product checks,
or publication. Respect the total attempt and resource limits.

Resume only a known persistent session whose exact ID, workspace, permissions,
and requested configuration have been checked. An ephemeral run or an arbitrary
session ID is not proof of resumability. If continuity cannot be established,
label the next attempt a fresh-context continuation and supply a focused repair
task with relevant files and failure evidence.

**Complete when:** a retry has a new recorded attempt or a verified session
continuation, and the preceding process cannot still perform duplicate work.
