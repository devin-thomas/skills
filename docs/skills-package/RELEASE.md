# Skills npm release

The final public version is `@uppercut-labs/skills@0.1.0` on npmjs.com. The
source repository is `devin-thomas/skills`; the npm scope identifies the
publisher, not the GitHub repository owner.

Released from source tag `v0.1.0` at `c5f4358bfff6c9d97995e19915b15baeea2f2b17`.
The reviewed and registry-downloaded 74-file archive has SHA-256
`a86386d38125e978a6b835f184f3a7ed8097e3ac24dd0d5b02f2eb1cd9b48055`.
The [GitHub release](https://github.com/devin-thomas/skills/releases/tag/v0.1.0)
includes that archive and `SHA256SUMS`; npm `latest` points to `0.1.0`.

## Native acceptance

The user's Grok Bot installed `0.1.0-rc.2` globally and invoked `starter-pack`
from its account library, while leaving a conflicting `grill-to-build` folder
unmanaged. Devin reports testing the remaining harnesses and has authorized
merge and final publication. The Bot screenshots are retained in the task;
detailed versions and results for the other hosts were not supplied. Keep that
distinction in release notes and future support reports.

## Candidate gate

1. Confirm the selected collection license and the rights notices for every
   bundled skill. Keep the Starter Pack grant scoped to the bundled skills; its
   upstream repository has its own rights notice.
2. Record the owner's acceptance of the remaining advertised hosts separately
   from the Bot account-library invocation shown in the supplied screenshots.
3. Confirm the candidate commit is on `main`, the tree is clean, and the
   `Skills CLI` checks passed on that commit.
4. In a clean checkout of that commit, run `npm ci`, the repository validators,
   `npm test`, and `npm run smoke` from `packages/skills-cli` as applicable.
   Review the actual `npm pack --json` file list, package metadata, license,
   notices, and the packed consumer result. Retain the exact `.tgz`, its SHA-256,
   source commit, and Node/npm versions outside the repository.

## Publish the reviewed artifact

1. Check that `@uppercut-labs/skills@0.1.0` is absent from npmjs.com. A network
   or authentication failure is not proof that a version is available.
2. Publish the retained tarball to the public npm registry with the authorized
   `uppercut-labs` account. Do not rebuild a different archive for publication.
3. Verify `npm view @uppercut-labs/skills@0.1.0` and install that exact version
   in a new consumer. Compare its registry integrity and packed file list with
   the candidate, then run `list`, an offline bundled add/doctor/remove flow,
   and the read-only MCP consumer check with its optional peer installed.
4. Tag the reviewed source commit `v0.1.0` and create a GitHub release with the
   candidate tarball and checksum. Record the registry URL, source commit,
   tarball digest, and native-host acceptance evidence in the release notes.

If npm accepts the package but a later verification step fails, treat it as a
partial release. Inspect the registry before retrying; npm versions cannot be
replaced in place.
