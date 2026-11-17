# Premium bar for content apps

One hundred and three rules an agent can test on the rendered app and its shell (numbered 1 to 103; 41b is the display-level half of 41), and the process around them. By evidence: 34 rule rows are checked in two builds, 54 in one, 4 in part of one, and 12 in none. Rules 1 to 40 came from craft research; a review against what Linear, Superhuman, Raycast, Stripe, 37signals and the latency literature say changed nine of them and added 41 to 56 and the process steps (round 1, built into the mail app for Windows). Rules 57 to 100 came from round 2, which widened the bar to Windows, macOS and Linux and tested it on the media converter (an Electron app over a command-line tool, on all three systems): five research reports proposed 56 rules, each numbered from 57, and the builders and an independent critic added what testing showed. Rules 101 to 103 came from what the media converter found by experiment after round 2's extraction: why an agent's test window took the owner's focus on Windows, and the largest removable part of its Windows idle memory. "Where the round 2 numbers went" at the end maps every proposal to its number here.

**What passing means.** The rules are a floor that stops known mistakes. Passing every one earns the sentence "passes the automated bar". It does not earn the word premium: that is the owner's verdict after real use (process step 4). In both builds so far the builder's own audit passed with no failures while an independent critic who saw only screenshots found 7 must-fix items. Weigh the groups below in the order they are listed.

**Builds column.** How many builds applied the rule and recorded a check of it: **2** (the mail app and the media converter, both 2026-11-15), **1**, or **0** (proposed by research, not yet built or checked anywhere: a hypothesis). "1 (part)" means one build checked part of it; the rest is unverified.

**Check column.** Each value names a script in the three-system starter (`starters/web-three-systems`) that fails when the rule fails, or says the check is by hand:

| Value | Script |
| --- | --- |
| `audit` | `pnpm qa:audit`: the page, headless, against the stand-in bridge, in every state, both themes, both key families |
| `audit (part)` | the audit covers part of the rule; the rest is by hand |
| `typing`, `kill` | `pnpm qa:typing`, `pnpm qa:kill`: the real shell, started without focus |
| `measure` | `python measure/run.py`: PresentMon on Windows only |
| `memory` | `pnpm measure:memory`: the development app idle for five minutes, private bytes per process read from outside, a foreground sampler throughout; Windows only |
| `focus` | `pnpm measure:focus` with `--first explorer --route explorer`, and `measure/foreground-sampler.ps1 -App` across an installed check: every change of the foreground window recorded; Windows only |
| `test` | `pnpm test`: the adapter against the stand-in tool, including the host-kill test, and the control channel served by a Node process |
| `shell-check` | `pnpm shell:check`: the shell's rules read from its source, no launch |
| `evidence` | `pnpm shell:evidence`: the real shell, reached only through its control channel; it opens a window, so on the owner's machine only when he has said it is free (see `SKILL.md`) |
| `container` | `scripts/linux-container/run.sh`: the real shell under X11, sway and weston in arm64 containers on a Mac |
| `installed` | `scripts/package.mjs` checks and `scripts/installed-check.*`: the packaged app installed and started from its real launcher |
| `contract` | the tool's own contract suite, which lives with the tool (build 2: `tool/tests/contract.py`); not in the starter |
| `manual` | no script checks it: do the test in the Test column and keep the evidence |

Report each rule as verified, unmet or unverified, per system where the rule names one.

## Data safety and reliability

| # | Rule | Test | Check | Builds |
| --- | --- | --- | --- | --- |
| 44 | Killing the process at any moment loses at most the last second of input | Kill the real shell 60, 300 and 600 ms after the last key, with a short and a 20,000-character document; relaunch and compare | kill | 2 |
| 45 | No crash and no unhandled error in the scripted session; a renderer crash recovers to the restored state | Page errors fail every audit state; force a renderer kill and relaunch | audit (part) | 2 |
| 43 | No local action waits on the tool or backend before its first visual response, including while a tool job runs | Stall the stand-in tool for 2 s, and run a job; local actions still respond on the next frame | manual | 1 |
| 11 | Destructive actions offer Undo or ask for confirmation; prefer Undo | Scripted run of each destructive command | manual | 2 |
| 54 | Memory has a fixed budget per app, split into the shell's share and the app's share, by each system's definition (private bytes on Windows, `phys_footprint` on macOS, anonymous resident memory plus swap on Linux), counting the tool and every process it starts at peak; the app's share grows only with a recorded reason | `scripts/memory-tree.*` from outside, before the app is asked anything, after five minutes idle and during the longest job, against 300 MB and 680 MB | measure, installed | 2 |
| 103 | The network service runs inside the main process when, and only when, the page makes no network request (`connect-src 'none'`); an app whose page talks to a server keeps the separate process and records why. Hardware acceleration and GPU compositing stay on: the GPU process (about 110 MB on Windows) is the floor | The shell check fails the switch without `connect-src 'none'`; the process kinds and private bytes of the tree from outside after five idle minutes, one change at a time against a baseline (build 2, Windows: 306.8 MB over 4 processes before, 238.0 MB over 3 after; installed 304.4 to 243.2 MB) | shell-check, memory | 1 |
| 57 | Ending the app's main process at any moment during a tool job leaves no tool process and no process the tool started alive 2 s later; what the tool could not clean up is removed at the next launch | Kill the host while the tool works (`test/host-kill.test.cjs`) on each system; kill the tool itself mid-job, including with a child that ignores signals | test, contract | 1 |
| 58 | Cancel is acknowledged in the same task as the key or click, and within 2 s the job has ended with no output and no temporary files | Scripted cancel early, midway and during publication; read the page state after the click's microtasks; list the destination folder | test, audit (part) | 1 |
| 59 | The app checks its tool before enabling anything that needs it; a missing, damaged or incompatible tool shows a designed state whose filled button can succeed | Stand-in scenarios: absent, wrong schema, unknown major, silent | test, audit | 1 |
| 60 | The adapter survives a hostile tool: 10 MB of noise, a 2 MiB line, events out of order, no output for 60 s, an exit without an outcome; each ends in a designed error and memory stays in budget | Stand-in scenarios, with the tool's processes checked gone afterwards | test | 1 |
| 61 | Bundled tools run by absolute path from inside the app, with an argument array, no shell and no PATH lookup; the installed app works with PATH emptied | Installed check: the installed app's own executable starts every helper with PATH empty; launch from the real launcher with PATH empty | installed | 1 |
| 62 | Jobs succeed with paths containing spaces, quotes, non-Latin text, a leading dash and more than 260 characters | Fixture matrix in the tool's contract suite on each system; a network share is still unverified | contract | 1 |
| 63 | A file is replaced only after an explicit yes for that job in the system's save dialog; a name the app generated never replaces a file; a file that appears during the job is kept | Create the destination before and during a slow job; export twice with defaults and compare the first file byte for byte | contract, audit (part) | 1 |
| 64 | Bundled third-party programs have their notices, source and build configuration reachable from About | Open About in the installed app; compare with the programs in the bundle | installed, manual | 1 |

## Speed and latency

| # | Rule | Test | Check | Builds |
| --- | --- | --- | --- | --- |
| 41 | Key press to paint in every text field: 95th percentile 50 ms or less with realistic data loaded, never over 100 ms | 220 real key events on an empty and a 20,000-character document | typing | 2 |
| 41b | The same, at the display | One high-speed camera capture per shell and machine, key to pixel | manual | 0 |
| 27 | Typing, selection and navigation: 95th percentile 50 ms, no interaction over 100 ms. 200 ms is allowed only for actions that do real work | Event timing during a scripted session | typing (part) | 1 |
| 29 | Typing never produces a long task over 50 ms per key | Worst event timing in the typing run | typing | 2 |
| 7 | The command palette opens with the primary modifier and K (Ctrl+K; Cmd+K on macOS) within 50 ms (100 ms is the limit) and with no open animation; on macOS it adds to the menu bar and never replaces it | Key event to the frame that shows it; animation scan during the key | typing, audit | 2 |
| 2 | Pressed feedback appears within one frame of pointer-down, measured at the display against the idle baseline | PresentMon click-to-photon | manual | 0 |
| 28 | Click-to-photon for a button press is within two frames above the idle baseline | PresentMon click-to-photon | manual | 0 |
| 25 | Scrolling a 10,000-row list holds the display rate: at most 1 late frame per 1,000 and a 99th percentile within 5% of the refresh interval. On macOS and Linux only real hardware counts: a container's software compositor runs at 60 Hz whatever the display | PresentMon on the GPU process during the scroll (Windows) | measure | 1 |
| 26 | Lists over 50 rows are virtualized | DOM row count at the top, middle and end | audit | 2 |
| 42 | Each named interaction has a written latency budget, checked on every build | Budget table in `docs/JOURNEYS.md`; the typing and measure runs fail on a regression | typing (part) | 2 |
| 30 | Start shows no white or black flash before first content; the window is revealed at first paint on every system (on Linux also at the end of the page load, since `ready-to-show` is not dependable there) | Frame capture at launch on real hardware per system. Not possible headless or in a container (build 2) | manual | 0 |
| 9 | No spinner or skeleton for work under 150 ms, including a job's stage; one that shows stays at least 300 ms; an action on local data never shows one | Throttled runs; a fixture with a stage under 150 ms | manual | 1 |
| 10 | A skeleton matches the final layout: no shift when content arrives | Screenshot difference | manual | 1 |
| 65 | Progress never moves backwards, never reads 100% before the outcome, and is indeterminate when the total is unknown; a tool floors its own counter by what it has written, because a child's last progress report can describe the wrong output | Replay events including null totals, a counter that goes back and a stalled stage; sample the bar each frame | test | 1 |
| 66 | Time remaining appears only when it can be trusted, changes at most once a second, never counts up by more than one second, and is worded in coarse units ("about 2 minutes"). Default: after 3 s and 5%; a shorter delay is a recorded decision | Replay a job with uneven speed and read every published value | test | 1 |
| 67 | A control's drawing never trails its value: no transition or animation on the indicator, and the readout changes in the same task as the input (a store outside React read with `useSyncExternalStore`) | Animation scan during a scripted drag and key steps; the value and the drawing read in the same task. A frame capture of pointer, indicator and number together is not possible headless | audit (part) | 1 |

Rule 25 was rewritten in round 1 because the original threshold (99th percentile under 8.3 ms) could not be met by a passing run on a 119.9 Hz display, whose interval is 8.34 ms.

## Task and language

| # | Rule | Test | Check | Builds |
| --- | --- | --- | --- | --- |
| 47 | Each essential journey has a recorded step count that may not grow | Keyboard-only script per journey against `qa/journeys.json`, once with each key family (Ctrl, and Command) | audit | 2 |
| 6 | Every flow completes with the keyboard alone; an overlay takes focus in the same turn as the key that opened it, traps it, and returns it on close | Journey scripts use no pointer; keys typed straight after the opening key land in the overlay; tab through each overlay | audit (part) | 2 |
| 46 | Every command is in the palette; every repeated command has a shortcut shown in its palette row and its tooltip, written as the system writes it as one string ("Ctrl+Shift+E" on Windows and Linux, "⇧⌘E" on macOS), and the shortcut works on both key families. Shortcuts come from one table read by the page and the macOS menu | Palette rows against the exemption list and the label format; each key pressed with each family and its effect checked; the menu compared with the table | audit, shell-check | 2 |
| 55 | The shortcut map and the position of primary actions are recorded and compared between releases | The shortcut table (`shortcuts.json`) and a screenshot pair per release | manual | 2 |
| 49 | No text a person can read, Details and About included, carries an internal identifier, protocol term or implementation noun; the tool's own text reaches a person only through Copy details, which copies it without showing it | Whole-word banned-term scan of rendered text and labels in every state (a substring match gave false hits in build 2); a fresh reader states what happened from the screenshot alone | audit (part) | 2 |
| 50 | An error says what happened and whether the person's work is safe, and its filled button is an action that can succeed for that cause; when nothing the person can do will help, the filled button copies the details for whoever repairs the app | One fixture per failure class, from the tool contract's error table; the filled button differs between causes a retry can fix and causes it cannot | audit (part) | 2 |
| 51 | At rest a screen shows at most one line of instruction; every preference has a recorded reason a default could not serve | Count instructional sentences per state; preferences ledger in `docs/DECISIONS.md` | manual | 2 |
| 48 | Any field that history or context could supply is prefilled | Fixture with history; no empty required field that has a last-used value | manual | 1 |
| 8 | Every screen has designed empty, loading, error and dense states; an empty state shows what the filled screen will look like or offers one action | One stand-in fixture per state; screenshots | manual | 2 |
| 52 | Worst-case content holds: one-letter and 200-character names; 0, 1 and 10,000 items; a 300-character title | Fixture matrix with screenshots | manual | 2 |
| 68 | Every code in the tool's published list has a stand-in fixture, a sentence of the page's own and a primary action; an unknown code from a newer tool gets a generic sentence | One stand-in scenario per code plus one invented code | test, audit (part) | 1 |
| 69 | No filled button reads Details, Show details or OK; a failure that happens again says so and offers a different step | Every filled button in every state; a repeated failure fixture | audit | 1 |
| 70 | A finished job says in words what it did and where ("Saved Mix.wav to Music"); its filled button is the next useful step, not a repeat of the job | Screenshot of the done state | manual | 1 |
| 71 | Names are cut at the end, keeping their start, with the whole name on hover and focus and never fewer than about 12 characters showing; the middle is cut only where the end carries meaning (an extension) | Fixtures with long names at the minimum window and 200% zoom | manual | 1 |
| 72 | Nothing reads as a web form: no native range, select, number, checkbox or radio input, no `title` tooltip, no pointer cursor on controls, no capitals or letter-spaced labels, no blur, glow or gradient, no slogan heading | Scan of every state | audit | 1 |
| 73 | A continuous control (knob, dial, custom slider) has a recorded full-range drag distance in CSS px that does not depend on its drawn size, and responds to vertical movement only | Scripted drags of the recorded distance at two window sizes reach the limit exactly; a horizontal drag changes nothing. Cannot be scripted on the pointer-lock path; use pointer capture or test by hand | audit (part) | 1 |
| 74 | A fine modifier of a recorded ratio works for drag, wheel and keys, and pressing or releasing it mid-drag does not move the value | Drag, press the modifier, read the value before and after | audit | 1 |
| 75 | A custom value control is a slider to assistive technology: role, minimum, maximum, current value and a spoken value text, with the arrow, Page Up and Down, Home and End keys of the APG slider pattern | axe plus a key script checking each key's effect and `aria-valuetext` | audit | 1 |
| 76 | Typed entry accepts every unit the control shows, with or without the unit, and a rejected entry changes nothing and names the current range in each unit | Fixture strings, the value after each commit, the old value intact after each rejection | audit | 1 |

Rules 73 to 76 apply when the app has a continuous value control; the starter has none.

## System integration and native seams

Each rule names its system where it applies to one. Build 2 ran macOS on a Mac nobody was using and Linux only in containers, so "Linux" below means X11 under Xvfb with openbox and headless sway and weston on Debian and Ubuntu userlands, never a real GNOME or KDE session.

| # | Rule | Test | Check | Builds |
| --- | --- | --- | --- | --- |
| 39 | Windows: the title bar is 32 px (48 px with search) or a recorded other height; it drags from all empty space, shows snap layouts on the maximize button and squares its corners when maximized. Every system: the title bar's content dims when the window is inactive | Window automation and screenshots. Both builds use 36 px to match the overlay, recorded as a decision | manual | 2 |
| 53 | Native seams are native: no browser context menu; on macOS a menu bar with the app, Edit and Window roles; on Windows and Linux no menu bar drawn inside the window; the system's open and save panels; system contrast themes respected. Popovers clipped by the window edge and settings in the same window are known gaps of this shell | Window automation, the menu dump in diagnostics, screenshots | manual | 2 |
| 40 | A window material (Mica on Windows, vibrancy on macOS) has an opaque fallback and looks correct when inactive, in Energy Saver, with transparency off and with Reduce Transparency and Increase Contrast on. Linux has no system material | Screenshots in each mode. Not applicable while the app uses no material, as both builds do not | manual | 0 |
| 77 | Every platform difference in the main process comes from one module (`electron/platform.cjs`); the page learns the system from one bootstrap value set as one root attribute and never reads the user agent; the stylesheet is the same in every build | Search the main process for `process.platform` outside that module; the page source for `navigator.platform` and `userAgent` | shell-check | 1 |
| 78 | Title bar content stays inside the title-bar area the shell reports (`env(titlebar-area-*)`) on every system; no fixed caption gutter in CSS. Build 2 measured 137 px reserved on the right on Windows, 82 px on the left on macOS and 113 px on the right in the Linux containers | The page's overlay rectangle and env values from diagnostics compared with each title-bar child's box | evidence, audit (part) | 1 |
| 79 | Window controls are the system's on every system: caption buttons on Windows, traffic lights on macOS, the overlay's buttons on Linux; the page draws no close, minimize or maximize button | Display-level screenshot per system (a page screenshot cannot show them) | evidence, container | 1 |
| 80 | macOS: the traffic lights are centred in the bar: at the system's own position for a 32, 40 or 52 pt bar ((9, 9), (12, 13), (19, 19)), by formula otherwise; the left inset is released in full screen | Positions computed in the shell check; `getWindowButtonPosition()` in diagnostics; a window screenshot | shell-check, evidence | 1 |
| 81 | macOS: the menu bar has the app, File, Edit, View, the app's own menus, Window and Help in that order, holds every command with its shortcut, dims rather than hides, and uses the system's roles for editing, hiding and quitting so Cmd+C, V, X, A, Z and Q work in every field | The menu template against the shortcut table; the menu dump with a command dimmed; key presses in each field on a running build | shell-check, evidence (part) | 1 (part) |
| 82 | Closing and quitting follow the system: on macOS closing the last window leaves the app running and the Dock reopens it; on Windows and Linux closing quits, unless a tray icon exists; a running job makes the close and the quit ask first | Close the window and read whether the process lives; reopen through the Dock path; start a job and close | evidence | 1 |
| 83 | Linux: window buttons follow the desktop's button layout, on the left, the right or both, and never collide with app controls | Run with the layout set to the left; compare the overlay rectangle with the bar's controls | container | 1 |
| 84 | Linux: the app is a native Wayland client whenever a Wayland session exists, including one whose session type is not set (the app starts itself again with Wayland named, because a switch added in app code comes too late); no journey depends on window position, focus requests, always-on-top or showing without focus; no Linux-unimplemented window option is used without a guard | The container's no-session-type and sway variants; search the main process for `skipTaskbar`, `movable`, `closable` and the rest | container | 1 |
| 85 | Linux: the window's `app_id` (Wayland) or `WM_CLASS` (X11) equals the installed `.desktop` file's name | The compositor's window list against the installed entry; `desktop-file-validate` | container, installed | 1 |
| 86 | Linux: every shipped package and every test run uses the Chromium sandbox; nothing passes `--no-sandbox`; the `.deb` carries the setuid helper and an AppArmor profile for Ubuntu 23.10 and later | Container run with `seccomp=unconfined`: renderer `Seccomp: 2`; the helper root-owned with mode 4755; once by hand on a real Ubuntu 24.04 or later, which no build has done | container, installed | 1 (part) |
| 87 | macOS: the bundle passes `codesign --verify --deep --strict`, every nested program carries the hardened runtime, and the app starts: an ad-hoc signed app with the hardened runtime verifies and then dies at launch unless library validation is off. A build for other people also passes `spctl --assess`, which needs a Developer ID | The package script fails on each; the installed check starts the app from `open` | installed | 1 |
| 88 | Files come in by the system panel, by a drop on the window, and by opening them with the app (Dock, file manager, command line), and reach the page as opaque ids; a finished result can be dragged out as a real file | One scripted route each; drag-out by hand | evidence (part), manual | 1 (part) |
| 89 | Each system's build has a known-gaps list (no toolbar window shape or system glass on macOS, controls matched in size not rendering, no launcher progress on Linux), and nothing imitates a system material or widget set | The list in `electron/platform.cjs`; the critic reviews screenshots for imitation | manual | 1 |
| 90 | macOS: Settings opens with Cmd+, in its own window titled by pane, applying at once with no Apply button | Window count and title after the key | manual | 0 |
| 91 | Every system: light and dark, accent, contrast, reduced motion and reduced transparency follow the system while the app runs | Toggle each setting under automation; screenshot within a second | manual | 0 |
| 92 | Dialog button order and keys follow the system; confirmations are sheets or attached panels on macOS and GNOME | One fixture per dialog per system | manual | 0 |
| 93 | Linux: the frame mode is chosen per desktop and recorded (client-side with shadow and rounded corners on GNOME; the compositor's title bar or a recorded exception on KDE) | Screenshot per desktop | manual | 0 |
| 94 | Linux: the app's keys follow the desktop: Ctrl+Q quits, Ctrl+W closes, F11 is full screen and F10 opens the app's list of actions on every desktop; preferences on Ctrl+, (GNOME) or Ctrl+Shift+, (KDE) | Key presses into the real shell in a container; the desktop keys on a real desktop | container (part) | 1 (part) |
| 95 | Linux: file dialogs, notifications and appearance settings go through the desktop portals; a Flatpak build needs no extra filesystem permission | Session-bus watch; the Flatpak manifest | manual | 0 |
| 96 | Linux: a tray icon, if the app has one, always has a context menu | `setContextMenu` called before the icon shows | manual | 0 |
| 101 | No script reaches the running app through a second instance. The app serves a control channel (a named pipe on Windows, a Unix socket elsewhere) only when a script started it (`--no-activate` or `--control`); the executable started with a command flag forwards it through the channel and ends without asking for the single-instance lock; the app counts second launches, and every scripted run that asks it anything ends with that count at 0. A person's own second launch still brings the window forward | Shell-check rule 8 before every launch; the control test serves the channel from Node and sends through the app's client and the scripts' client; `shell.lifecycle.secondLaunches` read after the last request of the shell evidence and of the installed check's `collect` | shell-check, test, evidence, installed | 1 |
| 102 | Windows: no check puts a window in front of the owner's work. No script runs in a visible console (a script Explorer runs starts under `conhost.exe --headless`; a Minimized shortcut or `-WindowStyle Hidden` is not enough where Windows Terminal is the default terminal), and nothing is claimed about focus without a foreground sampler running across the whole run and a launch started through Explorer, because a launch from an agent's own session holds no right to the foreground and cannot show the problem | `measure/focus-experiment.mjs --first explorer --route explorer` against the development app; `measure/foreground-sampler.ps1 -App <installed exe>` from before the install to after the quit; neither records the app's window in front, and console windows appear only where a person switched to one | focus, installed | 1 |

## States, typography and layout

| # | Rule | Test | Check | Builds |
| --- | --- | --- | --- | --- |
| 1 | Every interactive element has distinct rest, hover, pressed, focus-visible and disabled states | Screenshot each state | manual | 1 |
| 4 | Contrast increases on hover, active and focus | Pixel sample | manual | 1 |
| 5 | Every focusable element shows a visible focus ring of at least 2 px on keyboard focus and none on mouse click; a focus ring never looks like a selection or value mark | Every focusable element in every state must change appearance on focus; ring width and the mouse case by screenshot | audit (part) | 2 |
| 12 | Toasts enter and leave by the same edge, are announced politely, pause while the window is hidden, and never cover a primary control | DOM check; screenshot at the minimum window | manual | 1 |
| 31 | Text sizes come from one ramp; no text under 12 px; no semibold under 14 px | Smallest computed text size in every state; weights by computed style | audit (part) | 2 |
| 32 | Numeric columns and live numbers use tabular numerals, and a live number's box does not change width across its range | Computed style; the readout's box at the minimum, zero and maximum values | manual | 2 |
| 33 | Nested corners are concentric: outer radius equals inner radius plus padding | Computed geometry | manual | 1 |
| 34 | Spacing values come from the token scale | Computed style against `tokens/design-tokens.json` | manual | 1 |
| 35 | Interactive targets are at least 24 by 24 px and never overlap | The audit lists smaller targets without failing; review the list | audit (part) | 2 |
| 36 | One icon set, one stroke weight per surface; every control has an accessible name, and that name contains its visible label | Accessible-name and label-in-name checks on every interactive element in every state | audit (part) | 2 |
| 37 | Text and icons meet contrast in both themes | axe in every state and theme; resolve axe's "needs review" contrast items by hand | audit (part) | 2 |
| 38 | Layout holds at the app's own default and minimum window, 125% scale and 200% zoom, and with long strings: no sideways scroll, no clipped text without a fade or scrollbar | Overflow and clipped checks in every state at those four sizes, taken from `app.config.json` | audit | 2 |
| 56 | Reading text has a measure of 45 to 75 characters | Computed line length of body text | manual | 1 |
| 97 | The same controls sit in the same place in every state at every audited size; a status or footer bar has one height in every state and cuts a long message at its end instead of wrapping | The title bar, work area and status bar boxes in every state compared with the first at each size | audit | 1 |
| 98 | Nothing a person operates spills out of its region or the window, regions do not overlap, and the window itself never scrolls. A root with hidden overflow does not pass by hiding the spill | Each region's controls inside the region and the window at every size; the window's scroll range | audit | 1 |
| 99 | One type scale in every build; the UI font is either a bundled brand font or the system's UI font through one stack that resolves per system | Type-scale tokens identical across builds; computed font family per system | audit (part) | 1 |
| 100 | Type size and control height come from a per-system density token (13 px body and 24 px controls on macOS; the desktop's font on Linux) | Computed style per system build | manual | 0 |

Rule 31's 12 px floor held in build 2 on all three systems. Report 09 proposed an 11 px floor for secondary text on macOS (the system's small size); no build has tried it.

## Motion

Ask first whether the thing needs to animate at all. Motion was 12 of the original 40 rules, which overstates its weight.

| # | Rule | Test | Check | Builds |
| --- | --- | --- | --- | --- |
| 13 | No UI animation exceeds 300 ms; modals, drawers and sheets may reach 500 ms (the starter's audit holds a sheet to 450 ms) | Shipped stylesheets and the animations that actually ran | audit | 2 |
| 14 | No `transition: all` | Shipped stylesheets | audit | 2 |
| 15 | No layout property animates: transform, opacity, filter, clip-path and colour only | Shipped stylesheets and the animations that actually ran | audit | 2 |
| 18 | Popovers and menus grow from their trigger, not their centre | Computed transform origin | audit | 2 |
| 20 | Keyboard-triggered actions and list navigation run no animation; nor do wheel steps, presets, reset or typed entry on value controls | Animation scan during shortcuts, arrow keys and value changes | audit | 2 |
| 22 | With reduced motion requested, no transform animates; opacity may fade | Emulate and scan | audit | 2 |
| 3 | Web-styled buttons scale to 0.96 to 0.98 on press over 100 to 160 ms, as a recorded decision; list rows, menu items and title-bar controls do not scale. On macOS and Linux a scaling button may read as a web tell (AppKit and libadwaita buttons change shade only; report 09, inferred); both builds kept the scale everywhere | Computed style | manual | 2 |
| 16 | Nothing enters from `scale(0)`; entering scale starts at 0.9 or higher with opacity | Keyframe scan | manual | 1 |
| 17 | Entering and leaving elements ease out; no ease-in on UI | Computed timing functions | manual | 1 |
| 19 | The first tooltip waits; the next in the same group opens at once | Scripted hover | manual | 1 |
| 21 | Reversing an animation mid-flight continues from the current value | Frame capture of a rapid toggle | manual | 1 |
| 23 | No animation plays on first paint unless it is a designed entrance | Frame capture at load | manual | 1 |
| 24 | Spring bounce is 0 by default and never above 0.3 outside drag release | Config scan | manual | 1 |

## Process steps

Done in both builds: step 3 (the independent critic). Done in build 2 only: step 1 (journeys written before building) and step 10 (seam files first). Not yet done in any build: steps 2, 4, 5, 6, 7, 8, 9 and 11. They come from the same reviews and are hypotheses.

1. **Name the essential journeys first.** Five to fifteen per app, written before components are chosen, each with its step budget (rule 47). Build 1 named its main journey only after a reviewer counted the steps, and the count removed a whole confirmation step. Build 2 wrote its twelve journeys and shortcut table before any builder started.
2. **Walk the journeys.** A reviewer that did not build the app walks each journey in the real shell with real data and writes a friction log. The owner walks the same journeys and the two are compared. Build 2 ran its journeys by script in the real shell on all three systems; no person walked them.
3. **An independent critic.** The critique agent gets only screenshots and recordings, never the code, the audit or the builder's notes. The builder cannot see the builder's own flaws: in both builds the builder's audit passed with zero failures while the critic found seven must-fix items. Build 1's included implementation words in primary text and an error whose filled button could only fail again; build 2's included errors whose filled button was "Show details", developer text inside Details, a number that overflowed its dial at four digits, a footer that wrapped and crushed the layout at the minimum window, and names cut in the middle. Turn each class of finding into an audit gate so it cannot come back (build 2 did; rules 69, 71, 72, 97 and 98 are the result).
4. **A use gate.** The word premium is not applied until the owner has done real work in the app for a set number of days. Every annoyance in that period goes into the papercut log with a screenshot.
5. **A standing papercut pass.** Each iteration closes at least one flaw that is not a bug, in 30 minutes or less.
6. **Zero known bugs at ship, and a seven-day limit after.**
7. **An appetite and a circuit breaker.** Each screen gets a time budget; when it runs out, scope is cut and the cuts are written down.
8. **Diverge before polishing.** Build three layouts behind a switcher, choose, then run the polish rounds.
9. **Film it once.** One high-speed camera capture per shell and machine, to check the software clocks. It needs the owner's hands or a fixed camera, so ask before planning on it.
10. **Seam files first.** Before parallel builders start, the lead writes the tool contract and the page-to-shell bridge, and nobody else changes them. In build 2 five builders in separate worktrees (tool, adapter, shell, packaging, page) built against the two files and merged with no conflicts.
11. **Native references for the critic.** Give the critic a native app's screenshot per system at the same size beside each app screenshot (Finder or Notes on macOS, Files on GNOME, Dolphin on KDE). Proposed by report 09; build 2's critic saw only the app.

## Where the round 2 numbers went

Five reports (08 to 12) each numbered their proposals from 57. Duplicates were merged, rules about one app's audio were left out, and the rest were placed in the groups above.

| Report | Proposed | Here |
| --- | --- | --- |
| 08 Same app on three systems | 57, 58, 59, 60, 61, 62, 63, 64, 65; changes to 39, 40, 46, 53 | 77, 80, 78 and 83, rule 30, 82, 96, 77, 99, 84; amended 39, 40, 46, 53 |
| 09 Mac and Linux expectations | 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74; changes to 3, 7, 31, 39, 40, 46, 53; process step | 81, 81, 80, 90, 82, rule 39, 100, 91, 92, 88, 84, 83, 93, 94, 95, 85, 89, 89; amended 3, 7, 39, 40, 46, 53, and 31 noted; step 11 |
| 10 Electron on three systems | 57, 58, 59, 60, 61, 62, 63, 64, 65; changes to 25, 30, 39, 53, 54 | 78, 81, 79, 84, 86, 61, 87, 85, 86; amended 25, 30, 39, 53, 54 |
| 11 A GUI on a command-line tool | 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67; changes to 9, 43, 50, 54 | 57, 58, 59, 65, 66, 68, 61, 62, 63, 60, 64; amended 9, 43, 50, 54 |
| 12 Audio tool interfaces | 57, 58, 59, 60, 61, 62, 63, 64, 65; changes to 20, 32, 46 | 73, 74, 75, 67, 76, left out (audio on the main thread: one app's), 58 and 65 and 66 (taskbar progress left out: Linux cannot show it), 63, 98; amended 20 and 32; the change to 46 (typed values exempt from the palette) left out as one app's |

Found by testing rather than proposed: 69 and 97 (the critic of build 2), 71 and 70 (the same critic), the label-in-name part of 36 and the overlay part of 6 (the page builder), the "starts" half of 87 and the session-type half of 84 (the packaging and shell builders), the bytes floor in 65 (the tool builder), and the corrections to 38 (sizes from the app's own window), 49 (whole words) and 98 (a hidden-overflow root passed report 12's rule 65 trivially). Report 12's rule 60 asked for a frame capture, which cannot be taken headless; its rule 57 cannot be scripted on the pointer-lock path. Both are recorded in their rules.

Found after round 2's extraction, by experiment in build 2 rather than proposed by a report: 101 and 102 (the media converter D-018, the Windows focus experiment) and 103 (D-019, the Windows memory experiments). They are numbered after 100 so that no earlier number moves.

## Standing references for a critique round

Use these as the critic's material; pin a commit where one is installed.

- `emilkowalski/skills`: motion, component feel, worst-case data, whether to animate.
- `vercel-labs/web-interface-guidelines`: interaction detail rules.
- `yetone/native-feel-skill` with Raycast's technical deep dive: the seams between web UI and native host.
- Linear's Method and quality essays; Superhuman on speed; Dan Luu on input lag; Ink & Switch "Slow Software": what the bar's thresholds rest on.
- mjtsai.com's Electron tag: the adversarial view. Read it before calling a web-shell app finished.
- Apple's Human Interface Guidelines (menu bar, windows, settings), the GNOME HIG and the KDE HIG, for the per-system rules in "System integration and native seams".
