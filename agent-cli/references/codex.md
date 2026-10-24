# Codex

Read for the Codex CLI. Check `codex --help` and, for tasks,
`codex exec --help` on the resolved executable. The templates below describe
argv; substitute contract values and use a native argument-list launcher.

## Headless task

For a parent-written artifact, set cwd to the workspace and use this command
shape with options supported by the installed version:

```text
codex exec --model MODEL -C WORKSPACE --sandbox read-only
  -c approval_policy="never"
  -c model_reasoning_effort="EFFORT"
  --json --output-schema SCHEMA_PATH
  --output-last-message RESULT_PATH
  "Read TASK.md and follow its output contract."
```

Generate the schema from this task and omit schema/effort options when they are
not applicable. Keep configuration expressions as individual argv elements.
For child edits, select the supported workspace-write boundary appropriate to
the task, then inspect the actual changed files.

Treat `--ephemeral`, `--skip-git-repo-check`, output-schema, and final-output
options as exec-specific; check their scope before using a root/chat command.
Use repo-check bypass only for an intentionally non-repository task directory.
An ephemeral run can still write CLI state and output files.

Use `--ignore-user-config` only for an intentional controlled run, supplying
needed instructions explicitly. It retains authentication but changes configuration
loading. Current managed `--worktree` conflicts with that option and
`--ephemeral`; check combinations locally rather than assembling every optional
flag. Preserve normal policies; permission bypasses are not compatibility fixes.

Parse bounded JSONL. Require an acceptable terminal outcome; `turn.failed` or
`error` invalidates success. Validate the designated final-output file and
task checks independently. Activity logs are not a substitute for the product.

## Interactive chat or handoff

Use the root command in a persistent terminal:

```text
codex --model MODEL -C WORKSPACE
  -c model_reasoning_effort="EFFORT" "INITIAL_PROMPT"
```

Supply the initial prompt once. Check its accepted turn and successful backend
response/tool activity before claiming a prompted handoff. MCP startup messages
or a model label alone do not prove acceptance. Preserve the live session handle.
A blank chat can be ready for input without having verified backend access.

## Model discovery when needed

Use the installed CLI's discovery surface. For the documented app-server stdio
protocol, initialize the client, await the response, send `initialized`, then
request `model/list`. Correlate response IDs, follow pagination, and inspect
`supportedReasoningEfforts`. Keep stdin open and drain stderr asynchronously
within the probe deadline; close only the owned discovery process.

Discovery describes advertised support. Record actual task acceptance separately,
including requested selector versus exposed model identity.

Official references checked 2026-10-23:
[CLI](https://developers.openai.com/codex/cli/reference),
[non-interactive execution](https://developers.openai.com/codex/noninteractive),
[app server](https://developers.openai.com/codex/app-server).
Installed behavior governs each run; this reference is not a live qualification.
