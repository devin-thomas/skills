---
name: style
description: Apply Devin Thomas's coding style guide for the language or framework being written. Use when writing, reviewing, or refactoring code and the user asks to follow their style, conventions, or style guide. In an existing codebase it reports what it would change; pass `refactor` to apply the changes.
---

# Style

## Find the guide

Read the [style catalog](https://starter.uppercut-labs.com/style/catalog.json) and the `.md` guide for every language or framework in scope. All nine published guides are finalized and authoritative: TypeScript, Godot, Kotlin, React + TypeScript, Python, Swift + SwiftUI, JavaScript, Dart + Flutter, and Rust. Apply their accepted rules without further guide-level approval.

When invoked through `dvn`, activate the matching guide stages before scanning or writing code: `typescript`, `godot`, `kotlin`, `react-typescript`, `python`, `swift-swiftui`, `javascript`, `dart-flutter`, or `rust`. Read the returned guide resources and their required companions. React + TypeScript supplements TypeScript; use both for React components. JavaScript also uses the TypeScript companion for shared contracts. Direct skill installations read those same guides from the catalog's Markdown URLs.

For JavaScript, TypeScript, and React website/application UI, apply TypeScript D026 and its companion rules JS029/RX034 before generating labels or choosing icons: default to text and proper icons; emoji require an explicit user request. Follow the rule's content exceptions and source/rendered handoff check.

If no guide matches a language, say so and leave that code out of scope.

Explicit user instructions and documented project rules (AGENTS.md, CLAUDE.md, linter or formatter configuration) take precedence over a guide where they conflict. Undocumented habits in existing code do not; those are what a scan reports.

## Choose the mode

- **Writing new code** with no existing code in scope: write it to the guide.
- **Existing code, default (scan):** report what would change. Do not edit files.
- **Existing code with `refactor`:** apply the changes, then report them.

Scope is what the user names (a file, directory, or diff); otherwise the whole repository, excluding generated, vendored, and dependency code.

## Scan

Read the code in scope against the guide and report deviations grouped by guide rule:

- the rule, quoted or paraphrased briefly;
- each affected location as `path:line`;
- the proposed change, with a short before/after when it is not obvious;
- whether the change could alter behavior or a public interface.

Order groups by impact, collapse repeated mechanical fixes into one group with a count, and end with a one-line summary of totals. Finish by stating that `style refactor` applies these changes. If nothing deviates, say so.

## Refactor

1. Record the starting state (`git status`) so changes can be reviewed and reverted.
2. Apply the scan's changes. Keep edits to style: no feature changes or unrelated fixes. Skip changes that would alter a public interface or runtime behavior unless the user approved them, and list what was skipped.
3. Run the project's formatter, linter, type checker, and tests where they exist. Fix failures introduced by the refactor; report failures that were already present.
4. Report what changed by rule, what was skipped and why, and the check results. Do not commit unless asked.
