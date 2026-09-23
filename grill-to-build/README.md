# Grill to Build

Turn an idea into shared terminology, explicit decisions, testable behavior, and ordered work. Discovery updates Context, ADR, and Ideas; a stable understanding becomes SPEC and tickets. Implementation runs when requested.

## Install and use

Ask your skill-capable agent to install `grill-to-build` from `https://github.com/devin-thomas/skills`, or copy this entire directory into its supported skills location. Keep the references, profiles, and agent metadata together. No other skill or diagram service is required for the Markdown workflow.

Example prompts:

```text
Use $grill-to-build to turn this idea into a build pack: ...
Use $grill-to-build with the Figma profile to scope and build: ...
Resume $grill-to-build from the existing Context and open questions.
```

## Diagram preferences on another computer

Without a saved choice, the first round includes a separate format question that does not spend the discovery allowance. Choices are Markdown/Mermaid, Figma/FigJam, Excalidraw, diagrams.net, and no diagram. Unanswered setup defaults to Markdown/Mermaid.

The chosen format is a hard output constraint. Do not replace it with an AI-generated diagram image. Image generation is valid only when the user explicitly selects generated imagery as the diagram source or output method. For an `Excalidraw to PNG` request, author the editable Excalidraw scene first and render that scene to PNG.

To default to Figma across projects, copy `profiles/figma.md` to `PREFERENCES.md` in your installed skill directory and retain that file in your own versioned copy. Alternatively, say "with the Figma profile" on first use. Each project's Context records its choice, so resuming that project requires no setup question. A project-root `grill-to-build.preferences.md` can supply shared team preferences.

Preferences travel with files you copy or clone; this workflow does not depend on account synchronization or a global AGENTS.md. Integrations and access still need to be available on the destination computer. When an integration is missing, discovery continues locally with Markdown/Mermaid while preserving the preferred format.

See [the preference contract](references/preferences-and-diagrams.md) for precedence and fallback details.

## Portability boundaries

- Existing artifact layouts and terminology are preserved.
- Product questions stay within five rounds or twenty questions by default; unresolved material choices remain explicit blockers.
- External diagrams have a textual counterpart, so collaborators can use the pack without service access.
- Invoking the skill does not itself authorize publishing, deployment, paid tools, or public sharing.
- No personal account identifiers, local absolute paths, or credentials are required.

## Manual behavior checks

Before changing the workflow, review these cases against the entry point and references:

| Scenario | Expected behavior |
| --- | --- |
| Fresh install; no preference | One separate format question plus discovery questions |
| Product answers omit format | Markdown/Mermaid; source recorded as default |
| Explicit Figma profile | No redundant format question; check capability |
| Figma unavailable | Preferred Figma retained; active Markdown fallback disclosed |
| User selects no diagram | Prose/tables; no hidden diagram or repeated prompting |
| Explicit Excalidraw + PNG | Native editable Excalidraw scene first, then render/export that scene to PNG; never synthesize a look-alike with image generation |
| Selected diagram tool unavailable | Disclose the limitation and use only an allowed fallback; image generation is not an implicit fallback |
| Existing Context on a new machine | Reuse recorded preference and budget |
| Current user overrides saved preference | Current instruction wins |
| Five rounds end with material uncertainty | Block affected sections; do not invent acceptance rules |
| Existing ADR directory | Preserve it; no duplicate ADR.md |
| Build-pack-only request | Produce pack; do not begin implementation |

These are review scenarios, not claims of automated agent execution tests.
