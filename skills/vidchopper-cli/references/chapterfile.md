# ChapterFile and ChapterBuilder contract

Use this reference to choose and validate a chapter source without changing its meaning.

## Select one source

Require exactly one of:

- a JSON, YAML, or YML ChapterFile using schema version `1`; or
- user-selected chapters already embedded in the source video.

Do not infer embedded mode from omission. If inspection finds embedded chapters, show the user the
choice and use `--embedded` only after selection. If none exist, require a ChapterFile.

## Validate schema version 1

Use `../assets/chapter-config.schema.json` offline. The canonical immutable route is
`https://vidchopper.app/schemas/chapter-config/v1/schema.json`, but the CLI does not fetch `$schema`.
Never let a missing or mismatched network copy replace the bundled schema.

Require 1 to 255 chapters and reject unknown fields. Validate:

- optional top-level `version` equals `1`;
- `chapters[].name` is non-empty and every chapter lasts at least one second;
- every `start` is earlier than its `end`;
- chapters are ordered and non-overlapping;
- timestamps use `MM:SS`, `MM:SS.mmm`, `HH:MM:SS`, `HH:MM:SS.mmm`, or non-negative milliseconds;
- minutes and seconds are `0..59`, with one to three fractional digits;
- the final end does not exceed the probed source duration;
- `crf`/`cq` are `0..51` and `threads` is `0..255`; and
- `output.folder` uses only `%source%`, while `output.namingPattern` uses only `%index%`, `%name%`,
  and `%source%`; the `1.2.0` CLI sanitizes but does not reject unknown placeholders.

Validate structure with the schema and timeline rules with the CLI dry-run. A `$schema` value is an
editor hint and provenance; it is not proof that validation happened.

## Use the bundled examples

- `../assets/chapter-config.example.json` and `.yaml` are equivalent small starter files.
- `../assets/chapterbuilder-tns-2xko-36.json` is the byte-identical ChapterBuilder compatibility
  fixture with 16 chapters and a timeline ending at `03:09:51`.

Use examples only with a source long enough for their final timestamp. Do not substitute private user
paths into remote URLs or issue comments.

## Preserve ChapterBuilder handoff

Accept a ChapterBuilder export unchanged when it passes schema and timeline validation. Keep all
game-specific text inside normal `name` and `outputName` fields. Do not require ChapterBuilder after
the file is exported and do not scrape its GUI.

When installation is actually needed, trust only `https://github.com/devin-thomas/ChapterBuilder`.
Check Releases live before offering a download and verify any published checksum. Never invent a
release; offer a source build only after explicit approval when no suitable release exists.

## Inspect directories completely

For source and config directories, enumerate all supported files before probing. Use one shared file
for N:1, or exact filename stems for N:N. Reject 1:N, duplicate stems, missing ChapterFiles, orphan
ChapterFiles, and count mismatches. Apply the collision and confirmation gate to every resolved job.
