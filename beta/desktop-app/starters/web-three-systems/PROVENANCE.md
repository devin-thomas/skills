# Provenance of the three-system content-app branch

What this starter and the skill's round 2 changes were extracted from, how each item was sorted, and what a later run should merge. It covers this folder and the skill's `content-app.md` (renamed from `windows-content.md`), `tool-contract.md`, `packaging.md`, `premium-bar.md` and `measurement.md`. Round 1's record is `../windows-web/PROVENANCE.md`, unchanged.

## History

| Date | Build | What changed |
| --- | --- | --- |
| 2026-10-29 to 30 | fastwin and the macOS starter, reviewed by a design critique panel | The skill's Windows branch was fastwin only; acceptance cases A01 to A14 had nothing on visual design, typography, chrome or motion. |
| 2026-11-15 | The mail app (build 1 of this class) | Added the Windows content-app branch, the 56-rule premium bar, the measurement reference and the `windows-web` starter. Every item proven in 1 build |
| 2026-11-15 | The media converter (build 2) | The content-app branch now covers Windows, macOS and Linux from one codebase over a bundled tool. Added this starter, the tool-contract and packaging references, rules 57 to 100, per-system memory definitions and the agent launch rules; renamed `windows-content.md` to `content-app.md`, kept the `windows-content` stage as an alias. Items seen again were raised to proven in 2; rules no build had checked were set to 0 |
| 2026-11-15, evening | The media converter's fixes after the snapshot | The control channel (`electron/control.cjs`, both clients, command launches forwarded without the single-instance lock, the second-launch count), the windowless runner (`conhost.exe --headless`), an install that no longer quits a running app, installed checks on all three systems through the channel, shell-check rules 8 and 9, the control test, the foreground sampler (replacing `scripts/foreground-watch.ps1`), the focus and memory experiments, and the network service in the main process as a default for a page that makes no network request. Every QA and measure script now reaches the app through the channel. Premium-bar rules 101 to 103 added, each proven in 1 |
| 2026-11-27 | A launcher app built from this starter | A saved light theme counts only beside the mark of a person's pick, and the first paint is dark with no script (D-022; the QA helpers' light runs, which had rendered dark, fixed with it); QA captures use the software rasterizer, and the audit's `progress` gate samples a running job every frame (D-023) |
| 2026-11-21 | The starter itself, in a fresh app made from it | Strict TypeScript for the main process, scripts, measurements, QA and tests (D-013 to D-017); shared code from the kit packages instead of copies (D-018, D-019: menus, tool runner and line reader, control channel, private-memory reading, QA measurements, stand-in bridge, audit server and browser, icons); the list fades where scrollbars are overlays. The installed-app check for macOS and Linux stays in `scripts/installed-check.sh`. Premium-bar rules 104 to 111 were written from a separate JavaScript version of the starter; their scripted checks are not in this one (see `references/premium-bar.md`) |

## Sources read

Extracted on 2026-11-15 from the app's own repository, its research notes and critic findings, and the session records of the build. Those sources are not public; the history, sorting and counts below are what they showed.

## How the build ran

About 5 hours 20 minutes from the first commit (10:51 AM Central) to the README (4:08 PM Central), 72 commits. Five research lanes (reports 08 to 12) ran first; the lead then wrote the tool contract, the bridge, the journeys and decisions D-001 to D-014 before any builder started (10:51 to 11:20 AM). Five builders worked in separate worktrees on their own branches (tool, adapter, shell, packaging, screen), pushed to a bare repository on the Mac, and merged into main at 1:01 PM with no conflicts. An independent critic saw the screenshots only and returned 7 must-fix and 17 should-fix items while the builders' own audits passed; the fixes and the gates that keep each class out landed by 2:58 PM. The real page then ran in the real shell against the real tool on all three systems (`measure/final.mjs`, about 90 checks each), and the packages were installed and checked on each system by 4:08 PM.

For the next app of this class the shell, the per-system recipe, the adapter, the packaging scripts and the audit gates are paid for. What repeats is steps 1 to 9 in `content-app.md`: the seam files, the screens, the tool and its contract suite, the critic rounds, and the per-system runs.

## Sorting

Counts: 10 constants, 35 defaults, 10 parameters, 31 lessons, 16 one-offs left behind. "Proven in 2" means the mail app and the media converter both did it; "in 1" means the media converter only unless marked.

**Constants** (true for the class; owner rules marked):

1. 680 MB ceiling and about 300 MB budget per app, counting the tool and its children. Proven in 2.
2. Premium is the owner's verdict after use; the bar is a floor. Proven in 2.
3. Logic lives outside the page, and the page never sees a path, an executable or a flag. Proven in 2.
4. No window an agent opens takes the owner's focus; the agent launch rules in `SKILL.md` (owner rule; the launch rules are proven in 1).
5. Delivery is an install started from the real launcher on each system (owner rule). Proven in 2 on Windows, 1 on macOS and Linux.
6. Windows installs and checks run through Explorer, because of the AppData redirect. Proven in 2.
7. Sign-in uses the owner's standing auth rule. Proven in 0 (no build had a sign-in).
8. Checks run locally or on the owner's Macs; no hosted workflow (owner rule). Proven in 2.
9. One codebase on Windows, macOS and Linux; the Mac build is the same Electron app. Proven in 1.
10. Linux is tested in containers on the Macs, never WSL. Proven in 1.

**Defaults** (decided; a build may override with a recorded reason):

1. Electron as the shell (2): measured against Tauri in build 1; build 2 needed one engine on three systems.
2. React 19, TypeScript, Tailwind v4, Base UI, TanStack Virtual, lucide, Inter at pinned versions (2).
3. Window created hidden in the theme's colour and shown at first paint, 3 s fallback; on Linux also at the end of the page load (2 on Windows, 1 elsewhere).
4. The title bar overlay on all three systems at 36 px (2 on Windows, 1 elsewhere).
5. The page's title bar laid out inside `env(titlebar-area-*)` (1).
6. Traffic lights at the system's position or centred by formula (1).
7. One platform module; the page told the system at bootstrap (1).
8. A menu bar on macOS only; the shell's own keys on Linux (1).
9. Closing and quitting as each system expects (1).
10. Single instance per data folder (2); scripts reach the running app only through the control channel, and a command launch never asks for the lock (1, the second pass).
11. `app://` with a strict Content-Security-Policy (2).
12. A narrow preload with an origin check on every handler (2).
13. The tool bundled per system and processor, by absolute path, never PATH (1).
14. One-shot jobs: capabilities, NDJSON events, cancel by closing stdin (1).
15. The tool owns its children: a guardian on POSIX, a job object on Windows (1).
16. A job record written before the tool starts, reconciled at launch (1).
17. Publication from a staging folder in one step, no clobber, with the claimed-name fallback (1).
18. Own minimal builds of bundled third-party programs, with notices (1).
19. The packager with a keep-list and no `node_modules` (2).
20. Ad-hoc macOS signing with the hardened runtime and `disable-library-validation`; Apple silicon only (1; owner decisions).
21. A `.deb` and a portable tarball on Linux, 64-bit-time dependency names first, the sandbox kept on with an AppArmor profile (1).
22. The stand-in bridge chosen by the address's fragment (1).
23. The stand-in tool as a scenario player (1).
24. A store outside React read with `useSyncExternalStore` (1).
25. One shortcut table with a Mod key, read by the page and the macOS menu (1; the single registry is proven in 2).
26. Plain language with whole-word banned terms; developer text only copied, never shown (2, tightened in build 2).
27. A status bar with one height in every state (1).
28. Saved work written atomically by the main process (2).
29. Memory read from outside before the app is asked anything; diagnostics written synchronously (1).
30. Time remaining after 3 s and 5%, published at most once a second (1; build 2 itself used 1 s for short jobs).
31. The frozen-attempt record for irreversible actions (1, build 1 only; not in this starter).
32. Motion defaults: hover appears at once, keyboard actions do not animate, reduced motion fades only (2).
33. The premium bar's rules as the acceptance floor beside A01 to A14 (2 for the round 1 rules).
34. The network service in the main process while the page makes no network request (1, the second pass).
35. Scripts on Windows that Explorer runs start under `conhost.exe --headless`, never in a visible console (1, the second pass).

**Parameters** (asked of each new app; recommended answers in this README): product identity; which systems; default and minimum window; where the logic lives and its contract; the essential journeys and step budgets; the banned terms; bundled third-party programs; the release channel per system; whether the app talks to a server; whether anything is irreversible.

**Lessons** (a failure, and the check that now prevents it):

1. A closed progress pipe did not end FFmpeg on any system, as research expected. Check: the guardian and job object (`references/tool-contract.md`, rule 8); the host-kill test; the contract suite kills the tool.
2. An ad-hoc signed app with the hardened runtime verified and then died at launch. Check: `scripts/package.mjs` fails without `disable-library-validation`.
3. `setTitleBarOverlay` is undefined on macOS; calling it threw and showed a modal error. Check: the `overlayColours` fact in `platform.cjs`.
4. `frame: false` was assumed necessary on Linux. Check: the container's frameless variant; the recipe leaves `frame` alone.
5. An overlay height alone did not centre the traffic lights. Check: `trafficLights()` and the shell check.
6. Electron picks Wayland only when the session type says so, and a switch appended in app code is too late. Check: `startAgainOnWayland()` and the container's no-session-type variant.
7. A child's last progress block described the wrong output. Check: the tool floors its counter by bytes and reads the length from the file (`tool-contract.md`, rule 5).
8. A relative app path started the wrong program and took focus. Check: `scripts/lib/launch.mjs` resolves the binary absolutely; the shell check fails a script that starts Electron itself.
9. A syntax error raised Electron's modal error box. Check: `pnpm shell:check` (every main-process file parses) before every launch; under `--no-activate` errors go to stderr.
10. A second launch from an Explorer-started process brought the window forward, and so did a visible console closing (Windows Terminal ignores a shortcut's Minimized setting). Check: the control channel and shell-check rule 8; the app's second-launch count asserted 0 by `collect` and the shell evidence; `scripts/run-as-user.ps1` under `conhost.exe --headless`; `measure/foreground-sampler.ps1 -App` across every installed check; `measure/focus-experiment.mjs` with an Explorer-started launch before any focus claim.
11. A subagent's waiting shell outlived it by hours. Check: `SKILL.md`, end what you started before you report.
12. A quit that followed a second launch too quickly left the second launch running (macOS). Check: `shell.cjs` waits 500 ms after a second launch before quitting.
13. The first asynchronous file call in the main process added 32 MB on Windows. Check: synchronous diagnostics; memory read before asking.
14. An app started by `open` that touched a removable volume waited for a prompt nobody could answer. Check: install and test from the internal disk (`packaging.md`).
15. A modal alert on an unwatched Mac hung every check. Check: `--no-activate` on every scripted launch.
16. A bare `libasound2` dependency installed the wrong library on Ubuntu 24.04 and the app did not start. Check: `scripts/linux/deb-control.in` names the 64-bit-time libraries first.
17. LAME was pinned from memory, one major behind. Check: `packaging.md`, check the current release of anything pinned from memory.
18. `@electron/packager` 20's hooks take one object and return a promise. Check: `scripts/package.mjs` uses that form.
19. The single-instance lock is per data folder; a check without the same `--data-dir` became a second app with a focused window. Check: every installed-check step carries it.
20. Headless QA wrote to the machine's real clipboard. Check: `qa/lib.mjs` captures clipboard writes in the page.
21. Parallel test files disturbed process counts and cancel timing. Check: `node --test --test-concurrency=1`.
22. A stand-in that exited right after writing lost its last line. Check: `test/standin-tool.cjs` leaves from its write callback.
23. The builders' audits passed while the critic found 7 must-fix and 17 should-fix items, the second build in a row. Check: process step 3, and each class of finding turned into a gate (rules 69, 71, 72, 97, 98).
24. A substring banned-term match gave false hits. Check: whole-word matching in `qa/audit.mjs`.
25. A root with hidden overflow passed "the window never scrolls" while controls were cut off. Check: the spill gate (rule 98).
26. Audit sizes chosen by the audit missed the app's real minimum window. Check: sizes from `app.config.json`.
27. Focus reached an overlay a frame after its key, so typed keys went elsewhere (both builds). Check: the overlay gate (rule 6).
28. Errors offered a filled "Show details" or "OK", and Details showed developer text. Check: the buttons gate (rule 69) and Copy details.
29. The folder for the tool's binaries was spelled two ways by two builders. Check: `locate.cjs` uses only `<platform>-<arch>`.
30. Windows idle memory stayed over the 300 MB budget (304 to 314 MB) while macOS and Linux sat near 135 MB. Cause: a separate network-service process (68 MB on Windows) for a page that makes no request. Check: the network service in the main process (shell-check rule 9 holds its condition), `measure/memory-experiment.mjs`, the per-system memory scripts and the budget gate. The GPU process, about 110 MB on Windows, is the floor.
31. A worker's list of questions for the owner included ones his record already answered. Check: `SKILL.md`, settle what the record answers before asking.

**One-offs** (16, left in the subject): the one knob and its gates (`qa/knob-gates.mjs`, rules 73 to 76 keep the generic part); tuning in cents and percent; presets and the range and step popover; the waveform and peaks; the preview player (`<audio>` with `preservesPitch = false`); the media handler `electron/media.cjs` (it serves registered local files with byte ranges to the page; it would generalise to an app that previews local media, and no second app has needed it, so it stays at commit `6a8ac92` as the worked example); the track registry and probe; the exporter's naming ("+168 cents", " (2)"); the 4 GB WAV rule (D-017); decisions D-009 to D-012 (one knob, no per-track settings, no visualizer, the identity); the FFmpeg and LAME build recipes in `third-party/` (the pattern is in `packaging.md`); the C++ tool's Windows port (the traps are in `tool-contract.md`); the full tool contract; `measure/final.mjs` and `integration.mjs` (the real page against the real tool; the pattern is step 6 of `content-app.md`); the audio words in the banned list; the critic's audio-specific findings.

## Cold start

Instance: a desktop front end for a command-line mod and patch manager, on Windows, macOS and Linux. The other two instances kept in mind: a batch video converter over a bundled encoder, and a dashboard over a Git-backed command-line index. Method: a paper walk by the extracting agent holding only the skill, its references and this starter. No fresh agent ran it, because this run was told to start none; treat the result as optimistic until one does.

- **Open decisions without the factory: 41.** Framework; shell; how one codebase splits per system; title bar per system; where the window buttons are on Linux; traffic-light position; Wayland or X11; menus per system; close and quit per system; reveal without a flash per system; identity to each system; process model for the tool; transport and framing; versioning handshake; progress; cancellation; who owns the tool's children; error model and words; path handling on Windows; finding the tool; bundling per architecture; publication without clobbering; job records; testing the seam; packager; macOS signing and entitlements; Linux formats and dependencies; the Linux sandbox; per-user install on Windows; the AppData redirect; installed checks per system; memory definitions per system; agent launch rules; how to test Linux; the acceptance bar; the audit's gates; stand-ins for the page; tokens; shortcuts per system; who critiques; who gives the verdict.
- **Open decisions with it: 10**, all on the parameter list (identity, systems, window sizes, the tool and its contract, journeys, banned terms, bundled third-party programs, release channels, server, irreversible actions). None outside it after two repairs made during the walk: the window sizes became a parameter in `app.config.json` (the audit reads them), and a foreground watcher was added for the Windows installed check (the second pass replaced it with the sampler).
- **Files still written from nothing:** the app's screens and their stand-in fixtures; the tool itself, its Windows port and its contract suite; the app's `docs/TOOL-CONTRACT.md`; a real-page, real-tool run like build 2's `measure/final.mjs`; a notices builder if the app bundles third-party programs; the real tool's job check in `scripts/installed-helpers.cjs`; a container variant that runs that real-tool check on Linux.

## Trust checks (2026-11-21)

Premium-bar rules 104 to 111 were first built into the earlier JavaScript version of this starter on 2026-11-19 (crash recovery, window restoration, the security boundary, fuses, forced colours, colour tokens and visual baselines) and proven in a TypeScript app made from the starter. They are ported here as strict TypeScript: `electron/bounds.ts`, `electron/boundary.ts`, `qa/crash-test.ts`, `qa/visual.ts`, `scripts/fuses-check.ts` and `scripts/lib/fuses.ts` come from that app with the app's own screens taken out; the crash handling in `electron/window.ts`, rule 10 of `measure/shell-check.ts`, the `forced` and `tokens` gates of `qa/audit.ts`, the screenshot changes in `qa/shots.ts` and `scripts/package.ts` follow the same changes in the earlier version. `qa/planted-breaks.ts` is new. One bug in the app's copy was fixed on the way: its asar tamper probe changed a byte to the value it already had, so it could never fail.

## Still a hypothesis

Everything proven in 1 build above; every macOS and Linux claim, which rests on one Mac and arm64 containers; and the 12 premium-bar rules marked 0. The parts of this starter carried over without a run are listed in its README. The control channel, the windowless runner and the network-service default are proven in 1 build and were carried here without a run of the Electron side (see the README). Run this extraction again after the third content app ships: raise what repeated to proven in 2 or 3, and move the media handler, the frozen-attempt record or a sign-in screen into a starter only if that app needed them too.
