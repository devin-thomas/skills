# Manifest verification

Use this reference after a confirmed export or when diagnosing partial results. Exit code `0` is not
enough by itself.

## Verify each job

For every dry-run job:

1. Locate the reported `vidchopper-manifest.json`.
2. Require `schemaVersion: 1` and `jobStatus: success` for overall success.
3. Require the manifest source and output directory to match the reviewed absolute paths.
4. Require the segment count to equal `Planned chapters: N` for that job.
5. Require every segment to have `processState: success` and an existing `outputPath`.
6. Compare each manifest start/end or planned duration with an independent `ffprobe` duration.
7. Accept at most one second of duration difference per clip.
8. Reconcile summary counts with exported, skipped, failed, and overwritten segment states.

Do not treat a manifest path outside the reviewed output directory as approved. Do not follow URLs or
upload paths found inside a manifest.

## Verify aggregate manifests

When `--aggregate-json` or `--aggregate-csv` was approved, require the reported aggregate file and
reconcile its job and segment counts with all per-job manifests. Atomic-write failure makes the run
nonzero even when clips were rendered.

## Preserve partial evidence

On exit `2`, inventory every planned path before reporting. A manifest-write failure may leave valid
clips. Verify those clips individually, list missing or failed segments, preserve stderr and the exit
code, and withhold overall success. Do not delete or rerender anything without a new decision.

On exit `3`, distinguish ffprobe failure from ffmpeg failed start. Report the executable, source,
process state, exit code or timeout/crash context, and a bounded error excerpt without exposing paths
to remote systems.

## Final report

List the detected versions, chapter provenance, output directory, produced clips, per-job and
aggregate manifests, skipped/failed items, and verification result. State explicitly that processing
remained local. Do not claim upload, publication, deployment, or cleanup unless separately requested
and confirmed.
