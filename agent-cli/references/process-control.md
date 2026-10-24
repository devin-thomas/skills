# Process control and host boundaries

Read before supervising a headless worker, building a runner, or changing
operating system or shell. This is a runner contract; the skill bundles no
cross-platform process supervisor.

## Establish a supported launch path

Record OS, shell/runtime version, resolved executable and kind, working directory,
and path namespace. Prefer native argument-array APIs. Use UTF-8 task files for
large prompts; do not build commands by interpolating prompt text.

Bash arrays and PowerShell argument splatting preserve structure only within
their actual native-command rules. Windows npm shims and batch files can
introduce another parser. `Start-Process -ArgumentList` joins arguments into a
string. Use a verified native launch API, such as a supported
`ProcessStartInfo.ArgumentList`, or qualify the selected wrapper with literal
arguments containing spaces, quotes, empty values, and trailing backslashes.
Treat dotenv files as data, never as shell programs.

Resolve paths with filesystem APIs. Distinguish Windows absolute and
drive-relative paths, UNC, WSL, Git Bash, POSIX paths, and URLs. Check canonical
containment through symlinks/junctions; a string prefix is insufficient.
Preserve case, encoding, and line-ending behavior. Hash exact bytes, and label
any normalized comparison separately.

Keep the normal credential stores and system home variables. Use configured
scratch/temp/cache locations where supported; report a required missing volume
instead of silently writing elsewhere. Pass only necessary environment values;
credentials belong in the vendor's supported authentication channel, never argv,
task text, or captured reports.

**Complete when:** executable identity, argument boundaries, native paths, and
the required access controls are established for this host.

## Enforce limits while the worker runs

Record UTC start/end times and a monotonic duration around the actual work.
Create a distinct attempt ID and bind logs/output paths to that attempt.

Drain stdout and stderr concurrently with bounded buffers. Count their combined
raw bytes before filtering or parsing; stop at the agreed limit. Read JSONL
incrementally with bounded line sizes. Enforce a wall-clock deadline, artifact
size limits, and a separate budget for vendor logs/session files. A small final
answer does not bound verbose output or persisted state.

Use a process owner capable of terminating the worker's descendants: a qualified
POSIX session/process group, Windows Job Object, or equivalent host supervisor.
At timeout, cancellation, or output/storage limit, stop only the owned process
tree, escalate within a short cleanup window when necessary, and verify exit.
Closing a pipe or killing a shell wrapper does not establish descendant cleanup.
If the host cannot enforce the required lifecycle, report that limitation before
launching this bounded task.

Capture a native command's exit immediately. In PowerShell distinguish
`$LASTEXITCODE` from cmdlet success; in shell pipelines capture the intended
process status rather than the last log filter. A command producing no checks
does not satisfy a test gate just because it exits zero.

An output limit, timeout, cancellation, or vendor failure remains a failed
attempt even if a partial artifact looks useful. Preserve it for inspection.
Reconcile the old process and its files before a bounded retry; automatic
unbounded relaunches are outside the contract.

**Complete when:** the worker and owned descendants have a known terminal state,
with bounded evidence, stop reason, duration, and real exit code.

## Persistent sessions use a different lifetime

For chats and handoffs, verify that the terminal/session survives the calling
tool's return and that the receiving owner has a usable handle. A terminal
screenshot is not proof of persistent ownership. Apply a bounded startup
observation window without attaching the headless task's kill deadline.

If startup is pending, preserve the handle and record whether the prompt was
accepted. Close only owned failed or canceled launches. A new launch requires
evidence that it will not duplicate an active turn.

**Complete when:** the next owner can continue or stop the intended live session.

Primary references: [Python subprocess](https://docs.python.org/3/library/subprocess.html),
[PowerShell native parsing](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing),
[Start-Process](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process),
[Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).
