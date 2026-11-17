# Measuring a content app

How two builds measured displayed frames, typing latency, data safety, start-up and memory, what each number does and does not prove, and what could not be measured. The scripts are in the starters. Build 1 (the mail app and its bake-off, 2026-11-14 and 15) measured on Windows only: a 119 Hz 4K primary display at 125% scale, Windows 11, Electron 45. Build 2 (the media converter, 2026-11-15) measured memory on Windows, macOS 27.2 (Apple silicon) and Linux arm64 containers, and typing and the kill test on Windows. Each item says which.

## Before any window opens

These runs open a real window, shown without activation. On the owner's machine run them only when he has said it is free, one at a time, through the starter's `scripts/lib/launch.mjs` (absolute paths, the shell check first, `--no-activate`, a throwaway data folder, a time limit), on the CRT rather than the main display, and stop anything left running by its exact process id. A Chromium window that is fully covered stops rendering, so the numbers are void if another window sits on top. Record the display's rate and scale with every result; the scripts write both.

## What each tool proves

| Claim | Tool | What it proves | What it does not |
| --- | --- | --- | --- |
| The list scroll is displayed at the display's rate | `python measure/run.py` (PresentMon on the GPU process; Windows only) | Frames reached the display: displayed fps, frame-time percentiles, late frames, present mode | Anything outside the one captured phase; anything on macOS or Linux |
| Typing is fast | `pnpm qa:typing` | Real key events through Chromium's input pipeline to the end of the frame that rendered the change, on the page's clock | The compositor and the display, about a frame and a half more. It is a floor, not key-to-photon |
| The palette, a sheet or typing animate smoothly | The in-page frame clock in `measure/workload.js` | The compositor's schedule | Display. Report it apart from PresentMon numbers and never as "displayed" |
| Unsaved work survives a crash | `pnpm qa:kill` | The real shell, killed by exact process id 60, 300 and 600 ms after the last real key, restores the work on relaunch | A power loss or a full disk |
| Memory is inside the budget | `scripts/memory-tree.ps1`, `memory-tree.macos.sh`, `memory-tree.linux.sh` from outside; the installed check's `memory` step | Private memory by the system's definition, summed over the whole process tree, including the tool and its children | Any single process's figure, or resident size |
| What the idle figure is made of, and whether a switch lowers it | `pnpm measure:memory -- --work <folder> --label <name> [-- <switches>]` (Windows) | Private bytes per process with each process's kind, after five idle minutes, the app asked nothing, a foreground sampler running throughout | A figure during a job; macOS and Linux (use the shell evidence with `--idle 300`) |
| The app is idle when idle | CPU seconds over 10 s for the process tree | No busy loop | That zero frames are presented (see the quirks) |
| Start-up time | `python measure/run.py --startup 5` (Windows) | Launch to first frame after load, warm, median of the runs | A cold start after a reboot; the packaged app |

## Memory on each system

Chromium's own "private footprint" has one definition per system (report 10, from Chromium's source), and Electron's API does not give it: `app.getAppMetrics()` reports private bytes on Windows only. So the starter has one script per system, all printing the same JSON shape against the budget and ceiling in `app.config.json`. (Build 2 measured all three.)

| System | Definition | How | Do not use |
| --- | --- | --- | --- |
| Windows | Private bytes (`PrivateMemorySize64`) | `memory-tree.ps1 -ProcessId <pid>`: the process and every descendant from `Win32_Process` | Working set |
| macOS | `phys_footprint` | `memory-tree.macos.sh <pid>`: `/usr/bin/footprint` over the tree, its "Summary Footprint" | Resident size, which is wrong in both directions on macOS (an app read 807 MB footprint against 534 MB summed RSS, another 693 MB against 1,359 MB) |
| Linux | Anonymous resident memory plus swap | `memory-tree.linux.sh <pid>`: `Anonymous` + `Swap` from `/proc/<pid>/smaps_rollup` | `ps` or `top` resident size, which counts shared pages once per process: the same idle window read 118, 141, 274 or 584 MB depending on the column summed |

Traps, each seen in build 2:

- **Read from outside, before the app is asked anything.** Asking the running app changes the figure: a `--diagnostics` request, a page capture, and the first asynchronous file call in the main process all add memory. The first asynchronous file call starts libuv's worker threads, and on Windows each commits an 8 MB stack: 32 MB that stays (285 MB before, 318 MB after). The starter writes its diagnostics with synchronous calls for this reason, and the shell evidence script measures before it asks.
- **Keep the start-up and idle paths free of asynchronous file calls in the main process** (`fs.promises`, callback `fs.*`, streams). The control channel's pipe or socket uses the event loop's own completion port or kqueue/epoll, not libuv's worker threads, so serving it costs nothing at idle; build 2 confirmed the pool was not running at idle by holding it to one thread (`UV_THREADPOOL_SIZE=1`), which changed nothing.
- **Count the tool and everything it starts at peak.** On Windows each run of a console program under the app also has a hidden console host (`conhost.exe`), even with `windowsHide`; it counts.
- **The shell itself grows during a job.** In build 2's ten-minute export the Electron processes alone held 457 MB on Windows after the tool had exited, and the macOS tree peaked at 570 MB. Measure the shell's share during the longest job, not only at idle.
- **Containers say nothing about the GPU process.** A real GPU driver changes the GPU process's share; the containers render in software.
- **An emulated architecture's memory figure means nothing** (x64 under emulation read 365 MB for an app that read 142 MB natively).

## What Windows idle memory is made of

Build 2 (the media converter, 2026-11-15, Windows 11 on a desktop PC with an RTX 4090): the development app with an empty list, five idle minutes, private bytes per process read from outside by `measure/memory-experiment.mjs`, one change at a time.

| Run | Total | Processes | What changed | Kept |
| --- | ---: | ---: | --- | --- |
| Baseline | 306.8 MB | 4 | main 92.8, GPU 110.9, network service 68.1, renderer 35.0 | |
| Network service in the main process (`--enable-features=NetworkServiceInProcess2`) | 237.9 MB | 3 | the network process is gone; main +1.7 MB | yes |
| The same, set in `electron/main.cjs` | 238.0 MB | 3 | main 94.9, GPU 108.1, renderer 35.0 | yes |
| libuv's pool held to one thread (`UV_THREADPOOL_SIZE=1`) | 307.1 MB | 4 | nothing: the pool is not running at idle | no |
| GPU process inside the main process too (`--in-process-gpu`), for information | 233.2 MB | 2 | the GPU work's ~103 MB moves into the main process; 4.8 MB saved | no: a GPU driver fault would end the app, and the GPU work leaves its sandbox |

macOS, the same pair (footprint): 122.4 MB over 4 processes, then 112.2 MB over 3. The network service can go into the main process only because the page makes no network request (`connect-src 'none'`); the starter's shell check holds that condition (premium-bar rule 103). Chromium runs it that way by default on Android for the same memory reason.

**The floor.** The GPU process is about 108 to 114 MB on Windows against 38 to 40 MB on macOS: Windows counts committed memory, and the GPU process commits the Direct3D 11 driver's and ANGLE's heaps whether or not it draws. Chromium 156 draws with Ganesh on Windows (Graphite is on by default only on Apple systems), so the Graphite switches do not apply. Turning hardware acceleration or GPU compositing off would remove most of it and is ruled out: motion must follow the display's rate. What remains on Windows: GPU about 110 MB, main about 95 MB (Chromium's browser side, Node, the shell, now with the network service), the page about 35 MB (Blink and V8's floor for a small page).

**A switch is kept only if** it lowers the idle figure, changes nothing a person notices, and every check still passes.

## PresentMon service quirks

Windows only. Each of these cost a rerun in build 1. `measure/run.py` is laid out around them.

- **Capture the GPU process.** Chromium presents from its GPU process; a capture of the main process sees nothing. Find it by `--type=gpu-process` in the tree.
- **A capture that starts on an idle window records nothing**, whether or not frames are being presented. Start it after motion has begun: the harness starts two seconds into the scroll. For the same reason presents-while-idle cannot be measured this way.
- **One capture per launch.** A capture that follows another capture of the same process comes back empty.
- **After a pause in rendering the service stops seeing the presents.** Capture one continuous phase. The scroll is the displayed-frame evidence; the palette and typing phases have the in-page clock only.
- **WebView2 could not be observed at all.** In the Tauri shell the service attributed 2 presents to the GPU process during a ten-second scroll. A WebView2 host therefore has no displayed-frame evidence by this method.
- **Typing presents at half the display rate in the workload** because the script changes the text every other frame, and the app presents only on change. That is correct behaviour, not a dropped frame.

## Frame rate off Windows

Not measured in either build. Chromium keeps a display link per display on macOS and follows the compositor's frame callbacks on Wayland (report 10, from Chromium's source), so a window should follow the display it is on; that is inferred, not measured. In the Linux containers `requestAnimationFrame` ran at 60 per second under Xvfb, sway and weston with software compositing, whatever the display: that is the software compositor's default and proves nothing about real hardware. Rules 25 and 30 count on macOS and Linux only on real hardware.

## Thresholds

The verdicts use the premium bar's corrected numbers: list scroll passes with at most 1 late frame per 1,000 and a 99th percentile within 5% of the refresh interval (a late frame is one displayed more than 1.5 intervals after the last); typing passes at a 95th percentile of 50 ms or less with no key over 100 ms; the palette opens within 50 ms; a kill 300 ms or more after the last key restores everything and a kill at 60 ms loses at most the last second; memory is at most 300 MB after five minutes idle and never over 680 MB.

## Results, for comparison

| Measure | Build | Result |
| --- | --- | --- |
| List scroll, 10,000 rows, Electron | 1, Windows | 119.9 fps displayed; frame time p50 8.34 ms, p99 8.44 ms, max 8.71 ms; 0 late of 815 |
| Typing, empty document | 1, Windows | p50 2.5 ms, p95 3.7 ms, max 17.7 ms over 220 keys |
| Typing, 20,000 characters | 1, Windows | p50 3.0 ms, p95 4.2 ms, max 19.8 ms; worst browser event timing 24 ms |
| Typing, a value field | 2, Windows (60 Hz display) | p50 2.0 ms, p95 3.1 ms, max 8.8 ms over 220 keys; the window never had focus |
| Palette open | 1, Windows | p50 5.8 ms, max 19.3 ms over 6 opens |
| Palette open | 2, Windows | p50 7 ms, p95 19.5 ms over 6 opens |
| Kill test | 1, Windows | 4 of 4 trials restored every character, including the kill at 62 ms |
| Kill test | 2, Windows | 3 of 3 trials at 300 ms or more restored the value; the 67 ms trial kept the previous value (within the one-second allowance) |
| Start-up, warm, bake-off shell | 1, Windows | median 540 ms (430 to 819) |
| Memory after idle, development shell | 1, Windows | 343 MB after 5 minutes (bake-off) |
| Memory after idle, installed app | 1, Windows | 334.7 MB over 4 processes |
| Memory after 5 minutes idle, development shell | 2 | Windows 313.7 MB over 4 processes (over budget); macOS 134.6 MB; Linux 135.1 MB (X11) and 137.2 MB (sway) over 7 processes |
| The same, network service in the main process | 2 | Windows 247.3 and 248.0 MB over 3 processes (three items loaded); macOS 128.8 MB; Linux 123.6 MB (X11 container) |
| Memory, installed app | 2 | Windows 304.4 MB after 5 minutes (over budget), then 243.2 MB over 3 processes with the network service in the main process (288.7 MB after one export, whose file reads start libuv's pool); macOS 110 MB after 5 minutes; Linux 139 to 152 MB 20 s after launch |
| Memory peak, ten-minute export with the tool and FFmpeg | 2 | Windows 466 MB over 9 processes (a console host included); macOS 569.7 MB over 8; Linux 235.8 to 240.3 MB over 11 |
| Idle CPU, process tree | 1, Windows | 0.02 s per 10 s |

A new app that is far from these on the same machine has a cause worth finding before it ships. Build 2's Windows idle figure is now 55 to 60 MB under the budget; the macOS peak is the closest any build has come to the ceiling.

## Not measured, and why

- **Key-to-photon and click-to-photon.** They need a high-speed camera or PresentMon's click-to-photon column with real input; neither was set up. Typing latency stops at the page's frame.
- **Presents while idle.** The service quirk above. Idle CPU is the substitute.
- **Displayed frames for the palette, sheets and typing**, and **any displayed frame on macOS or Linux.**
- **Window resize, a second display, a cold start, the packaged app's start-up.** Not attempted.
- **Narrator, VoiceOver, Orca and IME.** Not attempted; they are behaviour checks, covered by the shared verification contract's A08 and A09.
- **The headless audit runs in Edge or Chrome, not in the shell.** It checks the page, and Electron's Chromium is a different build of the same engine.
