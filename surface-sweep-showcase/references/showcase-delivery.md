# Showcase delivery

Read before curating assets and implementing the page.

## Asset selection

Use final app captures, not reconstructed HTML illustrations of the UI. Pair a readable overview with details that explain a real task. Full-page screenshots are often too tall to read in cards: use a deliberate viewport or component capture, preserve the original, and record any crop. Never cut off the error, action, or state needed to understand the screenshot.

Retain lossless originals in the run artifacts; publish only the selected safe derivatives in the destination's normal asset directory. Record source case ID, captured source revision, original file, output file, crop/resize/format transformation, intrinsic dimensions, and alt text in a private/local or safe tracked manifest as appropriate. Keep the showcase build revision separate from the captured app revision. Revalidate assets when featured product code changes.

Use existing image optimization tools when available. Set intrinsic width/height or aspect ratio to prevent layout shifts, use responsive sources when worthwhile, load the primary image eagerly and below-fold images lazily. Verify tiny text and icon sharpness at actual rendered size; smaller bytes are not a win if screenshots become unreadable.

Screen-reader descriptions should explain the visible task/state. Decorative duplicate images can have empty alt text. Captions provide meaning without duplicating every visible label. If users need a larger view, a simple link to a larger safe image may suffice; a modal viewer adds focus, Escape, scroll-lock, and mobile tests.

## Composition

Use a concise introduction, screenshot-led sections with a deliberate hierarchy, and clear entry to the app. The number and layout of sections should follow the product story; no mandatory pricing, testimonials, metrics, color swatches, or feature-card grid. Only make claims supported by the app or verified documentation.

Use scoped styles and existing tokens. Check that a showcase heading, figure, link, or definition-list rule does not change the working app. Prefer readable screenshots over dramatic rotations, tiny device frames, oversized headlines, or crops that hide functionality. Let mobile composition reflow instead of shrinking the whole desktop scene.

## Routing and verification

Inspect the existing router and hosting configuration for the selected destination (for example `/showcase`). Verify a fresh navigation and hard refresh with the built app, not only the dev server. SPA fallback rules must preserve APIs and static image responses; an HTTP 200 containing the app HTML is not a successfully loaded PNG.

Check image content type/decode, no unexpected redirects, correct metadata/title, working anchors and calls to action, keyboard focus, no document overflow, image containment, and horizontal scroll only where deliberately designed and usable. Recheck representative app routes after shared CSS changes.

Do not publish private screenshots, session files, full raw diagnostics, or QA routes alongside curated assets. Existing authorization governs deployment. If deployment is part of the request, perform and verify it rather than stopping at build output; otherwise give the verified local route and make no live claim.
