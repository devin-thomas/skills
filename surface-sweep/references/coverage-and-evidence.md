# Coverage and evidence

Read when planning a sweep and recording its results. Use the repository's existing evidence format where equivalent; the fields below define meaning, not a mandatory framework.

## Matrix

Each case has: ID, surface/route, initial fixture and role, action sequence, expected visible result, browser engine, CSS viewport, device scale, theme/OS scheme, assertions, capture kinds, and disposition. Use stable IDs rather than screenshot filenames as identity.

Use `planned`/`not-executed` during preparation; final sweep dispositions must reconcile these to executed results, blockers, or reasoned exclusions. A user-requested planning-only exercise reports zero executions and does not claim a completed sweep. Report parameterized case families separately from expanded case IDs; neither planned families nor retries count as executed unique cases.

Inventory applicable categories:

| Surface | States and transitions that frequently expose defects |
| --- | --- |
| Shell/navigation | First load, active tab, collapsed/expanded navigation, deep link, back/forward, scrolled content, theme persistence |
| Lists/details | Empty, one item, typical and dense lists, long unbroken text, multiline notes, filter/no results/clear, pagination, missing optional metadata |
| Editors/configurators | Every mode, selected/unselected options, min/max values, long input, linked controls, reset/undo, preview updates, persistence/reload |
| Forms/overlays | Open, focus entry, invalid submit, corrected input, pending, success, error/retry, close/reopen, bottom actions, scroll locking and focus restoration |
| Account/permissions | Signed out, supported signed-in roles, protected navigation, unavailable/expired session, role-specific controls |
| Async/provider flows | Slow response, expected rejection, network failure, retry, stale/expired data, duplicate click prevention; label mocked versus live |

Apply actual product limits: test accepted maxima and one invalid input when validation is in scope. Include real-shaped synthetic fixtures as well as adversarial strings; a showcase-friendly example alone is weak QA. Do not silently replace a requested exact fixture with an approximation.

Separate the current source behavior from the intended acceptance condition. Resolve exact assertions from the product contract, domain rules, or established tests; an existing misleading success message is not its own correctness oracle. If the needed contract is unavailable within scope, record that uncertainty and continue independent coverage rather than inventing an expected value.

Freeze or inject fixture time where dates, countdowns, renewals, or expiry affect states. Record timezone and locale when formatting matters. Keep identical data across before/after comparisons; wall-clock-relative fixtures otherwise change the image without a product change.

Cover critical state transitions at desktop and mobile, every supported layout/theme on representative surfaces, and vulnerable components across their breakpoint edges. For omitted combinations record why sampled coverage is sufficient. A broad sweep has no fixed screenshot quota.

## Capture manifest

Keep one run manifest with target URL/environment, source revision and dirty-tree note, timestamp, startup/test commands, browser/version/OS, fixture version/seed, capture stabilization policy, and cases. Keep private session files and raw diagnostic payloads out of public artifacts.

For each case record:

```json
{
  "id": "editor-validation-phone",
  "surface": "/editor",
  "state": "invalid-submit",
  "fixture": "synthetic-long-title-v1",
  "role": "local-test-user",
  "viewport": { "width": 390, "height": 844 },
  "deviceScaleFactor": 2,
  "browser": "chromium",
  "theme": "light",
  "osScheme": "light",
  "providerMode": "mocked",
  "attempt": 1,
  "status": "failed",
  "readiness": "passed",
  "assertions": { "errorVisible": "passed", "actionsReachable": "failed" },
  "visualReview": "reviewed",
  "captures": [{ "kind": "viewport", "path": "before/editor-validation-phone.png", "rasterWidth": 780, "rasterHeight": 1688 }],
  "findings": ["UI-003"]
}
```

This is an illustrative failed case, not proof of a run. Add diagnostics and rerun evidence in the project's format. Use `not-reviewed` until inspection occurs. Capture failure or unavailable auth is `blocked`/`failed`, never a pass. Exclusions need a reason and must appear in the denominator explanation.

## Findings and report

Each finding records symptom and impact, affected cases, severity, before image, reproduction, root cause, changed source, regression check, after image, and final disposition. Prioritize blocked tasks/data loss, inaccessible actions, overlap/clipping, and then proportions/spacing. If no product fix is needed, state that conclusion with actual review coverage.

Report distinct counts: planned cases; unique executed cases; passed/failed/blocked/excluded; captured states; inspected states; product findings fixed/open; harness findings fixed/open. List browser and physical-device gaps. An 80-image run with five reviewed images is five reviewed images.

Keep raw captures/logs in ignored or external run directories. Retain minimal approved regression baselines according to repo policy. Curated public assets belong only to the showcase workflow. Do not commit an entire transient corpus just to preserve a screenshot count.
