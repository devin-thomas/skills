# Portable Configuration

`config.json` is shipped **inside** the skill for a discoverable, valid default.
It is a skill-owned policy file, **not a native configuration format** understood
or auto-loaded by Codex, Claude, Gemini, Cursor, Antigravity, or Grok. The active
agent reads it when the skill is invoked and applies only supported native
controls. On hosts that expose only the skill's instruction packet, ask for or
retrieve the declared config reference if available; otherwise inherit.

## Override locations and precedence

Read only these locations, if the host can access them:

1. Bundled `subagent-orchestration/config.json` (base).
2. User config in the runtime user's config directory:
   `~/.config/subagent-orchestration/config.json` (optional).
3. Project root `.subagent-orchestration/config.json` (optional).
4. The active user's **explicit instruction** (highest precedence).

Windows users may keep the same `.config` directory beneath their profile
home; do not assume a Unix-specific absolute home path. Project preferences
can be versioned in their own repository. Do **not** modify the installed
skill's tracked defaults as a prerequisite; package updates may replace them.

For each file, validate `schemaVersion: 1` and known fields against the shipped
`config.schema.json`. Overlay objects recursively; supplied scalar values
replace earlier values, including explicit `null`. Never merge arrays or
interpret missing entries as resets. Unknown keys and invalid types are an
error; retain the last valid config and report the rejected override.
The current task/user instruction still outranks config.

Within the resolved config, select `harnesses[activeHarness]`, then overlay
`roles[workerRole][activeHarness]` if present. A missing or `null` model or
effort means leave the setting to the harness. Preserve the native configured
selection; do not overwrite it with a guessed model.

## Example: project preferences

Save this as `.subagent-orchestration/config.json` in your project:

```json
{
  "schemaVersion": 1,
  "policy": {
    "maxConcurrentWorkers": 3,
    "maxDepth": 1
  },
  "harnesses": {
    "codex": { "model": "gpt-6-luna", "effort": "medium" },
    "claude-code": { "model": "sonnet", "effort": "medium" },
    "gemini-cli": { "model": "gemini-3-flash-preview", "thinkingBudget": 1024 },
    "cursor": { "model": null, "effort": null }
  },
  "roles": {
    "verify": {
      "codex": { "effort": "high" },
      "claude-code": { "effort": "high" }
    }
  }
}
```

These are examples, **not** bundled model defaults or guarantees of account
access. Replace them with model identifiers supported by your harness and
account; different models may reject a particular effort level. The
`gemini-cli` numeric thinking budget is not equivalent to Codex/Claude effort.
For Cursor, a supported model-variant string may embed its own effort option.

## Applying preferences safely

- Read the configured route before spawning, not after.
- Use native per-spawn overrides first if supported. Otherwise a configured
  named agent may be appropriate if it already exists.
- Do not edit global `config.toml`, `settings.json`, agent definitions, login
  stores, or billing settings just to make the preferences work.
- If no supported per-spawn or existing-agent mechanism can apply the setting,
  use `unsupportedSetting`: with `report-and-inherit`, run on the native
  default and mark the mismatch; with `fail`, do not launch that worker.
- An explicit user requirement for an **exact** model/effort wins over the
  fallback policy; ask only if no authorized route can satisfy it.
- Model availability, routing, and actually executed identity require
  runtime evidence. A requested value is not proof of acceptance.
- If `allowCrossHarnessFallback` is false, do not silently launch another
  CLI/provider. If true, still require an already authorized provider,
  credentials, billing, and process path; read the optional `agent-cli` skill.

Useful checks: `python3 -m json.tool config.json` checks syntax. JSON Schema
validation checks keys/types but not live vendor capability or model access.
