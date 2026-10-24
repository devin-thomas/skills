# Ledger format

## Contents

- [Layout and identity](#layout-and-identity)
- [Metadata](#metadata)
- [State and evidence](#state-and-evidence)
- [Index](#index)
- [Compatibility and recovery](#compatibility-and-recovery)

## Layout and identity

Use these defaults for a new ledger; honor an existing project contract:

| Artifact | Path from the project root |
| --- | --- |
| Mutable index | `reports/INDEX.md` |
| Plan snapshot | `reports/plans/<ID>-<YYYY-MM-DD>-<topic>.md` |
| Walkthrough snapshot | `reports/walkthroughs/<ID>-<YYYY-MM-DD>-<topic>.md` |

Use independent ascending integer sequences for plans and walkthroughs. Format
IDs as quoted strings with at least three digits. Allocate from the maximum known
ID in that type's files and index, not the file count. Preserve gaps and reserved
historical IDs. Never allocate the same type/ID to different filenames.

Use a short lowercase hyphenated topic slug containing only ASCII letters,
digits, and single hyphens; start and end with a letter or digit. Do not accept
path separators, traversal segments, or an absolute path as a slug.

Use the project or user's known timezone for the filename date. If neither is
known, use UTC and disclose that assumption. Optional `recorded_at` must include
an explicit UTC offset or `Z`. Use the recording date for a new retrospective
report; state the earlier event date in its body instead of backdating.

Reference another report by its full path relative to the ledger root, for
example `plans/003-2026-10-23-cache-policy.md`. Bare IDs are ambiguous across
types. Metadata paths always use this ledger-relative form; Markdown body links
must instead resolve from the file that contains them.

## Metadata

Keep the original five required fields. Add `outcome` to new walkthroughs.

| Field | Rule |
| --- | --- |
| `type` | `implementation-plan` or `walkthrough` |
| `id` | Quoted numeric ID matching the filename |
| `date` | Quoted `YYYY-MM-DD` matching the filename |
| `title` | Nonempty quoted descriptive title |
| `status` | State asserted when the snapshot was recorded; never edit later |
| `outcome` | Required for new walkthroughs; omit from plans |
| `recorded_at` | Optional timestamp with timezone |
| `supersedes` | Optional list of exact earlier report paths replaced or corrected |
| `plans` | Optional list of exact plan paths whose work a walkthrough addresses |

Use valid YAML, quote IDs and date-like values, and escape title strings
correctly. Omit unused optional fields rather than leaving template tokens.
Preserve extra metadata already required by the project.

For new plans, use `draft` or `approved` at recording. If a later report changes
their current state, reflect that in the index while retaining the original
frontmatter. For new walkthroughs, use `status: recorded`; this means an
observation was preserved and makes no completion claim.

Example plan revision:

```yaml
---
type: implementation-plan
id: "004"
date: "2026-10-23"
title: "Cache policy with explicit invalidation"
status: approved
supersedes:
  - "plans/003-2026-10-23-cache-policy.md"
---
```

An approved snapshot must include the applicable approval evidence in its body.
If approval covers only the earlier version and the revision changes scope, use
`draft` for the new version.

Example incomplete walkthrough:

```yaml
---
type: walkthrough
id: "002"
date: "2026-10-23"
title: "Cache invalidation implementation and checks"
status: recorded
outcome: partial
plans:
  - "plans/004-2026-10-23-cache-policy.md"
---
```

## State and evidence

Use these current plan states in the index:

| State | Required basis |
| --- | --- |
| `draft` | A proposed version without applicable recorded approval |
| `approved` | Existing user authorization or project approval covering that version |
| `executed` | A linked walkthrough covering the plan's scope and acceptance criteria |
| `superseded` | An explicit replacement of an unexecuted plan version |

An approved successor supersedes the earlier draft; it does not rewrite the old
draft's frontmatter into an approval record. Keep prior executed versions marked
executed when subsequent work evolves the design. Use a body link to relate a
new plan to an executed predecessor rather than marking that predecessor
unexecuted or superseded.

Record walkthrough outcomes against the stated walkthrough scope:

| Outcome | Meaning |
| --- | --- |
| `passed` | All checks needed for that stated scope completed successfully |
| `partial` | Some work or required checks remain; document any individual failures |
| `failed` | Attempted work or a required check failed; describe remaining coverage |
| `blocked` | A missing capability, dependency, or access prevented useful completion |
| `not-run` | No execution or verification was performed; the report records that fact |

Choose the outcome that best describes the milestone and enumerate the actual
per-check results. Do not use `passed` when a required check was skipped. A
narrowly scoped walkthrough can pass without completing its parent plan.

A `plans` link associates evidence; it does not automatically mark any plan
executed. A `supersedes` link records replacement or correction; explain what
changed. Use supersession within a report type, target an older report, and avoid
cycles. Do not treat a matching title, latest date, or greater ID as evidence
that one report replaces another.

Prefer evidence preserved within the ledger or at an immutable source revision.
For an approval given in conversation, preserve its relevant wording or faithful
summary, date, and context in the new snapshot; use a stable conversation
reference only if actually available. Never invent an approval, URL, timestamp,
commit, test result, or source identifier.

If new evidence retracts a completion claim or corrects an earlier walkthrough,
write a new walkthrough referencing the corrected report with `supersedes`.
Explain which plan claims are affected. Preserve the original report. Annotate
the plan's index status with the discrepancy and corrective report; do not
silently continue treating contradicted evidence as current or fabricate a new
approval state. Resolve any remaining ambiguity explicitly.

## Index

Use the supplied index template for a new ledger:

- **Plans:** ID, Date, Current status, Title, File, Status evidence.
- **Walkthroughs:** ID, Date, Outcome, Title, File.

Keep a single row per report path. A plan row initially cites its own snapshot.
A later change to its current status cites the newer report supporting the
change. Keep all earlier report rows accessible.

For a corrected walkthrough, preserve both rows and annotate the earlier row's
Outcome cell with a link to the corrective report, for example `partial; corrected by 003`, with `003` linked to
`walkthroughs/003-2026-10-24-correction.md`. Retain its originally
recorded outcome rather than presenting the later result as what happened then.

Escape pipes and line breaks in Markdown table text. Links in `INDEX.md` resolve
from the ledger root. Existing column arrangements may remain in use if they
convey the same evidence and preserve the project's historical information.

The index is editable, but it is not an independent authority for changing what
a snapshot said. A status that differs from its snapshot needs linked later
evidence. Never update the entire index from a stale cached copy.

## Compatibility and recovery

Adopt an existing ledger in place. Do not rename old files, reformat frontmatter,
renumber reports, or add missing fields to frozen snapshots. New reports follow
this contract; classify older schema differences as legacy records.

Read an existing walkthrough's `status: executed` as its historical claim.
If it has no outcome field, show its recorded status and note that the outcome
was not separately recorded; do not manufacture a passed result. When an older
index already reports current state, retain it and identify unsupported claims
as unverified until evidence establishes them.

Coordinate writes across the whole ledger, including its shared index. For
shared files, use one designated writer with no competing writers, or the
environment's suitable lock. For a repository API, a conditional commit/ref
update can provide equivalent coordination if it detects a changed base and
never replaces existing reports. Keep lock mechanics out of report identity.

Branches and independent worktrees do not share a numbering lock. Before
integration, inspect the combined ledger for ID and index conflicts. Resolve
unpublished allocations before publishing. If both conflicting snapshots were
already published, preserve their paths and record the collision for an explicit
additive reconciliation; do not silently renumber one of them.

A retry after a snapshot succeeded but its index update failed must reuse the
existing verified snapshot and add only its missing row. A wholly interrupted or
partial file is not a valid report: retain it as recovery evidence until its
provenance and the authorized recovery are established. Do not use a template to
invent missing historical content.

Restore missing historical bytes only from a verified prior copy or revision
when recovery is in scope. Treat absent or inconsistent history as an explicit
audit finding. Never claim that a present-day structural check proves historical
immutability.
