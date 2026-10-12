# Artifact Contracts

## Contents

- Glossary
- Project brief
- ADR
- Ideas
- Specification
- Tickets
- Recommended pack

## Glossary

Use the exact uppercase `GLOSSARY.md` convention from Matt Pocock skills v1.3. Include **only canonical domain terms**, defined in one or two sentences, with rejected synonyms under `_Avoid_` when helpful. Create it on first resolved term, not speculatively. If `GLOSSARY-MAP.md` exists, use its mapped domain glossaries. Do not duplicate terms, record product decisions here, or split a bloated document into multiple bloated glossaries. This file is vocabulary, not an implementation guide, spec, discovery history or project brief.

## Project brief

`PROJECT.md` is the living shared understanding that Grill's former `Context.md` actually represented. It answers what is being built, why, for whom, which behavior and constraints are agreed, what is excluded, which questions remain, how many Grill questions have been used, the workflow preferences, and the current system model.

Keep it descriptive rather than argumentative. Rewrite sections so it remains coherent and current. Include a visual model only when it materially clarifies the product, domain, state, flow, or system boundary. Link an external editable artifact from `PROJECT.md` when the chosen format does not embed in Markdown. Reference terms from `GLOSSARY.md` instead of redefining them.

## ADR

Use one append-only `ADR.md`, not one file per decision. Record consequential product and architecture choices such as platform, persistence, authentication, lifecycle semantics, data ownership, conflict behavior, supported platforms, and major domain modeling.

This is the default for new projects. If the repository already uses an ADR directory or another compatible decision structure, preserve it rather than merging or duplicating records.

Do not create ADRs for trivial implementation details. Use this shape:

```md
## ADR-### - Decision title

**Status:** Accepted | Superseded | Rejected | Proposed

**Decision:** What was decided.

**Rationale:** Why.

**Consequences:** What follows.
```

Preserve repository conventions if an existing ADR uses a compatible structure. Supersede earlier entries rather than rewriting their history.

## Ideas

Use `Ideas.md` as the parking lot for useful work that is not required now. Capture an idea when implementing it would materially increase current scope, the architecture should avoid preventing it, or it deserves preservation for a future release. Do not copy Ideas into required behavior unless the user explicitly promotes them.

## Specification

Create `SPEC.md` only after discovery stabilizes. Include enough observable behavior for another capable implementation agent to build without inventing product rules.

Typical sections include objective, success criteria, stack, structure, domain model, data semantics, features, user flows, business rules, external contracts, migrations, errors, accessibility, security, testing, and definition of done. Distinguish product rules from implementation recommendations.

## Tickets

Store tickets as `tickets/PRJ-###-slug.md`. Use this minimum structure:

```md
# PRJ-001 - Ticket title

## Goal

The outcome this ticket creates.

## Scope

- Concrete implementation work
- Components and boundaries

## Acceptance Criteria

- Observable behavior
- Required tests and failure behavior

## Dependencies

PRJ-000 or None.
```

Add Notes, Out of Scope, Test Cases, or Migration Requirements only when useful.

## Recommended pack

```text
project/
|-- PROJECT.md
|-- GLOSSARY.md       # created only when terms are settled
|-- ADR.md
|-- SPEC.md
|-- Ideas.md
`-- tickets/
    |-- PRJ-001-*.md
    `-- PRJ-002-*.md
```

Do not add other planning files unless the project genuinely requires them.

## Legacy migration

Read [migration-from-context.md](migration-from-context.md) before resuming a pre-migration Grill pack. If `Context.md` combined domain terms, rules, diagrams, progress, and preferences, move only terms into `GLOSSARY.md` and move the rest into `PROJECT.md`. A legacy upstream `CONTEXT.md` that truly is glossary-only can be renamed directly; preserve source material until verification. `CONTEXT-MAP.md` becomes `GLOSSARY-MAP.md` when its members are verified glossaries.
