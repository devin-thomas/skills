# Harness Routing Reference

This file maps portable preferences to **documented** vendor capabilities.
An agent skill cannot make a host recognize `config.json` as native settings,
and a field accepted by one harness may be ignored or unavailable in another.
Verify the installed version and tools before invoking a worker.

## Codex

Native subagents support `[agents]` defaults in `config.toml`, including
`default_subagent_model` and `default_subagent_reasoning_effort`, and
per-spawn model/effort choices. Custom agent TOML files may set `model` and
`model_reasoning_effort`. A custom agent file may take precedence for its
own values. Prefer supported per-spawn parameters over changing persistent
configuration, and verify actual reported model/effort if exposed.

Docs: https://learn.chatgpt.com/docs/agent-configuration/subagents

## Claude Code

Subagent Markdown frontmatter can set `model` and `effort`; per-invocation
Agent parameters can override them on supporting versions. The
`CLAUDE_CODE_SUBAGENT_MODEL` environment variable is a default unless forced,
and `CLAUDE_CODE_EFFORT_LEVEL` can override subagent effort. Model aliases
include `sonnet`, `opus`, and `haiku`. If model/effort are set for a worker,
use the harness's exposed controls, not extra text that merely claims a choice.
Version and organization restrictions can affect the actual result.

Docs: https://code.claude.com/docs/en/sub-agents

## Cursor

Custom `.cursor/agents/*.md` agents support a `model` value, defaulting to
`inherit`. A compatible model ID may include bracketed options such as
`[effort=high]`; there is no guarantee that every model supports this option.
Use a supported native agent/spawn model argument or an existing custom agent.
A separate `effort` preference is **advisory** until mapped to a documented
model variant. Do not create host agent definitions without consent.

Docs: https://cursor.com/docs/subagents

## Gemini CLI

Custom `.gemini/agents/*.md` definitions support `model`. The native
`agents.overrides` and scoped `modelConfigs` settings can change agent model
and supported generation settings. A numeric `thinkingBudget` is model- and
configuration-dependent. It does **not** correspond to Codex/Claude's effort
labels. `/model` on the parent does not override subagent selections.
Do not rewrite `settings.json` without authorization.

Docs: https://geminicli.com/docs/core/subagents/
https://geminicli.com/docs/cli/generation-settings/

## Google Antigravity

Current custom subagents use a model *tier* such as `inherit`, `flash`, or
`pro`; the API exposed to the running agent may differ by surface/version.
Do not translate arbitrary vendor model IDs or effort levels to invented
Antigravity settings. Inspect available native agent definitions and tool
parameters first.

Docs: https://antigravity.google/docs/subagents

## Grok CLI

Native subagents are available, with custom types under `.grok/agents/`.
The CLI's root `--model` and `--effort` flags do **not** by themselves
prove per-subagent model/effort control. Inspect the installed agent tools
and definition format before applying overrides. Otherwise inherit and
report the limitation.

Docs: https://docs.x.ai/build/features/subagents

## Grok Bot and other managed/chat hosts

Grok Bot does not expose a model picker; do not promise a specific subagent
model or effort from skill configuration. Other hosted chat agents likewise
may not expose worker routing even when they support delegation. Treat the
preferences as nonbinding there. Never confuse Codex/Claude/Cursor/Grok CLI
configuration with their separate hosted products.

Docs: https://docs.x.ai/grok-bot/faq

## No native workers

If the harness has no subagent mechanism, do not invent one. Complete the
work in the root or, if a separate CLI agent was intentionally requested and
authorized, use the separate public `agent-cli` skill and its evidence checks.
