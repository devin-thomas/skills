# Host contracts and initial-release evidence

These are researched routing contracts, not a claim that the new installer has run. Source IDs refer to [SOURCES](SOURCES.md).

| Host ID | Project route | User-global route | Important qualification |
|---|---|---|---|
| `codex` | `.agents/skills/<id>/` | `~/.agents/skills/<id>/` | Current local Codex paths are documented; preserve optional `agents/openai.yaml`. [H1] |
| `claude` | `.claude/skills/<id>/` | `~/.claude/skills/<id>/` | Claude Code filesystem skills; cloud/Cowork are different surfaces. [H2] |
| `cursor` | `.cursor/skills/<id>/`, or reuse an already-managed shared `.agents/skills/<id>/` | `~/.cursor/skills/<id>/` | Cursor also discovers shared and compatibility directories; local globals do not imply cloud sync. [H3] |
| `antigravity` | Current shared `.agents/skills/<id>/`; legacy `.agent/skills` is documented as compatible | IDE/2.0: `~/.gemini/config/skills/<id>/`; CLI: `~/.gemini/antigravity-cli/skills/<id>/` | Current docs distinguish surfaces; qualify the installed version before global writes. [H4, H5] |
| `grokbot` | `.agents/skills/<id>/` when the Bot works in a repository, per direct Bot report | `/home/box/agent-data/workflows/<id>/` on the Bot's own qualified Linux runtime | The account path is a second direct Bot report. Global npm postinstall can populate it only when the runtime and existing library pass strict checks; native discovery still needs a real Bot session. See [GROKBOT](GROKBOT.md). [H6, H7, H11, H12] |
| `grokcli` | `.grok/skills/<id>/` | `~/.grok/skills/<id>/` | xAI documents both CLI locations and Claude/user `.agents` compatibility. Use the explicit Grok CLI route by default. See [GROK-CLI](GROK-CLI.md). [H10] |

`~` means the execution machine's home, not a hard-coded Devin machine path. Never infer that a remote Bot or
cloud agent reads skills installed on the user's desktop.

## Six hosts now, not later

All six adapters and real-host acceptance are mandatory for the initial release. A global-path or registration
uncertainty is resolved in the early host-contract ticket, not hidden in an "unsupported for now" final product.
Outside the qualified Bot execution context, the account adapter stops rather than writing a guessed path. Copying
skills into the reported library is installation evidence, not proof that the Bot discovers or invokes them. A desktop
mock does not qualify the Bot host; Grok CLI acceptance is separate.

For each host, record the actual version, OS, selected surface, explicit project/global semantics, discovery location,
refresh behavior, invocation syntax, required-resource access, update behavior, and deletion behavior.
Do not claim every host works on every OS solely because the Node installer passes an OS matrix.

## Detection policy

Prefer explicit or previously saved selection. Use only documented, non-secret host signals; inspect version/help
commands only when needed and safe. A directory name is a routing hint, not definitive proof an application is installed.
Shared `.agents/skills` cannot distinguish Codex, Cursor, and Antigravity. A generic `agent` binary is ambiguous.
Do not guess undocumented environment variable names for any host.

Native application policies and security prompts remain in force. The package adds no dependency-specific confirmation.
Do not scrape account cookies, inspect authentication databases, elevate privileges, or turn off workspace trust.

## Portable content rules

Keep `SKILL.md` plus its complete required resources. Use scoped host/repository instruction discovery rather than
assuming `CODEX.md` is universal. Resolve sibling skill references by stable ID and the host catalog, with sibling
paths as a verified fallback. Do not require OpenAI metadata for other hosts or strip it from canonical source.
Do not globally inject every skill into AGENTS.md, CLAUDE.md, or always-on rules.

## Real smoke case

Install `execute-task-cycles` from a fresh profile. Confirm both skill IDs are discoverable. Invoke the outer skill
against a synthetic repository with two read-only/harmless local tickets and a two-cycle ceiling. Verify that the
inner skill's complete references are available and neither task is falsely marked complete. Separately install
`quick-build`, use it in planning-only mode, and confirm it reads a bundled template. Record evidence without
publishing or running paid services. Use host-owned safe fixtures when task execution would otherwise mutate Git.
