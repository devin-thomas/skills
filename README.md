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

- [`grill-to-build`](grill-to-build/SKILL.md) turns focused discovery into synchronized context, decisions, a specification, and ordered build tickets. See its [usage guide](grill-to-build/README.md) for portable diagram preferences.

- [`execute-task`](execute-task/SKILL.md) completes one bounded task pass from a repository prompt or a portable Linear, GitHub, or Markdown workflow.
- [`execute-task-cycles`](execute-task-cycles/SKILL.md) runs bounded sequential `execute-task` passes up to a caller-specified maximum, stopping on failure, incompleteness, or human gates.
- [`perfect-playlist`](perfect-playlist/SKILL.md) builds, appends, verifies, exports, searches, and inspects exact Spotify playlists without substitutions.
- [`task-execution-prompt`](task-execution-prompt/SKILL.md) creates or revises a repository-specific task execution prompt and validates its selection logic with a read-only rehearsal.

## Install from GitHub

Ask Codex:

```text
Use $skill-installer to install execute-task and task-execution-prompt from https://github.com/devin-thomas/skills.
```

For deterministic Spotify playlist work:

```text
Use $skill-installer to install perfect-playlist from https://github.com/devin-thomas/skills.
```

The installed skills are available on the next turn.
