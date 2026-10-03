# Stable skill bundle

`manifest/skills.json` is the authoring catalog. `source-policy.json` permits only the reviewed public skill roots; it is not a second skill index. `build-bundle.mjs` reads each catalog entry from its recorded commit, rejects non-commit revisions and unsafe tree objects, hashes every file, and writes the complete directory closure to `packages/skills-cli/src/generated/bundle.ts`.

Run the compiler from a checkout that has the recorded local commits and supply clean local checkouts of the two approved external repositories:

```sh
node distribution/build-bundle.mjs \
  --source-repo devin-thomas/starter-pack=/path/to/starter-pack \
  --source-repo devin-thomas/vid-chopper=/path/to/vid-chopper
```

Review the generated diff and resource links before including a new snapshot. A changed skill file needs a new recorded source commit in the canonical manifest. The compiler never executes bundled scripts or reads arbitrary source URLs.

The current package remains private while the collection license and native host acceptance are resolved.
