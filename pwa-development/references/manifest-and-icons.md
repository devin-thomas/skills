# Manifest and Icons

## Operational Baseline

The Web Application Manifest standard leaves members optional, while browsers impose different install and presentation behavior. For a product that claims an intentional installed identity, normally define:

- stable `id`;
- `name` and `short_name`;
- `start_url` within `scope`;
- supported `display` plus conservative fallback behavior;
- opaque `theme_color` and `background_color`;
- ordinary `any` icons and separate `maskable` icons;
- an Apple touch icon and browser favicon in HTML.

Changing `id` can create a different installed app. Do not use identity fields as cache-busting tokens. Optional members such as shortcuts, screenshots, share targets, file handlers, launch handlers, protocol handlers, or `display_override` need a supported product use case, feature behavior, and fallback.

## Icon System

Keep a vector master and generate tested outputs:

- ordinary 192x192 and 512x512 PNG `any` icons;
- separate 192x192 and 512x512 opaque `maskable` icons;
- an Apple touch icon, commonly 180x180, plus a root/browser fallback;
- favicon assets and only the shortcut icons actually referenced.

Keep important maskable artwork within the specified 40%-radius safe zone (an 80% inner diameter). Do not combine `any maskable` by default: a composition designed for cropping can look overly padded when unmasked.

## Build And Repair

1. Inspect the deployed HTML manifest link and all legacy/platform icon links.
2. Confirm `id`, `start_url`, and `scope` match the router, base path, and authentication entry behavior.
3. Validate JSON, MIME type, redirects, status, and that a `200` response is not an HTML fallback.
4. Decode icons and check declared versus actual dimensions, format, alpha, and file availability.
5. Inspect ordinary and maskable previews, then test fresh installs on claimed launchers.
6. When changing icons, update manifest and HTML references coherently, version asset paths intentionally, and retain old assets during adoption.

`node scripts/audit-manifest.mjs` checks local metadata and files. `node scripts/probe-release.mjs` checks deployed responses. Neither observes launcher selection or refresh.

## Common Traps

- A service worker or CDN serves stale manifest/icon bytes.
- A catch-all route returns HTML with status `200` for a missing manifest or icon.
- Existing launchers retain a prior icon/name after deployment.
- Transparent maskable edges expose unexpected launcher colors.
- An install prompt is treated as universal even though Safari and Firefox surfaces differ.

## Sources

- [W3C Web Application Manifest](https://www.w3.org/TR/appmanifest/)
- [MDN manifest reference](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
- [MDN defining app icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)
- [Chrome DevTools PWA inspection](https://developer.chrome.com/docs/devtools/progressive-web-apps)
- [Apple web-app configuration](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [WebKit Web Push for iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
