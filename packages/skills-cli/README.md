# Uppercut Skills CLI

`@uppercut-labs/skills` installs selected public Devin/Uppercut agent skills with their required skill dependencies.

The examples below pin 1.0.2, the newest version published to npm and attached to a
GitHub release when this guide was written. The [npm version list](https://www.npmjs.com/package/@uppercut-labs/skills?activeTab=versions)
and [GitHub releases](https://github.com/devin-thomas/skills/releases) are authoritative. Pin an
exact version, or verify the release archive against its adjacent checksum.

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

Run the public npm package:

```sh
npx @uppercut-labs/skills@1.0.2 list
npx @uppercut-labs/skills@1.0.2 add execute-task-cycles --host codex --project /path/to/project
npx @uppercut-labs/skills@1.0.2 doctor --host codex --project /path/to/project
```

If registry publication is unavailable, use the pinned GitHub release tarball and its adjacent checksum instead:

```sh
curl -fL -o uppercut-labs-skills-1.0.2.tgz https://github.com/devin-thomas/skills/releases/download/v1.0.2/uppercut-labs-skills-1.0.2.tgz
curl -fL -o uppercut-labs-skills-1.0.2.tgz.sha256 https://github.com/devin-thomas/skills/releases/download/v1.0.2/uppercut-labs-skills-1.0.2.tgz.sha256
shasum -a 256 -c uppercut-labs-skills-1.0.2.tgz.sha256
npm exec --yes --package=./uppercut-labs-skills-1.0.2.tgz -- uppercut-skills add quick-build --host codex --project /path/to/project
```

On Linux, replace `shasum -a 256 -c` with `sha256sum -c`. The checksum must verify before running the archive.

`add execute-task-cycles` also installs its required `execute-task` skill. `--no-dependencies` (or `-nd`) is an expert option that reports a degraded install if required skills are missing.

## Versions and content channels

Three different things carry versions:

- **Installer version**: the npm package version, such as `@uppercut-labs/skills@1.0.2`. It fixes the CLI code and the bundled snapshot inside it. `npx @uppercut-labs/skills@latest` means the newest installer on npm.
- **Bundled channel** (default): each skill is installed from the snapshot compiled into that installer, pinned to the source commit recorded in `manifest/skills.json`. It needs no network after the package is installed, and it never refreshes itself from GitHub. A newer bundled snapshot arrives only with a newer installer version.
- **GitHub channel** (`--latest` or `--channel github`): opt-in. It resolves the current allowed GitHub source revisions, records them, and remembers the channel for that skill's later `update`. A failed GitHub fetch reports the error; it never falls back to the bundle.

So `--latest` (newest skill content) and `@latest` (newest installer) are independent. Bundled skills derived from other repositories, such as Starter Pack, can lag their maintained source until a new installer is released; the release record names each pinned source version.

Use `--host codex|claude|cursor|antigravity|grokbot|grokcli` to select one host. Without `--host`, a noninteractive `add` refuses and writes nothing. `--global` selects user scope. Antigravity global installs also require `--surface ide|cli`. Grok Bot's project route writes `.agents/skills`. Grok CLI is a separate host with a `.grok/skills` route.

## Install-time script (Grok Bot only)

The package declares one npm `postinstall` script. It exists only to fill a fresh Grok Bot account library and writes nothing anywhere else:

- **Ordinary installs do nothing.** A local (non-`-g`) install, `npx`, or any install not run as npm's `postinstall` lifecycle prints "Grok Bot account library untouched" and exits without writing.
- **Global installs check the machine first.** Even with `npm install -g`, it continues only on Linux, as a non-root user whose home is `/home/box`, where `/home/box/agent-data/workflows` already exists, resolves inside that home, is a real directory, and belongs to the running user. The Bot reports that `agent-data` is a symlink, so the installer resolves the physical directory before writing. On any other computer it writes nothing.
- **Existing managed installs are preserved.** If the Bot library already has managed skills, postinstall changes nothing and prints the explicit `update --host grokbot --global` command.
- **Conflicts are skipped, not overwritten.** On a fresh library, a pre-existing folder is adopted only if its complete file set matches the bundle byte for byte. Differing, extra, or unsafe folders and the skills depending on them are skipped and named; the rest install in one transaction.
- **Scripts must be allowed.** npm 11 blocks package scripts unless allowed, for example `npm install -g @uppercut-labs/skills@1.0.2 --allow-scripts=@uppercut-labs/skills` on the Bot computer. Where scripts stay blocked, run `uppercut-skills add <id> --host grokbot --global` there instead; explicit `add` refuses conflicts rather than skipping them.

A successful npm install alone does not prove the skills were copied. Check with `uppercut-skills doctor --host grokbot --global --json`. The user's Bot invoked `starter-pack` from an installed account library once; that report is the only Bot account-library acceptance on record.

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

The catalog is authored in the repository's `manifest/skills.json`. The bundled snapshot is compiled from pinned commits in three reviewed public source repositories. The package and approved bundled skill snapshots use [MIT](LICENSE); the [notice](NOTICE.md) records Starter Pack and VidChopper sources and the limits of the Starter Pack permission. Only public skills are bundled; the package contains no private skills and depends on none.

Each release is accepted by the repository's local [release gate](../../distribution/README.md#release-gate), which tests the exact tarball later uploaded to npm and GitHub. The gate verifies source and package behavior only. It does not prove a skill is registered or discovered in a particular host; native host results are recorded separately in the [release record](../../docs/skills-package/RELEASE.md), and hosts without recorded results are unverified.
