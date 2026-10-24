---
name: immutable-reports
description: Preserve implementation plans, their design decisions, and verification walkthroughs as numbered, append-only Markdown snapshots with a synchronized project ledger. Use to initialize a reports ledger, record or revise a plan, preserve approval or execution evidence, record partial or failed work, reconcile a ledger, or audit historical reports in any agent harness.
---

# Immutable Reports

Preserve what was proposed, authorized, attempted, and verified without rewriting
earlier records. Use project files, user-provided text, or available user-facing
artifacts as inputs; no special artifact filename or agent workspace is required.

## Contract

- Freeze each complete snapshot when it is published into the ledger, even before
  a Git commit. Prepare editable drafts outside the final snapshot directories.
- Add a new numbered snapshot for a revision or correction. Preserve earlier
  snapshot contents and paths, including when their status later changes.
- Keep `reports/INDEX.md` as the mutable navigation and current-status view.
  Support status changes with linked evidence; do not change snapshot frontmatter.
- Treat the full ledger-relative path as the report identity. Number plans and
  walkthroughs independently; `plans/001-...` and `walkthroughs/001-...` differ.
- Record only approval already given and results supported by observations.
  Recording a plan does not authorize its implementation.
- Use the current environment's permitted file or repository tools. No particular
  model, harness, shell, runtime, Git host, private account, or sibling skill is
  required. Git commits and remote publication follow the task's existing scope.

This is an append-only working convention. It does not make writable storage
tamper-proof. State what historical baseline an integrity audit actually checked.

Before creating or reconciling reports, read
[the ledger format](references/ledger-format.md). Use the relevant templates:
[index](assets/INDEX.md), [plan](assets/plan.md),
[walkthrough](assets/walkthrough.md), and
[project rule](assets/project-rule.md).

## 1. Locate and inspect

1. Resolve the intended project root from the task and existing project context.
   Reuse its established ledger location; default to `reports/` for a new ledger.
   If multiple projects are equally plausible, ask which one before writing.
2. Inspect the project instructions, index, existing snapshots, and available
   history. Preserve existing layout, numbering, and historical metadata.
3. Determine the requested operation. Keep an audit read-only unless repair is
   requested. A one-time snapshot does not require a persistent instruction edit.
4. Identify the available write capability. If durable writes are unavailable,
   provide the complete proposed report and index delta, and state that neither
   was saved. Do not claim initialization, integration, or recording succeeded.

## 2. Initialize or adopt

For a new ledger, create only the missing `plans/`, `walkthroughs/`, and
`INDEX.md` beneath its root. Start the index from the supplied template.

For an existing ledger, inspect contents before writing. Preserve custom
sections, historical rows, snapshot bytes, and links. Add missing compatible
structure; do not replace an existing index with the empty template. A healthy
second initialization makes no changes.

When asked to establish an ongoing project rule, merge the supplied rule into
the applicable project instruction file if the task covers that edit. Choose the
file the project actually uses; do not require or create a particular harness's
instruction filename. Avoid duplicate rules and verify the resulting content.
Direct skill use remains valid without persistent integration.

Complete setup only after reading back the directories and index. Report
persistent instruction integration separately, including when it was unnecessary
or unavailable.

## 3. Prepare a snapshot

Capture each completed plan version, substantive revision, approval transition,
or implementation/verification milestone being recorded. Do not wait for
`implementation_plan.md` or `walkthrough.md` to appear, and do not record every
intermediate drafting edit.

For a plan, include scope, decisions, intended changes, acceptance criteria, and
known constraints. Use `draft` unless existing authorization or a project record
supports `approved` for this exact version. Cite that evidence. Do not ask the
user to approve again merely to record approval already given.

For a walkthrough, include work performed, checks and their actual results,
evidence, remaining work, and limitations. Use `status: recorded` and an honest
`outcome`: `passed`, `partial`, `failed`, `blocked`, or `not-run`.
A walkthrough can be useful even when the task is unfinished.

Keep each snapshot understandable on its own. Copy the relevant user-facing
content into the report, identify its source, and link supporting evidence.
Do not substitute a link to an ephemeral agent artifact for the report body.
Use project-relative paths or stable revision links where possible; identify
evidence that is unavailable or mutable. Exclude credentials and internal agent
reasoning. Recording evidence does not imply that every linked artifact's bytes
were preserved.

## 4. Publish and reconcile

1. Serialize ID allocation, snapshot creation, and index reconciliation through
   one designated ledger writer or an equivalent conditional transaction. Parallel
   agents can prepare content outside the ledger. Exclusive creation of one
   filename alone does not prevent duplicate IDs with different topic slugs.
2. Read the latest snapshots and index. Within the selected type, allocate one
   more than the greatest known numeric ID, including IDs reserved by historical
   index rows. Start at `001`, pad to at least three digits, and continue with
   `1000` after `999`. Do not fill gaps or reset numbering on a new date.
3. Choose a safe topic slug, fill all template values, and check frontmatter,
   references, and intended destination before publishing. Use creation that
   rejects an existing destination. Never use an overwrite or force option.
4. Read back the new snapshot. Immediately add its index row once, using a link
   relative to the ledger root. Preserve unrelated rows and concurrent changes.
5. Apply only status transitions supported by the new evidence:
   - A new plan can supersede the exact earlier unexecuted versions it explicitly
     replaces. An already executed plan remains part of the execution history.
   - Mark a plan `executed` only when a linked walkthrough demonstrates completion
     of that plan's scope and acceptance criteria. A `passed` check on one subset,
     a different revision, or a partial/failed attempt is insufficient.
   - For approval-only changes, create a new approved snapshot containing the plan
     and approval evidence, linked to the previous draft. Keep the draft unchanged.
6. Verify the snapshot, unique identity, exactly one corresponding index row,
   resolving links, justified state changes, and unchanged prior snapshots.
   When appropriate, commit the report and index together under the repository's
   existing workflow; saving reports does not itself authorize pushing remotely.

If coordinated, non-overwriting publication is unavailable, keep the prepared
content outside the ledger and identify the blocked write. Do not weaken the
contract to claim completion.

## 5. Recover or audit

For a complete snapshot missing from the index, verify it and add the missing
row; do not recreate or edit the snapshot. For an index row with no snapshot,
inspect history and backups. Preserve the row and reserve its ID; never invent
the missing report's contents or silently remove the evidence of a gap.

For a partial write, conflicting IDs, an interrupted update, or a suspected
changed historical report, preserve available evidence and report the exact
discrepancy. Use an additive correction or a verified recovery under the task's
authorization. Do not silently renumber, delete, rewrite, or backdate reports.

Audit structure, metadata, numbering, links, status evidence, and consistency
between snapshots and index. Compare older bytes against a known earlier commit,
trusted copy, or digest when available. Without that baseline, report structural
consistency and the integrity checks that remain unverified. Do not repair an
audit finding without repair scope.

## Completion

Return the new report paths, index path, source/version relationships, and the
recorded outcome. Distinguish saved locally, committed, and remotely published
only when those actions actually occurred. If a snapshot exists but index
reconciliation failed, report that partial state and the exact remaining repair;
the recording operation is not complete until both agree.
