---
name: long-horizon-dashboard
description: >-
  Maintain a durable dashboard for long-running, multi-phase agent work so the
  user can return and see current activity, progress, blockers, actions, decisions,
  outputs, and the next safe step. Default to localhost with verified ports;
  native Claude artifacts and private Tailscale access are optional delivery modes.
---

# Long Horizon Dashboard

Create the dashboard near the start of substantial work that spans several phases,
many tool calls, repeated testing, or likely interruptions. Reuse the same task
dashboard when work resumes. Do not create one for trivial answers or every turn.
Reading or maintaining this skill does not itself invoke it.

## Choose delivery

Use **localhost** by default. Native artifact delivery and Tailscale are optional;
neither a Claude account, Tailscale installation, nor an API key is required.
Honor an explicit mode or the project's saved preference. If a personal dashboard
skill already owns this task, reuse that dashboard instead of starting a duplicate.
An explicit invocation of this public skill selects these public defaults.

Optional per-project settings may be recorded in the tracked `status.json`:

```json
{
  "delivery": {
    "mode": "localhost",
    "preferred_local_port": 4173,
    "preferred_https_port": 8445
  }
}
```

Allowed modes: `localhost`, `claude-artifact`, `tailscale`. Missing settings mean
localhost. Ports are preferences, never reservations. Do not create extra config
files just to repeat these defaults. Record actual addresses separately from
preferences and keep private network details out of public repository content.

- **Localhost:** follow [port and endpoint checks](references/port-checks.md), then
  serve only the task's dashboard folder on `127.0.0.1` using the smallest existing
  static server or Python's standard-library HTTP server. Link the verified URL.
- **Optional native Claude artifact:** when selected and the host actually has
  native artifact tools, follow [optional delivery](references/optional-delivery.md).
  A model name alone does not establish artifact capability. No local port is needed.
- **Optional Tailscale:** when selected, follow [optional delivery](references/optional-delivery.md).
  Keep traffic private to the existing tailnet and verify both local and HTTPS URLs.
- **Unavailable delivery:** preserve `STATUS.md` and the portable HTML snapshot,
  record the precise limitation once, and continue independent work. If an optional
  mode is unavailable, localhost remains a usable fallback; do not claim it offers
  cross-device access. Do not turn optional delivery setup into a gate on the task.

## Durable files and commits

Store the task in the active project repository, with a stable, unique task slug:

```text
docs/agent-dashboard/<task-slug>/
  status.json
  STATUS.md
  index.html
```

Use `status.json` as canonical state. Derive the human recovery record and portable,
self-contained HTML from it; track any supporting renderer or source assets needed
to reproduce the dashboard. Use relative links. Keep the implementation small.

Include `task_id` and an ISO 8601 `updated_at` timestamp in the JSON. Include matching
HTML meta tags named `dashboard-task-id` and `dashboard-updated-at`. These are used
to distinguish this dashboard from a different server or stale page at the same URL.
Safely escape task data and attributes; render user/tool text as text, never raw HTML.

Dashboard artifacts are intentional repository records. Commit them at creation,
meaningful checkpoints, and final or interrupted handoff when Git writing is
authorized and available. Reuse unchanged committed files without empty commits;
do not commit on every poll. If the host requires approval for a commit, prepare
the scoped diff first and follow its approval mechanism.

- Inspect the repository, visibility, branch, staged changes, and ignore rules first.
  Sanitize task content before its first commit, especially in a public repository.
  Do not commit credentials, personal machine paths, raw tool output, or private
  network metadata. Unknown repository visibility calls for conservative content.
- Stage explicit dashboard files and inspect the diff. Use a scoped commit such as
  `git commit --only -m "docs: checkpoint task dashboard" -- docs/agent-dashboard/<task-slug>/`
  after staging its files. Preserve unrelated staged/unstaged work. Reconcile
  concurrent edits to this dashboard before committing them.
- Do not ignore the dashboard to suppress untracked-file warnings. Adjust broad
  ignore rules with narrow exceptions when necessary and include that change in
  the scoped commit. Runtime logs, PIDs, caches, and environment files stay outside
  the repository or narrowly ignored; they are not dashboard artifacts.
- Verify the dashboard path is clean and has a commit using `git status --short --
  <dashboard-path>` and `git log -1 -- <dashboard-path>`. Report its commit in chat;
  avoid rewriting the snapshot to insert its own hash and dirtying it again.
- Push or deploy through the surrounding task's authorized publication workflow.
  A local dashboard does not independently authorize public hosting or a Git push.
- If Git, write access, or a destination repository is unavailable, preserve an
  exportable artifact and recovery record, and explicitly mark persistence pending.
  Ask for a destination only when one cannot be inferred. An artifact in a native
  viewer is not a Git commit. Continue other work and report the limitation once.

Expected dashboard changes are owned work. Checkpoint them instead of repeatedly
warning the user about untracked files; report only actual persistence failures.

## Information hierarchy

The dashboard must make the user's next action obvious without reading chat.
Keep these sections in the page and corresponding fields in the state:

| Section | Content |
| --- | --- |
| Header | Task, overall state, phase, timestamp, repository/branch when relevant, verified access link when safe |
| Action required | Always at the top. Need, reason, blocked work, smallest user action, any authorized default. Empty: "No action required from you right now." |
| Current activity | Concrete operation and immediate expected checkpoint |
| Milestones | Pending, in progress, complete, or blocked; no invented percentages |
| Blockers | Cause, impact, owner, recovery path, independent work that can continue |
| Warnings | Watch items explicitly labeled "No action needed", "Monitoring", or "Agent handling" |
| Decisions | Decision, rationale, time, reversibility, final/provisional/revisit status |
| Outputs | Relative file links, reports, tests, commits, build or deployment evidence |
| Next up | Next one to five concrete steps in actual execution order |
| Activity | Compact append-only history of meaningful events, without raw logs |
| Walk-away snapshot | Last verified good state, unfinished operation, exact next safe step, touched files/services, expected running processes, needed input |
| Delivery and persistence | Selected mode, last endpoint verification, commit/persistence status, actual limitations |

Use alarm symbols and strong text for required action, yellow warnings for watch
items, and quieter notes for context. Labels must convey meaning without color.
Use states such as working, healthy, waiting, attention, blocked, complete. Keep
the layout readable on phone and desktop; do not sacrifice information for decoration.

## Maintain, resume, finish

Update the state atomically when practical, then regenerate the views, when a
phase, blocker, required action, warning, decision, artifact, test result, or
strategy changes. Keep the same task identity. For served pages, refresh with
cache busting and show the last update time and retrieval failures; never show a
stale page as fresh. Native artifacts are updated snapshots, not live monitors.

Put required user actions in the dashboard before or alongside asking in chat.
Continue useful independent work while waiting. Warnings must not masquerade as
requests. A dashboard delivery problem is separate from the task's own blockers.

On resumption, read the durable record and reconcile it with Git, files, processes,
and services. Recheck reused ports and endpoints. Correct stale claims and resume
from the next incomplete milestone; do not rely on chat memory alone. After failure,
record what completed, what failed, and the safe recovery point.

At handoff, reconcile milestones, clear resolved actions, retain relevant risks,
record actual verification and final outputs, and summarize what changed. Separate
optional follow-ups from unfinished requirements. Commit the final snapshot when
possible before replying. Link the dashboard and tracked path, give its commit,
and disclose actual delivery/persistence limitations. Keep the final dashboard
available while the environment permits; do not promise host or process uptime.
