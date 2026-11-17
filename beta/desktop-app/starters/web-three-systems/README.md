# Content-app starter for Windows, macOS and Linux

A starting point for a content app: a React page in an Electron shell, with the app's logic in a command-line tool or core that ships inside the app, built from one codebase for Windows, macOS and Linux. It is the the media converter build of 2026-11-15 (build 2 of this class) with everything about audio removed, on top of round 1's page, tokens and audit from the mail app (build 1). The rules it is built to are in the desktop-app skill's `references/premium-bar.md`; the stack, the shell recipe per system and the counter-evidence are in `references/content-app.md`; the tool seam in `references/tool-contract.md`; packages and installs in `references/packaging.md`. Each part says how many builds it rests on. `PROVENANCE.md` says where every file came from.

## What to ask for

Bring these to the build. Each has a recommended answer.

| Question | Recommended answer |
| --- | --- |
| Product name, exe name, app id, company | Set all four in `app.config.json`. The exe name has no spaces; the app id is reverse-DNS, and on Linux it is also the desktop entry's name |
| Which systems? | All three from this one codebase. A Mac-only app is SwiftUI instead (the skill's macOS branch) |
| Default and minimum window | Set `window` in `app.config.json`. The shell creates the window at these sizes and the audit lays the page out at exactly these, plus 125% scale and 200% zoom |
| Where does the logic live? | A command-line tool bundled inside the app, one binary per system and processor (`tool.name` and `tool.binaries`), started by absolute path. A long-lived core only when the app makes many small calls against warm state |
| What does the tool say to the app? | Write `docs/TOOL-CONTRACT.md` before anyone builds, following `references/tool-contract.md`: a capabilities call, newline-delimited JSON events, cancel by closing stdin, a published list of error codes |
| What can the page ask of the shell? | Write `src/bridge.ts` and `docs/BRIDGE.md` before anyone builds. The page never sees a path |
| What are the essential journeys and their step budgets? | Five to fifteen, in `docs/JOURNEYS.md` and `qa/journeys.json`, before any component is chosen |
| Which words may a person never see? | Start `qa/banned-terms.json` from the spec's glossary, the tool's field names and its error codes |
| Does the app bundle third-party programs? | Build your own minimal copies when the published ones are big (build 2's FFmpeg: 7 MB instead of 264 MB) and ship their notices from About |
| How is it released? | Per-user install on Windows; an ad-hoc signed, unnotarized bundle on macOS for Apple silicon with short instructions for other people; a `.deb` and a portable tarball on Linux  |

## What is decided for you

- **Stack:** Electron 45, React 19 with the React Compiler, TypeScript, Tailwind v4 tokens in OKLCH, Base UI primitives, TanStack Virtual, lucide icons, Inter Variable. Versions are pinned in `package.json` and `pnpm-lock.yaml`.
- **One platform module (`electron/platform.cjs`):** the only file that asks which system this is. It returns the window options for each system, a short list of named facts (closing the last window quits or not, whether a window can be shown without focus, which keys the shell handles itself), the app's identity to the system, and how the window is first shown. On Linux it restarts the app on Wayland when a Wayland session did not say so.
- **Window (`electron/window.cjs`):** created hidden in the saved theme's colour and shown at first paint (on Linux also at the end of the page load), with a 3 s fallback; the system's own window buttons over a page-drawn title bar on every system, reported to the page through `env(titlebar-area-*)`; traffic lights centred in the bar on macOS; size and position remembered where the system allows.
- **Life cycle (`electron/shell.cjs`):** one instance per data folder; commands for the running app (`--diagnostics`, `--capture`, `--show-about`, `--menu-command`, `--full-screen`, `--close-window`, `--quit`); files opened with the app; closing and quitting as each system expects; a quit right after a person's second launch waits for it to be acknowledged. The app counts second launches and control requests in its diagnostics (`shell.lifecycle`).
- **Control channel (`electron/control.cjs`):** the only way a script reaches the running app. An app started with `--no-activate` or `--control` serves a named pipe (Windows) or a Unix socket (macOS, Linux) and writes where to `control.json` in its data folder; an app a person started serves none. Clients: `ask()` in `scripts/lib/launch.mjs`, `scripts/control.cjs` (plain Node, or the installed app acting as Node) and `scripts/control.ps1` (PowerShell, starts no program). The executable started with a command flag forwards it through the channel and ends without asking for the single-instance lock, so it never becomes a second instance: on Windows a second instance hands the running app the right to take the foreground before any app code runs (Chromium's process singleton). Every check that asks the app anything expects its count of second launches to be 0.
- **Network service in the main process (`electron/main.cjs`, `NETWORK_SERVICE_IN_PROCESS`):** on by default, only for a page that makes no network request (`connect-src 'none'`; the shell check fails the switch otherwise). Build 2 measured 304.4 MB idle on Windows installed before, 243.2 MB after; an app that talks to a server turns it off and records why.
- **Menu (`electron/menu.cjs`):** a full menu bar and a Dock menu on macOS, built from the one shortcut table (`shortcuts.json`); none on Windows and Linux. Menu items dim exactly when the page says their command cannot run.
- **Memory (`electron/memory.cjs`, `scripts/memory-tree.*`):** private memory by each system's definition, summed over the process tree. Budget 300 MB after idle, ceiling 680 MB, in `app.config.json`.
- **Errors:** under `--no-activate` a main-process error goes to stderr and the app ends; diagnostics are written with synchronous file calls so asking does not change the memory figure.
- **Tool adapter (`electron/tool/`):** line reader, runner (cancel by closing stdin, escalate after 3 s), locator (one folder per system and processor, never PATH when packaged), capabilities cache, job records with launch reconciliation, progress model, and the adapter itself. All plain Node, tested against the stand-in tool.
- **Page parts:** title bar, command palette and one command registry with ids from `shortcuts.json`, platform-aware key labels, toasts with Undo, tooltips that show shortcuts, a virtualized list, a status bar with one height in every state, and the token set in `tokens/design-tokens.json`. The page learns the system from the shell and sets `data-platform` on the root.
- **Stand-ins:** `src/bridge.fake.ts` (the shell, for the page) chosen by the address's fragment; `test/standin-tool.cjs` (the tool, for the adapter) replaying scenarios.
- **Launch rules (`scripts/lib/launch.mjs`):** every scripted launch uses absolute paths, passes `pnpm shell:check` first, runs with `--no-activate`, a throwaway data folder and a time limit, talks to the app only through the control channel (`app.ask()`), quits it through the channel when the limit passes, and then ends only the process it started, by its id.
- **Windowless scripts on Windows (`scripts/run-as-user.ps1`):** anything handed to Explorer runs PowerShell under `conhost.exe --headless`, a console with no window. A visible console (even a Minimized shortcut, once Windows Terminal is the default terminal) takes the foreground and, when it closes, hands it to whatever app is entitled to it.
- **Decisions already recorded:** `docs/DECISIONS.md`, D-001 to D-012.

## What you still choose

The screens, the journeys, the banned terms, the accent colour and product mark, the tool and its contract, the fixtures for every state, which preferences exist, and the per-system known-gaps list (start from the one in `electron/platform.cjs`).

## From request to delivery

1. Copy this folder to the project, outside any Git checkout of this template. Edit `app.config.json`, the `name` and `productName` in `package.json`, the title in `index.html` and `build/icon.svg`.
2. `pnpm install --frozen-lockfile`, then `pnpm electron:install`. Electron 45 has no install script, so its binary is absent until this runs; the real-shell scripts need it. On a Mac without pnpm, `npx pnpm@11.9.0`.
3. `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm shell:check`, `pnpm qa:audit`. All five pass on the untouched starter (about 5 minutes for the audit). This is the baseline: a later failure is from the app's own change.
4. Write `docs/TOOL-CONTRACT.md`, `src/bridge.ts` with `docs/BRIDGE.md`, `docs/JOURNEYS.md` with `qa/journeys.json`, and `shortcuts.json`, before any builder starts. Builders change none of them.
5. Replace the example: the screen in `src/App.tsx` and `src/components/StatusBar.tsx`, the job in `src/state/job.ts` and `electron/tool/index.cjs`, the contract names in `electron/tool/contract.cjs`, the stand-in scenarios in `test/scenarios/` and fixtures in `src/bridge.fake.ts`, the menu in `electron/menu.cjs`, and the marked blocks in `qa/audit.mjs` (states, journey scripts, shortcut effects, job fixtures), `qa/shots.mjs`, `qa/lib.mjs` (`fill()`), `electron/qa.cjs` and `measure/workload.js`.
6. `pnpm qa:shots`, hand the screenshots alone to a critic that did not build the app, fix, and turn each class of finding into an audit gate. Repeat until a round has no must-fix item.
7. Run the real shell on each system. Linux: `scripts/linux-container/run.sh` on a Mac with Docker. macOS: `pnpm shell:evidence` on a Mac nobody is using. Windows: `pnpm qa:typing`, `pnpm qa:kill`, `pnpm shell:evidence` and `python measure/run.py` only when the owner has said the machine is free, because each opens a window. Before any claim about focus on Windows, run `pnpm measure:focus -- --work <folder> --first explorer --route explorer` (also when he has said the machine is free): launches from an agent's own session cannot show the problem, because that session holds no right to the foreground.
8. Build the tool for each target and stage it (`node scripts/stage.mjs tool <target> <file>`, or the placeholder in `tool/placeholder/`), then `pnpm icon` and `pnpm package:win`, `pnpm package:mac`, `pnpm package:linux-arm64`, `pnpm package:linux-x64` on the machine for each.
9. Install and check each (below), then hand over each system's launcher path, the evidence folders, the verdict per premium-bar group and per system, and what was not verified. The owner's use decides whether it is premium.

## Install and check the installed app

| System | Install | Check |
| --- | --- | --- |
| Windows | `scripts\run-as-user.ps1 install` (through Explorer, in a windowless console, because an agent inside a packaged desktop app has its AppData writes redirected) | Start `measure\foreground-sampler.ps1 -Out <file.jsonl> -StopFile <file> -Seconds <n> -App <installed exe>` in your own shell first (in the background), then `scripts\run-as-user.ps1 installed-check -Step list`, then `helpers`, `launch -Option no-activate, empty-path, "data-dir=<folder>"`, `memory`, `collect -Option "data-dir=<folder>"`, `quit -Option "data-dir=<folder>"`, `uninstall`; then write the stop file. The sampler fails if the app's window was ever in front |
| macOS | `sh scripts/install.sh` with `INSTALL_TO` on the internal disk | `sh scripts/installed-check.sh list`, then `helpers`, `launch`, `memory`, `collect`, `quit`, `uninstall` (`NO_ACTIVATE=1 EMPTY_PATH=1 DATA_DIR=<folder>`) |
| Linux | `scripts/linux/container-check.sh deb` (or `portable`) in a clean Debian or Ubuntu container | the same steps, inside the container |

`collect`, `about` and `quit` reach the running app through its control channel (never a second launch, which in build 2 brought the window forward on Windows), found through `control.json` in the data folder, so they need the same data folder `launch` used, and `launch` must have had `no-activate` (or, on Linux from the desktop entry, `LAUNCH_EXTRA=--control`). `collect` also fails if the app counted a second launch. `install.ps1` stops if the installed app is running instead of asking it to quit.

## Layout

```
app.config.json        names, window sizes, storage prefix, title bar height, memory budget, tool and binaries
shortcuts.json         the one command and shortcut table: page, palette, tooltips, macOS menu, shell check
electron/main.cjs      app:// protocol, saved state, IPC, diagnostics, quitting while a job runs, what kind of launch this is
electron/control.cjs   the control channel: the server in the app, the client for scripts (plain Node)
electron/platform.cjs  the one place that knows which system this is
electron/window.cjs    the window recipe; shell.cjs life cycle; menu.cjs menus; memory.cjs memory
electron/preload.cjs   the page's only bridge
electron/tool/         the tool adapter (plain Node) and its Electron glue (index.cjs)
electron/qa.cjs        development-only instrumentation (typing, kill, marks, workload); not packaged
src/                   the starter screen, the stand-in bridge and the reusable parts
tokens/                design-tokens.json and the generator for src/styles/tokens.css
qa/                    audit, screenshots, typing latency, kill test, journeys, banned terms
measure/               shell check, shell evidence, PresentMon and memory harness, foreground sampler, focus and
                       memory experiments (Windows)
scripts/               launch rules, control channel clients, windowless runner, icon, stage, package, install,
                       installed checks, memory per system, Linux packaging templates, macOS entitlements, the Linux
                       container harness
test/                  adapter tests against the stand-in tool, the host-kill test, the bridge check, the control channel
tool/placeholder/      a placeholder tool to package before the real one exists
third-party/           the notices file (a stub until the app bundles a third-party program)
docs/                  DECISIONS, JOURNEYS, BRIDGE, TOOL-CONTRACT
```

## What has and has not been run

Run on the untouched starter on 2026-11-15, Windows 11, from a fresh copy outside this repository: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test` (29 pass, including the host-kill test), `pnpm shell:check`, `pnpm qa:audit` (passed: 30 state and theme runs, 0 axe violations, 60 layout cases at 4 sizes, journeys and shortcuts on both key families). No Electron window was opened.

Run again after the control channel and the other fixes from the media converter were brought in, the same evening, Windows 11, a fresh copy outside this repository, headless only: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test` (32 pass, including the 5 control-channel tests, which serve the channel from a Node process and send through `electron/control.cjs` and `scripts/control.cjs`), `pnpm shell:check` (rules 8 and 9 included; each also shown to fail on a planted violation), `pnpm qa:audit` (passed, as above). `scripts/control.ps1` was run against a channel served from Node (an answered request, and exit code 2 with none running), and `measure/foreground-sampler.ps1 -App` for 2 s. No Electron window was opened, so neither the electron install step nor any part of the starter's own Electron side ran.

Carried over from the media converter without a run here, where they ran and passed on the systems named: the control channel inside the app, command launches forwarded through it and the second-launch count (`electron/main.cjs`, `shell.cjs`; Windows, where build 2's `measure/final.mjs` summary records 7 requests through the channel and 0 second launches, and by the app's `docs/MEMORY.md` macOS and a Linux container, whose post-fix `final.mjs` runs reach the app only through it); the windowless runner and the install change (`scripts/run-as-user.ps1`, `install.ps1`; Windows, installed); the installed check through the channel on Windows (`scripts/installed-check.ps1`). `scripts/installed-check.sh` (macOS and Linux) was changed the same way in the app, but no installed run on macOS or Linux after that change is recorded there; `measure/focus-experiment.mjs` and `measure/memory-experiment.mjs` (Windows; here adapted to `scripts/lib/launch.mjs`, without a run); the network service in the main process (all three). Also carried over without a run here, as before: the shell modules (all three), `measure/shell-evidence.mjs` and `scripts/linux-container/` (Linux containers; macOS), `scripts/package.mjs` (all three), `scripts/install.*` and `scripts/installed-check.*` (all three), `scripts/installed-helpers.cjs` (rewritten for any tool; the original ran on all three), `scripts/memory-tree.*` (all three), `scripts/linux/` (Linux containers), `scripts/mac/` (macOS). Carried over from round 1 without a run here: `qa/typing.mjs`, `qa/kill-test.mjs` (now through `scripts/lib/launch.mjs`), `measure/run.py`, `pnpm icon`. The placeholder tool has not been compiled. Expect to fix small things the first time each one runs.
