# Windows content-app starter

A starting point for a Windows content app: a React page in an Electron shell, with the app's logic in an installed command-line tool or a separate core. It is the the mail app build of 2026-11-15 with everything about mail removed. Every part is **proven in 1 build**, so treat each default as a hypothesis with one result behind it. The rules it is built to are in the desktop-app skill's `references/premium-bar.md`; the stack and its counter-evidence are in `references/content-app.md`.

## What to ask for

Bring these to the build. Each has a recommended answer.

| Question | Recommended answer |
| --- | --- |
| Product name, exe name, app id, company | Set all four in `app.config.json`. The exe name has no spaces. |
| Where does the logic live? | An installed command-line tool if one exists (`cli.shim`); otherwise a separate core process. The page never holds it. |
| Where does the working set live? | In the tool or core, on disk. The page holds what is on screen and asks for more through the bridge; an action on local data never waits on a spinner. |
| What are the essential journeys and their step budgets? | Five to fifteen, written in `docs/JOURNEYS.md` before any component is chosen. |
| Which words may a person never see? | Start `qa/banned-terms.json` from the spec's glossary and the tool's field names. |
| Does the app talk to a server? | No by default (`connect-src 'none'`). If yes, name the origins in the policy in `electron/main.cjs`. |
| Is there anything irreversible (a send, a delete, a payment)? | Give it one step with a short undo window rather than a confirmation step, and freeze what will be submitted when the window opens. |

## What is decided for you

- **Stack:** Electron 45, React 19 with the React Compiler, TypeScript, Tailwind v4 tokens in OKLCH, Base UI primitives, TanStack Virtual, lucide icons, Inter Variable. Versions are pinned in `package.json` and `pnpm-lock.yaml`.
- **Shell (`electron/main.cjs`):** the window is created hidden with the saved theme colour and shown at first paint with a 3 s fallback; `titleBarStyle: hidden` with `titleBarOverlay` keeps the native caption buttons and snap layouts; the page is served from `app://local` with a strict Content-Security-Policy; one instance, and a second launch can ask the first for diagnostics, a capture, About or quit; window position and theme are remembered; a native edit menu replaces the browser's context menu.
- **Bridge (`electron/preload.cjs`, `src/bridge.ts`):** the page gets a few named functions and nothing else. Every handler checks that the caller is the app's own page.
- **Saved work:** the main process writes each saved document to a file atomically, so a kill loses at most the last moment of typing.
- **Command-line tool (`electron/cli/run.cjs`):** the `.cmd` shim is read to find its script; the system `node.exe` runs it with an argument array, a time limit, capped output and an abort signal.
- **Page parts:** title bar, command palette with the single command registry, one shortcut table, toasts with Undo, tooltips that show shortcuts, a virtualized list, keyboard and pointer modality tracking, and the token set in `tokens/design-tokens.json`.
- **Budgets:** 300 MB private memory after idle and a 680 MB ceiling, in `app.config.json`.
- **Decisions already recorded:** `docs/DECISIONS.md`, D-001 to D-006.

## What you still choose

The screens, the journeys, the banned terms, the accent colour and product mark, which preferences exist, and whether the tool adapter needs a frozen-attempt record (see `references/content-app.md`).

## From request to delivery

1. Copy this folder to the project, outside any Git checkout of this template. Edit `app.config.json`, the `name` and `productName` in `package.json`, the title in `index.html` and `build/icon.svg`.
2. `pnpm install --frozen-lockfile`, then `pnpm electron:install`. Electron 45 has no install script, so its binary is absent until this runs or `pnpm start` runs once; the QA and measurement scripts start `electron.exe` directly and need it.
3. `pnpm build`, `pnpm test`, `pnpm qa:audit`. All three pass on the untouched starter. This is the baseline: a later failure is from the app's own change.
4. Fill in `docs/JOURNEYS.md` and `qa/journeys.json`, then replace the starter screen in `src/App.tsx`, `src/state/draft.ts` and `src/components/ItemList.tsx`. Rewrite the three marked blocks in `qa/audit.mjs` (states, journey scripts, shortcut effects), `fill()` in `qa/lib.mjs`, the states in `qa/shots.mjs`, and the selectors in `electron/qa.cjs` and `measure/workload.js`.
5. Add the app's calls to the tool in `electron/main.cjs` and `electron/preload.cjs`, with a test for each against a stand-in tool (`test/cli.test.cjs` shows the pattern).
6. `pnpm qa:shots`, hand the screenshots alone to a critic that did not build the app, fix, repeat.
7. When the owner has said the machine is free: `pnpm qa:typing`, `pnpm qa:kill`, `python measure/run.py`, `python measure/run.py --startup 5`. These open a window on the primary display without taking focus.
8. `pnpm icon`, `pnpm package`, then install and check through Explorer (below).
9. Hand over the Start Menu shortcut path, the evidence folder, and the list of what was not verified. The owner's use decides whether it is premium.

## Install and check the installed app

`scripts/install.ps1` copies the packaged app to `%LOCALAPPDATA%\Programs\<productName>` and writes `<productName>.lnk` into the Start Menu. An agent running inside a packaged desktop app has its AppData writes redirected into that package, so it starts the scripts through Explorer and reads the files they write:

```powershell
explorer.exe "<project>\scripts\install.cmd"                  # then read qa\evidence\install-log.txt
Set-Content "<project>\qa\evidence\installed-step.txt" list   # or launch, collect, about, memory, quit
explorer.exe "<project>\scripts\installed-check.cmd"          # then read qa\evidence\installed-<step>.txt
```

`launch` starts the app from its real shortcut. `memory` sums private memory over the running app's process tree and compares it with the budget and ceiling. Stop the app with the `quit` step, never by process name.

## Layout

```
app.config.json        names, storage prefix, title bar height, memory budget, command-line tool
electron/main.cjs      window recipe, app:// protocol, single instance, saved state, IPC
electron/preload.cjs   the page's only bridge
electron/cli/run.cjs   find and run an npm-global tool without a shell
electron/qa.cjs        development-only instrumentation (typing, kill, marks, workload); not packaged
src/                   the starter screen and the reusable parts
tokens/                design-tokens.json and the generator for src/styles/tokens.css
qa/                    audit, screenshots, typing latency, kill test, journeys, banned terms
measure/               PresentMon and memory harness
scripts/               icon, package, install, installed check, memory over the process tree
test/                  tool-runner tests against a stand-in tool
docs/                  DECISIONS.md, JOURNEYS.md
```

## What has and has not been run

Run on the starter itself on 2026-11-15, from a fresh install: `pnpm typecheck`, `pnpm build`, `pnpm test` (7 pass), `pnpm qa:audit` (passed), `pnpm qa:shots --quick`, `pnpm icon`, `pnpm package`.

Carried over from the subject app, where they ran and passed, and adapted here without a run: `pnpm qa:typing`, `pnpm qa:kill`, `measure/run.py`, `scripts/install.ps1` and `scripts/installed-check.ps1` (its `launch`, `memory` and `quit` steps are new). Expect to fix small things the first time each one runs.
