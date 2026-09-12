# Specification, Tickets, and Build

## Contents

- Specification discipline
- Acceptance criteria
- Ticket sizing and ordering
- Implementation authority
- Feedback routing
- Completion

## Specification discipline

Generate `SPEC.md` from synchronized Context and ADR decisions. The specification must not invent major product behavior. If drafting reveals a high-impact unresolved choice, stop that section, resolve the choice with the user, update Context and ADR when consequential, then continue.

Minor, reversible implementation choices may be resolved directly. For every feature, ask whether another capable implementation agent could build it without guessing product behavior.

## Acceptance criteria

Write observable rules. Prefer explicit outcomes such as `Cancel leaves the record unchanged` over vague criteria such as `Handle cancellation appropriately.` Include required error behavior and tests where risk warrants them.

## Ticket sizing and ordering

A useful ticket creates a coherent increment, is independently understandable, and has observable completion criteria. Avoid both `Build the entire application` and file-level chores such as `Create one text field`.

Prefer vertical capabilities. Order tickets as an executable dependency graph: foundation, data model, core behavior, workflows, external/platform features, migrations, conflict handling, accessibility, and release polish as applicable. State dependencies explicitly.

## Implementation authority

During implementation, SPEC defines required behavior, Context defines terminology, ADR explains accepted decisions, ticket criteria define work-unit completion, and Ideas remains outside current scope. Start with the first incomplete ticket unless dependencies or repository state require another order.

## Feedback routing

- New requirement: update Context and SPEC; adjust ADR/tickets if affected.
- New architectural decision: update ADR and Context; adjust SPEC/tickets.
- New future idea: update Ideas only unless promoted.
- Implementation detail: do not change product documents unless it changes shared understanding.

Resolve any conflict among artifacts immediately.

## Completion

For each ticket, implement the complete scoped outcome, exercise failure and migration paths proportional to risk, run repository-standard validation, confirm every acceptance criterion with evidence, and update artifacts if an assumption changed.

Finish with a synchronized pack and working implementation when implementation was requested.
