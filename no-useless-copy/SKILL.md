---
name: no-useless-copy
description: Remove filler, repetition, decorative labels, leaked implementation text, and redundant recovery instructions from user-facing interface copy. Use when writing, implementing, or reviewing UI copy; do not use to shorten technical documentation or ordinary prose.
---

# No Useless Copy

Make every visible string earn its place. Copy must help the user understand the current state, provide required information, or take the next action.

## Contract

- Delete labels, subtitles, slogans, and eyebrow text that only repeat or code the heading below them.
- Do not expose route names, sequence numbers, lifecycle enums, provider payloads, internal thresholds, hashes, or implementation terminology as product copy.
- Do not add descriptive text solely to fill space, balance a layout, explain an obvious control, or create visual atmosphere.
- Do not repeat a recovery action in an error message when the correct action is already clear and available on the same screen.
- Use direct task nouns for headings and direct verbs for actions. Keep necessary explanations concrete and short.
- Preserve copy that carries a distinct function: field labels, accessible names, validation, consequences, safety warnings, confirmation requirements, status, scope, or genuinely necessary next steps.
- Never remove required copy merely to make an interface look minimal.

Respect product terminology, localization, existing brand requirements, and necessary instructional copy. Technical identifiers can be appropriate in developer tools when users need them to perform a task; remove accidental implementation leakage, not meaningful domain information.

## Review Method

Inspect the rendered surface and its accessibility tree when possible. Enumerate the user-visible strings affected by the task. For each string, ask:

1. Does it communicate state, required information, or an action?
2. Does another nearby element already communicate the same thing?
3. Is it product language, or did an internal name leak into the interface?
4. Would removing it make the task, consequence, recovery path, or accessible name unclear?

Remove the string when it has no unique user-facing purpose. Rewrite it when the purpose is valid but the wording is vague, duplicated, or implementation-shaped.

## Errors And Recovery

State what failed. Include a safe reason when it helps the user decide what to do. Add a next step only when the interface does not already present the correct recovery control.

Do not turn errors into generic encouragement. Do not show raw provider errors. Do not add a separate `Try again` link when the original action remains visible and is the retry mechanism.

## Concrete Failures

```text
Identity / Profile
Profile
```

The first line is useless because it restates the heading. Keep only `Profile`.

```text
Identity / 004
Sign In
```

The first line is useless and exposes an unexplained internal code. Keep only `Sign In`.

```text
Couldn't sign in. Try again.
[Continue with Discord]
[Send magic link]
```

The generic retry instruction does not identify which sign-in method failed. Name that failure when known and keep the applicable recovery controls; do not remove a distinct recovery path.

## Completion Check

Before finishing, verify that:

- every visible string has a distinct purpose;
- no small label merely restates or codes its heading;
- no decorative or SEO copy entered the product interface;
- errors are safe, descriptive, and paired with one clear recovery path;
- required labels, warnings, consequences, and accessible names remain intact;
- tests or review evidence cover removed copy when the project normally tests UI behavior.
