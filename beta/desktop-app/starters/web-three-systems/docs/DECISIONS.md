# Decisions

Append-only. Each entry says what was decided, by whom, when, and what it changes. Entries D-001 to D-012 came with the starter. D-001, D-002 and D-004 to D-006 are defaults applied in two builds (the mail app and the media converter, 2026-11-15); D-003 and D-007 to D-012 come from one build (the media converter). A later entry may override any of them by saying why.

## D-001 Electron shell and web UI

Inherited default. The page is React and TypeScript; the shell is Electron; the app is its own program with its own processes. Memory is summed as private bytes over the process tree: about 300 MB is the budget and 680 MB is the ceiling no build may pass. Both numbers live in `app.config.json`.

## D-002 Logic stays outside the page

Inherited default. The page asks the main process through the functions in `electron/preload.ts`; the main process runs the installed command-line tool or core. The page holds no credentials and makes no network request (`connect-src 'none'`). An app that needs a server names its origins in the Content-Security-Policy in `electron/main.ts` and records why here.

## D-003 The tool ships inside the app

Default from build 2. The command-line tool and every program it drives ship inside the app, one binary per system and processor under `resources/bin/<platform>-<arch>/`, and are started by absolute path with an argument array, never through a shell or PATH (`electron/tool/locate.ts`). This replaces round 1's npm-global tool started through the system `node.exe`, which is still in the `windows-web` starter for an app whose tool is an npm global.

## D-004 Plain language in the interface

Inherited default, tightened in build 2. Headings, buttons and status speak in outcomes. Identifiers, hashes and raw tool output are never on screen, Details and About included: a Copy details action copies them for whoever repairs the app. The audit scans all rendered text for the whole-word terms in `qa/banned-terms.json`.

## D-005 Title bar height

Inherited default. 36 px on every system, matching the title bar overlay height so the system's window buttons and the bar are one strip. The Windows default is 32 px and the macOS bars are 32, 40 or 52 pt; the difference is deliberate and recorded. Set `macTitleBarHeight` in `app.config.json` to use one of the macOS heights there; the traffic lights then sit at the system's own position.

## D-006 Buttons scale on press, rows do not

Inherited default. Web-styled buttons scale to 0.97 while pressed. List rows, menu items and title-bar controls do not.

## D-007 One codebase for Windows, macOS and Linux

Default from build 2 (owner, 2026-11-15: "It needs to be fully cross-platform across Windows, Mac, and Linux"). One page, one stylesheet, one main process. Everything that differs between the systems is decided in `electron/platform.ts`, and the page learns the system from `bootstrap().platform`. A Mac-only app is SwiftUI instead (the skill's macOS branch).

## D-008 Closing and quitting follow the system

Default from build 2. Closing the last window quits on Windows and Linux; on macOS the app stays in the Dock and the window comes back on activate. A running job makes the close and the quit ask first, on every system.

## D-009 macOS has a real menu bar; Windows and Linux have none

Default from build 2. On macOS the menu bar holds every command with its shortcut, in Apple's order, with the system's roles for editing, hiding and quitting (`electron/menu.ts`). On Windows and Linux there is no menu bar (a menu there would draw a bar inside the window); the page's palette lists every command, and on Linux the shell handles Ctrl+Q, Ctrl+W, F11 and F10 itself.

## D-010 Launches by agents follow scripts/lib/launch.ts

Default from build 2, where agent launches took the owner's focus three times. Every scripted launch uses absolute paths, runs the shell check first, passes `--no-activate`, a throwaway data folder and a time limit, and ends the process it started by its exact id. No script uses a second instance to control the running app (D-011).

## D-011 Scripts reach the running app only through the control channel

Default from build 2 (the media converter, its D-018), found after agent checks took the owner's focus on Windows. A script never starts the app's executable a second time to talk to a running one: on Windows that hands the running app the right to come to the front (Chromium's process singleton calls `AllowSetForegroundWindow` for it before any app code runs). An app started with `--no-activate` or `--control` serves a named pipe (Windows) or a Unix socket (macOS, Linux), `electron/control.ts`, and writes where it listens to `control.json` in its data folder; an app a person started serves none. The executable started with a command flag forwards it through the channel and ends without asking for the single-instance lock. The app counts second launches, and every check that asks it anything expects 0. Scripts on Windows that Explorer runs start under `conhost.exe --headless`, with no console window. A person's own second launch still brings the window forward.

## D-012 The network service runs in the main process

Default from build 2 (D-019 there), with one condition: the page makes no network request (`connect-src 'none'`). The separate network process then isolates nothing, and running it in the main process took Windows idle memory from 304.4 MB to 243.2 MB installed (306.8 to 238.0 MB in development); macOS and Linux dropped about 10 MB. An app whose page talks to a server sets `NETWORK_SERVICE_IN_PROCESS` to false in `electron/main.ts` and records why here; `pnpm shell:check` fails the switch without `connect-src 'none'`.

## D-013 Everything is strict TypeScript; the main process is bundled

Owner, 2026-11-19 and 2026-11-21: strict typing everywhere and no hand-written JavaScript where TypeScript can go, following the owner's other TypeScript apps. The main process is `electron/*.ts` and `electron/tool/*.ts`, bundled by rolldown (`scripts/build-electron.ts`) into `dist/electron/main.mjs`, an ES module and `package.json`'s `main`, with the runtime kit packages inside it, so the package carries no `node_modules`. The preload is bundled to `dist/electron/preload.cjs`, one CommonJS file that requires only `electron`, because the window is sandboxed; its object `satisfies DesktopBridge`. The page builds to `dist/page/`. The no-dialog handler is its own module, imported first; the shell check holds that it comes first in the bundle. Electron 45 loads an ES-module main, and an error thrown while it loads still reaches `process.on('uncaughtException')`.

## D-014 The test instrumentation never reaches the package

`electron/qa.ts` is built to `dist/electron/qa.mjs` and loaded by a path computed at run time, only in an unpackaged app with a `--qa-*` flag. Its measurement package stays outside the bundle. `scripts/package.ts` leaves the file out, and the shell check fails if `main.ts` imports it by name or `main.mjs` contains it.

## D-015 Scripts, measurements, QA and tests run by Node's type stripping

`scripts/`, `measure/`, `qa/`, `test/` and `tokens/` are `.ts` that Node 24 and later run directly, with erasable syntax only (`erasableSyntaxOnly` in `tsconfig.node.json`). `qa/tsconfig.json` adds the DOM types for the functions Playwright runs in the page; `pnpm typecheck` checks the page, the main process, the scripts and `qa/`. `node --check` passes a broken ES-module `.ts`, so `scripts/lib/syntax.ts` strips the types first.

## D-016 The plain-Node scripts are built from TypeScript and committed

`scripts/control.cjs`, `installed-helpers.cjs` and `installed-diagnostics.cjs` are built from their `.ts` sources by `scripts/emit-plain-node.ts` and committed. The installed checks run them by those names with the installed app acting as Node, often from a checkout that was never built, and Electron's Node strips types only from `.ts` files. `test/plain-node.test.ts` fails when one differs from its source.

## D-017 measure/workload.js stays JavaScript

Its text is the expression the page evaluates for `--qa-bench`, and `measure/run.py` names the file, so it cannot be a module or need a build. It is type-checked with the page (`checkJs`).

## D-018 Shared code comes from the kit packages, and only from them

Owner, 2026-11-21. Code every app had been copying comes from published packages: `@uppercut-labs/electron-command-menu` (the menus), `electron-child-process-runner` (starting and stopping the tool), `electron-qa-measurements` (typing, palette, launch marks, the kill test), `electron-bridge-test-double` (the stand-in bridge), `browser-qa-harness` (serving the build and launching the browser for the audit) and `app-icon-generator` (icons) from npm, and `uppercut-windows-window-capture` from PyPI for the window picture in `measure/run.py`. The PresentMon capture stays in `measure/run.py` and `analyze.py` until `uppercut-presentmon-measure` reads displayed-frame times (`msBetweenDisplayChange`) and starts a delayed capture on a chosen process; moving earlier would quietly change what the numbers mean. `test/kit-only.test.ts` fails when a hand-rolled copy of any of them or a direct PresentMon call comes back, and names the package to use. A package that lacks something the app needs is extended; its code is not copied here.

## D-019 The control channel, memory reading and line reader are packages too

The control channel is `@uppercut-labs/electron-control-channel` (`electron/control.ts` names the app's command flags), the memory reading is `@uppercut-labs/electron-private-memory` (`electron/memory.ts` gives it the budget and ceiling), and the bounded line reader is `createLineReader` from `@uppercut-labs/electron-child-process-runner` 0.2.0. `scripts/control.cjs` is built from `scripts/control.ts` with the package bundled in, so installed checks still run it with no `node_modules`. `test/kit-only.test.ts` holds all three.

## D-020 Desktop apps are dark by default

Owner, 2026-11-21. A generated app starts dark on first run and with any fresh data folder, whatever the operating system's theme is. Light is a choice the person made and the app saved; the saved choice wins on every later start. `electron/theme.ts` holds the one rule (`resolveTheme`, which D-022 narrowed), `electron/window.ts` paints the window with it, and `index.html` sets the page the same way before first paint (the shell names its theme in the address, a plain browser reads `localStorage`, and with neither the theme is dark). The system setting is never read. `test/dark-default.test.ts` fails when a fresh profile renders anything but dark, with the operating system set to light. The QA helpers open pages dark, and a critique round (`pnpm qa:shots --quick`) photographs dark alone; the audit still checks both themes, because light stays available.

## D-021 Rules 104 to 111 are built in, each with a check that fails when it is broken

2026-11-21. The starter had the page checks but nothing for the shell's trust: a crashed renderer, a window saved on a monitor that is gone, what the page may ask Chromium for, the fuses, focus under a contrast theme, colour outside the tokens, or a picture that changed. They are now rules 104 to 111 of the premium bar, with code and checks in the starter: `electron/bounds.ts` and the crash handling in `electron/window.ts`, `electron/boundary.ts`, `scripts/lib/fuses.ts`, `pnpm qa:crash`, `pnpm shell:check` (rule 10), the audit's `forced` and `tokens` gates, `pnpm fuses:check` and `pnpm qa:visual`. `pnpm qa:planted` makes one break per rule in a throwaway copy of the app and requires its check to fail, so a check cannot quietly stop checking.

- **Fuses.** `NODE_OPTIONS` and `--inspect` off, the app only from `app.asar`, no extra file-protocol privileges, asar integrity on macOS only (on another system only after its packaged app has started with it). `RunAsNode` stays on, with `RUN_AS_NODE_REASON`, because the installed checks run the app's own binary as Node; turning it off is the next step. `--inspect` off means Playwright's `_electron` cannot drive a packaged app: drive the development app, which is never fused.
- **Permissions.** One allowed: writing to the clipboard, for Copy details. An app that needs another adds it to `ALLOWED` in `electron/boundary.ts` with its reason, and the test names it.
- **Baselines.** Per system, because each system draws fonts its own way, in `qa/baselines/<system>/`. The starter keeps none (`.gitignore`); an app removes that line and commits its own after reviewing the pictures. The threshold is 0.02 with anti-aliasing excluded, and a picture fails above 0.05% changed pixels: 0.1, the library's default, cannot see the design's smallest step.
- **Crash loop.** More than 3 renderer crashes in 60 s stop the reloads. The notice that tells the person is never shown under `--no-activate`, because a dialog would take focus.

## D-022 A saved light theme counts only if the person picked it

2026-11-27, from an app built from this starter. A freshly installed copy of that app opened light on a dark system. Its first-paint script had not run, so the page painted light and then told the window its theme, as the page does at every start, and the shell saved what it was told: `window.json` held `"theme":"light"` though nobody had chosen it, and D-020's "a saved choice wins" kept it. This starter's script does run, but the flaw is the same: the shell cannot tell a choice from an echo. Now:

- A theme counts as the person's only beside `themeChosenBy: "user"` in `window.json`. Only the toggle, the menu item and the palette entry save it (`setTheme(theme, chosen)` in the bridge, the shell's `app:theme` handler with `chosenPatch`); the page reporting the theme it opened with saves nothing. A saved light without the mark opens dark and the file is rewritten (`resolveTheme`, `resetPatch` in `electron/theme.ts`). A plain browser keeps its pick in `app.theme` beside `app.themeChosenBy` the same way.
- The first paint is dark with no script at all: the generated stylesheet's default (`:root`) is the dark theme, light applies only through `data-theme="light"` (`tokens/build.ts`), the colour-scheme meta says dark, and the script in `index.html` can only add light, for a marked pick.
- `nativeTheme.themeSource` follows the app's theme, so menus, scrollbars and the frame do not follow the system.
- The QA helpers open a light page by storing a marked pick (`qa/lib.ts`). Before this, since D-020, a light run only set the browser's colour scheme, which the page ignores, so every "light" audit run and light screenshot rendered dark.
- Checks: `test/dark-default.test.ts` (the rule's cases, the shell saving only a pick, the page with scripts off, an unmarked saved light opening dark) and `pnpm qa:theme` (`qa/theme-start.ts`): the real shell on four data folders (unmarked light, marked light, fresh, dark), reading the window's colour, `nativeTheme`, the page's theme and `window.json` afterwards.

## D-023 QA captures use the software rasterizer; a running job is sampled every frame

2026-11-27, from an app built from this starter.

- **Rasterizer.** That app's `qa:visual` failed now and then on a few hundred pixels of icon and image edges. On Windows, 12 identical captures of one screen gave three different pictures with the GPU rasterizer and one with `--disable-gpu`, so every QA browser launch passes it (`qa/lib.ts`). On this starter on macOS the largest change between runs stayed about the same (0.013% after, 0.015% before), within the 0.05% limit; the gain shown is on Windows. Baselines made before the change are redrawn once with `qa:visual --update`, after review.
- **Progress gate.** The same app showed a long job with its stage, a meter, the time left and Cancel, and checked them on a live run. The audit's `progress` gate does the same for the starter's job: it samples the status bar every frame, with and without reduced motion, and fails when the meter goes back or reads 100% before the outcome, a stage shows for under 300 ms, Cancel is missing while the job runs, time left is not coarse words, an unknown total shows a number, or anything in the status bar animates under reduced motion (rules 9, 22, 65, 66). The stand-in's save stage now lasts 400 ms: it lasted 100 ms, which rule 9 does not allow and which the gate caught. An app gives its stand-in the tool's real stages, or the gate checks only the stand-in.

## Preferences ledger

Every preference the app offers is listed here with the reason a default could not serve. The starter has one: the theme, which starts dark and keeps a person's own pick (D-020, D-022).
