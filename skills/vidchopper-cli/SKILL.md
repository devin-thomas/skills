---
name: vidchopper-cli
description: Plan, review, export, and verify local video chapter clips with VidChopperCLI 1.2.0 and JSON/YAML ChapterFiles, including ChapterBuilder exports and embedded chapters. Use for read-only inspection, safe dry-runs, collision review, confirmed local export, and manifest verification on supported Windows and Apple Silicon macOS releases.
license: MIT
metadata:
  vidchopper.skill-contract-version: "1"
  vidchopper.cli-version: "1.2.0"
  vidchopper.chapterfile-schema-version: "1"
  vidchopper.export-manifest-schema-version: "1"
---

# VidChopper CLI

Keep the source video, ChapterFile, prompt, local paths, clips, and manifests on the user's machine.
Use a local-capable harness. Never upload media to bridge a remote runtime limitation.

## Protect the boundary

- Treat inspection and `--dry-run` as read-only. Do not install software, edit `PATH`, create settings,
  export clips, overwrite files, delete files, publish, or upload without the relevant confirmation.
- Require absolute, quoted paths and one explicit chapter source: JSON/YAML ChapterFile or selected
  embedded chapters.
- Ask again if the plan, output paths, collisions, encoder resolution, or command changes after approval.
- Never claim success from an exit code alone; verify every planned output and manifest.
- On macOS, never disable Gatekeeper globally or remove quarantine metadata as an installation shortcut.

## Require the 1.2.0 contract

Before export, require this tuple:

- `VidChopperCLI 1.2.0`
- ChapterFile schema `1`
- export-manifest schema `1`
- skill contract `1`

Supported end-user hosts are Windows 10/11 x64 and macOS 15+ on Apple Silicon. Intel macOS and end-user
Linux packages are outside the 1.2.0 release boundary; Linux source/CI qualification is not a public
end-user package.

Read-only prerequisite checks on Windows:

```powershell
& "C:\Tools\VidChopper\VidChopperCLI.exe" --version
ffmpeg -version
ffprobe -version
```

On macOS, use the extracted binary or installed user-local command:

```sh
./VidChopperCLI/VidChopperCLI --version
ffmpeg -version
ffprobe -version
```

```sh
~/.local/bin/vidchopper --version
ffmpeg -version
ffprobe -version
```

Require ffmpeg and ffprobe 6.1 through major 9.x. They are external dependencies and are never bundled
or auto-installed. Report detected CLI/tool paths and versions. Ask before downloading, installing, or
changing any tool.

## Respect platform settings and discovery

Default CLI settings are adjacent `VidChopperCLI.ini` on Windows and
`~/Library/Application Support/VidChopper/VidChopperCLI.ini` on macOS.

- `--config <path>` and `--config-path <path>` select one explicit CLI settings file.
- `--portable` selects the deterministic sidecar beside the executable.
- `--use-gui-config` explicitly imports GUI preferences; the CLI still writes only its own settings.

Do not combine an explicit config path with `--portable`. Do not invent `--ffmpeg` or `--ffprobe`
flags; tool paths are settings fields. The 1.2.0 resolver may use configured paths, `PATH`, Homebrew
locations on macOS, and standard Unix locations.

The macOS app and CLI are ad-hoc signed, not Developer ID signed or notarized. If macOS blocks a
browser-downloaded copy, use the documented per-app Finder/System Settings > Privacy & Security
approval flow. The standalone installer may install `~/.local/bin/vidchopper` without `sudo` and does
not edit shell startup files.

## Inspect inputs read-only

Confirm each source and ChapterFile is readable. Use `ffprobe` to inspect duration, streams, frame rate,
and embedded chapters without writing media. For directories, inventory the complete directory first
and allow only:

- N sources to one shared ChapterFile;
- N sources to N ChapterFiles paired by exact filename stem; or
- a source file/directory with explicitly selected embedded chapters.

Reject 1:N, duplicate stems, missing pairs, orphan ChapterFiles, and partial scans. Use
[references/chapterfile.md](references/chapterfile.md) for schema, ChapterBuilder, and pairing detail.

Preserve a ChapterBuilder-produced JSON/YAML ChapterFile unchanged. Do not translate it into an
invented shape. If ChapterBuilder itself is needed, trust only `devin-thomas/ChapterBuilder`, check
Releases live, and ask before downloading or building it.

## Plan before writing

Run one supported form with `--dry-run`.

```powershell
& "C:\Tools\VidChopper\VidChopperCLI.exe" `
  "C:\Media\event.mp4" `
  "C:\Media\event.chapters.json" `
  --dry-run

& "C:\Tools\VidChopper\VidChopperCLI.exe" chop `
  "C:\Media\event.mp4" `
  "C:\Media\event.chapters.json" `
  --dry-run

& "C:\Tools\VidChopper\VidChopperCLI.exe" `
  "C:\Media\meeting.mkv" `
  --embedded `
  --dry-run
```

macOS examples:

```sh
./VidChopperCLI/VidChopperCLI \
  "/Volumes/Media/event.mp4" \
  "/Volumes/Media/event.chapters.json" \
  --dry-run

~/.local/bin/vidchopper \
  "/Volumes/Media/meeting.mkv" \
  --embedded \
  --dry-run
```

Require `Planned chapters: N`. Confirm the dry-run created no settings file, output directory, clip, or
manifest. Capture the chapter source, effective settings, output directory, every `Segment:` path,
every `Existing output:` value, manifest paths, resolved encoder, and planned ffmpeg commands.
`output.folder` is a sanitized sibling-folder pattern, not an arbitrary destination.

## Review the resolved encoder

Treat encoder selection as part of the plan.

- Windows Auto uses HEVC NVENC only after its real capability test passes; otherwise it resolves to x264.
- Apple Silicon macOS Auto uses HEVC VideoToolbox only after a real capability encode passes; otherwise
  it resolves to x264 before export.
- Explicit hardware-backend failure blocks export. Do not silently change the stored preference or
  retry a started chapter with x264.
- `--crf` tunes x264 but does not select it. `--cq` tunes NVENC when NVENC is selected but does not
  select NVENC. `--preset` does not authorize a backend change.

If the resolved backend changes after dry-run, stop and obtain fresh approval.

## Gate and run the export

Present one compact review with versions, host/platform, settings mode/path, source and chapter source,
chapter count, resolved encoder, one-run overrides, exact output directory/files, collisions, manifest
locations, overwrite behavior, and the exact command without `--dry-run`.

Stop on every `Existing output: yes`. The 1.2.0 CLI has no released `--existing-output` or arbitrary
output-directory flag. Prefer a fresh sibling output folder; otherwise require approval for each listed
overwrite. A broad approval does not authorize unlisted paths. Immediately before export, recheck every
destination and obtain fresh approval if anything changed.

After approval, run the reviewed command with only `--dry-run` removed. Do not add unsupported flags or
silently change settings, backend, chapter source, or output plan. Preserve bounded stdout/stderr and
the numeric exit code. Read [references/cli.md](references/cli.md) before optional flags, settings,
batch modes, or tool-failure diagnosis.

## Verify the result

Before reporting success, require:

1. exported/skipped/failed counts match the reviewed plan;
2. every planned clip exists at its exact path;
3. every expected `vidchopper-manifest.json` has `jobStatus: success`;
4. segment/output counts equal the dry-run chapter count and every `processState` is `success`;
5. `ffprobe` reports every clip within one second of planned duration; and
6. approved aggregate JSON/CSV manifests exist and reconcile with per-job results.

Use [references/manifests.md](references/manifests.md) for detailed verification. Do not delete partial
outputs or retry writes without a new decision.

## Handle failures exactly

- Exit `0`: verify files and manifests before success.
- Exit `1`: report usage/validation failure; change only approved input and dry-run again.
- Exit `2`: withhold overall success; inventory preserved clips and manifest/export errors.
- Exit `3`: report the executable, source, process state, and bounded ffprobe/ffmpeg-start error.

Never hide a nonzero exit behind partial success. Distinguish failed start, timeout, crash, and nonzero
tool exit. A manifest-write failure may leave valid clips; keep and report them.

## Work offline or stop on mismatch

Prefer the compatible release/skill copy, then a verified local copy, then
`https://vidchopper.app/agents/vidchopper-cli/SKILL.md`. The `v1.2.0` agent-skill package contains this
skill and its adjacent manifest. Verify the exact version tuple and SHA-256 metadata before replacing a
trusted cached copy.

When offline, use the bundled schema and examples. If no compatible verified copy exists, stop rather
than inventing commands. Treat same-origin digests as transfer-integrity checks, not publisher identity.

## Load only what is needed

This entry covers the core inspect, dry-run, confirmation, export, and verification workflow.

- Read [references/cli.md](references/cli.md) for released flags, settings, directories, encoders, and exits.
- Read [references/chapterfile.md](references/chapterfile.md) for schema and ChapterBuilder inputs.
- Read [references/manifests.md](references/manifests.md) for post-export verification.
- Use `assets/chapter-config.schema.json` and bundled examples for offline validation and practice.
