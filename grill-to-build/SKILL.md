---
name: grill-to-build
description: Turn a rough product, feature, migration, or architecture idea into an implementation-ready build pack through focused discovery, synchronized context and decision records, an explicit specification, ordered tickets, and implementation. Use when a user asks to grill an idea, resolve high-impact product or technical uncertainty before coding, create Context/ADR/Ideas/SPEC/ticket artifacts, or run a grill-to-build pipeline.
---

# Grill to Build

Convert uncertainty into shared language, explicit decisions, testable behavior, and executable work without designing the solution prematurely.

## Core contract

Maintain these artifacts in the project, preserving the repository's existing filename casing:

- `Context.md`: living, canonical understanding plus a useful system model.
- `ADR.md`: append-only record of consequential accepted, rejected, proposed, or superseded decisions.
- `Ideas.md`: valuable work deliberately deferred from the current scope.
- `SPEC.md`: implementation contract created only after discovery stabilizes.
- `tickets/*.md`: ordered work units created only after the specification stabilizes.

If equivalent files already exist, update them instead of creating duplicates. Read [artifact-contracts.md](references/artifact-contracts.md) before creating or materially restructuring these artifacts.

Use this authority order and resolve conflicts rather than preserving ambiguity:

```text
Current explicit user decision
        -> Context
        -> ADR rationale
        -> Specification
        -> Ticket acceptance criteria
        -> Implementation
```

`Ideas.md` is non-binding.

## Run the pipeline

### 0. Resolve scope and portable preferences

Infer the requested endpoint: discovery, build pack, or implementation. Run only the requested stages; invoking this skill alone does not authorize implementation, publishing, or external sharing. No companion skill, paid service, global `AGENTS.md`, or account memory is required.

Read [preferences-and-diagrams.md](references/preferences-and-diagrams.md) before the first discovery round. Reuse an explicit diagram preference; otherwise ask the separate first-round format question described there. It does not consume the discovery question allowance. If unanswered, use Markdown/Mermaid. A user's choice of no diagram is valid.

On resume, read existing artifacts and their open questions before asking anything. Reuse recorded preferences and completed decisions. Preserve compatible repository layouts, including existing ADR directories and ticket conventions.

### 1. Extract the raw idea

Inspect the existing project and pull out facts already supplied: problem, user, platform, current system, constraints, technology preferences, likely scope, exclusions, terminology, and known decisions.

Do not ask for information already present in the request, repository, or existing artifacts. Initialize only missing discovery artifacts; do not create `SPEC.md` or tickets yet.

### 2. Grill high-impact uncertainty

Before each round, rank unknowns by downstream impact. Ask approximately 3-4 short, independently answerable questions. Default to no more than 5 rounds or 20 total questions, and stop earlier once remaining ambiguity is inexpensive and reversible.

Track discovery rounds and question count in Context so resuming does not reset the budget. Count each independently answerable product question; the single diagram setup question is exempt. At the limit, record unresolved material questions and the blocked specification sections. Continue independent work, but do not invent answers or call the pack implementation-ready. Ask whether to extend discovery when more answers are necessary.

Prioritize product boundaries, domain/state semantics, data integrity, user workflow, platform architecture, persistence, external dependencies, destructive behavior, and acceptance criteria. Deprioritize cosmetics, speculative features, and reversible implementation details.

When useful, give concrete options. Clearly label a recommendation and its consequence; never turn a recommendation into a hidden decision. Read [grilling-and-modeling.md](references/grilling-and-modeling.md) for question selection, vocabulary, state, diagram, and completion rules.

After every round:

1. Rewrite Context coherently; do not append a conversation transcript.
2. Append or supersede only consequential ADR entries.
3. Park useful deferred ideas immediately.
4. Update the living model when entities, relationships, flows, states, systems, or storage boundaries change.

Continue useful read-only investigation while waiting for answers, but do not guess at choices that materially change the product.

### 3. Close discovery

End discovery once the important entities, lifecycle behavior, required data, destructive operations, platform boundaries, major constraints, and meaningful edge cases are understood. Briefly restate the agreed project and ensure Context, ADR, Ideas, and the living model agree.

### 4. Write the specification

Generate `SPEC.md` from the accepted discovery artifacts. Do not introduce a major product decision while writing it. If a material unknown appears, resolve it through discovery, synchronize the artifacts, then continue.

Make important behavior observable and testable. Prefer explicit rules over phrases such as "handle appropriately." Read [specification-tickets-and-build.md](references/specification-tickets-and-build.md) before generating the specification.

### 5. Decompose tickets

After the specification is stable, create ordered `tickets/PRJ-###-slug.md` work units using a stable, project-specific prefix. Each ticket must have a goal, concrete scope, observable acceptance criteria, and dependencies. Prefer coherent vertical increments over file-level chores or entire-project tickets.

### 6. Build and feed discoveries back

When implementation is part of the request, start from the first incomplete ticket and continue through the scoped pack. Treat SPEC as required behavior, Context as shared terminology, ADR as decision rationale, and Ideas as out of scope.

Route new information deliberately:

- New requirement: update Context and SPEC, plus ADR/tickets when affected.
- New architectural decision: update ADR and Context, then affected SPEC/tickets.
- Future idea: update Ideas only unless explicitly promoted.
- Implementation detail: leave product artifacts alone unless shared understanding changes.

Verify ticket acceptance criteria and repository-standard tests before marking work complete.

## Operating rules

1. Ask only questions that can materially alter the result.
2. Keep a ubiquitous vocabulary and reuse it in models, storage, UI, tests, and tickets.
3. Distinguish stored, derived, inferred, and external state; avoid persisting derived state without a strong reason.
4. Keep Context descriptive, ADR argumentative, SPEC contractual, and Ideas non-binding.
5. Make destructive behavior, error behavior, migrations, and data ownership explicit.
6. Preserve future options through clean boundaries, not current-scope feature inflation.
7. Do not generate tickets before the specification stabilizes.
8. Update the pack when implementation invalidates an assumption.
9. Stop grilling when remaining decisions are inexpensive and reversible.
10. Finish with a synchronized, executable pack rather than a discussion transcript.
