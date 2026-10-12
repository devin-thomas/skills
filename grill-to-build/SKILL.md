---
name: grill-to-build
description: Turn a rough product, feature, migration, or architecture idea into an implementation-ready build pack through focused discovery, synchronized glossary, project brief, and decision records, an explicit specification, ordered tickets, and implementation. Use when a user asks to grill an idea, resolve high-impact product or technical uncertainty before coding, create GLOSSARY/PROJECT/ADR/Ideas/SPEC/ticket artifacts, or run a grill-to-build pipeline.
---

# Grill to Build

Convert uncertainty into shared language, explicit decisions, testable behavior, and executable work without designing the solution prematurely.

## Core contract

Maintain these artifacts in new projects:

- `GLOSSARY.md`: exact-case Matt Pocock skills v1.3-compatible canonical **domain terms only**, created lazily when the first term is settled. Honor existing `GLOSSARY-MAP.md` and its mapped per-domain glossaries.
- `PROJECT.md`: the living project brief, scope, constraints, agreed product rules, discovery progress and open questions, workflow preferences, and editable models (the non-lexical portion of the former `Context.md`).
- `ADR.md`: append-only record of consequential accepted, rejected, proposed, or superseded decisions.
- `Ideas.md`: valuable work deliberately deferred from the current scope.
- `SPEC.md`: implementation contract created only after discovery stabilizes.
- `tickets/*.md`: ordered work units created only after the specification stabilizes.

`GLOSSARY.md` must **not** become a spec, project brief, transcript, general context file, or store of decisions. Preserve compatible existing ADR/ticket layouts. Read [artifact-contracts.md](references/artifact-contracts.md) and [migration-from-context.md](references/migration-from-context.md) before creating or materially restructuring artifacts. An existing `Context.md` / `CONTEXT.md` is a *migration input*, not the new canonical output: never blindly rename a broad document or silently discard or duplicate its contents.

Authority is purpose-specific: an explicit current user decision wins; `PROJECT.md` holds current approved boundaries and state, `GLOSSARY.md` defines terminology only, ADR records reasoning and history, SPEC binds implementation behavior, and tickets bind scoped acceptance criteria. Reconcile conflicts immediately. `Ideas.md` is non-binding.

## Run the pipeline

### 0. Resolve scope and portable preferences

Infer the requested endpoint: discovery, build pack, or implementation. Run only the requested stages; invoking this skill alone does not authorize implementation, publishing, or external sharing. No companion skill, paid service, global `AGENTS.md`, or account memory is required.

Before editing project artifacts, inspect `GLOSSARY.md`, `GLOSSARY-MAP.md`, `PROJECT.md`, and any legacy `Context.md`, `CONTEXT.md`, or `CONTEXT-MAP.md`; follow the [migration contract](references/migration-from-context.md) to avoid split vocabularies. Read [presentation-and-interaction.md](references/presentation-and-interaction.md) and [preferences-and-diagrams.md](references/preferences-and-diagrams.md) before the first discovery round. **Silently choose the live Grill presentation based on verified host capabilities**: native, mobile-friendly interactive chat presentation in ChatGPT when supported; Claude Artifacts in Claude when available and useful; otherwise concise Markdown, with Mermaid when supported and useful. Do not ask a separate presentation or diagram-format setup question by default. Reuse explicit user/project preferences and allow overrides at any time. Independently maintain portable living-model semantics in `PROJECT.md`, defaulting to Markdown/Mermaid unless explicitly changed. A choice of **no persistent diagram** preserves the model as structured prose/tables and still permits host-native interactive chat visualization; **no diagrams anywhere** prohibits visualization in chat too.

Treat the selected diagram format and authoring source as a hard output constraint. Do not substitute an image-generation model for Figma/FigJam, Excalidraw, diagrams.net, Markdown/Mermaid, or no-diagram output. Image generation may be used for a diagram only when the user explicitly selects generated imagery as the diagram source or output method.

On resume, read existing artifacts and their open questions before asking anything. Reuse recorded preferences and completed decisions. Preserve compatible repository layouts, including existing ADR directories and ticket conventions.

### 1. Extract the raw idea

Inspect the existing project and pull out facts already supplied: problem, user, platform, current system, constraints, technology preferences, likely scope, exclusions, terminology, and known decisions.

Do not ask for information already present in the request, repository, or existing artifacts. Initialize `PROJECT.md` when discovery needs persistence; create `GLOSSARY.md` only once a canonical term has been resolved. Do not create `SPEC.md` or tickets yet.

### 2. Grill high-impact uncertainty

Before each round, rank unknowns by downstream impact. Ask approximately 3-4 short, independently answerable questions. Default to no more than 5 rounds or 20 total questions, and stop earlier once remaining ambiguity is inexpensive and reversible.

Track discovery rounds and question count in `PROJECT.md` so resuming does not reset the budget. Count each independently answerable product question; the default presentation selection is silent and costs no question. At the limit, record unresolved material questions and the blocked specification sections. Continue independent work, but do not invent answers or call the pack implementation-ready. Ask whether to extend discovery when more answers are necessary.

Prioritize product boundaries, domain/state semantics, data integrity, user workflow, platform architecture, persistence, external dependencies, destructive behavior, and acceptance criteria. Deprioritize cosmetics, speculative features, and reversible implementation details.

When useful, give concrete options. Clearly label a recommendation and its consequence; never turn a recommendation into a hidden decision. Present questions and visual models through the active host-native surface only when the content merits it; keep controls actionable, responses conversationally answerable, and unsubmitted UI selections non-binding. Read [grilling-and-modeling.md](references/grilling-and-modeling.md) for question selection, vocabulary, state, diagram, and completion rules.

After every round:

1. Rewrite `PROJECT.md` coherently; do not append a conversation transcript.
2. Update `GLOSSARY.md` (or its mapped glossary) **only** when a new domain term has become canonical; do not dump answers into it.
3. Append or supersede only consequential ADR entries.
4. Park useful deferred ideas immediately.
5. Update the living model when entities, relationships, flows, states, systems, or storage boundaries change.
6. Refresh any useful in-chat/Artifact visual from canonical understanding; never let a temporary UI become the only copy of a decision.

Continue useful read-only investigation while waiting for answers, but do not guess at choices that materially change the product.

### 3. Close discovery

End discovery once the important entities, lifecycle behavior, required data, destructive operations, platform boundaries, major constraints, and meaningful edge cases are understood. Briefly restate the agreed project and ensure `PROJECT.md`, applicable `GLOSSARY.md`, ADR, Ideas, and the living model agree.

### 4. Write the specification

Generate `SPEC.md` from the accepted discovery artifacts. Do not introduce a major product decision while writing it. If a material unknown appears, resolve it through discovery, synchronize the artifacts, then continue.

Make important behavior observable and testable. Prefer explicit rules over phrases such as "handle appropriately." Read [specification-tickets-and-build.md](references/specification-tickets-and-build.md) before generating the specification.

### 5. Decompose tickets

After the specification is stable, create ordered `tickets/PRJ-###-slug.md` work units using a stable, project-specific prefix. Each ticket must have a goal, concrete scope, observable acceptance criteria, and dependencies. Prefer coherent vertical increments over file-level chores or entire-project tickets.

### 6. Build and feed discoveries back

When implementation is part of the request, start from the first incomplete ticket and continue through the scoped pack. Treat SPEC as required behavior, `GLOSSARY.md` as shared terminology, `PROJECT.md` as current scope and discovery state, ADR as decision rationale, and Ideas as out of scope.

Route new information deliberately:

- New requirement: update `PROJECT.md` and SPEC, plus ADR/tickets when affected. Only update the glossary if canonical terms change.
- New architectural decision: update ADR and `PROJECT.md`, then affected SPEC/tickets.
- New canonical terminology: update the applicable `GLOSSARY.md` and reconcile dependent contracts.
- Future idea: update Ideas only unless explicitly promoted.
- Implementation detail: leave product artifacts alone unless shared understanding changes.

Verify ticket acceptance criteria and repository-standard tests before marking work complete.

## Operating rules

1. Ask only questions that can materially alter the result.
2. Keep a ubiquitous vocabulary in `GLOSSARY.md` (or mapped glossary) and reuse it in models, storage, UI, tests, and tickets.
3. Distinguish stored, derived, inferred, and external state; avoid persisting derived state without a strong reason.
4. Keep `GLOSSARY.md` lexical, `PROJECT.md` descriptive, ADR argumentative, SPEC contractual, and Ideas non-binding.
5. Make destructive behavior, error behavior, migrations, and data ownership explicit.
6. Preserve future options through clean boundaries, not current-scope feature inflation.
7. Do not generate tickets before the specification stabilizes.
8. Update the pack when implementation invalidates an assumption.
9. Stop grilling when remaining decisions are inexpensive and reversible.
10. Finish with a synchronized, executable pack rather than a discussion transcript.
