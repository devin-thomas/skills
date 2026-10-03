# Uppercut Skills CLI

`@uppercut-labs/skills` installs selected public Devin/Uppercut agent skills with their required skill dependencies. This checkout is a private development preview; it is not an npm release.

## Run from this checkout

Requires Node.js 22 or newer.

```sh
cd packages/skills-cli
npm ci
npm run build
node bin/uppercut-skills.js list
node bin/uppercut-skills.js add execute-task-cycles --host codex --project /path/to/project
node bin/uppercut-skills.js doctor --host codex --project /path/to/project
```

`add execute-task-cycles` also installs its required `execute-task` skill. The default bundled channel uses the reviewed content snapshot inside this package and needs no network after installation. `--latest` selects the current allowed GitHub source revisions and remembers that channel for subsequent updates. `--no-dependencies` (or `-nd`) is an expert option that reports a degraded install if required skills are missing.

Use `--host codex|claude|cursor|antigravity|grokbot|grokcli` to select one host. Grok Bot's project route writes `.agents/skills`; its account-wide private library requires a native registration transport and is not claimed by a file copy. Grok CLI is a separate host with a `.grok/skills` route. `--global` selects user scope. Antigravity global installs also require `--surface ide|cli`.

`update`, `remove`, `show`, `list`, and `doctor` use the same CLI. Add `--json` for one machine-readable result or `--dry-run` to inspect an intended write. The installer refuses changed or unowned files by default.

## Read-only MCP catalog

Start the opt-in loopback Streamable HTTP mount:

```sh
node bin/uppercut-skills.js serve-mcp
```

The command prints the local `http://127.0.0.1:<port>/mcp` URL. It accepts `POST /mcp` and advertises only `catalog.list` and `catalog.show`. It exposes no install, update, remove, doctor, or local installation state. The MCP peer is `@modelcontextprotocol/server@2.3.0`; the ordinary CLI does not start the listener.
Use `--port <number>` to choose a loopback port; the default selects an available port.

For package consumers, the `./agent-native` export supplies a scoped capability registry factory and `./mcp` supplies the loopback server helper. Importing either starts no listener or install operation.

## Source and release boundary

The catalog is authored in the repository's `manifest/skills.json`. The bundled snapshot is compiled from pinned commits in the three reviewed public source repositories. The package remains private until licensing, full host qualification, packed consumer checks, and explicit release authorization are complete.
