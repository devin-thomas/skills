# Grilling and Modeling

## Contents

- Question budget
- Selecting questions
- Round format
- Modeling understanding
- Derived and stored state
- Discovery completion
- Scope control

## Question budget

Use at most 5 rounds and 20 questions by default. Ask roughly 3-4 questions per round and stop early when shared understanding is sufficient. The goal is to expose high-impact unknowns, not collect every conceivable requirement.

The single first-round diagram preference question is separate and does not consume this allowance. Follow [preferences-and-diagrams.md](preferences-and-diagrams.md) for preference precedence, choices, fallback, and persistence. Retain the budget count across resumes. If material uncertainty remains at the limit, mark affected work blocked and resolve it before declaring the pack ready.

## Selecting questions

Rank uncertainty in this order when relevant:

1. Product boundaries
2. Domain model
3. State transitions
4. Data integrity
5. User workflow
6. Platform architecture
7. Persistence
8. External dependencies
9. Destructive behavior
10. Acceptance criteria

Avoid spending the question budget on colors, exact spacing, speculative future features, minor naming, or implementation details that are easy to reverse.

Keep questions short, concrete, and independently answerable. Offer choices when that reduces ambiguity. If recommending an answer, state why and what follows from it.

## Round format

After each answer round, integrate answers into canonical Context sections, add or supersede consequential ADR entries, capture deferred value in Ideas, and update the living model if the mental model changed. Never use discovery artifacts as a chronological chat log.

## Modeling understanding

Choose the smallest visual format that represents the uncertainty being resolved: a system map for boundaries, an entity relationship model for a domain-heavy product, a state model for lifecycle-heavy behavior, or a flow model for workflows. Use Mermaid, FigJam, a design canvas, or another maintainable medium according to user preference and available tools. Do not add diagrams as decoration.

Respect a no-diagram preference by maintaining the same semantics in prose and tables. For external canvases, retain a textual model and verified link in Context and report synchronization failures.

Maintain ubiquitous language. Define any entity, role, status, ownership term, lifecycle name, or calculated concept that could be interpreted differently. Reuse the chosen terms in database names, model names, variables, UI labels, tests, and tickets. Avoid synonyms that fracture the model.

## Derived and stored state

Classify meaningful concepts as stored explicitly, calculated or derived, inferred, or external. Do not persist a derived value as a second source of truth without a documented reason. Record consequential state-model decisions in Context and ADR.

## Discovery completion

Stop grilling when important entities and relationships, lifecycle behavior, required data and ownership, destructive operations, major failures, platform/storage boundaries, constraints, and meaningful edge cases are understood and remaining uncertainty is inexpensive and reversible. Summarize the agreed project before writing the specification.

## Scope control

Classify each newly surfaced feature as required now, valuable but deferred, or disposable. Put required behavior in Context and SPEC. Put valuable deferred work in Ideas. Keep current architecture from blocking credible future needs, but do not build deferred capabilities merely because they are plausible.
