# Verify the app being delivered

Use this contract for either platform; it also governs standalone template README claims. Build, behavior, accessibility/text, pacing, idle, focus and release are separate checks. Select applicable cases from the acceptance table below before running. Keep raw evidence for the final artifact; historical numbers, inspected source and proposed tests do not qualify a changed app's runtime.

## Before launching

Reuse existing authorization for the target machine and displays. Follow the platform's background-launch rule on the owner's active session; input-capable qualification uses its separate dedicated-session procedure. When a required owner decision is missing, use the skill's owner-question workflow and continue independent work while it is pending.

Record a run ID, source revision or candidate diff, dependency pins, toolchain, artifact path/digest, OS/CPU/GPU, workload, screen identities/scales/rates, chosen screen and fastest rate. Declare sample count, budgets and instrument uncertainty before running. Put reports in an explicit writable location or per-user state directory; existing templates may need a local writable staging parent. Verify a fresh file and successful write, preserving an old `bench.txt` separately. A stale file or silently ignored write error cannot pass a run.

For protected launches, record foreground app/window identity through shutdown with an OS observer. On Windows, foreground event hooks or timestamped `GetForegroundWindow` samples can track transitions; include hover activation and log sampling gaps. On macOS, record `NSWorkspace` activation notifications and active-app identity; use window/focus observations when the claim covers those too. Keep observer coverage, timestamps and overhead. Start/end snapshots or a static report label leave the interval unverified; app identity alone does not establish control focus.

Keep background-launch observation separate from keyboard, dialogs, IME and screen-reader tasks in a dedicated authorized interactive session. Windows no-focus mode suppresses keyboard and makes `Ctx::ask` answer No. Those results cannot qualify interactive dialog behavior or persistence. Use disposable data for destructive/fault cases and call-level injection rather than a workstation-wide GPU reset.

## Behavior and idle

Exercise the main action with representative data, plus empty, one-item, sparse-ID, no-results, cancel, error and large-input cases as applicable. Define search fields and preserve/clear selection behavior when filtering hides the selected row. Cancellation leaves data intact. If undo is promised, restore the exact previous value by stable ID after sort/filter, rather than reverse cycling.

For persistence, inject denied-write or rename failure on disposable data, close and choose Save: failure must retain dirty work, window and actionable error. Cancel keeps work; explicit Discard is distinct; successful save survives reopening. Add meaningful regression tests for these state/error transitions when modifying them.

Qualify semantic controls with names, roles, states/actions and focus/selection announcements using the platform tree plus Narrator or VoiceOver and keyboard tasks. Include virtualized items, visible focus, contrast/large text and relevant locale input. Rendering text does not prove caret/selection/composition behavior. Test typing Space while a field is focused if the app has a Space command.

Stop motion and input; a useful default is a 5-second settle then 60 seconds observed idle. Record callbacks/presents and process CPU against a matched blank-window baseline, with a predeclared budget. Measure energy only when claimed; CPU, resident working set, private commit and power are different metrics. Distinguish app work from OS maintenance. Check hidden/minimized/resumed state and Reduce Motion separately from synthetic benchmark motion. An animation benchmark cannot qualify idle behavior; missing instrumentation leaves the relevant claim unverified.

## Pacing

Run each distinct applicable case once on the final build: fastest screen, slower screen when connected, cold launch, and a screen/rate change during motion when pacing changed. Cases can share a run. Mark unavailable cases unverified. Repeat only after a relevant fix or to resolve a named measurement problem; retain failed evidence and reason. The fastest-connected target remains the current policy; an output-local recommendation from the roast room does not silently change it. Keep requested simulation cadence, actual negotiated output cadence and maximum panel capability distinct, especially with adaptive refresh.

For every case record:

- Requested fastest rate, window-screen rate and actual measured rate, tagged as callback, loop, submit or displayed presentation. Use independent presentation evidence such as PresentMon/ETW on Windows or Instruments/display evidence on macOS when making a displayed-frame claim; document tool version, clock, limitations and overhead. API return time does not establish input-to-photon latency.
- Average and 1%-low fps, p50/p95/p99 intervals, hitch count/definition, sample count, size and peak memory from the fresh report or raw trace. Windows `render cpu ms` currently times elapsed workload/update/draw/`Present`, not thread CPU. Label it elapsed submit-path time; retain the p99 headroom ceiling of half the frame budget `1000 / target Hz` in milliseconds or the project's tighter ceiling. Measure actual CPU separately when claiming CPU consumption.
- A **screen-baseline verdict**: average within 1% of that screen's rate and zero hitches in the measured sample. Preserve the template's hitch definition in the report.
- A separate **fastest-rate verdict** against the same 1%/zero-hitch thresholds and the fastest connected rate, including when the window is on the slower screen. A documented platform cap makes that case unmet; it never lowers the target. If the timing method cannot establish a requested presentation-rate claim, that claim remains unverified.

A failed measurement starts a bounded diagnosis of that case. Fix the cause and rerun affected cases; preserve thresholds and workload. Report an architectural or platform limit explicitly and continue independent work. Do not expand a small app task into a framework rewrite without task scope supporting it.

## Capability acceptance cases

Use only cases relevant to the product or changed framework contract; record omitted cases and scope. For a framework/capability expansion, use equivalent tiny-picker, searchable-list and file-dialog fixtures across promised platforms, preserving native conventions. Generic repository tests do not qualify these runtime tasks. macOS CI uses self-hosted Macs only; hosted Linux/Windows are allowed.

| Case | Procedure and required evidence |
| --- | --- |
| A01 Scaffold/build | Clean source, quoted paths containing spaces, dependency lock/pin, release log and artifact digest. Retained source rebuilds after moving it away from the scratch dependency; artifact survives cleanup. |
| A02 Protected launch | Background flags, observer before/during/after, hover/dialog/window cases as applicable; no app-caused owner activation in the covered interval. |
| A03 Input | Isolated keyboard-only and pointer tasks agree; selection/shortcuts and Save/Discard/Cancel behave correctly; field typing cannot trigger unrelated commands. |
| A04 Pacing | Separate requested/callback/submit/presentation and event-response metrics; fixed-rate cases at available rates, declared thresholds and raw intervals. Compare elapsed-time motion distance across rates. VRR needs configuration/capability plus observed operation. |
| A05 Displays | Move, unplug/replug, rate/DPI/orientation changes on promised topologies; log current output and correct hit geometry, no crash. Declare an adaptation deadline (2 seconds after stable change is a useful fixture gate). |
| A06 Idle/resume | Settled interval with callbacks/presents, CPU baseline and budget; minimize/hide and resume. No unnecessary continuous redraw; pause/catch-up policy explicit. For trim changes, compare on/off after 3/5/30 seconds using memory, faults and first-response tails. |
| A07 Scale/search | Seeded 1/1k/100k rows where representative; query/change/clear/sort while scrolling. Track row IDs, visible-row paint/filter/cache counts, latency p50/p95/p99 and memory against declared budgets. Optimize only the demonstrated bottleneck. |
| A08 Accessibility | Semantic tree and screen-reader/keyboard task transcript; names/roles/states/actions, focus/selection, virtualized rows, contrast/large text and Reduce Motion before/during use. |
| A09 Text/locale | Composition commit/cancel, dead keys, emoji/combining sequences, mixed RTL, caret/selection/replacement/clipboard and OSK where promised; candidate geometry follows DPI. |
| A10 Lifecycle/faults | Close/reopen, detach/attach, sleep/wake/minimize; repeat (20 cycles is a useful fixture). Counts return to baseline; one measured window per stream. Inject initialization/resize/target/present failures: bounded recovery or actionable termination, safe teardown. |
| A11 Files/output | Unprivileged run from protected install parent; explicit writable output and denied data/log access. Fresh report or visible non-success; failed Save/Cancel preserves edits. |
| A12 Delivery | Chosen local/portable, direct-download or store channel; OS/CPU scope, identity/version/build/icon, channel-specific trust/install/uninstall and required runtime data checked on a clean supported user/host. Test updates only if promised. |
| A13 Settings/topology | Supported scale/large-text, appearance, rotated/generic displays and assistive input; no clipping, wrong hit targets or lost focus. Name unsupported combinations. |
| A14 Task outcomes | Picker, searchable list and file-dialog outcomes relevant to this app, including empty/loading/error/cancel/persistence; use native conventions rather than identical pixels. |

Record each applicable case with run ID, artifact/source identity, environment, workload, observer/instrument, budget, raw evidence, verdict and next action. `Not-run` and inconclusive cases map to **unverified**; a source control-flow observation may be verified as source only. Add deterministic state/error tests where they catch a consequential regression. Keep unchanged low-impact UI edits proportional to their risk.

## Handoff and cleanup

Retain the final `.app` or exe and required data outside disposable build directories. Copy reports, observer evidence and captures to the project's evidence location before cleanup. Recheck that the artifact and its required runtime files still exist afterwards.

The handoff names the artifact, source/template revision, dependency pins, tested behavior, workload, toolchain, supported OS/CPU and selected distribution channel; links evidence and gives separate behavior, accessibility/text, pacing, idle, focus and release verdicts. Use **verified**, **unmet** or **unverified** with reason and next action for each gap. Explicitly out-of-scope capabilities are not passes. Claim full qualification only when every applicable requirement is verified. A review build may have explicit gaps; ad-hoc development signing does not establish public distribution readiness. Apply trust/signing and clean-host checks only for the chosen channel; avoid adding an updater, onboarding or broader OS support without a product need.
