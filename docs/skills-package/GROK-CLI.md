# Grok CLI: separate first-release host

Grok CLI is a distinct host from Grok Bot. Use `--host grokcli` for its local filesystem skill installation.
[xAI's CLI skills documentation](https://docs.x.ai/build/features/skills-plugins-marketplaces) lists project
`.grok/skills/<id>/` and user `~/.grok/skills/<id>/` discovery. It also documents Claude Code compatibility
and user-level `.agents/skills`, but the installer should not create duplicate copies at every compatible path.

Project scope selects the repository's `.grok/skills` destination; `--global` selects the CLI user's
`~/.grok/skills`. Preserve the full skill resource directory and receipts. A copy is only file-placement evidence;
SKP-003 must qualify the actual CLI version, discovery, refresh behavior, and safe invocation before claiming
native support. SKP-011 must exercise add, dependencies, update, and managed removal in Grok CLI separately
from Grok Bot's repository and account-library surfaces.

Do not use the CLI's `.grok/skills` root as a Grok Bot account-library transport. The user's Bot reported that
Grok Bot repository work reads `.agents/skills`; its chat-wide private library is distinct. See [GROKBOT](GROKBOT.md).
