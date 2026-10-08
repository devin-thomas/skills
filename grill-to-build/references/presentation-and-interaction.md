# Host-Native Presentation and Interaction

## Purpose

Make Grill-to-Build discovery easy to conduct **inside the conversation**, while keeping project artifacts portable and authoritative. Presentation is a delivery surface, not a product decision, artifact format, or new source of truth.

Read this reference together with [preferences-and-diagrams.md](preferences-and-diagrams.md). That reference governs the persistent *living-model source*. This one governs the *live discovery presentation*.

## Silent host-aware default

Determine the actual capabilities exposed by the current conversation surface. Do not ask a presentation-format setup question by default, and do not infer availability merely from a model or vendor name.

| Conversation environment | Preferred discovery presentation |
| --- | --- |
| ChatGPT surface with native rich layout/interaction support | Native, mobile-friendly in-chat layouts, diagrams, and relevant controls |
| Claude conversational surface with usable Artifacts | Claude Artifacts for substantive interactive or visual discovery, coordinated with conversational replies |
| ChatGPT without that presentation support, Claude Code terminal/CLI without Artifacts, other text-first hosts | Compact Markdown; Mermaid for useful diagrams where supported; otherwise prose/text tables |
| Any host with an explicit user format/source request | Honor the request, subject to actual available authoring tools and the existing fallback contract |

'Claude' alone is not proof of Artifacts support. A coding-agent CLI or API harness must not claim it created an Artifact if the current host cannot expose one. Likewise, do not output invented rich UI markup to a host that cannot render it.

Treat the first two rows as **silent defaults**, not unconditional mandates to generate elaborate visuals. A plain short question often remains the best presentation. Prefer the host-native option when it materially improves a round; no gratuitous cards or forms.

### Presentation versus source

- **Presentation** is the ephemeral user-facing round: structured question cards, side-by-side tradeoffs, an architecture diagram, or a small interactive selector.
- **Persistent model source** is the editable artifact in the project: default Markdown/Mermaid in `PROJECT.md` unless an explicit model-format preference selects Graphviz DOT, Figma/FigJam, Excalidraw, diagrams.net, or **no separate diagram source** (model retained as structured prose/tables in `PROJECT.md`).
- Native ChatGPT UI and Claude Artifacts do **not** replace `PROJECT.md`, `GLOSSARY.md`, ADR, Ideas, SPEC, tickets, or any editable model source.
- An interactive presentation may render a snapshot of the current model; after decisions, update the canonical files and refresh the presentation from them.
- **Distinguish source from presentation:** “no diagram file/source; intelligent UI in chat is the diagram” means no persisted Mermaid/DOT/canvas, but an ephemeral native in-chat model visualization is welcome. The canonical entities, states and relationships still live in structured `PROJECT.md` prose/tables.
- If the user instead says “no diagrams at all, including in chat,” suppress visual diagrams in both surfaces. Do not silently substitute generated images for editable requested sources.

## Discovery round behavior

1. Extract known answers first and ask only unresolved material questions within the existing Grill budget (usually 3-4 per round, at most 20 across 5 rounds).
2. In a native visual host, use a compact, readable round layout: small question group, concise options where useful, recommendation with tradeoff, and an optional visual of the part of the model affected.
3. Use real interactive controls only when the host can wire their state and submit the answers. Do not make decorative/inert controls, pretend a selection was saved, or treat an unsubmitted local UI change as a decision.
4. Prefer conversational questions by default. Use a form only when several independent missing inputs must be gathered together and the form is genuinely easier than a short exchange. Do not force the user through a form to continue.
5. Allow conversational, partial, ambiguous, and mixed-format replies. Interpret explicit text replies exactly as faithfully as a widget submission; never require the user to use the graphical controls.
6. Summarize actual accepted decisions after the answer, flag still-open questions, and update the project documents. A recommended/default choice is not accepted unless the user chooses it.
7. Keep each presentation mobile-first and readable without horizontal scrolling: prefer stacked cards or compact diagrams, avoid enormous tables, and display only meaningful visuals. Do not let decoration overwhelm the Grill.

### Claude Artifact behavior

Use a Claude Artifact for a useful evolving questionnaire, decision comparison, or system model **when that host genuinely supports artifact creation**. Keep the canonical decisions in the conversation and project files, not solely in Artifact-local state. Reuse or revise one coherent Artifact for the same discovery session where possible; do not proliferate independent artifacts for every round. Avoid implying that client-side Artifact state is durable, synchronized, or committed unless verified.

### ChatGPT native behavior

Use native in-chat layout and interaction supported by the **current** ChatGPT surface. Compose compact cards, responsive diagrams, comparison grids, and real actionable controls when helpful. Controls must submit deliberate selections into the conversation or otherwise have a supported, observable effect; persist accepted decisions only after they are communicated to the assistant. Keep a useful plain-language answer beside any richer visuals.

## Fallback and overrides

- Current explicit instruction overrides automatic host selection and saved preferences.
- Next honor project-recorded presentation preferences, then the project preferences file, then installed skill preferences, then silent host-aware defaults.
- If a requested renderer is unavailable, disclose that limitation briefly and use the explicitly permitted fallback. For automatic defaults, just pick the next supported presentation without an unnecessary announcement.
- Markdown is the universal discovery fallback; Mermaid is a helpful *model* fallback only where actually supported. If diagrams cannot render, preserve semantic information in prose/tables. The user may always ask for plain text, Markdown/Mermaid, Graphviz, Figma/FigJam, Excalidraw, diagrams.net, or no diagrams.
- Avoid requiring external paid services, credentials, browser automation, files, or account setup just to conduct Grill.
- Do not override project security, authorization, accessibility, or platform constraints for presentation quality.

## Persistence

Record a non-default presentation preference in `PROJECT.md` under `Workflow Preferences`, together with its source (explicit, project file, skill file). It is not necessary to write a host capability probe or default style into every project's `PROJECT.md`. Persist the living-model source and any approved external artifact URL in `PROJECT.md` as defined by [preferences-and-diagrams.md](preferences-and-diagrams.md). Do not create an ADR for a mere presentation choice.

## Behavior checks

- ChatGPT rich host, no preference: starts a useful in-chat discovery round without asking which diagram service to use; keeps editable `PROJECT.md` model source and separate glossary.
- Claude chat with Artifacts: creates or updates an Artifact when appropriate; project decisions still get documented.
- Claude Code terminal with no Artifact support: Markdown questions/model, with no promise of Artifacts.
- Explicit plain-text or Excalidraw preference: follows the override, not the rich default.
- A user answers options in ordinary prose: accepts the answer, with no widget dependency.
- A user changes a selector but does not submit: does not silently record a decision.
- The user selects no persistent diagram but wants intelligent UI in chat: use structured prose/tables in `PROJECT.md`; the in-chat visualization can illustrate current understanding without becoming a second source of truth.
- The user explicitly excludes any diagrams, including in chat: suppress visual diagrams even in a rich host.
- An interactive session is resumed elsewhere: `PROJECT.md`/`GLOSSARY.md`/ADR/Ideas supply the state, not the prior Artifact/widget.
