# Agent Skills

Reusable agent skills live in this repository. Each skill should have its own
directory with a `SKILL.md` file as the entry point:

```text
<skill-name>/
  SKILL.md
  references/   # optional supporting guidance
  scripts/      # optional executable helpers
  assets/       # optional templates or other bundled files
```

Keep skill-specific supporting files next to the skill that uses them. The
repository-level `docs/` directory is for documentation about the collection
as a whole; it is not required for an individual skill.

## Available skills

- [`execute-task`](execute-task/SKILL.md) completes one bounded task pass from a repository prompt or a portable Linear, GitHub, or Markdown workflow.
- [`task-execution-prompt`](task-execution-prompt/SKILL.md) creates or revises a repository-specific task execution prompt and validates its selection logic with a read-only rehearsal.

## Install from GitHub

Ask Codex:

```text
Use $skill-installer to install execute-task and task-execution-prompt from https://github.com/devin-thomas/skills.
```

The installed skills are available on the next turn.
