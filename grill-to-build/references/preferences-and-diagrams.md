# Portable Preferences and Diagrams

## Resolve once

Use the first applicable source: current explicit user instruction, the project's recorded preference in Context, a project-root `grill-to-build.preferences.md`, an installed skill-root `PREFERENCES.md`, then the first-round question. These are workflow preferences, not authority to override project requirements or higher-priority instructions. Read only these known locations; do not search unrelated personal directories.

The bundled [Figma profile](../profiles/figma.md) applies only when the user selects it. "Use grill-to-build with the Figma profile" is sufficient. Record the result in Context and do not ask again on resume. Do not infer a preference from the author's identity, GitHub owner, or ChatGPT account.

## Separate first-round question

If no preference is known, ask this setup question alongside the first discovery round, separately labeled and excluded from its 3-4 questions and 20-question allowance:

"Which format should we use for the living model?"

- Graphviz DOT: editable text source with fast deterministic SVG/PNG rendering when a local Graphviz renderer is available.
- Markdown/Mermaid (portable fallback): text stored with the project; rendering may be host- or CLI-dependent.
- Figma/FigJam: editable collaborative canvas; requires an available integration and access.
- Excalidraw: editable sketch-style diagram; requires a supported authoring path.
- diagrams.net (draw.io): editable structured diagram; requires a supported authoring path.
- No diagram (not recommended): maintain the model in prose and tables.

Adapt to the host's input UI limits without dropping choices; use a plain-text question when necessary. Do not split setup into a questionnaire. If the user answers the product questions but skips this one, proceed with Markdown/Mermaid and record it as a default, not an explicit decision. For asynchronous input, allow a reasonable reply window while investigating independently. The fallback never supplies unanswered product decisions.

## Record and carry preferences

Keep a short `Workflow Preferences` section in Context: preferred format, source (explicit, file, profile, or default), active format, and any verified diagram path or URL. If the integration is unavailable, distinguish the preferred format from the temporary fallback. Do not create an architectural ADR just for a presentation preference.

For reuse across projects, users can place this ordinary Markdown file at the installed skill root as `PREFERENCES.md`, or at a project root as `grill-to-build.preferences.md`:

```md
# Grill-to-build preferences

- Diagram format: Figma/FigJam
- If unavailable: Markdown/Mermaid
```

Copy or version this file with the skill to carry it to another computer. A fresh installation without it uses the first-round question. Project Context carries that project's choice when cloned. Do not promise account-level synchronization, and do not silently modify global instructions or write cross-project preferences. Installation updates may replace local skill files; retain a versioned copy of custom preferences.

## Discover rendering capabilities before recommending a format

Separate **conversation-host capabilities** from **execution-harness capabilities** before recommending a living-model format.

- **Conversation host** means tools available directly in the current chat or agent surface: for example a Figma integration, a diagram-specific connector, file-generation tools, or no direct renderer at all.
- **Execution harness** means the local or remote runtime the agent can inspect and execute in: for example Graphviz (`dot`/`neato`), Mermaid CLI, Excalidraw packages, diagrams.net CLI, browser automation, SVG libraries, Inkscape, CairoSVG, or ImageMagick.
- Do not assume a tool exists in either environment. Probe the capabilities you can actually inspect.
- Do not treat a slow external plugin as preferable merely because it is integrated. Latency, determinism, editability, portability, and offline/local rendering all matter.
- When the chat host and harness differ, explain both paths briefly and recommend the best available path for the user's priorities.

For architecture, domain, state, dependency, and workflow diagrams, consider these source-first options when available:

| Source format | Typical renderer | Strengths | Trade-offs |
| --- | --- | --- | --- |
| Graphviz DOT | `dot`, `neato` | Fast local rendering, deterministic layout, diffable text, excellent agent ergonomics, SVG/PNG output | Less freeform than canvas tools |
| Mermaid | Mermaid CLI or host renderer | Familiar Markdown-adjacent syntax, portable, strong documentation support | Host rendering may vary; CLI may be absent |
| Excalidraw | Excalidraw SDK/app | Editable sketch-style canvas, strong human manipulation | Native renderer/package may not be installed; external app can add latency |
| diagrams.net | diagrams.net app/CLI | Editable structured canvas and broad import/export | Authoring path may require GUI/integration |
| SVG source | Browser/SVG library + rasterizer | Precise visual control, deterministic, direct SVG artifact | More manual layout responsibility |
| Figma/FigJam | Figma integration | Rich collaborative editing and presentation | External-plugin latency and access dependencies |

A good default when the user values speed and agent-native maintenance is **editable text source plus deterministic local SVG rendering**, with PNG as a convenience preview when requested. If Graphviz is installed, DOT → SVG/PNG is often a strong choice for software/system models. Do not make Graphviz mandatory; capability discovery and the user's explicit preference take precedence.

## Capability and fallback

Check available tool capabilities before promising an external diagram. Use applicable tool or skill instructions when authoring it. A format preference does not provide credentials, select a workspace, or authorize public sharing. Reuse a known authorized destination; if one is required but missing, request only that information and continue local modeling meanwhile.

The selected authoring path is binding. Never substitute an image-generation model for the selected diagram format merely because image generation is available or because the preferred authoring integration is missing. Image generation is permitted only when the user explicitly chooses generated imagery as the diagram source or output method.

For Excalidraw, use a supported Excalidraw authoring path or SDK to create the native editable scene. When the user requests a PNG or SVG as well, render or export that Excalidraw scene into the requested preview format. A request such as `Excalidraw to PNG` means **native Excalidraw scene first, rendered PNG second**; it never means synthesizing an Excalidraw-looking raster image with an image model.

If the chosen authoring path is unavailable, explain briefly and keep a Markdown/Mermaid model unless the user forbids that fallback. Retain the preferred format for later migration. Do not demand installation or authentication to continue discovery, fabricate an artifact URL, claim an external diagram is synchronized when an update failed, or silently replace the selected format with image generation.

For external diagrams, keep a concise textual account of entities, relationships, states, and boundaries in Context so the build pack is usable without access to the service. Update the diagram when its semantics change, reuse the same artifact, and record any pending synchronization. An unverified external artifact must not be the only source of required behavior.

For no diagram, use prose and tables throughout; do not keep prompting or generate a hidden Mermaid diagram. In every format, model only what materially clarifies the work.
