---
name: surface-sweep-showcase
description: "Visual QA and correction plus a screenshot-led product showcase for an existing web app. Use when the user wants both polished product surfaces and a showcase, case-study page, or product tour built from actual app captures. Do NOT use for QA alone, a generic landing page, or invented product mockups."
---

# Surface Sweep Showcase

Deliver the corrected app and a working showcase built from its reviewed browser captures. The product supplies the imagery and visual language.

If the request only mentions a **later** showcase, use Surface Sweep now and preserve private evidence/provenance; do not activate showcase construction or public asset curation until requested.

## 1. Complete the shared sweep

Read and execute [Surface Sweep](../surface-sweep/SKILL.md), including the references it routes to. Install both skills together; this companion requires the shared QA contract, regardless of global or project-local installation. If that file is missing, locate `surface-sweep` in the current skill catalog before proceeding; report a missing dependency if unavailable.

Use showcase mode to extend the base deliverables, not to bypass its correction loop. Reuse a prior sweep only if its source revision, fixtures, relevant matrix, inspection results, and assets still match the current app. Rerun impacted cases after intervening changes. Do not build a polished page around known-broken captures.

**Done when:** the relevant product cases pass behavior, geometry, readiness, and visual review; remaining gaps are explicitly reported and do not misrepresent any featured surface.

## 2. Curate a coherent product story

Read [showcase-delivery.md](references/showcase-delivery.md) before selecting images and building the route.

Choose a small complementary set: overview, primary workflow, meaningful interaction/detail, and mobile use where supported. Use representative synthetic data with realistic density. A QA stress case can be featured when it demonstrates capability clearly; do not make every image a maximum-length torture test.

Select captures only from reviewed final states. Maintain provenance from published asset to source case, revision, fixture, viewport, and transformation. Recapture to remove incidental menus or dev chrome; do not fabricate UI or retouch away a product defect. Preserve a separate menu-open or error-state capture when it is the feature being shown.

**Done when:** every selected asset has a distinct purpose, safe content, a matching passing case, and source provenance.

## 3. Build at the intended destination

Honor the requested destination: an existing app route, documentation site, or portfolio. Reuse its router/build system while keeping the showcased product recognizable. When no destination is specified and the app supports routes, use `/showcase`; otherwise resolve a suitable output from repository conventions before building. Keep the app's primary entry intact and give the showcase a working route into the app. Do not add a separate service or general redesign merely to host images.

Let actual screenshots dominate. Write brief accurate captions and a clear product introduction; omit QA machinery, run counts, fixture identifiers, decorative filler, and unsupported claims from user-facing copy. Call static images screenshots rather than live demos. Match the page to the product's identity rather than copying another project's palette or layout.

Preserve screenshot aspect ratios, meaningful detail, and mobile readability. Use optimized derived assets with dimensions and appropriate responsive loading. Avoid CSS selectors that leak into the main app. Implement responsive layouts and reduced-motion behavior; avoid unnecessary image viewers or animation infrastructure.

**Done when:** the page renders at the intended destination, uses real reviewed assets, links correctly, and preserves the existing app experience.

## 4. Sweep the showcase and verify delivery

Add the showcase to the coverage matrix. Test desktop, phone, narrow and intermediate widths, short viewports, direct URL load, hard refresh, query/trailing-path behavior supported by the router, section links, app links, keyboard focus, image loading, and any gallery interaction. Inspect the resulting screenshots and fix their defects too. Check shared styles have not regressed the main app.

Verify the production build/preview and hosting route behavior. A client navigation pass does not prove a deep link works. Deploy only when already authorized, and then check the deployed URL and asset responses. Otherwise report the locally verified route and deployment status accurately.

- [ ] Base sweep report and final matrix remain truthful.
- [ ] Every public image maps to a reviewed passing case and contains safe content.
- [ ] Images keep correct proportions and remain legible at display sizes.
- [ ] Showcase and main app pass their relevant responsive and interaction checks.
- [ ] Build, deep link, refresh, asset delivery, and navigation checks pass in the claimed environment.
- [ ] Handoff links the showcase, evidence, assets, and any actual delivery gaps.

**Done when:** both corrected product and showcase satisfy these bounds. A screenshot folder alone is not a showcase, and a local preview is not a verified deployment.

## Maintaining these instructions

Review trigger boundaries, linked resources, terminology, and observable completion criteria together. Keep the entry point concise and disclose detailed guidance through references. Validate all relative links and bundled helpers before publishing. No external authoring skill is required.
