# Usage, cost, and quota evidence

Read only when the user requests usage, cost, quota, or a model comparison.

## Capture all attempts

Retain exposed usage, cost, duration, and model fields with their original names,
attempt/session ID, and terminal outcome. Include failed attempts that expose
partial usage. Preserve sanitized usage-only evidence and its capture time.

Use null/unknown with a reason for absent fields. Do not sum cumulative stream
snapshots, double-count per-message/per-model/session totals, or transfer a later
attempt's totals to an earlier one. Mark incomplete aggregates.

Separate elapsed intervals from nested timings. Record setup, worker, parent
verification, and publication when measuring end-to-end work; overlapping stage
durations cannot be added into a meaningful total.

**Complete when:** every attempted run is represented and coverage is explicit.

## Distinguish three different claims

| Measurement | Valid interpretation |
| --- | --- |
| Per-run token/usage fields | What the CLI reports for that run, with its aggregation limits. |
| Cost field or calculated estimate | A dated vendor estimate or API-equivalent estimate under the stated billing route. |
| Account quota surface | A timestamped observation of the displayed account window and reset information. |

A subscription session's API-equivalent estimate is not its invoice or proof of
an additional API charge. For an API-billed route, distinguish estimates from
actual billing records. Obtain current prices from official sources if an
estimate is requested; this skill pins no price table.

Use a supported account-usage surface for quota. Capture real before/after values
only when observed at those times. Current quota cannot reconstruct a historical
run's usage share or exclude other account activity. Another generation call
does not recover missing historical measurements.

**Complete when:** token accounting, estimated cost, and account quota are clearly
separated, and the report contains no invented zeroes or historical deltas.
