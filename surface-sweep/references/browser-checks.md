# Browser checks

Read when implementing or adapting the harness. Prefer existing test helpers and installed tool documentation. The optional [browser-probes.mjs](../scripts/browser-probes.mjs) exports two browser-context functions usable with permitted Playwright/Puppeteer `page.evaluate`. Import it into a project harness or copy the needed function into a maintained test helper. No browser package is bundled or installed by the script.

## Readiness before capture

1. Observe errors and failed responses before navigation; retain narrow, explained exceptions for intentional error fixtures.
2. Wait for a meaningful app-ready marker and exact expected state. Network idle alone is insufficient for hydration, streaming, or delayed rendering.
3. Set theme through the supported app control and assert its application. OS color scheme and authored theme are separate settings.
4. Wait for required fonts and images with a deadline. `document.fonts.ready` does not prove a particular face loaded; verify required faces/assets separately where fallback rendering would invalidate the result.
5. Scroll the relevant containers to exercise lazy content, then restore page and nested-container scroll/focus. Do not force virtualized lists into a giant synthetic DOM; capture representative scrolled segments. Capture original sticky positions with viewport images.
6. Assert key geometry is stable across successive frames or bounded polling. Wait for intended transitions; reduced-motion emulation or screenshot animation disabling is a recorded capture policy, not coverage of motion behavior.

`await page.evaluate(waitForAssets, { timeoutMs: 10000 })` waits for document fonts and the images currently present. Its default scope is the document. It rejects broken or undecodable images and times out rather than waiting forever. For a focused crop, pass a selector as `scope`; hidden/offscreen images in that scope are included. Prepare lazy content first. Check CSS backgrounds, SVG external references, canvas/WebGL rendering, and dynamic image insertion with app-specific readiness assertions; the helper cannot prove those ready.

## Geometry and reachability

Document overflow and internal overflow are different. A child can exceed its button while `document.scrollWidth === clientWidth`. A parent with `overflow:hidden` can also conceal a real defect.

Use `page.evaluate(inspectGeometry, options)` to collect document width and **explicit** relationships:

```js
const result = await page.evaluate(inspectGeometry, {
  tolerance: 1,
  contain: [{ parent: '.motion-button', child: '.motion-glyphs' }],
  separate: [{ a: '.detail-title', b: '.detail-actions' }],
  inViewport: ['.dialog-close', '.dialog-submit']
});
expect(result.documentOverflow).toBeLessThanOrEqual(1);
expect(result.issues).toEqual([]);
```

Selectors are examples; replace them from inspected source/DOM. `contain` examines matching descendants in each visible parent. `separate` checks pairs across the two selector sets; scope them narrowly so unrelated repeated rows are not compared. Missing/hidden required targets produce issues. Intentional scroll regions, offscreen carousel slides, tooltips, or decorative overlaps require a narrower relationship, not a global exception.

Bounding rectangles do not establish glyph shape, clipping through all ancestors, contrast, or clickability. Add application assertions for text/icon contents, computed clipping, target sizes, and real keyboard/pointer interactions. For dialogs with scrollable content, check initially visible close controls, then scroll within the dialog and prove bottom actions reachable; do not require the entire dialog body to fit at once. Verify sticky bars do not cover controls at top, middle, and bottom scroll positions.

The bundled probe uses layout-viewport coordinates. For pinch zoom or a real virtual keyboard, record `visualViewport` bounds/offset/scale and test reachability in that visible area separately. A page that fits its layout viewport can still hide essential actions behind browser or keyboard UI.

## Regression and runtime limits

- Assert exact visible output and state transitions alongside geometry. `textContent.length > 0` cannot verify formatting or correct data.
- Missing required controls or fixture records must fail the case, not silently skip an optional-looking branch. Compare executed case IDs with the planned matrix. Standalone scripts must return a nonzero exit status for unexpected failures or missing cases; writing a JSON report and exiting zero is not an automated gate.
- Use screenshot comparisons for stable, reviewed high-value regions. Record engine, OS/fonts, viewport, device scale, and theme; do not regenerate baselines automatically after a failure.
- Serialise fixture-mutating tests only when they share mutable state. Otherwise isolate data/context per worker and parallelize independent cases. Never let parallel capture paths collide.
- Capture trace/screenshot diagnostics for the initial failure, including when there are no retries. Check response status as well as network exceptions.
- A mobile device preset using Chromium is Chromium emulation, not Safari. Run WebKit when Safari behavior matters and report engines actually exercised. Virtual keyboard, browser chrome, and hardware behavior require separate evidence.
- Actual extensions must be exercised when extension compatibility is in scope. A theme-lock meta tag proves only markup; API injection and a real extension run are different evidence.
- Keep provider fixtures deterministic and local. UI error/success coverage from mocked responses is not provider integration qualification.
