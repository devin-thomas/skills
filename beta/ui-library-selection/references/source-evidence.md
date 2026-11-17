# Source evidence

- **Original title:** UI Libraries for Claude Code (Ban the AI Look)
- **Creator:** Griffin Wooldridge. **URL:** https://youtu.be/zsCGS-Yzjnw. **Published:** 2026-11-07. **Duration:** 4:26.
- **Independent title:** Three kinds of UI library, and how to make an AI coding agent use them instead of improvising components
- **Media identity:** 1280x720 AV1 + Opus capture, sha256 `ae6cd56218ef68f983d408aaa7785e1946b5ef345f5c28a335a9027cd7be70f6`.
- **Analysis run (outside git, on the Grok Bot box):** `/workspace/video-analysis/zsCGS-Yzjnw/run-20261116-0800/` (`analysis.json`, `analysis.md`, `provenance.json`, `transcript-corrected.md`, `glossary-corrections.json`).
- **Coverage:** audio fully transcribed with local faster-whisper (medium, CPU). Visual coverage is **partial**: 33 sampled frames over the whole timeline (8 s spacing, viewed as contact sheets) plus 14 exact-offset captures viewed individually or in sheets. Continuous playback, animation and motion between samples were not reviewed. The video is mostly narration over staged overlays and screenshots; no live coding session is shown.
- Status words: `observed` (seen on screen), `speaker-claimed`, `external-verified` (checked against a primary source on 2026-11-16), `tested` (run by the skill author), `uncertain`.

## Steps and claims

| Skill step | Source time | Status | Evidence and notes |
| --- | --- | --- | --- |
| Three kinds: foundations, specialists, designed components | 0:24-0:34, 1:25, 2:27 | observed and speaker-claimed | Chapter overlay shows the three rows (0:30). The taxonomy is the speaker's framing, not a standard. |
| Foundations give behavior (keyboard, focus, accessibility) | 0:34-0:42 | speaker-claimed | Base UI quick start and Radix exist at the names shown (`@base-ui/react` 1.9.0, `radix-ui` 1.8.1 on npm, checked). |
| Default shadcn has an "AI look" (same radius, grays, fonts) | 0:50-1:01, shown 0:58-1:12 | speaker-claimed | Overlay compares three identical cards labeled shadcn/ui, Claude Code, Lovable. Opinion, not measured. The skill only uses the actionable part: restyle tokens. |
| Change radius, color, type to carry personality | 1:01-1:15 | observed | Before/after card with a radius slider, color and font chips (about 1:10). |
| shadcn copies code into the project so the agent can edit it | 1:15-1:21 | external-verified, tested | shadcn docs: `add` copies component files. Test: `shadcn add sonner drawer command` created files under `src/components/ui`. |
| Specialists: Sonner toasts, Vaul drawers, cmdk menus, NumberFlow numbers | 1:25-1:49 | observed | Labeled pages for each library. Whisper heard "Sonar", "Vol", "Command K"; corrected from screen text. |
| Hand-built toast/drawer/menu typically fails (stacking, drag, keyboard) | 1:51-2:08 | speaker-claimed | No test shown. Treated as motivation only. |
| `pick-ui-library` skill chooses a library with one-sentence reasons | 2:12-2:27 | observed, external-verified | Screen shows github.com/emilkowalski/skills, steps ("identify the task", "check package.json", "recommend one library") and a "common mismatches" list. Repo cloned at commit 64eb3de (2026-11-15); the skill exists. The upstream file sets `disable-model-invocation: true`; this skill does **not** inherit that and links to it instead of copying its table. |
| Emil's list picks Base UI for primitives | 2:16-2:27 (screen) | observed | The video's shadcn-first default and the list's Base UI default differ. The skill tells the agent to choose one foundation per project. |
| Designed components: Beautiful UI, RareUI, Magic UI, Aceternity, 21st.dev | 2:27-3:40 | observed | Beautiful UI page shows "Built by Turbo" and AI states (Loading State, Approval Card, Prompt Bar, Diff, Agent Screen). 21st.dev is a marketplace (site checked). |
| Magic UI "over 150 free animated components", built to sit on shadcn | 3:10-3:19 | partly inconsistent | Speaker says over 150. A site capture at 3:11 reads 150+ and "perfect companion for shadcn/ui", but a separate overlay near 3:12 (nominal frame) reads 135+. The live site now says 150+. The skill does not repeat a count. |
| Install designed components with the shadcn CLI | 3:25-3:30 | external-verified, tested | Docs show `npx shadcn@latest add @magicui/marquee` and `@aceternity/background-beams`. Test added both; build passed after one fix (see below). |
| RareUI: `npx rareui add ...` | ~3:04-3:08 | observed on screen, **not followed** | Terminal overlay shows an `npx rareui add` line being typed. The site now says RareUI rebranded to a profane name and offers shadcn registry support. Excluded from runtime steps. |
| One standout moment per page | 3:40-3:56 | speaker-claimed | Design opinion; kept as a guardrail because it is cheap and reversible. |
| Name the libraries in the prompt; install via CLI/registry so Claude can read the code | 3:56-4:14 | observed | Prompt overlay: "Use shadcn for the base components and Sonner for toasts"; file tree shows `button.tsx` and `sonner.tsx` marked untracked under `components/ui`. A claimed effect on the model's behavior was not tested here. |
| Install the pick skill to decide automatically | 4:14-4:17 | speaker-claimed | Not required by this skill. |

## Independent checks (2026-11-16)

- npm latest: sonner 2.0.8, vaul 1.1.2 (last published 2024-12-14; GitHub repo not archived, last push 2025-10-03), cmdk 1.1.1 (2025-08-27), @number-flow/react 0.6.2, @base-ui/react 1.9.0, radix-ui 1.8.1, shadcn 4.23.0.
- shadcn docs: `add sonner`, `add drawer` ("built on top of Vaul"), `add command` ("uses cmdk"), `init --base base|radix|aria`.
- Fixture test on the Grok Bot box: Vite react-ts project, `shadcn init -t vite -b radix`, `add sonner drawer command @magicui/marquee @aceternity/background-beams`, `npm i @number-flow/react`, a small App using `toast`, `NumberFlow`, `Button`. First `npm run build` failed with TS6133 inside the Aceternity file (unused `path` parameter); renaming it to `_path` made the build pass. A prior attempt also hit a host npm setting (see tooling-notes.md).
- Browser click-through on the same fixture, later on 2026-11-16: Playwright 1.65.1 against `vite preview` at 1280×800. First pass found: (1) shadcn 4 `CommandDialog` without a `<Command>` wrapper crashed the page blank (`Cannot read properties of undefined (reading 'subscribe')`) while the build stayed green; wrapping the items in `<Command>` fixed it. (2) Command menu and other portaled surfaces rendered in the light theme until `dark` was moved from `<main>` to `<html>`. (3) Aceternity background beams were nearly invisible until stroke width/opacity and the mask were increased in the copied file. (4) Generated files imported `cn` from the npm package `cn` instead of `@/lib/utils`. (5) The Vaul bottom drawer spanned the full viewport until `max-w-md mx-auto` was applied. After those fixes, a second pass opened toast, Number Flow, command menu, dropdown, popover, tooltip, tabs, sheet, drawer, and dialog; no `pageerror` or console errors; theme and desktop widths were checked on the shots. Additional shadcn items (`popover`, `dropdown-menu`, `tabs`, `tooltip`, `sheet`, `card`, `badge`, `skeleton`) and Magic UI `shimmer-button` plus `border-beam` were installed through the CLI and used on the same page. One high-motion hero effect (beams) was kept; border-beam was used as a card accent.

## Excluded from runtime instructions

- Affiliate links, "free guide" and sponsor material in the description.
- The claim that default shadcn is an "AI look", and the claim that models spot it on sight, as facts.
- The RareUI command, Magic UI component counts, and any statement that a model "will" follow a named library.
- Video terminology as commands: nothing in the skill executes a command because the video said so.

## Term corrections affecting the procedure

Sonar to Sonner, Vol to Vaul, Command K (library) to cmdk, Aseternity to Aceternity, ShadCN to shadcn, Pick UI Library to pick-ui-library. "Command K" meaning the keyboard shortcut was left as spoken. No unresolved term affects a step. Full ledger: `glossary-corrections.json` in the analysis run.

## Not finished or unverified

- Browser click-through of toast, Number Flow, command menu (type to filter), dropdown, popover, tooltip, tabs, sheet, drawer, and dialog was run on the fixture and passed after the gotchas above were fixed. Drawer drag on a touch-emulated viewport, firing three toasts to confirm stacking, and cmdk arrow/Enter selection were not separately scripted.
- The video's "Claude uses them when you name them" claim and the pick skill's effect on agent output were not measured.
- Visual review of the source video is sampled, not continuous.
