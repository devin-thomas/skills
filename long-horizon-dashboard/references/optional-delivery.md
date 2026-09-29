# Optional delivery modes

These modes are selected by the user or saved project preference. Localhost is
the default and works without either integration. Do not install services, request
keys, or change account settings merely because this reference exists.

## Native Claude artifact

If `delivery.mode` is `claude-artifact` and native artifact creation/update tools
are actually available, use one native artifact per task with the same portable
`index.html` snapshot committed to the repository. Keep its default private
visibility. Do not create a public share link to achieve cross-device access.

Embed the sanitized state. Do not fetch localhost resources, tailnet endpoints,
or secrets from the artifact. Update the same artifact at meaningful checkpoints;
changing files in Git does not refresh a native artifact automatically. If an
update fails, preserve the Git snapshot and identify the stale artifact clearly.

Use local Git or an authorized write-capable repository integration for the matching
files. Claude chat with no repository write capability can display/export artifacts
but cannot claim committed persistence. Record that limitation and continue.
Artifact capability varies by host; do not invent tool names or assume a model
name implies the feature. No local server or port is required in native mode.

Reference: [Claude artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them).

## Private Tailscale Serve

When `delivery.mode` is `tailscale`, use the user's already connected Tailscale
client. No API key is required for Serve. Optional read-only API diagnostics may
use an existing user-provided credential, loaded locally; never print it, put it
in command arguments or HTML, or confuse an API key with a device auth key.

1. Inspect `tailscale status --json`, `tailscale serve status --json`, and OS
   listeners. Discover the actual device DNS name. Follow the mandatory
   [port and endpoint checks](port-checks.md) for both new and reused servers.
2. Choose a free loopback port and a dedicated unused HTTPS port. Defaults 4173
   and 8445 are suggestions only. Inspect Serve handlers and Funnel exposure;
   never reuse a public Funnel port, overwrite another service, or reset Serve.
   Existing routes for this task can be reused only after confirming ownership,
   destination, and live task content. Recheck immediately before mutation.
3. Start the loopback server with document root exactly the dashboard directory.
   Reject links/junctions that expose other directories. Verify its HTML and state
   identity and timestamp before mapping it:

   ```text
   tailscale serve --bg --https=<unused-https-port> http://127.0.0.1:<local-port>
   ```

4. Inspect Serve status again and run the endpoint helper against the actual
   `https://<device-dns-name>:<https-port>/` URL. It must return the expected task
   and current state, not just HTTP 200. Never use Funnel or another public tunnel
   as a fallback. Keep unrelated routes and processes intact.
5. Give the verified URL in chat. Tailnet devices need connectivity and permission
   under existing policy. A check from the serving host does not prove phone access;
   record second-device verification separately when actually performed. The host
   must remain awake/online; `--bg` does not keep the local HTTP server alive.

Use a dedicated HTTPS port to avoid breaking root-relative assets through a path
prefix. If permissions, HTTPS enablement, login, or policy blocks serving, state
the concrete limitation and retain the localhost/portable fallback. Do not enroll
devices, rotate keys, widen policy, or change unrelated configuration automatically.

Preserve only task-owned process/route details in ignored runtime metadata for
reuse and cleanup. When cleanup is requested, recheck ownership and remove only
that mapping and server using the installed CLI's scoped `off` syntax. Do not run
`tailscale serve reset` or terminate an unknown process to free a port.

Reference: [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve).
