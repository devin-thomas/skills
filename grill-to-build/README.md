# Grill to Build

Turn an idea into shared terminology, explicit decisions, testable behavior, and ordered work. Discovery updates `PROJECT.md`, applicable `GLOSSARY.md`, ADR, and Ideas; a stable understanding becomes SPEC and tickets. Implementation runs when requested.

## Install and use

Ask your skill-capable agent to install `grill-to-build` from `https://github.com/devin-thomas/skills`, or copy this entire directory into its supported skills location. Keep the references, profiles, and agent metadata together. No other skill or diagram service is required for the Markdown workflow.

Example prompts:

```text
Use $grill-to-build to turn this idea into a build pack: ...
Use $grill-to-build with the Figma profile to scope and build: ...
Resume $grill-to-build from PROJECT.md, GLOSSARY.md, and open questions.
```

## Host-native discovery by default

Without a setup question, Grill chooses the richest **useful** presentation the current host actually supports:

- **ChatGPT:** Mobile-friendly native in-chat question layouts, decision comparisons, and compact diagrams, with functional controls when genuinely useful and supported.
- **Claude with Artifacts:** A reusable Claude Artifact when a round benefits from an interactive panel or evolving visual model; short questions still belong in conversation.
- **Claude Code terminal and other text-first hosts:** Markdown questions, plus Mermaid when supported and helpful; otherwise clear prose and tables.

The agent must check actual host capabilities; it cannot assume a Claude Code terminal offers Claude Artifacts or that every ChatGPT client supports identical native controls. If richer presentation is unavailable, fall back silently to the next supported option. Do not ask the user to choose a presentation tool unless they request a non-default path that needs clarification. Short conversational questions remain preferable to needlessly large forms.

**Presentation is not persistence.** The source for the living model stays editable and portable, defaulting to Markdown/Mermaid in `PROJECT.md`. Choosing a host-native UI does not change `PROJECT.md`, `GLOSSARY.md`, ADR, Ideas, SPEC, or tickets. An explicit user choice of Graphviz DOT, Figma/FigJam, Excalidraw, diagrams.net, Markdown/Mermaid, or no persistent diagram overrides the model-source default. **No persistent diagram** can coexist with an intelligent in-chat model visualization; an explicit **no diagrams anywhere** instruction suppresses even in-chat visuals.

For shared preferences, use project-root `grill-to-build.preferences.md` or skill-root `PREFERENCES.md`; overrides in current instructions or `PROJECT.md` take priority. Old `Diagram format: ...` settings continue to apply to living-model sources. The selected editable source remains a hard constraint. Do not replace it with an AI-generated look-alike; image generation requires explicit selection as the source/output method. `Excalidraw to PNG` means author the native editable Excalidraw scene, then render it.

See [host-native presentation](references/presentation-and-interaction.md) and [portable model preferences](references/preferences-and-diagrams.md) for precedence, actual-capability checks, nonbinding UI state, and fallback.

## Choosing a renderer

The skill distinguishes what the agent can render **inside the current chat surface** from what it can render **inside its execution harness**. Those are often different.

Before recommending a format, the agent should probe the capabilities it can actually inspect instead of assuming Figma, Mermaid, Excalidraw, or any CLI is present. Useful source-first candidates include Graphviz DOT, Mermaid, Excalidraw, diagrams.net, and authored SVG.

For architecture and system diagrams, a fast local Graphviz path is especially useful when available: keep `.dot` as the editable source, render `.svg` as the canonical visual, and optionally render `.png` for previews. This is a recommendation, not a universal default; explicit user preference still wins.

External integrations can be appropriate when collaborative editing matters, but they should not automatically outrank a deterministic local renderer when the user prioritizes speed.

## Portability boundaries

- Existing project meaning and compatible ADR/ticket layouts are preserved; legacy Context filenames require explicit migration.
- Product questions stay within five rounds or twenty questions by default; unresolved material choices remain explicit blockers.
- External diagrams have a textual counterpart, so collaborators can use the pack without service access.
- Invoking the skill does not itself authorize publishing, deployment, paid tools, or public sharing.
- No personal account identifiers, local absolute paths, or credentials are required.

## Manual behavior checks

Before changing the workflow, review these cases against the entry point and references:

| Scenario | Expected behavior |
| --- | --- |
| Fresh ChatGPT rich host, no preference | Native mobile-first Grill where useful; no presentation/format setup question |
| Fresh Claude chat with Artifacts | Claude Artifact for substantive interactive round/model; canonical state remains in files |
| Claude Code CLI without Artifact capability | Markdown/Mermaid fallback; no false Artifact promises |
| Other text-first host | Markdown questions; source-first Mermaid if supported |
| Simple single Grill question | Conversational prose, not a large form |
| User types option instead of using interactive control | Fully valid response; accepted decision synchronized |
| User clicks a control but does not submit | No accepted decision recorded |
| Product answers omit presentation preference | Host-native default remains; no new setup question |
| Explicit Figma profile | Model authored in Figma when possible; ChatGPT/Claude interview presentation may remain native |
| Figma unavailable | Preferred Figma retained; active Markdown model fallback disclosed |
| Explicit no persistent diagram; rich in-chat model requested | No diagram artifact; model semantics in `PROJECT.md` prose/tables, with native visual chat presentation |
| Explicit no diagrams anywhere | No diagram visual in chat/Artifact or project source |
| Explicit Excalidraw + PNG | Editable Excalidraw scene first, PNG export second; no AI-generated imitation |
| Selected diagram tool unavailable | Disclose limitation and use only an allowed fallback |
| Existing `PROJECT.md` resumed in a different host | Explicit preferences and saved decisions preserved; presentation adapts to host |
| Legacy mixed-use `Context.md` | Split scope and preferences into `PROJECT.md`; resolved terminology into `GLOSSARY.md` |
| Legacy glossary-only `CONTEXT.md` / `CONTEXT-MAP.md` | Git-rename to canonical v1.3 names and update mapped paths |
| Both legacy and new files exist | Reconcile without overwriting or creating parallel vocabulary |
| Current instruction overrides saved preference | Current instruction wins |
| Five rounds end with material uncertainty | Block affected sections; do not invent acceptance rules |
| Existing ADR directory | Preserve it; no duplicate ADR.md |
| Build-pack-only request | Produce pack; do not begin implementation |

These are review scenarios, not claims of automated agent execution tests.

## Breaking: compatibility with Matt Pocock skills v1.3

New projects write **`GLOSSARY.md`** (terms only) and **`PROJECT.md`** (scope, constraints, discovery state, models, preferences) instead of the old mixed-use `Context.md`. Mapped domain glossaries use `GLOSSARY-MAP.md`. Do not rename mixed project documentation straight into a glossary. Read the [migration guide](references/migration-from-context.md) before resuming older projects. This is a breaking pre-1.0 artifact contract change; it is not yet published.
