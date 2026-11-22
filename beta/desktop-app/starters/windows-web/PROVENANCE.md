# Provenance of the Windows content-app branch

What this branch of the desktop-app skill was extracted from, how each item was sorted, and what a later run should merge. It covers the starter in this folder and the skill's `windows-content.md`, `premium-bar.md` and `measurement.md` references.

## History

| Date | Build | What changed |
| --- | --- | --- |
| 2026-10-29 to 30 | fastwin and the macOS starter, reviewed by a design critique panel | The skill's Windows branch was fastwin only; acceptance cases A01 to A14 had nothing on visual design, typography, chrome or motion. |
| 2026-11-15 | The mail app (build 1 of this class) | Added the content-app branch, the 56-rule premium bar, the measurement reference and this starter. Every item below is proven in 1 build |

## Sources read

Extracted on 2026-11-15 from the app's own repository, its research notes and critic findings, and the session records of the build. Those sources are not public; the history, sorting and counts below are what they showed.

## How the build ran

Six parallel research lanes (own apps, an ideas repository, frameworks, craft and tooling, installed reference apps, performance); a review page with a two-question form, with a notification to the owner; a bake-off of one screen in two shells, measured on the primary display; a review against public expert knowledge whose must-fix list was applied before packaging; then the real app, one live acceptance send confirmed by the provider's record, and a launch from the real Start Menu shortcut.

For the next app of this class the research, the bake-off and the shell choice are already paid for. What repeats is steps 1 to 8 in `windows-content.md`.

## Sorting

Counts: 9 constants, 20 defaults, 7 parameters, 13 lessons, 13 one-offs left behind.

**Constants** (true for the class; owner rules marked):

1. 680 MB ceiling on private memory over the process tree.
2. About 300 MB budget per content app, each its own program.
3. Premium is the owner's verdict after use; the bar is a floor.
4. Logic lives outside the page.
5. Test windows never take focus, and open only when the owner has said the machine is free (owner rule).
6. Delivery is a per-user install launched from its real Start Menu shortcut (owner rule).
7. Installs and installed-app checks run through Explorer, because of the AppData redirect.
8. Sign-in uses the owner's standing auth rule (owner rule; not exercised by build 1).
9. Checks run locally; no hosted workflow is a dependency (owner rule).

**Defaults** (decided; a build may override with a recorded reason):

1. Electron as the shell. Reason: same screen measured 119.9 fps displayed, 343 MB idle and 540 ms start against Tauri's 437 MB and 663 ms, with native caption buttons for free.
2. React 19 with the React Compiler, TypeScript, Tailwind v4, Base UI, TanStack Virtual, lucide, Inter, at pinned versions. Reason: what four of five reference apps and the component ecosystem use.
3. Window created hidden with the theme colour, shown at first paint, 3 s fallback.
4. `titleBarOverlay` with native caption buttons at 36 px.
5. `app://` scheme with `connect-src 'none'`.
6. Single instance; a second launch carries diagnostics, capture, About and quit requests.
7. Narrow preload with an origin check on every handler.
8. System `node.exe` runs the npm shim's script with an argument array, bounded.
9. Frozen attempt with one key, three outcomes, never an automatic resend (a note, not code).
10. One-step irreversible action with a 5 second undo window.
11. Saved work written atomically by the main process within 250 ms of a change.
12. One command registry, one shortcut table, palette on Ctrl+K.
13. Plain language, with a banned-term scan and a Details control.
14. The token values, from the installed-app teardown.
15. Motion defaults: hover appears at once and leaves slowly, keyboard actions do not animate, reduced motion fades only.
16. `@electron/packager` with asar and a keep-list, no `node_modules`.
17. The headless audit and its gates.
18. The corrected thresholds for rules 7, 25 and 27.
19. Buttons scale on press; rows and title-bar controls do not.
20. The 56 rules as the acceptance floor, beside A01 to A14.

**Parameters** (asked of each new app; recommended answers are in the starter README): product identity; where the logic lives; where the working set lives; the essential journeys and step budgets; the banned terms; whether the app talks to a server; whether anything is irreversible.

**Lessons** (a failure and the check that now prevents it):

1. Electron 45 has no install script, so `electron.exe` is missing after `pnpm install`; hit twice in the build and again here. Check: README step 2, `pnpm electron:install`.
2. PresentMon recorded nothing for idle starts, second captures, paused rendering and the main process. Check: the timeline in `measure/run.py` and the quirks list.
3. Rule 25's threshold could not be met by a passing run. Check: the rewritten rule and `measure/analyze.py`.
4. The builder's own audit passed with zero failures while an independent review found seven must-fix items. Check: step 4, a critic that sees screenshots only.
5. A measured bake-off screen was presented as the result; the owner asked where the app was ("You've got to make the actual thing to prove that your concept was correct"). Check: steps 6 to 8 end at an installed app.
6. Implementation words reached primary text. Check: the language gate and `qa/banned-terms.json`.
7. An error's filled button retried a request that could only fail again. Check: rule 50.
8. Build and fixture text sat in the title bar. Check: the title bar holds only what a person needs; rule 49's scan.
9. With a hidden title bar the saved window grew a few pixels on each restart. Check: the growth is subtracted before saving.
10. Focus moved one frame after a shortcut, so keys typed straight after it landed in the old field; found by the journey gate during this extraction. Check: `focusField` in `src/App.tsx` and the journey scripts.
11. The live acceptance send was held because a required connector needed the owner to sign in again. Check: step 7 names its prerequisites; confirm them before packaging, and raise a missing one as a human blocker at once.
12. Time went into locating a conversation thread when the spec was what mattered ("The thread isn't important. You just need to find the build pack where it's described."). Check: step 1 starts from the written spec or build pack.
13. This repository's `.gitignore` ignores `tokens.json`, which would have dropped the token source silently. Check: the file is `tokens/design-tokens.json`.

**One-offs** (13, left in the subject): the six sender domains and their accounts; the recipients rail, which the owner kept ("I want to keep the recipients rail for now"); recipient search scoring; attachments and drag and drop; account colours; the composer and result-sheet components; the profile dry-run script; the live send-path test; the fixture adapter and its forced outcomes; the Tauri shell; the review page; the ideas-repository lane; the replaced WPF proposal.

## Cold start

Instance: a Melee Replay browser for Windows. Method: a paper walk by the extracting agent holding only the skill and this starter. No fresh agent ran it, because this run was told to start none; treat the result as optimistic until one does.

- **Open decisions without the factory: 28.** Framework, shell, primitives, tokens, window chrome, launch flash, process model, how to call the core, bridge surface, crash safety, list virtualization, keyboard model, motion rules, the acceptance bar, displayed-frame method, typing-latency method, memory budget and method, packager, install location, the AppData redirect, inspecting the installed app without focus, who critiques, accessibility tooling, language rule, theming, single-instance behaviour, pinned versions, and who gives the verdict.
- **Open decisions with it: 7**, all on the parameter list. None outside it after two repairs made during the walk: the working-set question was added to the parameter list, and bundling a core inside the package was added to the reference as an unproven note.
- **Files still written from nothing:** the app's screens; the calls to its core with stand-in tests; a folder picker in the bridge; packaging a bundled core; fixtures for each error state.

## Still a hypothesis

Everything here rests on one build. The parts carried over without a run in this starter are listed in its README. Run this extraction again after the second content app ships: raise what repeated to proven in 2, retire what the second app overrode, and move the frozen-attempt record, the file pickers or a sign-in screen into the starter only if that app needed them too. Run it sooner if the owner's first days of use contradict a default.
