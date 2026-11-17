# fastwin template

Small native Windows apps in Rust: raw Win32, D3D11 flip model, Direct2D and DirectWrite. Historical sample exe sizes were 190–250 KB; measure the delivered app. Qualification follows the [shared verification contract](../references/verification.md); API and drawing support alone do not qualify controls, editing, focus or presentation.

## Layout

```
Cargo.toml            workspace + the release profile (opt-level z, lto, codegen-units 1, panic abort, strip)
fastwin/              the library
  src/host.rs         App trait, Config, Ctx, Event, window proc, paced render loop
  src/gpu.rs          D3D11 device, FLIP_DISCARD swap chain, D2D context, resize/DPI, device-lost
  src/canvas.rs       Canvas drawing API, Color, Theme, Rect
  src/text.rs         Font, Align, DirectWrite format + layout cache
  src/list.rs         List: virtualized rows, selection, hover, keyboard nav, scrollbar
  src/anim.rs         Smooth (exponential, time-based), Tween, snap, pingpong
  src/display.rs      Display::Crt / Display::FourK selection, no-focus mode, app_args()
  src/file.rs         read_text, write_atomic, exe_dir, utc_iso, local_hms
  src/bench.rs        --bench harness
examples/hello/       smallest app: a 1,000-row list and a click counter (~60 lines); also the new-app starter
examples/triage/      skill-triage ported onto fastwin (reads skills.tsv / decisions.json)
new-app.ps1           scaffolds a standalone app crate
macos/                the SwiftUI starter for Mac apps (see macos/README.md); not part of the Cargo workspace
```

## The App trait

```rust
pub trait App: 'static {
    fn init(&mut self, cx: &mut Ctx) {}                      // window + GPU exist
    fn event(&mut self, e: &Event, cx: &mut Ctx);            // call cx.redraw() if anything visible changed
    fn update(&mut self, dt: f32) -> bool { false }          // advance animations; true = still animating
    fn draw(&mut self, c: &mut Canvas);                      // draw the whole frame, in DIPs
    fn bench_step(&mut self, frame: usize, cx: &mut Ctx) {}  // --bench: drive synthetic input
    fn close(&mut self, cx: &mut Ctx) -> bool { true }       // false keeps the window open
}
fastwin::run(Config { title: "my-tool".into(), size: (720.0, 560.0), ..Default::default() }, MyApp::new());
```

`Event` covers MouseMove/Down/Up, Wheel (in notches), MouseLeave, Key/KeyUp (virtual-key codes in `fastwin::key`), Char, Focus and Resize. Every coordinate is in DIPs. `Canvas` has `clear`, `fill`, `round`, `stroke_round`, `line`, `hline` (one device pixel), `text` (cached layout), `text_once`, `measure`, `clip`/`unclip`, `theme()` and `stats()` (fps).

## Make a new app

```powershell
.\new-app.ps1 -Name my-tool                       # creates .\my-tool (standalone crate, path dep on fastwin)
.\new-app.ps1 -Name my-tool -Dest C:\src -FrameworkPath C:\somewhere\fastwin
cd my-tool; cargo build --release
```

`new-app.ps1` creates a mutable path dependency. For rebuildable retained source, vendor the exact fastwin snapshot or use a pinned Git revision, retain `Cargo.lock`, record provenance and rebuild after moving away from the original checkout. A compiled exe does not need that source at runtime.

## Capability limits before reusing examples

Custom widgets currently have no implemented UI Automation provider; glyph drawing and committed `Char` events are not a general editor. For semantic controls/fields, use a narrow standard-control/editor bridge or maintain the required providers and input behavior, then qualify with UIA/Narrator, keyboard, composition, selection and clipboard tasks. Read the [Windows capability boundaries](../references/windows.md#capability-and-reliability-boundaries) before reuse.

Triage's current close path permits closing after a requested save fails. Reusing persistence requires propagating save success, retaining dirty edits/window/error on failure, and testing Cancel, explicit Discard and reopen. Its name filtering and reverse choice cycling are triage-specific examples, not general search or undo contracts. GPU error propagation and global-host early-exit cleanup also need inspection and targeted fault checks before claiming recovery. These source conditions are not runtime incidents reproduced by the roast-room review.

## Launching: agents must use --no-focus or --bench

Test windows must never take the owner's focus. On the owner's active session, agents launch with `--no-focus` (or `--bench`). Setting `FASTWIN_NO_FOCUS=1` does the same. In this mode:

- The window opens on the **CRT** by default. Use `--display crt|4k` (or `FASTWIN_DISPLAY`) to pick a display. Displays are chosen by physical resolution: the CRT is a 4:3 display at most 1600 px wide, and the 4K is at least 3840 px wide. If the one you ask for isn't connected, the window goes on the other, still without focus. `fastwin.log` next to the exe records which display was used.
- The window is created with `WS_EX_NOACTIVATE`, shown with `SW_SHOWNOACTIVATE`, and answers `WM_MOUSEACTIVATE` with `MA_NOACTIVATE`. It never calls SetForegroundWindow, SetActiveWindow, SetFocus or BringWindowToTop, and it is never topmost. A no-focus window gets no keyboard input.
- `Ctx::ask` shows no dialog and answers No; `Ctx::alert` writes to `fastwin.log`.
- To close the window, post `WM_CLOSE` to it.

A normal launch without these flags uses the system's default placement and behaves like any other app. Agent input-capable checks use this mode only in a dedicated authorized interactive session, clearing `FASTWIN_NO_FOCUS` for that process. Background-display authorization does not authorize normal launches on the owner's session.

## Bench

`app.exe --bench` runs 120 warm-up iterations then 600 measured iterations, calling `bench_step` before each one. `bench.txt` contains loop-interval fps, 1% low, worst interval, hitches (over 1.5x median), memory and exe size. The field labeled `render cpu ms` is elapsed wall time around workload/update/draw/`Present`, including waits, not measured thread CPU. The `focus: never taken` line is a static label; display metadata records placement and is not an independent current-output trace. The bench always runs in no-focus mode.

Average within 1% of screen rate and 0 hitches is a diagnostic screen-baseline check. The shared contract separately evaluates the fastest-connected target, displayed presentation, idle and observed focus. Loop cadence proves none of those alone. Independent presentation evidence is needed for a displayed-frame claim; no-focus runs cannot qualify keyboard/dialog/IME behavior.

Current reports/logs go beside the exe, and benchmark write failure is ignored. Use a writable staging parent for existing runs, verify a fresh file and archive it with a run identity; a delivered app should use explicit writable output or per-user state and surface failures. Never reuse a stale report as a pass. Retain the exe, required runtime data and reports outside `target` before cleanup, with a separate local/portable versus public-release verdict.

## Design rules that make it fast

- **Flip model, Present(1, 0).** FLIP_DISCARD, 2 buffers, no tearing flag, max frame latency 1. The loop waits on the frame-latency waitable or on input, whichever comes first. This is the fixed-vsync path; VRR/G-Sync operation needs capability, configuration and observed-operation evidence before being claimed.
- **Mixed refresh rates.** If the window's display is slower than the fastest one connected (the 60 Hz CRT next to the 119 Hz 4K), the loop paces by that display's vblank alone. The latency waitable runs at the faster compose rate: on its own it over-produces frames the CRT never shows, and combined with the vblank wait it drifts against it, so whole seconds of frames get skipped.
- **Custom drawing.** Canvas rendering uses Direct2D and DirectWrite on the swap chain's back buffer. A narrow native control/editor bridge may supply required interaction and accessibility semantics.
- **Present only on change.** When nothing is dirty and nothing is animating, the thread blocks in `MsgWaitForMultipleObjectsEx` and presents nothing.
- **Time-based motion.** `Smooth` and `Tween` take elapsed seconds, so motion runs at the same speed at any refresh rate.
- **Pixel snapping.** Canvas rounds rect edges and text origins to whole device pixels, so scrolling stays crisp.
- **Virtualize lists.** `List::rows()` yields only visible rows. Layouts are cached and age out. Measure query/filter/sort separately; visible-row drawing does not bound search work. Keep full-frame redraw until profiling and buffer-preservation semantics justify a change.
- **Trim when idle.** After 4 s idle, `SetProcessWorkingSetSize(-1, -1)` requests a working-set trim. Its memory, energy and first-response tradeoff is unmeasured; compare residency, private commit, faults and resume latency before changing it or claiming a benefit.
- **Per-monitor DPI v2.** Apps work in DIPs. D2D is set to the window's DPI, and WM_DPICHANGED is handled.
- **Device-lost path.** The host attempts GPU rebuild after recognized device-loss results. Other resize/target/presentation failures and early-exit cleanup need bounded failure propagation and isolated fault qualification before claiming general graphics recovery.

CRT/4K resolution heuristics come from the development machine's display layout (a 4:3 CRT beside a 4K panel). Keep them as a default where that layout exists; record actual output identity, DPI, orientation and rate on generic topologies instead of treating these aliases as universal monitor identities.
