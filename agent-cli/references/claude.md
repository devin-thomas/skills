# Claude Code

Read for `claude`. Check the resolved executable's help for the intended mode.
Use its existing authorized authentication route. Personal token paths and shared
credential conventions are outside this public skill.

## Keep the authorized credential route

Claude Code selects one credential by documented precedence: cloud-provider
selection, then `ANTHROPIC_AUTH_TOKEN`, then `ANTHROPIC_API_KEY`, then
`apiKeyHelper`, then `CLAUDE_CODE_OAUTH_TOKEN`, then profiles and the `/login`
subscription. In print mode an API key present in the environment is always
used, with no approval prompt. Before launch, compare the child environment
with the authorized route; remove from the child's copy any higher-ranked
variable that would switch a subscription run to API billing. Pass credentials
only through the environment or the vendor's store, never argv or task text.
A token from `claude setup-token` makes model requests only; claude.ai
connectors stay with the parent.

## Headless task

Set cwd explicitly. This argv shape is for a parent-written result from supplied
files; adjust the exact tool list to the task:

```text
claude -p --model MODEL --effort EFFORT
  --output-format stream-json --verbose
  --permission-prompts none
  --tools Read --allowedTools Read
  "Read TASK.md and the supplied inputs. Return the required result."
```

Include effort only when supported by the selected model. `--tools` selects
built-in tools; `--allowedTools` controls approvals. MCP scope is separate.
Tool names are case-sensitive (`Bash`, not `bash`).
For child edits, grant only the task's needed tools and write scope under the
existing policy. `--permission-prompts none` denies operations requiring an
unanswered prompt; it does not approve them.

Inspect inherited project hooks and MCP configuration before launch.
`--strict-mcp-config` scopes MCP loading, not hooks. Use `--safe-mode` only for
a deliberate controlled run with required context supplied explicitly.
Preserve authentication and managed policy. `--bare` skips OAuth/keychain
credentials; it is not a safe default substitute for isolated configuration.

Use `--no-session-persistence` only when resume is unnecessary. If selected,
record that this print run is ephemeral. An optional `--max-budget-usd` is an
estimate-based control with possible overshoot, not a hard invoice cap.
Keep parent-enforced time/output/storage limits.

Read JSONL through the terminal `result`. Require no `is_error` or terminal
failure; verify required tool operations and the output. When using schema
output, validate `structured_output` and treat its absence as missing evidence.
Retain exposed usage fields before sanitizing the record.

## Interactive chat or handoff

Use `claude` without `-p`, in the chosen workspace and a persistent terminal,
with supported model/effort arguments and at most one initial prompt.
Retain a usable session handle. Verify a supplied turn's backend activity before
handoff; an auth-status read alone does not prove model access or remaining quota.
A blank chat can be ready for input without a generation probe.

Resume only the specific intended persistent session using the installed
resume syntax. Avoid an ambiguous "latest" session and never infer resumability
from a prior ephemeral result.

Official references checked 2026-10-23 (authentication 2026-11-08):
[CLI](https://code.claude.com/docs/en/cli-reference),
[headless operation](https://code.claude.com/docs/en/headless),
[authentication](https://code.claude.com/docs/en/authentication).
Installed behavior governs each run; this reference is not a live qualification.
