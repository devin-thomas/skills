# Antigravity

Read for `agy`. Verify executable identity and installed help; an IDE launcher
is not interchangeable with the agent CLI.

## Headless task

Set cwd to the task workspace. This command shape requires permission checks
before launch; it does not establish a read-only boundary:

```text
agy --print "Read TASK.md and return its required result."
  --model MODEL --new-project --output-format json
  --json-schema SCHEMA_PATH --print-timeout TASK_TIMEOUT
```

Use a schema only when the task requires it. `--new-project` separates a fresh
task from prior project context. Add supported effort only when requested.
Set the CLI timeout explicitly, with a slightly longer parent deadline and
bounded cleanup; current reference pages disagree about default timeouts and
available effort levels.

Add `--mode plan` for a planning task, not as a security boundary. Verify its
effective behavior and any interacting flags on the installed version.
The documented `--sandbox` option can have no effect when sandboxing is
unavailable. Require evidence of effective containment before claiming isolation.

Inspect inherited permission policy. Headless mode can automatically allow
workspace reads and writes. A required tool can be denied while the process
continues and exits zero; inspect stderr and required-operation outcomes.
Use scoped existing policy or report the blocked capability rather than adding
an unrestricted permission bypass.

## Decode the result

Require `status: "SUCCESS"` with no error or unmet required operation.
When a schema is requested, validate `structured_output` as the payload.
The `response` string may contain ordinary prose or mixed content; parsing
the entire string as one JSON object is not a reliable replacement.
Then verify the artifact independently.

In persistent streaming runs, usage/duration fields may be cumulative. Preserve
the aggregation basis rather than summing every snapshot.

## Interactive chat or handoff

Use the documented interactive entry and persistent terminal/session support,
checked against installed help. Select the workspace and requested model,
submit one initial prompt, and verify backend activity before transferring work.
Record a usable terminal/conversation handle.

Choose one prompt transport. In streaming-input mode a supplied print prompt
can be ignored; do not combine argv prompt and stdin as a delivery hedge.
Keep startup observation separate from the lifetime of the handed-off session.

Official references checked 2026-10-23:
[CLI reference](https://antigravity.google/docs/cli/reference/),
[headless mode](https://antigravity.google/docs/cli/headless/).
Installed behavior governs each run; this reference is not a live qualification.
