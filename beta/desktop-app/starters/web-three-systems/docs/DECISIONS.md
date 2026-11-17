# Decisions

Append-only. Each entry says what was decided, by whom, when, and what it changes. Entries D-001 to D-012 came with the starter. D-001, D-002 and D-004 to D-006 are defaults applied in two builds (the mail app and the media converter, 2026-11-15); D-003 and D-007 to D-012 come from one build (the media converter). A later entry may override any of them by saying why.

## D-001 Electron shell and web UI

Inherited default. The page is React and TypeScript; the shell is Electron; the app is its own program with its own processes. Memory is summed as private bytes over the process tree: about 300 MB is the budget and 680 MB is the ceiling no build may pass . Both numbers live in `app.config.json`.

## D-002 Logic stays outside the page

Inherited default. The page asks the main process through the functions in `electron/preload.cjs`; the main process runs the installed command-line tool or core. The page holds no credentials and makes no network request (`connect-src 'none'`). An app that needs a server names its origins in the Content-Security-Policy in `electron/main.cjs` and records why here.

## D-003 The tool ships inside the app

Default from build 2. The command-line tool and every program it drives ship inside the app, one binary per system and processor under `resources/bin/<platform>-<arch>/`, and are started by absolute path with an argument array, never through a shell or PATH (`electron/tool/locate.cjs`). This replaces round 1's npm-global tool started through the system `node.exe`, which is still in the `windows-web` starter for an app whose tool is an npm global.

## D-004 Plain language in the interface

Inherited default, tightened in build 2. Headings, buttons and status speak in outcomes. Identifiers, hashes and raw tool output are never on screen, Details and About included: a Copy details action copies them for whoever repairs the app. The audit scans all rendered text for the whole-word terms in `qa/banned-terms.json`.

## D-005 Title bar height

Inherited default. 36 px on every system, matching the title bar overlay height so the system's window buttons and the bar are one strip. The Windows default is 32 px and the macOS bars are 32, 40 or 52 pt; the difference is deliberate and recorded. Set `macTitleBarHeight` in `app.config.json` to use one of the macOS heights there; the traffic lights then sit at the system's own position.

## D-006 Buttons scale on press, rows do not

Inherited default. Web-styled buttons scale to 0.97 while pressed. List rows, menu items and title-bar controls do not.

## D-007 One codebase for Windows, macOS and Linux

Default from build 2 (owner, 2026-11-15: "It needs to be fully cross-platform across Windows, Mac, and Linux"). One page, one stylesheet, one main process. Everything that differs between the systems is decided in `electron/platform.cjs`, and the page learns the system from `bootstrap().platform`. A Mac-only app is SwiftUI instead (the skill's macOS branch).

## D-008 Closing and quitting follow the system

Default from build 2. Closing the last window quits on Windows and Linux; on macOS the app stays in the Dock and the window comes back on activate. A running job makes the close and the quit ask first, on every system.

## D-009 macOS has a real menu bar; Windows and Linux have none

Default from build 2. On macOS the menu bar holds every command with its shortcut, in Apple's order, with the system's roles for editing, hiding and quitting (`electron/menu.cjs`). On Windows and Linux there is no menu bar (a menu there would draw a bar inside the window); the page's palette lists every command, and on Linux the shell handles Ctrl+Q, Ctrl+W, F11 and F10 itself.

## D-010 Launches by agents follow scripts/lib/launch.mjs

Default from build 2, where agent launches took the owner's focus three times. Every scripted launch uses absolute paths, runs the shell check first, passes `--no-activate`, a throwaway data folder and a time limit, and ends the process it started by its exact id. No script uses a second instance to control the running app (D-011).

## D-011 Scripts reach the running app only through the control channel

Default from build 2 (the media converter, its D-018), found after agent checks took the owner's focus on Windows. A script never starts the app's executable a second time to talk to a running one: on Windows that hands the running app the right to come to the front (Chromium's process singleton calls `AllowSetForegroundWindow` for it before any app code runs). An app started with `--no-activate` or `--control` serves a named pipe (Windows) or a Unix socket (macOS, Linux), `electron/control.cjs`, and writes where it listens to `control.json` in its data folder; an app a person started serves none. The executable started with a command flag forwards it through the channel and ends without asking for the single-instance lock. The app counts second launches, and every check that asks it anything expects 0. Scripts on Windows that Explorer runs start under `conhost.exe --headless`, with no console window. A person's own second launch still brings the window forward.

## D-012 The network service runs in the main process

Default from build 2 (D-019 there), with one condition: the page makes no network request (`connect-src 'none'`). The separate network process then isolates nothing, and running it in the main process took Windows idle memory from 304.4 MB to 243.2 MB installed (306.8 to 238.0 MB in development); macOS and Linux dropped about 10 MB. An app whose page talks to a server sets `NETWORK_SERVICE_IN_PROCESS` to false in `electron/main.cjs` and records why here; `pnpm shell:check` fails the switch without `connect-src 'none'`.

## Preferences ledger

Every preference the app offers is listed here with the reason a default could not serve. The starter has one: the theme, because the system setting cannot say which a person wants for this app alone.
