# Coding artifact checks

Read for tasks that generate or modify code. Derive acceptance from the actual
project; do not impose a browser suite or demo workflow on unrelated work.

## Before the worker edits

Supply relevant repository instructions, source entry points, package exports
and types, allowed files, and the project's install/build/check commands.
Inspect real interfaces instead of guessing imports or inventing exports.

Record the current diff and relevant untracked files. Keep reference packages
and third-party source read-only unless modifying them is explicitly part of the
task. Use the real dependency through the intended project workflow.

Make the output contract concrete: changed files or patch, relevant checks,
known limitations, and ownership of commit/publication. A parent-only deployment
connector stays with the parent.

**Complete when:** the worker can implement against actual interfaces without
expanding the write scope or fabricating an integration.

## Verify behavior with short feedback

Use portable editing APIs and inspect the diff. Capture native build/test exit
codes before log filtering. When a check runner changes, verify that expected
checks actually ran; an empty successful runner is not acceptance.

For UI work, check real state and interactions before expensive broad runs:
hidden-state precedence, visible unique controls, keyboard behavior, rendering
changes, and cleanup. Test responsive layout, reduced motion, or fallbacks only
where the product's requirements make them relevant. Keep binary evidence on
disk; inspect a small useful sample instead of embedding image payloads in logs.

Repair failed checks and their dependencies, then run the required final gate
against the final files. Reuse a suitable independent audit fixture after
reviewing its assertions. Avoid repeating passing suites without a changed
artifact, unresolved risk, or required gate.

**Complete when:** the actual artifact and relevant checks pass, the parent has
inspected the changes, and unperformed checks remain visible in the result.
