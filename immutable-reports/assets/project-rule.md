## Immutable Reports Ledger

Preserve completed implementation plan versions, their design decisions, and
implementation/verification milestones as standalone snapshots in the project's
reports ledger. Use the established location, or `reports/` for a new ledger.

- Keep numbered snapshots in `plans/` and `walkthroughs/`; retain their contents
  and paths once published, even before a Git commit.
- Create a new snapshot for a revision or correction. Never overwrite or delete
  a historical snapshot as part of ordinary report maintenance.
- Maintain `INDEX.md` as the editable navigation and current-status view. Preserve
  historical rows and link status changes to supporting reports.
- Keep `type`, quoted `id`, quoted `date`, `title`, and snapshot-time `status`
  in frontmatter. New walkthroughs use `status: recorded` and an honest outcome.
- Allocate IDs independently by report type, using the greatest known ID plus
  one and at least three digits. Coordinate allocation and writes through one
  ledger writer or an equivalent conditional transaction.
- Record existing approval accurately. Mark a plan executed only when a linked
  walkthrough supports its full scope and acceptance criteria.
- Verify the new snapshot and its index row before claiming that recording is
  complete. Report write failures and unresolved ledger inconsistencies.

Use the project's installed `immutable-reports` skill for the full format and
recovery workflow. Direct invocation works without this persistent rule.
