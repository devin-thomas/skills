---
name: agent-prompt
description: Build or refine branded agent-prompt controls, copyable task prompts, open-in-agent drafts, and project handoffs. Use for agent onboarding and task launchers with short prompts backed by readable guides.
---

# Agent Prompt

Build a compact handoff: recognize the agent, copy or open once, and continue the task. Keep authentic product branding, useful copy, and a short payload together.

## Establish the task and appearance

Identify the destination page, requested outcome, supported agent products, and guide the agent will read. When a site is supplied as a visual reference, apply the pattern to the target project.

Use the project's existing components, typography, colors, spacing, radii, and theme conventions. Honor explicit user direction where it changes those choices. If neither a visual system nor a direction exists, use the optional [default appearance](references/default-appearance.md) and [scoped stylesheet](assets/agent-prompt.css). The default is a starting point for the handoff component; it does not restyle the surrounding product.

Use [Agent Prompts](https://agent-prompts.vercel.app/) as the public reference implementation. For choosing among its seven control formats, read [formats](references/formats.md). For implementation or a UI audit, read [the interaction and verification contract](references/contract.md). For the dated research behind the patterns, read [observed patterns](references/observed-patterns.md). None requires a private skill or the author's accounts.

## Write the bootstrap

Use one sentence containing the outcome, one canonical guide URL (or an available repository instruction path), and only inputs the agent cannot recover. For example:

```text
Read https://agent-prompts.vercel.app/guides/branded-handoff.md and add a branded agent handoff to this project, following its scope and verification steps.
```

Aim for at most **40 words and 300 characters, including URLs**. This is a review target, not permission to omit essential user constraints. Move setup branches, file maps, API details, and verification procedures into the guide before lengthening the paste. Resolve placeholders before enabling copy. Whole-page Markdown export is a separately labeled action.

Fetch the guide from the intended agent environment. It must return readable instructions with scope and a completion check. A successful response containing an app shell, login wall, or missing-file page fails this check.

## Keep the control recognizable and useful

Pair authentic product marks with readable names. Distinguish Codex from ChatGPT, Claude Code from Claude, and Grok Bot from Grok. A mark identifies a tool; it does not establish a connection or repository access. Preserve artwork geometry, transparent cutouts, full-color originals, and applicable attribution. Use authentic monochrome variants for contrasting surfaces; never invent brand colors.

For a page whose purpose is the handoff, keep a usable branded action visible at scroll position zero at **320 × 667** and **390 × 844** CSS pixels. For an embedded feature action, place it beside that feature and check the component at the same widths. Keep marks, names, and action together without clipping or horizontal overflow; let logo groups wrap independently.

Name the task and action directly: `Agent picker`, `Copy build prompt`, `Copy for Codex`, `Open in Cursor`. Remove slogans, decorative labels, repeated explanations, and implementation details that do not help the visitor decide. Preserve necessary prerequisites, consequences, and recovery instructions. The public [No Useless Copy](https://github.com/devin-thomas/skills/tree/main/no-useless-copy) skill can extend a requested copy review; it is optional.

## Make the handoff honest

Generate preview text, clipboard text, counts, and any launch URL from one resolved payload. Announce success only after the clipboard write resolves. On failure, offer the complete selected text in an accessible manual-copy dialog. Clear stale feedback when switching agents or copying again.

Offer launch links only after verifying their current format. Pair them with a copy fallback and describe whether they open a draft. Public guides and handoff records operate within the user's existing authorization; they grant no additional permission for deployment, messages, or account changes.

For continuation, verify the existing project record against the working tree, complete the next authorized unfinished step, run relevant checks, and update that same record with concise status and repository-relative links. Exclude credentials, personal paths, machine details, and raw session logs.

## Finish with evidence

For a prompt-only request, return the final prompt after checking its length and guide retrieval. For a component or page, verify the rendered target, keyboard behavior, payload parity, clipboard denial recovery, responsive layout, reduced motion, and light/dark appearance. Test real Dark Reader transformation when the browser environment supports extensions; report unavailable coverage explicitly. Run the target project's relevant checks.

Report what changed, the resolved prompt's word/character counts, verified guide retrieval, visible branding and action at phone widths, and any remaining coverage gaps. Missing authentic assets or an unusable action leaves the handoff incomplete; an interim named text control is a recovery state.
