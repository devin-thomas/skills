# Skills npm release

The final public version is `@uppercut-labs/skills@0.1.0` on npmjs.com. The
source repository is `devin-thomas/skills`; the npm scope identifies the
publisher, not the GitHub repository owner.

## Native acceptance preview

The reviewed `0.1.0-rc.0` tarball was published under the npm `next` dist-tag.
npm also assigned `latest` to this first package version automatically; an
attempt to remove that tag returned 403. Treat both tags as prerelease pointers
until the final version is qualified. Do not merge the draft PR for this preview. On the
Bot's own execution computer, install `@uppercut-labs/skills@next` globally,
confirm that lifecycle scripts were permitted, and run
`uppercut-skills doctor --host grokbot --global`. Verify native skill discovery,
invocation by name, and a sibling resource; then test update and managed remove.
Record the exact preview version, registry integrity, and Bot-side result.
If the lifecycle was blocked, run the explicit `uppercut-skills add` route on
that same computer and record that separately. Test the other advertised hosts
on their own native surfaces before promoting the final release.

## Candidate gate

1. Confirm the selected collection license and the rights notices for every
   bundled skill. Keep the Starter Pack grant scoped to the bundled skills; its
   upstream repository has its own rights notice.
2. Record real-host acceptance for every advertised route, including Grok Bot
   project and account scopes. Filesystem tests and a Bot-reported path are
   useful evidence but do not prove native discovery or invocation.
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
