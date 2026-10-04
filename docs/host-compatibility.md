# Skill host compatibility

The canonical unit is a `SKILL.md` directory with its required references, templates, scripts, assets, and optional
host metadata. Do not make six authored copies of the same workflow. Resolve required sibling skills by stable ID.
Installing a requested skill includes its declared required skill dependencies automatically, without a separate
dependency confirmation. Installing a skill does not authorize installing external applications or adding credentials.

When reading repository policy, follow the active host's applicable, scoped instructions and enabled rules.
Include repository-designated instruction files, including a CODEX.md when the repository designates it, without
assuming every host discovers that filename automatically. Preserve instruction precedence and ignored-file boundaries.

## Researched routes, October 3, 2026

| Host | Local project skill route | Scope notes |
|---|---|---|
| Codex | `.agents/skills/` | User-global `.agents/skills` in the execution machine's home. |
| Claude Code | `.claude/skills/` | User-global `.claude/skills`; this does not establish Cowork/cloud installation. |
| Cursor | `.cursor/skills/` or shared `.agents/skills/` | Cursor can discover several compatibility locations; avoid duplicate copies. |
| Antigravity | Current `.agents/skills/`; legacy `.agent/skills/` compatible | Verify the actual IDE/CLI/2.0 surface and its global route. |
| Grok Bot | `.agents/skills/` for repository work, based on a direct Bot report | Chat-wide private skills use the account library; a project copy does not install into that library. Verify both surfaces natively. |
| Grok CLI | `.grok/skills/` | User-global `~/.grok/skills/`; the CLI also reads Claude and user `.agents` skills. Do not substitute this route for Grok Bot's account library. |

Sources: [Codex](https://developers.openai.com/codex/skills/),
[Claude Code](https://code.claude.com/docs/en/skills), [Cursor](https://cursor.com/docs/skills),
[Antigravity](https://antigravity.google/docs/skills),
[Grok Bot](https://docs.x.ai/grok-bot/skills-routines-and-automations), and
[Grok CLI](https://docs.x.ai/build/features/skills-plugins-marketplaces).

The Grok Bot project route is a direct report from the user's Bot working in a repository; its public account-library
documentation does not establish that route. Keep real project discovery and invocation as an acceptance gate.
The Grok CLI `.grok/skills` route is documented by xAI and is a separate host contract.

## Portable authoring subset

Local skill entry points retain the first plan's verified subset: folder and frontmatter `name` match, names use
lowercase letters, digits, and hyphens within 64 characters, and a present description stays on one line and within
1,024 characters. Keep entry points below 500 lines and required scripts, references, templates, and assets together.
Optional host metadata, including `agents/openai.yaml`, remains optional and must not make other hosts unusable.

These researched routes are not native acceptance results. Verify discovery and a safe invocation in the actual host,
including resource access. A copied directory is not proof of native discovery, and a staged Grok Bot account-library
request is not proof of registration.
Keep private account details and machine-specific receipts outside this public collection.

The proposed npm distribution is specified in [skills-package/PLAN.md](skills-package/PLAN.md).
That plan is not a claim that the CLI is already implemented or published.
