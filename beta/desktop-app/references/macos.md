# macOS: Swift + SwiftUI

Every Mac app is Swift and SwiftUI, with AppKit only behind narrow `NSViewRepresentable` bridges for what SwiftUI can't do. No Catalyst, no web views, no cross-platform toolkit. The aim is an app that looks and feels like it shipped with the current macOS.

## Steps

The template lives in this skill's `starters/macos`. Its [README](../starters/macos/README.md) is the reference for its files, the frame clock, the bench and launching. Read it before writing code.

1. **Get the template for a new app.** Copy `starters/macos` from this skill to a scratch folder, or take it from a fresh checkout of the repository that holds this skill, and record the revision. Done when `Package.swift`, `.swift-format`, `bundle.sh` and `new-app.sh` exist in the copy. For an existing app, inspect and build its current project instead; preserve its deployment target and build system.
2. **Establish the baseline.** For a new app, run `new-app.sh <Name> <project folder>` with a PascalCase name and a quoted destination, following workspace folder rules. Done when the generated app has `.swift-format` and `./bundle.sh` succeeds on the untouched starter. For an existing app, record its baseline build result before edits.
3. **Build one working action**, then expand to the requested behavior and native look below. Keep the frame clock for continuous animation and apply the lifecycle/data rules below. In starter-based apps, replace the sample data and point `ContentView.step(at:)` at the app's real hot path; existing apps use an equivalent workload hook. Done when the representative workload exercises the requested action, the release build succeeds, `swift format lint -r Sources Package.swift` prints nothing for the starter-based project, and the language-guide review has no findings. Existing projects keep their configured formatter.
4. **Verify.** Follow [verification](verification.md). Run `open -g -n "<Name>.app" --args --bench`, retain its fresh `bench.txt`, then inspect the actual UI with `open -g`, capture it with `screencapture -l <windowID>`, and quit with `osascript -e 'quit app "<Name>"'`. Done when behavior, pacing, idle and focus each have evidence and a verdict; a build or screenshot alone cannot pass this step.
5. **Deliver, then tidy.** Copy the final `.app` and verification evidence to retained locations before removing `.build`, the template clone and scratch bundles. Done when the handed-over `.app` still exists and its path, tested workload, results and remaining limits are recorded.

## Look

Build from system parts so the app inherits the current macOS design, including Liquid Glass, for free:

- **Scenes and chrome.** `WindowGroup` or `Window` for the main window, `Settings` for preferences, `MenuBarExtra` for menu-bar tools. Put actions in `.toolbar`, `.commands` and context menus with keyboard shortcuts. Use `NavigationSplitView` for sidebar and detail.
- **Controls.** Native `Button`, `Toggle`, `Picker`, `TextField`, `List`, `Table`, `Form` with `.formStyle(.grouped)`, `.searchable`. Use system button styles (`.borderedProminent`, `.glass` where the release has it) rather than hand-drawn ones.
- **Type, color, icons.** System fonts by text style (`.title`, `.headline`, `.body`), semantic colors (`.primary`, `.secondary`, `.tint`) and SF Symbols with symbol effects. Respect light and dark mode, the accent color and Reduce Motion.
- **Surfaces.** Materials and the system's glass for sidebars, toolbars and floating panels; `.containerBackground` for window backgrounds. Default spacing and padding unless a layout needs its own.
- **Motion.** Spring animations (`.smooth`, `.snappy`, `.bouncy`) and `matchedGeometryEffect` for state changes. Every continuous animation runs on the frame clock.

## Frame clock: the fastest display wins

The current template's `FrameClockView` requests the highest connected rate from a window-bound `CADisplayLink`, re-reading it when screens change. The template documents a cap at the window's own screen: on a slower screen it does not meet the fastest-display requirement. Bench on the fastest screen for the target-rate case and retain the slower-screen case as unmet when capped. The link runs while motion is active. Advance motion by elapsed time so its speed is independent of frame rate.

`Bench.swift` measures callback intervals, not completed display presentations, and records only the frontmost app at finish. Neither field proves continuous focus protection or rendered-frame throughput; use the shared verification contract for claims. Prior starter numbers are historical examples in this template's history, not evidence for the app being delivered.

## State, clocks and benchmark ownership

- The starter shares one `Bench` across `WindowGroup` content and reports `windows.first` as its screen. Bind a run to one registered window/clock and that window's screen, or emit independent per-window records before measuring multiple windows. A second window must not silently feed the same sample stream. Normal apps may still support multiple windows.
- `step(at:)` currently takes modulo `items.count` and treats selection as a contiguous integer. Guard empty input and advance through actual IDs. Exercise empty, one-item and sparse IDs such as `[10, 20, 30]`; filtering out the selected row needs a deliberate preserve/clear policy and a visible no-results recovery path.
- Clock teardown and animation time are separate contracts. Choose paused visual time or elapsed-time catch-up for the app; test attach/detach, close/reopen, minimize and sleep/wake against that choice. Links and observers must return to baseline. Stop nonessential hidden decoration, honor Reduce Motion before and during use, and keep synthetic benchmark motion a separate mode.
- A scrolling bench does not measure filtering or repeated SwiftUI body work. Measure query changes, clear, sort and selection at representative sizes before adding caches or asynchronous search. Verify the Space shortcut while editing text so typing cannot trigger an unrelated animation action.

## Development and distribution

The starter's macOS 26 deployment target and ad-hoc bundle are development defaults. Preserve an existing project's support policy; choose OS/CPU support and local, direct-download or store delivery from the actual audience. For a release, align package and bundle targets and verify identity, version/build, icon and the channel's signing/trust/install requirements. Latest-OS/local-only is a valid deliberate scope; an updater or back-deployment is not automatic. Use the shared release acceptance case before claiming distribution readiness.

## Launch rule

Agent launches use `open -g`, including the bench. On the owner's active session, a bench/test window never calls `NSApp.activate`, orders itself front or takes key focus. In a dedicated authorized interactive session, launch with `open -g`, then select the test window through that session's input tooling for keyboard/dialog/VoiceOver checks. Keep protected-launch and interactive observations separate. Quit with `osascript -e 'quit app "<App>"'`.
