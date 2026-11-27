---
name: desktop-app
description: "Build or improve a desktop app: SwiftUI for a Mac-only app; the fastwin Rust template for a small native Windows utility; or, for a content app with forms, text editing, long lists or sign-in, a web UI in an Electron shell over a bundled command-line tool or core, from one codebase on Windows, macOS and Linux. Use for any desktop app that must be fast, polished and measured."
---

# Desktop app

Build one app for its target systems. Before scaffolding or editing, identify its main user action, destination or existing project, representative workload, and required capabilities: editable text, semantic controls, persistence, windows and distribution channel. Reuse the owner's answers and project; ask only for a missing decision that changes the work. Done when the behavior and capability boundaries to verify are explicit.

Desktop apps are dark by default, on every branch: a fresh install or a fresh data folder starts dark whatever the system theme is, and light is only a choice the person made and the app saved. Test it with a fresh profile on a system set to light.

Use the requested target systems; for an existing app, preserve its platforms. Otherwise default to the machine the owner is asking from. Activate that branch and load its reference and the matching guide from the `style` skill before writing app code.

| The app | Stack | Reference | Starter | `style` guide |
| --- | --- | --- | --- | --- |
| macOS only | Swift + SwiftUI, always | [references/macos.md](references/macos.md) | [starters/macos](starters/macos/README.md) | `swift-swiftui` |
| Windows utility | Rust on fastwin (Win32, D3D11, Direct2D) | [references/windows.md](references/windows.md) | [starters](starters/README.md) | `rust` |
| Content app on Windows, macOS and Linux, or any one of them | React page in an Electron shell, logic in a bundled command-line tool or core | [references/content-app.md](references/content-app.md) | [starters/web-three-systems](starters/web-three-systems/README.md) | `react-typescript` |

The Windows-only [`windows-web`](starters/windows-web/README.md) starter is kept as round 1 extracted it.

## Choosing the branch

| The app | Branch |
| --- | --- |
| Has forms, text editing, long lists, sign-in or rich content (a composer, a library browser, a dashboard, a converter with a queue), on any system | content app |
| Must run on more than one system from one codebase | content app |
| Is a picker, launcher, tray tool or viewer on Windows that must appear instantly and stay small, or is mostly a custom renderer | Windows utility |
| Runs on the Mac only | macOS (SwiftUI) |

The content-app branch is proven in 2 builds: the mail app (Windows, 2026-11-15) and the media converter (Windows, macOS and Linux from one codebase, 2026-11-15). Its reference says how many builds each part rests on, carries the counter-evidence and lists what was not verified. Start a content app from the three-system starter, `starters/web-three-systems`; `windows-web` stays as round 1 extracted it. The Windows utility branch is unchanged by that work: whether fastwin or Slint is the right utility stack was researched and not built or measured. An app that fits no row is an owner question.

A content app also loads [the premium bar](references/premium-bar.md) (112 testable rules for design, motion, language, feel, each system's seams, crash recovery, window restoration, the security boundary, fuses, screenshot baselines and the app icon, checked against Apple's guidance on 2026-11-22, each marked with the builds it is proven in), [the tool contract](references/tool-contract.md), [packaging](references/packaging.md) and [measurement](references/measurement.md). Apply the premium bar's rules to an app on any branch when the request is about look and feel; its scripts exist only in the content-app starters.

A content app also needs guidance this skill does not hold: which control to use and how it behaves, keyboard and form conventions, local data and sync, and release (installers, updates, signing, diagnostics, privacy). Use the host's skills on those topics; where they disagree with this skill on a desktop seam, this skill wins.

## Existing apps and shared code

For changes to an existing app, preserve its code and data; use a starter to fill a missing capability rather than scaffold over it.

A Mac-only app and a Windows utility keep native frontends. Share non-UI parsing, validation or persistence only when real consumers demonstrate useful duplication. A content app shares everything but one platform module (`electron/platform.ts`), and its Mac build is the same Electron app even when a separate SwiftUI version exists.

Linux is built and tested only as a content app. Its evidence is containers on a Mac (X11 with openbox, headless sway and weston, Debian 12 and Ubuntu 24.04 and 26.04, arm64), never WSL: the app runs as a native Wayland client, keeps the Chromium sandbox on, ships as a `.deb` and a portable tarball, and lays its title bar out around whatever button layout the desktop asks for. A real GNOME or KDE session, fractional scaling, portals, IME and the Ubuntu user-namespace restriction have not been tested; say so in every Linux verdict.

## Owner questions

Ask the owner only for a decision that changes the work and that their record does not already answer (a worker's list of questions included). Use the project's notification route when it defines one; otherwise use the host's question mechanism. Include the project, the smallest required decision, useful choices and how to reply. Continue independent authorized work while awaiting the answer; delivery and silence are not approval. If sending fails, report the failure visibly.

## Rules for every branch

- **Memory ceiling.** No program passes about 680 MB of private memory summed over its process tree, under load as well as idle, counting every process it starts. A content app has a budget of about 300 MB after idle and is its own program, not a window in a shared host. Measure it on each system by that system's definition; a build over the ceiling is not delivered.
- **Dark by default.** The first run is dark on every system. The content-app starter decides it in one place (`electron/theme.ts`) and a test fails when a fresh profile renders anything else; the fastwin template draws a dark theme, and the SwiftUI starter forces the dark appearance. Never follow the system theme for the first run.
- **Premium is the owner's verdict.** Report "passes the automated bar" and what was not verified. The word premium waits for the owner's own use of the app.
- **Style.** Follow the loaded language guide, then review the changed app against it and fix every finding. Formatter success alone is not a style review.
- **Capabilities before reuse.** Native drawing alone proves neither accessible controls nor a text editor. Check the platform's capability limits before copying an exemplar; use a narrow native bridge or a maintained provider where the task needs it.
- **Protect edits.** Closing after Save depends on actual save success. Failure keeps dirty work available with an actionable error; Cancel and explicit Discard remain distinct. Verify denied-write and reopen outcomes before treating persistence as complete.
- **Fastest refresh rate wins.** Motion targets the fastest connected display's rate, whichever screen holds the window. Read it at launch and when displays change. The platform references describe current template limits; those limits do not lower the requirement.
- **Present only on change.** Frame work stops when visible changes and motion stop. Verify idle behavior separately from the animation benchmark.
- **Never take the owner's focus.** Launch in background mode on the owner's active session (`--no-focus` or `--bench` on fastwin, `--no-activate` on a content app). Normal input-capable launches are permitted only in a dedicated authorized interactive session; use the platform procedure. Reuse display authorization; an unresolved decision follows the owner-question rule above.
- **Agent launch rules.** Agent launches took the owner's focus three times in one build (a relative path that started the wrong program, a syntax error that raised a modal error box, a second launch from an Explorer-started process that brought the window forward). So every launch an agent makes: starts the app by absolute paths through a project script (the content-app starter's `scripts/lib/launch.ts`), never by hand; passes a syntax and focus check first (`pnpm shell:check`); runs under the no-focus flag, with which a startup error goes to stderr instead of a dialog; carries a time limit, a throwaway data folder and a quit, and ends only the process it started, by exact id. Then:
  - **Never a second instance as a control channel**, on any machine. Talk to a running app only through the channel it serves when a script started it (a named pipe on Windows, a Unix socket elsewhere; the starter's `electron/control.ts`). On Windows a second instance hands the running app the right to take the foreground before any of its code runs (Chromium's process singleton), and the app cannot refuse it. Every check that asks the app anything confirms its count of second launches is 0.
  - **Never a visible console for a script on Windows.** Where Windows Terminal is the default terminal it ignores a shortcut's Minimized setting and `-WindowStyle Hidden`; the console flashes, and when it closes Windows gives the foreground to whatever app is entitled to it. Scripts that Explorer runs start under `conhost.exe --headless` (the starter's `scripts/run-as-user.ps1`).
  - **No claim about focus on Windows without a foreground sampler and an Explorer-started launch.** Run the sampler (`measure/foreground-sampler.ps1`) from before the first step to after the last of any installed-app check, and stop if the app ever owns the foreground. Launches from an agent's own session hold no right to the foreground, so they cannot show the problem: build 2's development runs never did, while its installed check took the owner's focus twice. Before saying a change keeps focus, run `measure/focus-experiment.ts` with the app started and asked through Explorer, when the owner has said the machine is free.

  A waiting shell left by a subagent can outlive it by hours: end what you started before you report.

Before launching, read [verification](references/verification.md), shared by every branch. Select its applicable acceptance cases for the actual capabilities; missing evidence stays unverified. Finish with a retained artifact and separate behavior, accessibility/text, pacing, idle, focus and chosen distribution-channel verdicts, per system for a content app. A source review establishes source conditions, not runtime success.
