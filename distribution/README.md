# Stable skill bundle

`manifest/skills.json` is the authoring catalog. `source-policy.json` permits only the reviewed public skill roots; it is not a second skill index. `build-bundle.mjs` reads each catalog entry from its recorded commit, rejects non-commit revisions and unsafe tree objects, hashes every file, and writes the complete directory closure to `packages/skills-cli/src/generated/bundle.ts`.

Run the compiler from a checkout that has the recorded local commits and supply clean local checkouts of the two approved external repositories:

```sh
node distribution/build-bundle.mjs \
  --source-repo devin-thomas/starter-pack=/path/to/starter-pack \
  --source-repo devin-thomas/vid-chopper=/path/to/vid-chopper
```

Review the generated diff and resource links before including a new snapshot. A changed skill file needs a new recorded source commit in the canonical manifest. The compiler never executes bundled scripts or reads arbitrary source URLs.

Skill declarations are installed as `dvn.json`. The compiler normalizes the
legacy declaration filename from pinned snapshots while retaining its original
content bytes, hashes and source revision. It rejects resulting path collisions.

The package and approved bundled skill snapshots are MIT licensed; the package NOTICE records their source and attribution. Native host acceptance and final artifact checks remain release gates for the candidate.

For a packed MCP consumer check, install the tarball and `@modelcontextprotocol/server@2.3.0` in a clean directory,
copy `smoke-mcp-consumer.mjs` into that directory, and run it with Node.js. It verifies both protocol versions and
the installed package's `serve-mcp` command without exposing installation writers.

## Release gate

Releases do not depend on GitHub Actions. From a clean checkout of the candidate commit, run:

```sh
node distribution/release-gate.mjs --out ../skills-release-candidate
```

The gate clones the approved external sources fresh (or uses `--source-repo owner/repo=/path` checkouts after fetching them). It fails closed on any of these:

- a dirty tree, a pin that is not a published commit, or a pinned skill root that differs from its maintained source unless `snapshot-freezes.json` records why it is frozen;
- a bundle that does not rebuild byte-for-byte, a `dvn.json` declaration whose skill or resource hashes do not match, a public skill depending on a `private/` skill, or a NOTICE that does not name the external commits or still contains `PENDING-OWNER`;
- any repository validator or test failing, or a package version already published to npm.

It then packs one tarball and checks only that file: allowed package files, exact runtime dependencies, bundled bytes against pinned Git sources, a secret and owner-identifier scan, offline bundled installs, host-scope refusal without writes, and the packed CLI and read-only MCP consumer smoke. `release-record.json` and `RELEASE-RECORD.md` record the commit, tool versions, every result and the tarball SHA-256, and the `.sha256` sidecar is written beside the tarball. Native host registration is listed as unverified; record those results separately.

Publish that same tarball. Afterwards, compare what was published without rebuilding:

```sh
node distribution/release-gate.mjs --compare ../skills-release-candidate/release-record.json --npm <version>
node distribution/release-gate.mjs --compare ../skills-release-candidate/release-record.json --artifact <downloaded-github-asset.tgz>
```
