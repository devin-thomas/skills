# Control formats

Choose the smallest control that fits the task. Implement only the format needed by the target project.

## Seven reference formats

Match the control to the task, required inputs, and where the agent runs. [Agent Prompts](https://agent-prompts.vercel.app/#formats) demonstrates seven working formats, each paired with an inspectable payload and a public Markdown guide:

1. **Shared prompt** (`#format-01`): One shared copy action with a compact logo cluster and readable product names when the prompt is agent-independent.
2. **Agent picker** (`#format-02`): Named agent option buttons with authentic product marks and `aria-pressed` selection state (such as `Claude Code`, `Codex`, and `Antigravity`), dynamically updating the action label (`Copy for Claude Code`).
3. **Contextual prompt** (`#format-03`): A compact prompt action placed directly beside the feature, form, or preview it adds or configures (`Add this form` + `Copy for Grok Bot`).
4. **Command palette** (`#format-04`): Searchable task launcher (`Cmd/Ctrl + K`) with keyboard navigation (`ArrowDown`, `ArrowUp`, `Home`, `End`, `Enter` to copy, `Escape` to dismiss), product marks on each row, and polite `role="status"` announcements for empty search states.
5. **Linked guide** (`#format-05`): One sentence pointing to a complete guide (`Read {origin}/guides/{slug}.md and {outcome}, following its scope and verification steps.`), paired with a direct human-readable link to that guide.
6. **Open in agent** (`#format-06`): A verified client draft link (such as `https://cursor.com/link/prompt?text=...` labeled `Open in Cursor`) paired side-by-side with a `Copy prompt` fallback. Opening a draft is the supported outcome; never claim automatic execution.
7. **Continue this project** (`#format-07`): An agent-independent project continuation handoff (`Continue this project`, backed by [`/guides/continue-project.md`](https://agent-prompts.vercel.app/guides/continue-project.md) and illustrated by [`/examples/project-handoff.md`](https://agent-prompts.vercel.app/examples/project-handoff.md)). It works with project records (`PROJECT.md`, roadmap, or handoff docs) already available in the visitor's repository without requiring an account or a particular agent tool. The guide instructs the agent to verify existing handoff claims against the current working tree before acting, complete the next unfinished step, run relevant checks, and leave an updated portable handoff record using repo-relative links without credentials, personal paths, machine details, or raw session logs.

