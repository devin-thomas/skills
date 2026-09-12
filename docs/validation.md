# Publication validation

The September 12, 2026 adaptation was checked with Node.js 24.18.0 and Python 3.14. No project screenshots, learner progress, or private account configuration were included.

## Repeatable package and helper checks

From the repository root:

```sh
python3 scripts/validate-skills.py
node --test tests/pwa-helpers.test.mjs
git diff --check
```

The package validator checks entry-point frontmatter shape, folder/name matching, entry-point length, relative Markdown file links, and machine-specific home paths. It does not validate remote content or certify live agent behavior.

All four PWA helper tests passed: local manifest success and missing-icon failure, malformed JSON failure, HTTP release success and HTML icon fallback failure, and CLI help/usage exit codes. Fixtures are temporary, synthetic, and local. These checks do not install a PWA or execute a service worker.

## Browser probe checks

The unchanged Surface Sweep probes were exercised in headless Chromium through Playwright at 390 by 844 CSS pixels. Observed checks passed for internal child overflow with zero document overflow, corrected containment, missing required targets, an image-free ready document, missing asset scope, and a broken image.

To reproduce, import `inspectGeometry` and `waitForAssets` from `surface-sweep/scripts/browser-probes.mjs` into a permitted Playwright/Puppeteer harness. Use a 60px button containing a 100px child, assert `outside-parent` despite zero document overflow, then widen the button to 120px and assert no containment issues. Assert a missing selector produces `missing-or-hidden`; an image-free page resolves readiness; a missing scope and invalid image reject. No browser or browser package is bundled.

This is helper behavior validation, not a completed visual sweep of a real application. Screenshots, physical-device PWA behavior, and end-to-end agent execution were not certified by these checks.

## Instruction review

Reviewed the paired sweep trigger boundaries, explicit dependency and unavailable-tool behavior, showcase destinations, preservation of useful technical UI language, and PWA helper limitations. Quick Build was reviewed for standalone use, existing-plan reuse, local-only delivery, curriculum resume, unavailable curriculum resources, and failed publishing. Its curriculum reference matches the source 0.2.0 entry point byte for byte; standalone templates deliberately make curriculum closeout conditional.

These instruction scenarios were reviewed against the text, not run as automated agent simulations. The collection's existing public skill content was preserved.
