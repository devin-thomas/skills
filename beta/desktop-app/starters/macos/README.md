# SwiftUI starter

A native macOS app in Swift and SwiftUI, built with SwiftPM and bundled by a script. No Xcode project. The historical starter bundled to about 270 KB; measure the delivered artifact. Qualification follows the [shared verification contract](../../references/verification.md), separately for behavior, accessibility/text, pacing, idle, focus and distribution.

## Layout

```
Package.swift            one executable target, macOS 26+
.swift-format            the pinned formatter config (4 spaces, 120 columns, explicit returns and -> Void kept)
bundle.sh                swift build -c release, then <Name>.app with Info.plist, ad-hoc signed
new-app.sh               copies this starter to <dest>/<Name> and renames it
Sources/Starter/
  StarterApp.swift       @main App: WindowGroup, Settings, the app delegate that owns --bench
  ContentView.swift      NavigationSplitView: searchable 1,000-row sidebar, detail with an animated ring
  FrameClock.swift       FrameClock, FrameClockHostView, FrameClockView: CADisplayLink at the fastest screen's rate
  Pulse.swift            time-based motion the frame clock advances
  Item.swift             sample rows
  Bench.swift            --bench harness and bench.txt report
```

## Make a new app

```bash
./new-app.sh ClipShelf ~/dev      # creates ~/dev/ClipShelf, bundle id com.example.clipshelf
cd ~/dev/ClipShelf && ./bundle.sh  # prints the .app path
swift format lint -r Sources Package.swift  # must print nothing
```

Names are PascalCase. `new-app.sh` replaces every `Starter` with the name.

## Frame clock

`FrameClockView(isRunning:tick:)` goes in a view's `.background`. While `isRunning` is true it receives display-link callbacks with a preferred rate equal to the highest `maximumFramesPerSecond` of connected screens. It re-reads the rate when screens change. macOS caps a link at the window's own screen; maximum capability is not a guarantee of actual cadence. When `isRunning` is false the link is invalidated; this stops this clock's work, not all possible system/SwiftUI rendering. Advance motion by elapsed time (`Pulse.advance(to:)`), never by frame count. Keep the fastest-connected requirement separate from a slower-screen baseline; the latter cannot pass the former.

Choose paused visual time or elapsed-time catch-up on resume. Verify detach/attach, close/reopen, minimize and sleep/wake, with links/observers returning to baseline. Give nonessential decoration a Reduce Motion policy and stop needless hidden work; synthetic benchmark motion is separate.

## Bench

```bash
open -g -n ClipShelf.app --args --bench
```

The app opens in the background, turns animation on and advances selection. After 120 warm-up and 600 measured callback intervals, timed with `CACurrentMediaTime()`, it writes `bench.txt` beside the bundle and quits. The report contains callback fps, 1%-low, worst interval, hitches (over 1.5x median), memory, bundle size and frontmost app at finish. Callback cadence does not establish completed display presentations or input latency; finish-only foreground identity does not establish focus protection through the run. Use the shared contract's separate evidence and verdicts.

Replace `ContentView.step(at:)` with the app's real workload. The current starter assumes a nonempty array of contiguous integer IDs; guard empty input and select actual IDs before substituting data. Define filtering/selection/no-results behavior. Query/sort latency and repeated view work need separate measurements from selection/scrolling.

The starter shares one `Bench` across window content and reports the first app window's screen. Use exactly one registered measured window/clock or independent per-window reports before running multiple windows; an arbitrary first window cannot identify the measured stream. Use a writable staging parent for existing reports, verify fresh output and preserve write errors from stderr; a delivered app should use explicit writable output or per-user state with an actionable failure verdict.

The macOS 26 target and ad-hoc signature are development defaults. Choose actual OS/CPU and local/direct-download/store scope; align bundle/package targets and verify channel-specific identity, version/build, icon, trust and install behavior. Retain the `.app` and evidence outside `.build` before cleanup. Public distribution, updater and back-deployment are separate product needs. macOS CI runs on self-hosted Macs only.

## Launching

Agents launch with `open -g`, including the bench. Keep test code free of activation/front-order calls on the owner's active session. Quit with `osascript -e 'quit app "ClipShelf"'`. Observe app/window activation through shutdown; a background launch request plus an end snapshot does not prove the whole interval. Keyboard, dialogs, composition and VoiceOver checks use a dedicated authorized interactive session: launch with `open -g`, then select the window through that session's input tooling. Background-display authorization alone does not authorize this interaction.
