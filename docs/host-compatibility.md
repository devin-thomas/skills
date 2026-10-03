# Agent Skills host compatibility

This repository keeps its public skills inside the portable Agent Skills shape: one directory per skill, a required `SKILL.md` with YAML `name` and `description`, and optional references/scripts/assets kept beside it.

The content contract targets five initial hosts. Installation transport is separate from content compatibility.

| Host | Project/workspace location | Global/account location | Discovery evidence |
| --- | --- | --- | --- |
| Codex | `.agents/skills/<skill>/` | `~/.codex/skills/<skill>/` | skill appears in the host's available-skill surface or is explicitly resolved by Codex |
| Claude Code | `.claude/skills/<skill>/` | `~/.claude/skills/<skill>/` | Claude Code lists/resolves the skill |
| Cursor | `.agents/skills/<skill>/` | `~/.cursor/skills/<skill>/` | Customize/Skills or slash menu shows the skill |
| Antigravity | `.agents/skills/<skill>/` | IDE: `~/.gemini/config/skills/<skill>/`; CLI: `~/.gemini/antigravity-cli/skills/<skill>/` | Customizations or slash-command discovery shows the skill |
| Grok Bot | account library, not a project filesystem contract | account library / packaged skills | the skill appears in Grok Bot's saved/private skills surface and can be invoked |

## Portable authoring subset

Local skills in this repository should satisfy the common strict subset:

- folder and frontmatter `name` match;
- name uses lowercase letters, digits, and hyphens and stays within 64 characters;
- `description` is present, single-line for this repository, and no more than 1024 characters;
- the entry point stays below 500 lines and links to supporting material rather than loading everything eagerly;
- no skill assumes a host-specific tool exists merely because a model or product name is present;
- scripts, references, templates, and assets needed by the workflow travel with the skill directory.

Host-specific metadata such as `agents/openai.yaml` may be present as an optional enhancement. A skill must remain understandable without it.

## Installation is not activation

A successful copy proves only that files reached the intended destination. Package tooling and documentation must report host discovery separately.

For local coding hosts, the installer may validate the destination and then ask the host's own discovery surface for evidence when automation is available.

For Grok Bot, do not treat `~/.grok/skills` or another local directory as the Grok Bot saved-skill library. Grok Bot skills are account-level. A programmatic installer needs a verified account-library/plugin transport; otherwise it must report the remaining manual/plugin step.

## Primary references

- OpenAI Agent Skills: https://developers.openai.com/api/docs/guides/tools-skills
- OpenAI Codex skill examples and migration guidance: https://developers.openai.com/cookbook/examples/agents_sdk/migrate-from-claude-agent-sdk/readme
- Claude Agent Skills authoring: https://docs.claude.com/docs/agents-and-tools/agent-skills/
- Cursor Agent Skills: https://cursor.com/docs/skills
- Google Antigravity Agent Skills: https://antigravity.google/docs/skills
- Grok Bot skills and routines: https://cursor.com/docs/grok-bot/work

The package implementation should re-check these references before changing host paths or claiming a new activation mechanism.
