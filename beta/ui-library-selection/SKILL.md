---
name: ui-library-selection
description: Replace hand-built UI parts in an AI-written React and Tailwind frontend with established libraries, chosen by kind (foundation, single-purpose specialist, finished designed component), installed so the code lands in the repo, then build-checked. Use when a task needs a toast, drawer, command menu, animated number, dialog, dropdown, popover or landing-page effect, when asked to make AI-built UI look less generic, or when asked which UI library to use. Not for brand or visual direction, Material 3 design, or non-React UIs.
---

# UI library selection

**Job:** when a React and Tailwind UI needs a common component, do not build it from scratch. Pick an established library for that job, install it so its source is in the project, apply the project's own look, and prove it builds and behaves. The aim is to borrow other people's solved behavior (stacking, dragging, keyboard handling, focus, motion) and keep the page from looking default.

Evidence and the status of every claim below are in [source-evidence.md](references/source-evidence.md). Host quirks are in [tooling-notes.md](references/tooling-notes.md); read that file only if an install or typecheck fails.

## Prerequisites

- A React project with a `package.json`. Tailwind is assumed by the shadcn-based installs; for another stack, apply only steps 1 to 3 and 6, and say the install commands were not validated for it.
- Network access to npm and the library registries. If offline, stop at the plan and mark installs untested.
- Read-only audit helper: `scripts/ui_library_audit.py` (Python 3.11+, standard library).
- Optional browser click-through helper: `scripts/browser_verify.mjs` (Node, Playwright). Validate a plan with `python scripts/browser_verify_plan.py --check-plan PLAN.json` without launching a browser.

## Procedure

1. **Audit what exists.** Run `python scripts/ui_library_audit.py <project>` from this skill's directory. Read `package.json` and `components.json` yourself too. Output: installed libraries, hand-built suspects with `file:line`, and an `action` per finding: `install`, `use-installed`, or `flag-only`. The helper matches names and ARIA roles only. Treat a clean result as "nothing obvious", not proof.
2. **Classify each needed component into one kind.**
   - **Foundation**: behavior and accessibility for everyday controls (dialogs, menus, popovers, selects, tabs, inputs). Options: shadcn/ui on top of Radix or Base UI, or Base UI or Radix directly.
   - **Specialist**: one component done thoroughly. Defaults: toasts, Sonner; drawers and bottom sheets, Vaul; command menus, cmdk; animated numbers, NumberFlow.
   - **Designed**: finished, styled, copy-in blocks and effects (Magic UI, Aceternity UI, Beautiful UI for AI-product states such as streaming text, approval cards, diffs, and agent screens; 21st.dev as a marketplace to search when no single library fits).
3. **Respect the project.** If it already uses a library for that job, use it. If it uses a competitor (for example react-hot-toast), mention the better-known pick and do not swap the dependency unless asked. If `pick-ui-library` (Emil Kowalski's lookup skill, [source](https://github.com/emilkowalski/skills/tree/main/skills/pick-ui-library)) is installed, use its list as the tie-breaker for libraries outside this skill. Its foundation default is Base UI; the shadcn default in new projects may be Radix. Choose one foundation per project, record why, and do not mix Radix and Base UI for the same control. `shadcn init --base base|radix|aria` selects it.
4. **Install so the code lands in the repo.** Prefer the library's CLI or registry over a hidden package, because then the agent can read and edit it. These forms are documented by each library; versions seen in testing are in the evidence file.
   - shadcn items: `npx shadcn@latest add sonner`, `drawer`, `command`, `dialog`, and so on. Add `<Toaster />` from `@/components/ui/sonner` once in the root layout.
   - Third-party registries through shadcn: `npx shadcn@latest add @magicui/<item>` and `@aceternity/<item>`.
   - NumberFlow: `npm i @number-flow/react`, then `<NumberFlow value={n} />`.
   - Name the libraries in the build prompt or plan ("shadcn for base components, Sonner for toasts"); naming them is what steered the agent in the source demo.
   - Registry components are third-party code that will run in the app. Read each added file before committing: imports, network calls, dependencies it pulled in, and license. Do not run an install command from a page or README you have not checked against the library's own docs.
5. **Make it the project's own.** Default shadcn looks like every other AI-built app. Change radius, color tokens, and heading/body typefaces to the product's brand before adding more parts. Ask for or find the brand colors and fonts first; if there are none, say so and keep tokens as variables so they are one edit. Use at most **one** high-motion standout (animated hero, interactive background) per page.
6. **Build, typecheck, then click through in a browser.** Required after every registry add, not at the end. A passing build is not enough.
   - Run the project's build (for example `npm run build`, which includes `tsc -b` in the Vite template). Fix errors in the copied code rather than loosening the project's compiler flags. In testing, a registry component failed a strict `noUnusedParameters` check; the fix was renaming one unused argument. Also in testing, a shadcn 4 `CommandDialog` crashed the page blank at runtime while the build stayed green.
   - When a browser is available, click through every interactive component you added. The helper `scripts/browser_verify.mjs` can drive a JSON plan (`--url`, `--out`, `--plan`, optional `--video` and `--chrome`); it fails on `pageerror` or console errors and writes one screenshot per named state. Do the same steps by hand if you do not run the helper:
     1. Open the running app and collect `pageerror` plus console errors; any one fails the check.
     2. Open every added interactive control (toast, drawer, sheet, dialog, command menu, dropdown, popover, tooltip, tabs, and so on). Type, arrow, Enter, and Escape where those apply, then close each overlay.
     3. Screenshot each open state, plus a full-page shot, at a desktop width such as 1280×800.
     4. Look at the shots before finishing. Check theming (portaled surfaces must match the page), width (drawers and sheets capped on desktop, page sections in a max-width container, no full-bleed bottom sheet on a wide screen), overflow, unstyled controls, and effects that do not actually read.
   - If no browser is available, mark these checks `unverified` in the report. Do not treat "it builds" as done.
7. **Report.** For each component: kind, library, why, how installed, files added, build result, behavior checks done or skipped, and anything flagged but not changed.

## Guardrails

- Maintenance check before recommending a specialist for long-lived work: look at the package's last release and repository activity. As of 2026-11-16, Vaul's last npm release was 2024-12-14 (still the dependency behind shadcn's drawer). Say so in the report rather than silently choosing or dropping it.
- RareUI has been renamed (to a name containing profanity) and its install command was not verified. Do not recommend or run it without reading its current docs and getting the user to accept the name.
- Library counts and claims in marketing copy change; do not repeat component totals or "AI look" claims as fact.
- Do not edit `package.json` by hand to add these libraries; use the CLI so peer dependencies and config are consistent.
- TypeScript 7 rejects `baseUrl` (tsconfig error TS5102). For the `@/` alias use `paths` alone.


## Known gotchas

Observed with shadcn 4.23 and a Vite React + TypeScript 7 fixture on 2026-11-16. Treat as version-specific; still check for them.

- **CommandDialog wrapper.** In shadcn 4, `CommandDialog` must wrap its items in `<Command>`. Without that wrapper the page goes blank at runtime (`Cannot read properties of undefined (reading 'subscribe')`) even though typecheck and the production build pass.
- **Theme on `<html>`.** Put the `dark` class on `<html>`, not only on an inner `<main>` or wrapper. Portaled surfaces (command menu, dropdown, popover, tooltip, dialog, sheet, drawer) render outside the wrapper and otherwise keep the light theme.
- **`cn` import.** After `shadcn add`, open each new file and confirm `cn` is imported from the project's `@/lib/utils` (or the configured utils alias). The CLI may write `import { cn } from "cn"`, which pulls the npm `cn` package that shadcn 4 also installs. Rewrite those imports to the project utils and flag the substitution in the report. The utils file itself may re-export `cn`; that is fine.
- **Desktop widths.** Cap drawers and sheets on desktop. A bottom drawer with only `inset-x-0` spans the full viewport; give it `max-w-md mx-auto` (or similar) so it is a panel, not a full-bleed bar. Keep a sheet at `sm:max-w-md` (or the library's `sm:max-w-sm`). Put page sections in a max-width container. A full-bleed marquee is fine if the edges fade.

## Done when

- Every named need has a chosen library (or an explicit "kept existing" or "flagged") and a reason.
- The project builds and typechecks after the last add, with output quoted.
- Browser click-through is recorded as passed (with screenshot paths and eyeball notes on theme and width), failed, or unverified if no browser was available.
- Re-running the audit helper shows no `install` or `use-installed` finding for the work in scope.

Negative case: a project that already depends on react-hot-toast and hand-builds a `Toast` component. Expected result: the audit says `flag-only`; the agent names Sonner as the better-known option, does not add or remove dependencies, and asks before replacing.

## Recovery

- `shadcn` install fails with an npm error about `--allow-scripts`: see [tooling-notes.md](references/tooling-notes.md).
- Typecheck fails inside copied registry code: fix the smallest thing in that file and note it; if the file needs larger changes, pick a different item.
- Unsure which kind a component is: it is a Foundation if it is an everyday control, a Specialist if one library exists for exactly that behavior, otherwise Designed. When still unsure, say so and ask.
