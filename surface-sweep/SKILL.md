---
name: surface-sweep
description: "Broad visual QA and correction for existing web apps. Use for browser sweeps, responsive overflow, broken interaction states, awkward proportions, or screenshot-backed UI polish across product surfaces. Do NOT use for screenshot collection alone, a new visual identity, backend-only testing, or a public showcase; use surface-sweep-showcase when a showcase is requested."
---

# Surface Sweep

Deliver corrected product surfaces with reproducible browser evidence. A passing test suite or a large screenshot directory does not establish visual quality.

## 1. Establish the product and execution contract

Inspect repository instructions, working-tree state, design authority, routes, component variants, existing browser tests, fixtures, and run commands. Preserve the app's visual language. Reuse Playwright or Puppeteer already present; otherwise select a permitted browser harness suited to repeatable state setup and assertions. Follow the current tool's API and restrictions; these instructions do not grant additional browser capabilities.

Identify local/preview/production targets and provider dependencies. Prefer isolated local fixtures for mutations. Label mocks and seeded sessions as simulated evidence. Do not put test-only auth or fixture bypasses into production. Carry out already-authorized delivery; a sweep alone does not authorize purchases, messages, production records, or deployment.

Verify that the running server serves the intended checkout and fresh build. If watching/HMR is disabled or stale, restart only the identified task-owned process and confirm a changed marker before judging post-fix captures.

**Done when:** the target revision, design authority, run command, fixture mechanism, browser capabilities, and external-action boundary are recorded in the run's evidence.

## 2. Inventory surfaces and state transitions

Read [coverage-and-evidence.md](references/coverage-and-evidence.md) to create a finite coverage matrix and capture manifest. A **surface** is a route or distinct user-visible state: menus, dialogs, drawers, tabs, editors, validation, and recovery states count even without a URL change.

Inventory from both source and browser navigation. Include every in-scope route and primary workflow, then expand high-risk combinations: layout modes, themes, permissions, long content, data density, short viewports, and asynchronous results. Exercise actions that enter, change, leave, and recover each state. Use exact expected content or outcomes, not merely nonempty output.

Distinguish source-implemented, entry-wired, and browser-reachable surfaces. For dormant components, locate the intended entry or test in an isolated component harness when in scope; otherwise record a reasoned exclusion or unresolved reachability. Do not add a production route solely to obtain coverage.

Start with representative desktop, tablet, phone, and narrow supported widths (often 1440, 768, 390, and 320 CSS pixels). Add both sides of actual breakpoints and short-height/landscape views where controls or overlays are constrained. Enumerate all supported theme choices; test System against both OS schemes. Do not invent a dark theme for a single-theme app.

Use risk-based combinations outside critical paths instead of multiplying every axis blindly. State omissions explicitly. Assign stable case IDs and expected assertions before running. If delegation is available, split independent route families or visual review with isolated fixtures and output paths; retain one owner for shared CSS and the final matrix.

**Done when:** every inventoried surface has case IDs or a reasoned exclusion, every primary transition has an expected result, and high-risk combinations are explicit.

## 3. Capture trustworthy evidence

Before implementing a capture harness, read [browser-checks.md](references/browser-checks.md). Use its readiness contract, geometry probes, and diagnostic guidance with the existing test runner.

Observe console errors, uncaught exceptions, failed requests, and relevant HTTP failures before navigation. Assert application readiness, exact fixture state, actual theme, required fonts, and image decode. Use bounded waits tied to state. Preserve intentional loading/error states with controlled fixtures. A missing asset is a failure to diagnose, not permission to hide it.

Capture full-page context plus viewport images for sticky controls, menus, dialogs, and focused editing; add component crops for dense details. Restore scroll position after preparing lazy assets. Ordinary captures close incidental menus, while menu-open cases keep them open deliberately. Do not remove product UI or change product styles to make a capture pass. Record any capture-only suppression of development chrome or animation stabilization.

Write artifacts under unique run/case/attempt paths, using test-runner output paths where available. Record CSS viewport separately from raster dimensions and device scale. Keep before evidence when fixing a defect; never silently overwrite it with a later attempt.

**Done when:** every executed case has reproducible state setup, readiness results, diagnostics, assertions, and traceable images, or a recorded capture failure.

## 4. Inspect and correct

Inspect every capture counted as reviewed using an image-capable tool. Contact sheets help triage; inspect each state at a readable scale and open full-resolution crops for dense text, controls, or suspected defects. If images cannot be inspected, keep visual review incomplete. Screenshots are evidence, not assertions by themselves.

Review hierarchy, spacing, readable proportions, text wrapping, icon containment, card density, preview/control balance, scroll effort, sticky obstruction, stacking, contrast, and state feedback against the existing design. Test pointer, touch emulation, and keyboard behavior: visible focus, tab order, selection, Escape, focus return, outside clicks where intended, input retention, disabled/pending controls, and recovery. Test real zoom or assistive technology only when available; narrow-width emulation is not proof of either.

Record each finding with case ID, severity, symptom, before image, reproduction, root cause, and verification condition. Classify product defects separately from fixture/harness defects before changing code.

Fix root causes in shared components/styles, then check their consumers. Prefer reflow and content-aware sizing over shrinking text, hiding controls, clipping glyphs, or global overflow suppression. Preserve all actions when adapting a desktop table into mobile cards. Keep useful error feedback visible; collapse routine detail only when it obstructs the workflow and preserves semantics.

Add regression assertions that would fail on the observed defect: child-inside-button geometry, non-overlap, reachable dialog actions, exact state changes, or a reviewed focused visual baseline. Never approve a visibly broken baseline or weaken an assertion to accept a regression.

**Done when:** every inspected defect is corrected and linked to a regression check, or remains explicitly unresolved with its reason and impact. Unresolved in-scope defects prevent an unqualified completion claim.

## 5. Recheck and hand off

Rerun corrected cases, shared-component consumers, and the final coverage matrix against the resulting revision. Recapture affected evidence and inspect it again. Run relevant existing build, type, lint, and test checks. When fixing capture instability, demonstrate repeatability with two clean consecutive targeted runs; retries alone do not establish stability.

Reconcile every planned case as passed, failed, blocked, or excluded with reason. A case passes only after its required behavior, geometry, diagnostics, and visual review pass. Deduplicate retries when reporting case totals. Report fixes separately from test/fixture changes so the user can see actual product improvements.

- [ ] All in-scope surfaces and primary transitions have final dispositions.
- [ ] Captures counted as reviewed were actually inspected.
- [ ] Fixed findings have after evidence and passing regression checks.
- [ ] No known in-scope issue is hidden by a screenshot baseline, skip, mock, or CSS clip.
- [ ] Final report links matrix, manifest, representative before/after images, commands/results, and unresolved limitations.

**Done when:** the scoped sweep passes these bounds, or the handoff clearly reports partial completion and the exact blockers. Do not turn base-mode artifacts into a public showcase unless requested.

If the user says "ready for a later showcase," retain private capture provenance and candidate case roles now. Showcase construction and public asset curation remain deferred until requested; future reuse requires matching revision and passing evidence.

## Maintaining these instructions

Review trigger boundaries, linked resources, terminology, and observable completion criteria together. Keep the entry point concise and disclose detailed guidance through references. Validate all relative links and bundled helpers before publishing. No external authoring skill is required.
