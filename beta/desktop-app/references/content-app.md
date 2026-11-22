# Content app: web UI in an Electron shell, on Windows, macOS and Linux

A content app has forms, text editing, long lists, sign-in or rich content. Its UI is a React page; its shell is Electron; its logic lives in a command-line tool or core outside the page, never in it. One codebase serves Windows, macOS and Linux: one page, one stylesheet, one main process, with every difference between the systems decided in one module.

Two builds stand behind this reference, both on 2026-11-15:

- **Build 1, the mail app**, Windows only, over an npm-global command-line tool. Its starter is `starters/windows-web` ([README](../starters/windows-web/README.md)).
- **Build 2, the media converter**, Windows, macOS and Linux from one codebase, over a native C++ tool that drives FFmpeg, both bundled inside the app. Its starter is `starters/web-three-systems` ([README](../starters/web-three-systems/README.md)). Start every new content app from this one.

Every item says how many builds it rests on. One build makes a hypothesis: follow it, and record in the app's `docs/DECISIONS.md` where a third app disagrees. The tool seam is in [tool-contract](tool-contract.md), packages and installs in [packaging](packaging.md), the rules in [the premium bar](premium-bar.md), and measurement in [measurement](measurement.md).

## Constants

- **Memory** (2 builds). No program passes about 680 MB of private memory over its process tree, counting the tool and everything it starts; about 300 MB after five minutes idle is the budget. Both are in the starter's `app.config.json`. Each system has its own definition ([measurement](measurement.md)). Build 2 was first over budget on Windows (304 to 314 MB idle) and under it on macOS (110 to 135 MB) and Linux (135 to 142 MB); running the network service in the main process then brought Windows to 243 MB installed and 238 to 248 MB in development.
- **Agent launch rules** (from build 2, where agent launches took the owner's focus three times, and its installed check twice more). They are in `SKILL.md`, "Rules for every branch", in the starter's `scripts/lib/launch.ts`, and below under "Reaching the running app".
- **Sign-in** follows the owner's standing auth rule (Neon Auth with a branded sign-in). That is an owner rule, not a result of either build: neither has a sign-in screen.
- **Delivery is the real launcher** (owner rule; 2 builds on Windows, 1 on macOS and Linux). An app is not ready until it has been installed and started from its Start Menu shortcut, its Applications bundle or its desktop entry.
- **One codebase on three systems** (owner, 2026-11-15, for build 2). A Mac-only app is SwiftUI instead; this branch's macOS build is the same Electron app.

## Steps

1. **Name the journeys.** Start from the app's written spec or build pack, not from a conversation about it. Write five to fifteen essential journeys, each with a step budget, in `docs/JOURNEYS.md` and `qa/journeys.json`, the shortcut table in `shortcuts.json`, and the words a person may never see in `qa/banned-terms.json`. Done when these describe the app and no component has been chosen yet. (Build 1 did this after the fact; build 2 before any builder started.)
2. **Write the two seam files.** The lead writes `docs/TOOL-CONTRACT.md` (the tool's flags, capabilities, events and error codes, following [tool-contract](tool-contract.md)) and `src/bridge.ts` with `docs/BRIDGE.md` (every function the page may call, and who owns what). Builders do not change them; they list the changes they want and build the nearest thing that fits. Done when both exist and the decisions file names who decided what. (Build 2: five builders in separate worktrees, tool, adapter, shell, packaging and page, merged with no conflicts.)
3. **Get the starter and prove the baseline.** Copy this skill's `starters/web-three-systems` to the project, outside any Git checkout of this skill's repository, set `app.config.json` (names, window sizes, tool name and binaries), then follow its README. Done when `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm shell:check` and `pnpm qa:audit` pass on the untouched copy and the checkout revision is recorded.
4. **Build against the stand-ins.** The page is built against the stand-in bridge (`src/bridge.fake.ts`), whose scenario is chosen in the address's fragment, so every state can be opened and photographed without the shell or the tool. The adapter is built against the stand-in tool (`test/standin-tool.ts`), which replays scenarios. Add one fixture per designed state and one per primary action in the contract's error table. Build one journey end to end, then the rest. Done when every journey runs by keyboard alone with both key families inside its budget and the audit passes with the app's own states, journeys and banned terms.
5. **Critique from screenshots.** Run `pnpm qa:shots` (every state, both themes, the default and minimum window, each system's labels and title bar) and give the pictures alone to a reviewer that did not build the app. Apply its must-fix list, then turn each class of finding into an audit gate. Done when a round returns no must-fix item, or each remaining one is an owner decision that has been asked. (Both builds: the builder's audit passed and the critic found 7 must-fix items.)
6. **Run the real tool in the real shell on each system.** Windows on the owner's machine only when he has said it is free; macOS on a Mac nobody is using; Linux in the container harness on a Mac (`scripts/linux-container/run.sh`), never WSL. Drive the page through the DevTools protocol on loopback, not system input (build 2's `measure/final.mjs`, about 90 checks per system, is the worked example; the starter has the shell-only part, `measure/shell-evidence.ts`). Measure memory from outside first ([measurement](measurement.md)). Done when each system has a summary file and a verdict, or the gap is listed as not verified.
7. **Package, install, and check the installed app on each system** ([packaging](packaging.md)). Done when the app has been started from its real launcher on each system with PATH emptied, its helpers ran from inside it, its memory was read, and it was closed by its own `--quit`.
8. **One live acceptance of the main journey** with real data, if the app has an irreversible action. Confirm what it needs before packaging (a connector, a signed-in tool, a credential the tool already holds); a missing one is a human blocker to raise at once, while the rest continues. Done when the backend's own record confirms exactly one action, or the journey is listed as not verified. (Build 1 only.)
9. **Hand over.** Give each system's launcher path with a one-line open command, the evidence folders, the verdict per premium-bar group and per system, and the not-verified list. Done when the report says in plain words that the owner has not used the app yet.

When an agent returns decisions it wants from the owner, settle every one his record already answers (earlier decisions, standing rules, the build brief) before asking, and ask the rest together in one form.

## Shell recipe

What build 2 shipped and checked in `electron/platform.ts`, `window.ts`, `shell.ts`, `menu.ts` and `main.ts`, all in the starter. "Checked" means a run on that system recorded it; Linux means containers (X11 with openbox, headless sway and weston), never a real desktop.

| Recipe line | Windows 11 | macOS 27.2 (Apple silicon) | Linux (containers) | Builds |
| --- | --- | --- | --- | --- |
| Window created hidden in the saved theme's colour, shown at first paint, 3 s fallback | `ready-to-show` | `ready-to-show` | `ready-to-show` or the end of the page load, whichever comes first | 2 on Windows, 1 elsewhere |
| Title bar | `titleBarStyle: 'hidden'`, `titleBarOverlay` with a transparent colour, the theme's glyph colour and the bar's height (36 px) | `titleBarStyle: 'hidden'`, `trafficLightPosition` computed so the lights are centred in the bar, and `titleBarOverlay: { height }` only, which turns the overlay values on for the page | As Windows. `frame` is left at its default: `frame: false` is not needed with the hidden title bar | 1 |
| Space the page leaves for the window buttons | Reported by the shell through `env(titlebar-area-*)`; measured 137 px on the right | 82 px on the left, released in full screen | 113 px on the right with Electron's default layout; on the left when the desktop asks for it | 1 |
| Traffic lights | n/a | The system's own position for a 32, 40 or 52 pt bar ((9, 9), (12, 13), (19, 19)); otherwise centred by formula. An overlay height alone does not centre them | n/a | 1 |
| Theme change | `setBackgroundColor` and `setTitleBarOverlay` | `setBackgroundColor` only: `setTitleBarOverlay` is undefined on macOS, and calling it throws | As Windows | 1 |
| App identity | `setAppUserModelId(appId)` | The bundle id from the packager | `setDesktopName('<appId>.desktop')` before ready, equal to the installed entry's name | 1 |
| Display protocol | n/a | n/a | Electron picks Wayland only when `XDG_SESSION_TYPE=wayland`. A switch appended in app code is too late, so when a Wayland socket exists and the session type is missing the app starts itself again with `--ozone-platform=wayland` | 1 |
| Shown without focus (`--no-activate`) | `showInactive` | `showInactive`; the frontmost app did not change | X11: `showInactive`. Wayland: `show`, because the compositor decides | 1 (Windows also build 1) |
| Menu | None (`setApplicationMenu(null)`) | Full menu bar with system roles, and a Dock menu | None; the shell handles Ctrl+Q, Ctrl+W, F11 and F10 itself | 1 |
| Closing the last window | Quits | The app stays running; the Dock reopens the window | Quits | 1 |
| Saved window bounds | Size and position, minus the hidden title bar's growth, restored only onto a connected display | Size and position | X11: size and position, saved after a pause because `resized` and `moved` are not sent; Wayland: size only | 2 on Windows, 1 elsewhere |
| Single instance | Per data folder, for a person's launches. A launch carrying a command flag never asks for the lock (next row). A quit within moments of a person's second launch waits 500 ms, or the second launch survives in its place (seen on macOS) | Same; files opened with the app arrive in `open-file`, registered before ready | Same; files arrive on the command line | 1 |
| Reaching the running app from a script | The control channel: a named pipe, served only when the app was started with `--no-activate` or `--control`, found through `control.json` in the data folder; clients in Node and in PowerShell (which starts no program). Never a second instance (below) | A Unix socket in the data folder (under `/tmp` when that path would pass 100 bytes); the same rules | Same as macOS; a launch from the desktop entry adds `--control` | 1 |
| Network service | In the main process (`NetworkServiceInProcess2`) while the page makes no network request: 3 processes instead of 4: 61 MB less installed and 69 MB less in development after five idle minutes | Same; 10 MB less | Same; 12 MB less (a container, three tracks loaded) | 1 |
| A main-process error | Under `--no-activate` it goes to stderr and the app ends with code 70; without it, Electron's modal error box (which takes focus) | Same. While a modal alert is up the app answers nothing, through the channel or otherwise | Same | 1 |
| Diagnostics | Written with synchronous file calls: the first asynchronous file call in the main process starts libuv's worker threads, about 32 MB of private memory on Windows that stays | Same | Same | 1 |
| Page served | `app://local` with a strict Content-Security-Policy and `connect-src 'none'`; navigation and new windows denied; a native edit menu in place of the browser's | Same | Same | 2 |
| Frame pacing and throttling | Left alone; Chromium paces every window to the primary display | Left alone; a display link per display | Left alone; frames follow the compositor | 1 measured (Windows, build 1) |

The page lays its title bar out inside `env(titlebar-area-x)` and `env(titlebar-area-width)`, so it never needs to know which side the buttons are on, and reads the system from `bootstrap().platform` set as `data-platform` on the root. Shortcuts use Ctrl on Windows and Linux and Command on macOS from one table (`shortcuts.json`) that the page, its tooltips, the palette and the macOS menu all read.

## Reaching the running app

Build 2's installed check put the app's window in front of the owner's work twice on Windows, both times while asking the running app for its diagnostics. An experiment that recorded every change of the foreground window (`measure/focus-experiment.ts`) found three ingredients, each seen:

1. **A window that comes and goes.** Where Windows Terminal is the default terminal it opens its own window for any console and ignores a shortcut's Minimized setting and PowerShell's `-WindowStyle Hidden` (microsoft/terminal issue 12464). Every script handed to Explorer flashed a Terminal window for 0.45 to 0.77 s; when it closed, Windows activated another window.
2. **The right to be that window.** What Explorer starts may take the foreground, and so may what it starts in turn, until the person next gives input. The app started by the check held that right. A second launch is a second source of it: Chromium's process singleton calls `AllowSetForegroundWindow(<running app>)` in the second process before it sends its command line (`chrome_process_finder.cc`, Chromium 156 as Electron 45.3.2 builds it), before any of the app's code runs, so the app cannot refuse it.
3. **Nothing else.** No code of the app activated its window on these paths. Development runs never showed it, because their launches came from the agent's own session, which holds no right to the foreground.

What the starter does about it (1 build):

- **A control channel** (`electron/control.ts`): the app serves a named pipe or Unix socket when a script started it (`--no-activate` or `--control`) and writes where it listens to `control.json` in its data folder. An app a person started serves none, so no script can drive the owner's own window. One JSON request per connection, one reply.
- **Command launches never become instances.** The executable started with a command flag (`--diagnostics`, `--capture`, `--quit` and the rest) sends it through the channel and ends, answered or not, without asking for the single-instance lock. A script's launch with `--no-activate` and a file is handed over the same way. A person's second launch still goes through the lock and brings the window forward.
- **The app counts second launches**, and every check that asks it anything expects 0: the shell evidence at its end, the installed check's `collect`.
- **Scripts run without a console window on Windows**: `scripts/run-as-user.ps1` hands Explorer a shortcut to `conhost.exe --headless powershell.exe ...`.
- **Installing never quits a running app**: `install.ps1` stops and says to close it, because asking it to quit by starting it again is a second launch.
- **Checks**: shell-check rule 8 (the lock only in `start()`, a command launch never reaches it, every flag the shell acts on is a command flag, no script starts the executable with a command); `test/control.test.ts` (a Node process serves the channel; both clients talk to it); `measure/foreground-sampler.ps1 -App` across every installed check on Windows; `measure/focus-experiment.ts`.

| Run (the media converter, Windows, development app, started and asked through Explorer) | Requests by | Console for the script | Result |
| --- | --- | --- | --- |
| Before the fix | a second launch | Minimized shortcut to `powershell.exe`, `-WindowStyle Hidden` | Terminal in front for 0.77 s, then the app's window in front |
| Fix to the app only | the control channel | the same | Terminal in front for 0.63 s, then the app's window in front |
| Both fixes | the control channel | `conhost.exe --headless` | nothing came to the front; 0 second launches |
| Both fixes | the executable started again with the commands (it forwards them) | `conhost.exe --headless` | nothing came to the front; 0 second launches |
| From the agent's own session | the control channel | none | nothing came to the front |

The installed app, repackaged with both fixes and checked through Explorer with a sampler running from before the install to after the quit, recorded no change of the foreground at all.

## Tool adapter

The tool ships inside the app, one binary per system and processor, and is started by absolute path with an argument array (build 2). It is called with a short capabilities question at launch and one streaming job at a time; it cancels when its stdin closes; it owns every process it starts; and a job record written before it starts lets the next launch remove what a killed run left. The page never sees a path, an executable or a flag. [tool-contract](tool-contract.md) has the rules, what testing changed in them, and the per-system traps. The starter's `electron/tool/` holds the pieces: line reader, runner, locator, status cache, job records, progress model and adapter, all plain Node and tested against the stand-in on every system.

Build 1's pattern (an npm-global tool started through the system `node.exe` from its `.cmd` shim) is in the `windows-web` starter, for a Windows app whose tool is an npm global. Build 1's frozen-attempt record for irreversible actions (one stable key, three outcomes, never an automatic resend, a 5 second undo window) is described in that starter's provenance; no second build has needed it.

## Packaging and install

`@electron/packager` on every system with an explicit keep-list and no `node_modules`; the tool and its helpers beside `app.asar` under `resources/bin/<platform>-<arch>/`; a per-user install on Windows through Explorer, an ad-hoc signed bundle on macOS, a `.deb` and a portable `.tar.gz` on Linux built in a container. [packaging](packaging.md) has the recipe, what each system was seen to do, and the owner's distribution decisions.

## When this stack is the wrong choice

- **A Mac-only app.** Use the SwiftUI branch. This branch's Mac build is for an app that must also exist on Windows and Linux.
- **Small utilities and resident tools** (pickers, launchers, tray tools, viewers that must appear instantly and stay small) belong on the fastwin branch on Windows. That tier was researched and not built or measured in this work.
- **An app that cannot fit the ceiling**, for example one that embeds several webviews or holds large media in the page (build 2 kept audio out of the page: `<audio>` elements streamed from the main process, never decoded buffers).
- **Several content apps open at once.** At about 300 MB each the ceiling holds per app, and the sum is the owner's cost. A shared host was considered and declined.
- **A core that must hold state between many small calls** (a language server, a player): use long-lived stdio with requests and replies instead of one-shot jobs ([tool-contract](tool-contract.md)).

## Counter-evidence

State these whenever this stack is recommended.

- **Raycast chose a native host.** Raycast v2 moved to a web UI and still ruled out both Electron and Tauri, to keep control of the native side: on Windows its host is C# and WPF around a WebView2 view. This recipe takes Raycast's conventions and leaves out its host. Popovers here are clipped by the window edge, and settings open in the same window.
- **Tauri saved disk, not memory or start-up** (build 1's bake-off, Windows): 437 MB settled against Electron's 343 MB, 663 ms start-up against 540 ms. On macOS, Tauri's system web view caps `requestAnimationFrame` at 60 on macOS 13 to 15 according to a plugin's documentation (report 10, secondary source).
- **Memory is a real cost.** 343 MB idle for a mail form is five to forty times what the owner's native tools hold. Build 2 sat at 304 to 314 MB idle on Windows, over its budget, until the network service moved into the main process (243 MB installed); the GPU process alone is about 110 MB there, and no switch lowers it without turning off hardware acceleration. The same app held 110 to 135 MB on macOS and Linux; during a ten-minute export its tree peaked at 466 MB on Windows (a hidden console host counted), 570 MB on macOS and 240 MB on Linux. The macOS peak is 84% of the ceiling, with only the tool and FFmpeg added.
- **Claude Desktop's own footprint.** It measured 1.5 GB while hosting a session, more than twice the ceiling. Copy its launch and title-bar settings only.
- **The admired Mac apps are admired for integration more than looks** (report 09): a complete menu bar, native settings windows, Services, Quick Look, AppleScript. A web shell can supply most of it and these builds supplied little: no settings window, no Open Recent, no scripting dictionary. The toolbar window shape and the system's glass are out of reach without native code; do not imitate them.
- **Native on the Mac is rarer than expected.** On the owner's machines the Mac ChatGPT app is the Codex Electron app and Ollama is a system web view in a native shell; only Tailscale is native on both systems (report 08). That supports this branch, but it is evidence about what vendors ship, not about what users prefer.
- **Research claims that tests proved wrong** (build 2). A closed progress pipe does not end FFmpeg on any system; ad-hoc signing with the hardened runtime verifies and then the app dies at launch; `setTitleBarOverlay` does not exist on macOS; `frame: false` is not needed on Linux; an overlay height alone does not centre the traffic lights; Electron's Wayland choice cannot be changed from app code. Kill, launch and measure in a test; do not reason about it.
- **Frame rate and feel.** Displayed frames were measured on Windows only (build 1: 119.9 fps scroll, no late frame). A container runs a software compositor at 60 Hz and says nothing about real displays. Whether a keystroke reaches the screen quickly was measured only on the page's clock.

## Not verified in build 2

Every macOS and Linux claim above rests on one Mac (macOS 27.2, Apple silicon) and arm64 containers on it. Not verified: a real GNOME or KDE session, real fractional scaling, portals, IME under Wayland, Orca, and the Ubuntu 23.10 and later user-namespace restriction (a container uses the host's kernel); x86-64 Linux except under emulation; a downloaded, quarantined macOS build and the dialog a person would see; Intel Macs; VoiceOver; Narrator; displayed frames on macOS and Linux; key-to-photon anywhere; a cold start after a reboot; anything on a second display; Windows publication on exFAT, FAT or a network share; the owner's own use of the app. Focus on Windows was tested on one machine (Windows 11 with Windows Terminal as the default terminal); with the old console host as the default the console flash may differ, and the fix does not depend on it. By the app's records the control channel ran on macOS and in a Linux container through build 2's `measure/final.mjs` against the development app; no installed check on macOS or Linux has run through it. The focus problem itself was found and reproduced only on Windows. In the starter the control channel's Node side is tested on its own; the starter's Electron side (its `main.cjs` and `shell.cjs` with the channel) has not been started.

## Not verified in build 1

Narrator and any screen-reader task; IME and composition; key-to-photon with a camera; click-to-photon; window resize behaviour; presents while idle; a cold start after a reboot; anything on a second display; a real rejection from the provider (failures were simulated with a stand-in tool); and the utility tier. A report on a new app carries its own version of this list.
