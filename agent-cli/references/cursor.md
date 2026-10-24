# Cursor Agent

Read for Cursor's agent CLI. Resolve its vendor identity before using the generic
`agent` command. Installations can expose `cursor-agent` or another verified
launcher; bare `cursor` may open the editor.

## Headless task

For a parent-written answer, use this argv shape after checking installed help:

```text
RESOLVED_CURSOR_AGENT --print --model MODEL --mode ask
  --workspace WORKSPACE --output-format json
  "Read TASK.md and answer its questions."
```

Verify the installed ask-mode/tool boundary. Ask mode is not evidence of
operating-system isolation. Check supported model discovery and any requested
effort control; do not translate another vendor's effort flag by analogy.

For direct edits, inspect the installed version's permissions first. The headless
guide describes `--force`/`--yolo` for applying edits, while the parameter
reference defines force as allowing commands unless explicitly denied. Treat it
as a broader permission change, not a write-only switch. Use an already
authorized, adequately scoped route or return a patch for the parent to apply.
Do not weaken permissions to repair authentication or quota failures.

Avoid automatic `--trust` or `--approve-mcps`; preserve the intended workspace
trust and MCP scope. A documented sandbox option still needs host qualification.

## Decode the result

For JSON success, check `type: "result"`, `subtype: "success"`, and
`is_error: false`, then validate the textual `result` against the task.
Failure may produce stderr without valid final JSON. Process success and envelope
success remain separate from product acceptance.

For streaming output, consume the terminal result and avoid double-appending
partial text and its final buffered copy. Retain a returned session ID as
evidence, not proof that resume was tested.

## Interactive chat or handoff

Use the verified agent entry without print mode in a persistent terminal.
Confirm locally supported prompt/model/workspace syntax, submit direction once,
and verify the accepted turn before handoff. Resume only an identified session
whose workspace and continuity match the task.

Official references checked 2026-10-23:
[headless mode](https://cursor.com/docs/cli/headless),
[parameters](https://cursor.com/docs/cli/reference/parameters),
[output format](https://cursor.com/docs/cli/reference/output-format).
Installed behavior governs each run; this reference is not a live qualification.
