# Platform Installation

Installation is not one cross-browser API. Define the product's supported surfaces, provide platform-appropriate instructions, and verify each claim on the actual surface.

## iOS And iPadOS

- Safari 26 changed Home Screen behavior so any site can be added and opens as a web app by default unless the user disables **Open as Web App**.
- The immediate predecessor was Safari/iOS/iPadOS 18.6 because Apple skipped public version numbers 19-25.
- Do not depend on Chromium's `beforeinstallprompt`; provide version-aware Share/Add to Home Screen guidance.
- Keep manifest metadata and Apple touch icons. Test fresh install, icon, name, scope, standalone relaunch, keyboard/orientation, offline reload, storage boundary, updates, and push if used on real iPhone/iPad targets.
- Home Screen Web Push requires user interaction and permission; it remains optional and delivery is not guaranteed.

## Android

Chrome or another provider may create a WebAPK, shortcut, QuickApp, or provider-specific surface. Verify the actual result, launcher mask/icon, package identity, cold start, offline behavior, push, storage, update, and uninstall/reinstall. A second browser is separate evidence.

## Windows

Edge exposes desktop install, Start/taskbar integration, window/display behavior, shortcuts/app actions, and notification permissions. Test the web install independently from optional MSIX/Store packaging. Edge version and Windows/macOS support boundaries are volatile.

## macOS

Safari Add to Dock creates a web-app surface and data boundary that is not interchangeable with a Safari tab or Chrome/Edge install. Test cookies/storage, icon, notification permission, deep links, update, and uninstall for each supported route.

## Firefox And Linux

Firefox on Windows offers taskbar web apps from version 143; Microsoft Store installations support them from version 150. This is a vendor-specific site window, not Chromium's manifest-driven install flow. Check the current distribution and version, then verify taskbar/Start identity, launch, session behavior, and removal separately. Firefox's implementation shares its browser profile; do not assume a separate installed storage boundary.

On Linux, Chromium launcher integration varies by browser and desktop environment. Firefox's taskbar-app implementation is disabled by default on Linux; macOS support is unavailable in the current vendor documentation. Preserve the browser-tab path and verify actual enabled behavior before claiming installed support.

Platform guidance reviewed 2026-10-12. Recheck vendor sources before changing a product's target matrix; documentation about manifest installation alone can miss a vendor's separate site-window feature.

## Acceptance Record

For every target capture browser/OS version, clean versus returning profile, install entry path, resulting surface type, icon/name, start URL/scope, display mode, cold start, offline restart, update transition, storage boundary, permission behavior, uninstall/reinstall, and any untested requirement.

## Sources

- [WebKit Features in Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [Safari 18.6 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-18_6-release-notes)
- [WebKit Web Push for iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [web.dev installation](https://web.dev/learn/pwa/installation)
- [Microsoft Edge PWA documentation](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/)
- [Apple Safari web apps on Mac](https://support.apple.com/guide/safari/use-safari-web-apps-sfri407b2f6b/mac)
- [Mozilla web apps on Windows](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows)
- [Firefox taskbar-app implementation](https://firefox-source-docs.mozilla.org/browser/components/taskbartabs/docs/index.html)
