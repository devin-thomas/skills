# Released CLI contract

Use this reference for VidChopperCLI 1.2.0 invocation, optional flags, platform settings, tool
discovery, encoder resolution, batch pairing, and failures. Do not document proposed flags as released
behavior.

## Contents

- [Invocation forms](#invocation-forms)
- [Released flags](#released-flags)
- [Settings and tool discovery](#settings-and-tool-discovery)
- [Encoder resolution](#encoder-resolution)
- [Outputs and collisions](#outputs-and-collisions)
- [Directory pairing](#directory-pairing)
- [Exit and failure handling](#exit-and-failure-handling)

## Invocation forms

Use exactly one explicit chapter source:

```text
VidChopperCLI <input-video> <chapters.json|chapters.yaml> [options]
VidChopperCLI <input-video> --embedded [options]
VidChopperCLI chop <input-video> <chapters.json|chapters.yaml> [options]
```

The Windows release executable is `VidChopperCLI.exe`. The Apple Silicon macOS release contains
`VidChopperCLI`; its installer may expose the same tool as `~/.local/bin/vidchopper`. The direct and
`chop` forms have the same chapter-config behavior. Use `--embedded` only after the user selects
detected embedded chapters.

Use absolute, quoted paths. PowerShell example:

```powershell
& "C:\Tools\VidChopper\VidChopperCLI.exe" `
  "C:\Media\event.mp4" "C:\Media\event.chapters.json" `
  --dry-run
```

macOS example:

```sh
./VidChopperCLI/VidChopperCLI \
  "/Volumes/Media/event.mp4" \
  "/Volumes/Media/event.chapters.json" \
  --dry-run
```

## Released flags

| Flag | Value | Released behavior |
| --- | --- | --- |
| `--embedded` | none | Explicitly use chapters embedded in each input video. |
| `--dry-run` | none | Probe and print the complete plan without writing settings, output, manifests, or clips. |
| `--config` | path | Use the supplied file as the sole CLI settings store for this run. |
| `--config-path` | path | Alias for `--config`. |
| `--portable` | none | Use the deterministic settings sidecar beside the executable. Do not combine with `--config`. |
| `--crf` | `0..51` | Override x264 CRF for this run. This does not select x264. |
| `--cq` | `0..51` | Override NVENC CQ when NVENC is selected. This does not select NVENC. |
| `--preset` | name | Apply the current encoder preset override. This does not select a backend. |
| `--threads` | `0..255` | Override ffmpeg threads; `0` uses ffmpeg's default. |
| `--aggregate-json` | path | Write one atomic run-level JSON manifest. |
| `--aggregate-csv` | path | Write one atomic run-level CSV manifest. |
| `--stop-on-first-error` | none | Stop batch execution after the first failed item. |
| `--use-gui-config` | none | Explicitly import GUI settings before CLI-owned settings. |
| `--version` | none | Print the installed VidChopperCLI version; the 1.2.0 release prints `VidChopperCLI 1.2.0`. |
| `--help` | none | Print help; `-h` is the short form. |

There is no released `--existing-output`, output-directory, `--ffmpeg`, or `--ffprobe` flag. Never
invent one.

## Settings and tool discovery

Resolve the CLI settings location first.

- Windows default: `VidChopperCLI.ini` adjacent to the executable.
- macOS default: `~/Library/Application Support/VidChopper/VidChopperCLI.ini`.
- `--config` and `--config-path` select one explicit settings file.
- `--portable` selects the deterministic sidecar beside the executable.

Explicit and portable modes cannot be combined. An explicit settings file is the sole CLI settings
store and does not import GUI settings. `--use-gui-config` explicitly reads GUI settings before
CLI-owned settings; the CLI never writes the GUI file.

Resolve settings from lowest to highest precedence:

1. built-in CLI defaults;
2. optional GUI import, only with `--use-gui-config`;
3. CLI-owned `VidChopperCLI.ini`;
4. ChapterFile `output` and `encoder` fields; and
5. explicit CLI flags.

Dry-run reads settings but creates nothing. A normal run may create the CLI settings file if needed.
A settings failure is visible; do not silently switch to another config boundary.

FFmpeg and ffprobe are external dependencies. VidChopper 1.2.0 supports 6.1 through major 9.x. Tool
discovery may use explicit configured paths, `PATH`, Homebrew locations such as `/opt/homebrew/bin` or
`/usr/local/bin`, and standard Unix locations. The selected executable must exist, be executable,
launch `-version`, report a parseable supported version, and match the expected tool kind. A supported
ffmpeg/ffprobe version mismatch continues only with a visible warning containing both paths and
versions. VidChopper never auto-downloads or auto-installs the tools.

## Encoder resolution

Treat the dry-run's resolved backend as part of the plan.

- Windows Auto uses HEVC NVENC only when the supported NVIDIA capability path passes its real encode
  test. Otherwise Auto resolves to x264 before export.
- Apple Silicon macOS Auto uses HEVC VideoToolbox only when its real capability encode succeeds.
  Otherwise Auto resolves to x264 before export.
- An explicitly selected hardware backend that fails capability validation blocks export. Do not
  silently alter the stored preference.
- Do not start a chapter on hardware and retry it with x264 after failure.
- `--crf`, `--cq`, and `--preset` tune effective settings; they do not authorize selecting a backend
  different from the resolved plan.

If the resolved backend changes after dry-run, require a fresh review before writing.

## Outputs and collisions

Dry-run renders the effective overwrite mode and reports every planned path as
`Existing output: yes|no`. Block on every `yes`, recheck destinations after approval, and prefer a
fresh output folder. `output.folder` is sanitized into a sibling folder of the source; there is no
released arbitrary output-directory flag.

Each job writes `vidchopper-manifest.json` by default. Settings may also enable per-job CSV.
`--aggregate-json` and `--aggregate-csv` add run-level manifests; their writes are atomic and a failed
manifest write makes the CLI nonzero.

## Directory pairing

Inventory the whole directory before deciding the mode. Supported modes are:

- N:1: a source directory plus one shared ChapterFile;
- N:N: a source directory plus ChapterFile directory, paired by case-insensitive exact stem; or
- embedded: a source file/directory plus `--embedded`.

Supported source extensions are `.mp4`, `.mkv`, and `.mov`. Supported ChapterFile extensions are
`.json`, `.yaml`, and `.yml`. Reject 1:N, duplicate stems, count mismatches, missing pairs, orphans,
and partial scans. In an embedded directory batch, the CLI may skip sources without chapters; report
those skips explicitly.

## Platform boundary

VidChopperCLI 1.2.0 is published for:

- Windows 10/11 x64; and
- Apple Silicon macOS 15 or newer.

Intel macOS is not qualified. Linux source and CI qualification do not constitute a supported 1.2.0
end-user package.

The macOS app and CLI are ad-hoc signed, not Developer ID signed or notarized. A browser download may
need the per-app Finder/System Settings > Privacy & Security approval flow. Never disable Gatekeeper
globally or remove quarantine metadata as an installation shortcut. The standalone installer may
place the CLI at `~/.local/bin/vidchopper` without `sudo`; it does not edit shell startup files.

## Exit and failure handling

| Code | Meaning | Required response |
| ---: | --- | --- |
| `0` | Successful command | Verify planned files and manifests before success. |
| `1` | Usage, path, ChapterFile, or plan validation failure | Preserve the error, correct only approved input, and dry-run again. |
| `2` | Dry-run path inspection, ffmpeg/export, or manifest failure | Withhold overall success and inventory preserved successful clips. |
| `3` | ffprobe failure or ffmpeg failed start | Report tool, source, process state, exit detail, timeout/crash context. |

Preserve bounded stderr and the numeric exit. Distinguish failed start, timeout, crash, and nonzero
tool exit. Never translate ChapterBuilder data or silently retry with different flags. When a batch
continues after a failure, verify each job independently rather than flattening it into one result.
