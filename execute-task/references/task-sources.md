# Task Sources

## Discover one authoritative source

Resolve task-source authority in this order:

1. An issue, ticket file, tracker, or project explicitly named by the user.
2. Applicable repository instructions and task-source documentation.
3. Conventional local sources such as `tickets.md`, task-brief directories, and implementation plans.
4. GitHub or Linear only when repository context identifies that tracker and, when needed, its project or repository.

Do not treat connector availability as authority. Do not treat a Git remote alone as proof that GitHub Issues govern work. If several authoritative-looking sources remain, ask the user rather than merging their state.

For every source, read task bodies, acceptance criteria, native state, assignee or owner, declared blockers, priority metadata, human gates, and relevant comments before selection. Retry transient reads only when the operation is safe and external state may recover; never guess after a failed authoritative read.

## Linear

- Use the configured Linear connector or repository-approved client.
- Identify the governing team/project from explicit input or repository guidance.
- Read native blocker relationships when available; use textual blockers only when repository convention makes them authoritative.
- Use native priority, labels, project order, or repository-declared coordinates for ordering. Do not rely on visual list position, creation time, or numeric issue ID unless the repository explicitly defines that rule.
- Claim, change state, and comment only on the selected issue and only through native conventions.
- Do not create labels, states, projects, parent relationships, or blocker links in the portable workflow.

## GitHub Issues

- Use the repository identified by explicit input or repository guidance; verify it matches the intended remote before writes.
- Read issue bodies, labels, assignees, comments, milestones, and blocker/sub-issue relationships used by the repository.
- Treat labels such as autonomous, human-gated, critical, or security as signals only when repository documentation or established usage defines them.
- Use native priority or project order when established, then declared plan order, then stable issue number.
- Assign, comment on, or close only the selected issue. Pull requests are not task sources unless repository policy explicitly says otherwise.

## Repository-local Markdown

Recognize established forms rather than forcing one schema:

- A `tickets.md` file with headings, `Blocked by` text, and checkboxes.
- Ordered task briefs split between active and completed directories.
- An implementation plan whose task coordinates and completion markers are authoritative.
- Another documented local convention with stable task identity and completion evidence.

Read the complete relevant task set before computing the frontier. Respect textual dependency edges and declared document order. Do not equate code existence with completion when the source uses checkboxes or file location as authority.

On completion:

- Check only the selected task and acceptance criteria actually satisfied.
- Move a brief only when the source convention defines directory movement as lifecycle.
- Preserve blocker text, ordering, historical notes, and unrelated boxes.
- Do not create formal statuses or an auxiliary notes file when none exists.

## Explicit task selection

When the user explicitly names a task, use that task instead of frontier ordering only if it belongs to the authoritative source and is executable under its blockers and human gates. If it is not executable, report why; do not silently select another task.
