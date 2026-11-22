# A command-line tool under a desktop app

Rules for the seam between a content app and the command-line tool or core it drives, on Windows, macOS and Linux. They start from research report 11 (2026-11-15), which read how GitHub Desktop, VS Code, LosslessCut, HandBrake, Mullvad, Tailscale, Terraform, cargo, restic and others drive their tools, and are corrected by what build 2 (the media converter: an Electron app over a C++ tool that runs FFmpeg) saw when it tested them on all three systems. **Proven in 1 build** unless a rule says otherwise. The starter's `docs/TOOL-CONTRACT.md` is a small worked example; build 2's tool contract is the full one.

## Choose the shape first

| The core | Shape |
| --- | --- |
| One job at a time with progress and one outcome (an export, a conversion, a send) | **One-shot process**: arguments in, newline-delimited JSON events out, cancel by closing stdin. Everything below is about this shape |
| A short question with one answer (version, capabilities, one file's metadata) | One-shot process, whole stdout as one JSON document, a hard time limit |
| Many small calls per second against warm state (a language server, a player) | Long-lived stdio with requests and replies (LSP, DAP, MCP framing) |
| A privileged or always-running service several programs share | A socket or named pipe with an identity check |
| A core that must outlive the window | A daemon, with all of its lifetime cost |

Avoid loopback HTTP for a one-shot core: it brings port choice, a token, firewall prompts and a lifetime problem for no gain.

## The tool

1. **A real executable, started with an argument array.** It never needs a shell, a console, a terminal size or a prompt, and reads stdin only when a flag says so. A `.cmd` or `.bat` cannot be started without a shell.
2. **One binary per system and processor**, in a folder named as Node names them (`win32-x64`, `darwin-arm64`, `linux-x64`, `linux-arm64`), one spelling everywhere. On Linux build it static against musl in an Alpine container so it runs on any distribution; on Windows build it with MSVC, `/MT` (the C runtime inside the exe, so no redistributable) and `/Brepro` (the same source gives the same bytes), and fail the build if it imports anything but Windows' own DLLs; on macOS one universal file is fine. (Build 2.)
3. **A handshake in one short call** (`--capabilities`): tool version, the event schema majors it speaks, features, and the state of each dependency. It succeeds even when a dependency is missing, and says so.
4. **A machine mode chosen by a flag that names the schema major** (`--events 1`). In it, stdout carries only UTF-8, newline-delimited JSON with no line over 1 MiB; the first line is `hello` with the schema and version; the last is exactly one terminal event (`result`, `error` or `cancelled`). Every event has `type`, `seq` (from 0, by one) and `t_ms`. Fields and event types may be added within a major; anything else is a new major.
5. **Progress is a counter that never goes backwards**, with a total and a fraction when the tool knows them and null when it does not, and named stages. Floor the counter by what has been written: a child's last progress block can describe the wrong output (build 2: FFmpeg's closing block reported a validation sink, not the file). Read a finished file's length from the file itself, not from the last progress report.
6. **Failure is a stable code, a developer's message and a details object.** The list of codes is published with the schema and only grows. Exit codes are coarse: 0 with `result`, 1 with `error`, 130 (or 129, 143) with `cancelled`; the terminal event is authoritative. Never echo a caller's path in an event: refer to inputs by position, and replace the names you gave a child in any of its text you pass on.
7. **Cancel on stdin end-of-file** (and a `cancel` line, and signals where they exist), within a stated time (2 s), leaving no partial output and no temporary files, and say so with `cancelled`, which is not an error. A failed write to stdout counts as stdin closing: the reader has gone.
8. **Own every process it starts.** On Windows put each child in a job object with kill-on-close, created suspended, holding the only handle. On macOS and Linux start a guardian before the first child: a forked copy of the tool that holds only a pipe from it, is told which child is running, and kills that child when the pipe closes. A closed progress pipe does **not** end a child: FFmpeg ignores SIGPIPE and the write error on all three systems (build 2 measured it; report 11 had expected the opposite). Kill the tool in a test; do not reason about it.
9. **Publish in one step without clobbering.** Write into a private staging folder beside the destination (`.<tool>-<32 hex>.tmp`) and put the file in place in one step; never replace an existing file without an explicit flag; refuse if the name appeared meanwhile. Where hard links are missing (exFAT, FAT, ReFS), use an exclusive rename (`renameat2` with `RENAME_NOREPLACE` on Linux, `renameatx_np` with `RENAME_EXCL` on macOS, `MoveFileExW` without the replace flag on Windows); where that is unsupported too (exFAT and FAT on macOS), claim the name with an exclusive create and rename over the empty placeholder, removing it only while it is still the empty file the tool made. With the replace flag, Windows cannot replace a file another program holds open without delete sharing: retry for 2 s, then a distinct "in use" code whose page action is Try again.
10. **Every dependency's path is a flag** (`--ffmpeg PATH`); without it, the tool's own folder, then PATH; never the current folder. On Windows skip relative and empty PATH entries, which are the current folder by another name.
11. **Any filename the system allows works**, including spaces, quotes, non-Latin text, a leading dash, shell characters and more than 260 characters; inputs come after `--`.
12. **Memory and output stay bounded** whatever the input, and the tool says what it truncated.

## The adapter

13. **Runs the tool from inside the app bundle by absolute path**, outside the asar archive (a program inside it cannot be started), passing every helper's absolute path as a flag. Nothing reads PATH in the packaged app: a GUI app started from the Dock or a launcher does not get the shell's PATH anyway.
14. **Spawns with** `shell: false`, `windowsHide: true`, `stdio` all pipes, `detached: true` on macOS and Linux only (so the tool leads a process group), the working folder set to the app's data folder, and `ELECTRON_RUN_AS_NODE` removed from the environment.
15. **Checks the tool before enabling anything that needs it**, and turns each answer into a designed state: missing, damaged or the wrong major is one blocking state with an action that can succeed; one missing feature disables only that feature. The answer is cached by the binaries' size and modified time so a launch can show a ready state while its own check runs.
16. **Reads stdout as a stream of capped lines and checks every one**, ignoring unknown types and fields, and keeps draining after any fault so the tool never blocks. A line that is not JSON, a line over the cap, events out of order or a first line that is not `hello` ends the job with an adapter code. No hello within 5 s, or no capabilities within 10 s, is "stalled".
17. **Cancels by closing stdin and escalates after a stated wait** (3 s): `child.kill()` on Windows (TerminateProcess; the tool's job takes its children), SIGKILL to the process group elsewhere. The page shows the cancel on the next frame; the bookkeeping finishes when the process exits.
18. **Watches for silence but never kills a job for it.** A job with no event for 30 s is shown as not progressing, with Cancel; a slow disk is legitimate.
19. **Records a job before starting it** and reconciles at the next launch. When the app is killed, what happens differs per system (build 2): on Windows the tool dies at once with the app, because libuv keeps its direct children in a kill-on-close job object, so it cannot remove its staging folder; on macOS and Linux nothing ends the tool except the tool, which sees its stdin close and cleans up. The record names the staging folder so the next launch can remove it, and only a folder whose name matches the contract's pattern, directly inside the destination folder.
20. **Never lets the page supply an executable, a flag or a path.** The page holds opaque ids; the main process keeps the id-to-path map, filled only from a system dialog, a dropped file (resolved in the preload with `webUtils.getPathForFile`) or a file opened with the app.
21. **Never shows the tool's text.** Codes map to the page's own sentences and actions; the tool's message and details reach a person only through Copy details.
22. **Ships the notices the bundled programs require**, reachable from About.

## Testing the seam

- **A stand-in tool** that takes the same flags and replays scenarios: delays, events, raw bytes, noise, an over-long line, stderr, a staging folder and publication, a grandchild, an exit. Scenarios: success, slow success, each error code, a code from a newer tool, a crash with no terminal event, garbage, a 2 MiB line, 10 MB of noise, silence before hello, silence mid-job, a cancel ignored, unknown events and fields, the wrong major. The starter's `test/standin-tool.ts` has these. It must leave from its write callback, or its last line can be lost on a Windows pipe, and exit quietly when its reader goes away.
- **The host-kill test**: a small host process plays the main process, starts a job, and the test kills the host and checks that no tool process survives 2 s and that the next launch's reconcile leaves nothing (`test/host-kill.test.ts`). Run it on every system; it asserts the per-system difference above.
- **Run Node's test runner with concurrency 1** (`node --test --test-concurrency=1`): the process tests count live processes and time cancels, and parallel files disturb both.
- **A contract suite in the tool's own repository**, one runner on all three systems, against the real tool with real dependencies and with controllable substitutes (on Windows a tiny compiled launcher, since Windows starts only real executables). It checks every line against a JSON schema, every flag, every cancel path, the tool and its child killed mid-job, a hostile child, the path matrix, existing and appearing destinations, and asserts that **every published error code is reachable**, or lists why it is not. Build 2 reached 20 of its 22 codes across the three systems: `INTERNAL` cannot be arranged, and `PUBLISH_UNSUPPORTED` stopped being reachable on every volume it had once exFAT and FAT could publish.
- **Cheap test volumes** for filesystems without hard links: on macOS `diskutil image create blank` makes a 12 MB exFAT, a 64 MB exFAT and a 64 MB FAT32 image in seconds; in a Linux container a loop-mounted FAT image and a 10 MB volume (for "disk full").
- **Porting a POSIX tool's test suite to Windows by subclassing**: run every upstream test that has a Windows meaning unchanged, swap only the substitute program, and replace the rest by their Windows form with the reason written beside each (build 2 ran 29 of upstream's 31 on Windows this way).
- **Headless tests may share the machine's clipboard.** Capture clipboard writes in the page (the starter's `qa/lib.ts` does) so a test never overwrites what the person copied.

## Windows traps

Each seen in build 2.

- Start a child with a plain program path; the `\\?\` prefix is for file calls, and a program path over 260 characters is the only time to use it there.
- Negative exit codes are normal on Windows (an NTSTATUS such as `0xC0000005` arrives as a negative number); do not treat them as impossible.
- Start children with `CREATE_NO_WINDOW` and an explicit handle list naming only the pipes and `NUL`. Even with `windowsHide`, each run of a console program under the app gets a hidden console host process (`conhost.exe`), which counts in the memory tree (build 2: part of a 466 MB peak).
- `wmain`, not `main`: arguments arrive as UTF-16 and `main` would lose characters. Embed a manifest with `activeCodePage` UTF-8 and `longPathAware`; do not rely on `LongPathsEnabled`.
- MinGW's start-up code expands `*` and `?` in arguments unless told not to; MSVC's does not.
- A file opened without write or delete sharing cannot be modified, renamed or deleted while the tool holds it: on Windows that pins inputs more strongly than POSIX can. A file already open for writing elsewhere fails that open; fall back to read-write sharing with a warning.
- There is no graceful stop from outside: `child.kill()` with any signal is TerminateProcess with exit code 1. Cancellation has to travel in-band, which is why stdin is the channel.

## When the rules were wrong

What testing changed, so a later reader does not re-learn it:

| Report 11 said | Build 2 saw |
| --- | --- |
| A killed tool takes FFmpeg with it on macOS and Linux, because FFmpeg's next progress write raises SIGPIPE | FFmpeg ignores SIGPIPE and the write error on all three systems. A guardian process (macOS, Linux) or a kill-on-close job object (Windows) is needed |
| The tool reports `out_time` from FFmpeg's progress | FFmpeg's closing block describes a validation sink; floor by bytes written and read the length from the file |
| Publication without overwrite falls back to an exclusive rename, else fails | exFAT and FAT on macOS refuse both; claim the name and rename over the placeholder |
| Time remaining after 3 s and 5% (report 11) or after 1 s (report 12) | Build 2's jobs finish in seconds, so it used 1 s; the default stays 3 s and 5% for longer jobs, as a recorded choice per app |
