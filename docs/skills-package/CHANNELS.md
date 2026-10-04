# Content channels, provenance, and updates

## Two versions, two meanings

The npm version identifies installer code and its embedded stable snapshot. Skill source versions identify content.

```sh
# Proposed commands after implementation:
npx @uppercut-labs/skills@0.1.0 add quick-build
npx @uppercut-labs/skills@0.1.0 add quick-build --latest
npx @uppercut-labs/skills@0.1.0 update
```

The second command changes the saved content channel to GitHub for that root; the third follows that saved choice.
The installer version can remain 0.1.0 throughout. By contrast, `npx @uppercut-labs/skills@latest` selects the latest
npm installer. These two uses of "latest" must not be conflated in help or tests.

## Bundled channel

A new install without a saved choice uses `bundled`. It uses only the stable bundle shipped in the running package.
The npm package includes a compiled catalog, complete resource closures, upstream commit IDs, file hashes,
license/attribution records, and schema versions. Once the npm package is available locally, installation can work offline.
An old bundle remains old by design; do not secretly contact GitHub to call it fresh. Updating the CLI can provide a new
bundled snapshot. A previous GitHub-channel install is not downgraded merely because an older CLI is invoked.

## GitHub channel

`--latest` and `--channel github` are the same choice. Resolve the canonical manifest from the allowed catalog
repository once per invocation, then resolve each selected allowed source repository's approved `sourceRef` to
one immutable commit. Reuse that commit for every file and skill from that repository in this transaction.
Compute dependencies from that one catalog view. Fetch a complete declared skill/resource closure at the pinned
commits, not loose files from moving `main` URLs. Record all resolved revisions before writes.

The catalog's `sourceRevision` records authoring provenance and is retained. A GitHub-latest operation deliberately
resolves the approved moving `sourceRef`; otherwise stale catalog provenance could incorrectly prevent content updates.
The bundled compiler uses explicit verified snapshot pins. Treat a 40-character string as a commit only after verifying
its object type through the source provider. Reject unsupported source refs instead of accepting arbitrary user refs.

## Allowed sources

The current owned catalog references `devin-thomas/skills`, `devin-thomas/starter-pack`, and `devin-thomas/vid-chopper`.
Approve those source identities and their public skill subtrees in distribution policy. Only catalog-selected skill
roots and explicitly declared supporting resources may be included. Reject a manifest pointing outside the allowed
identity/path set even when it says `ownedBy: devin-thomas` or `public: true`.

The CLI accepts skill IDs, not repo URLs. Updates cannot expand the allowed repository set silently. A newly cataloged
skill inside an already approved source subtree can ship through the content channel after validation without an npm
rerelease. A new source repository or unsupported schema is a compatibility change requiring reviewed installer policy.

## Failure, cache, and trust

A requested GitHub refresh that fails leaves installed bytes/state unchanged and reports the source error; it never
silently falls back to bundled and calls that current. An existing complete verified snapshot may be reused only under
explicit offline/cache semantics that report the actual age/revision. Do not add background refresh jobs.

Bound request counts, timeouts, retries, file count, expanded size, and nesting. Validate HTTPS destinations and redirects;
never forward credentials to unrelated origins. Public reads require no login. Do not request a new token scope to make
an ordinary install succeed. Rate limits are actionable source errors.

Commit pinning and digests establish snapshot identity and detect corruption; they do not prove a trusted author's
content is harmless. No install-time execution, install hooks, automatic host permission changes, or signature claims
without actual verification. The public bundle must exclude credentials, private preferences, host receipts, and source
files outside its declared public resource closure.

## Shared dependency revisions

A transaction calculates the union of selected and retained managed roots. A dependency needed by both is one compatible
physical installation. Conflicting source/channel requirements fail before writes rather than mixing two versions in one
folder. Keep the previous coherent set until the conflict is resolved. Test this explicitly across shared host locations.
