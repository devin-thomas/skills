# Required port and endpoint checks

Run these checks before starting or reusing a localhost server, and again before
reporting a served dashboard ready. Native Claude artifact mode needs no port.
Resolve helper paths relative to the installed skill directory.

## Before binding

Inspect listeners and ownership, not just a preferred port number:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 4173
```

On macOS/Linux, use `lsof -nP -iTCP:4173 -sTCP:LISTEN` or `ss -ltnp` as available.
Include wildcard and IPv6 listeners in the inspection. Correlate a PID with the
task's saved runtime metadata and server command/document root; a PID alone can
be reused by an unrelated process. An occupied port is not permission to stop it.

The bundled standard-library helper checks an exclusive loopback bind:

```text
python <skill-directory>/scripts/dashboard_endpoint.py port --port 4173
```

If free, launch a server on that port. If occupied, reuse it only when process
ownership, document root, and the endpoint checks below all confirm this task.
Otherwise choose another port and rerun the checks. An unknown owner, unrelated
HTTP 200 page, or different task ID means collision, not success. Try a bounded
set of candidates (up to ten), then record a serving limitation and preserve files.

A preflight closes its test socket; it cannot reserve the port. Check the server's
actual startup result and listener after launching. If binding loses a race, choose
a new port instead of proceeding against the process that won. Do not silently
accept a framework's automatic port change: discover and verify the actual port.

Bind only `127.0.0.1`, with document root exactly the reviewed dashboard directory.
Do not serve the repository root or follow symlinks/junctions outside that directory.
For example, using the selected port and folder:

```text
python -m http.server <local-port> --bind 127.0.0.1 --directory <absolute-dashboard-folder>
```

Run through the host's supported background process mechanism. On Windows,
`Start-Process` requires `-WindowStyle Hidden` and correctly quoted arguments.
Store logs and process metadata outside the repository or in a narrow ignored
runtime directory. Verify the process remains alive at handoff.

## Before linking or reusing

Read the expected identity and timestamp from the current canonical `status.json`.
Check both its served JSON and the HTML markers with the helper:

```text
python <skill-directory>/scripts/dashboard_endpoint.py verify --url http://127.0.0.1:4173/ --task-id <task-id> --updated-at <exact-ISO-timestamp>
```

It requires successful nonredirected JSON/HTML responses with matching task IDs and
timestamps. HTML needs `<meta name="dashboard-task-id" content="...">` and
`<meta name="dashboard-updated-at" content="...">`. Escape attribute values. A 200,
open socket, copied URL, or running PID alone never proves dashboard delivery.
Also check any linked assets that the page needs and its actual rendered content.
Markers verify endpoint identity/freshness; they do not certify the underlying task.

If an owned server returns stale content, repair its root, regenerated files, or
caching and rerun verification. If it belongs to another task, leave it alone and
choose another port. Never report a failed verification as working delivery.

## Additional Tailscale checks

Serialize Serve configuration changes across dashboard sessions with a host-wide
OS lock shared by all invocations: a named mutex on Windows or `flock` on a shared
local lock file on Unix. Use the shared lock name `LongHorizonDashboardServe` (not
a per-task name), and keep runtime lock metadata outside project repositories.
Hold it in one process across port selection, fresh configuration inspection,
mutation, read-back, and endpoint verification; separate shell calls that release
the lock do not protect the operation. Wait for a bounded interval or fall back
to local delivery if locking is unavailable. Do not configure Serve without it.
This prevents two dashboard sessions from both claiming the same apparently free
HTTPS port. The lock coordinates these skills, not unrelated external operators.

Inspect both OS listeners and `tailscale serve status --json` before selecting an
HTTPS port or route; a userspace Serve handler may not look like an ordinary host
listener. Inspect public Funnel exposure too. Choose a dedicated port without any
existing Serve handler or Funnel exposure, or reuse this task's verified mapping.
Do not overwrite unknown routes or rely on a free-port probe alone for this choice.

Recheck configuration just before adding the mapping, then read it back to confirm
the exact local target. Run the same `verify` command against the actual tailnet
HTTPS base URL as well as the local base URL. Use normal TLS certificate validation.
Record host-side and second-device checks separately. A stale/wrong remote page
must be fixed before sharing the URL as ready; never reset unrelated configuration.
If noncooperating external changes appear, stop configuring that mapping and report
the conflict instead of restoring a stale global snapshot over somebody else's work.
