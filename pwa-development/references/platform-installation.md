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

## Linux And Firefox

Chromium launcher integration varies by browser and desktop environment. Firefox desktop supports many PWA runtime features and offline behavior without the Chromium-style manifest install flow. Preserve a capable browser-tab path and do not label Firefox failure merely because a Chromium install affordance is absent.

## Acceptance Record

For every target capture browser/OS version, clean versus returning profile, install entry path, resulting surface type, icon/name, start URL/scope, display mode, cold start, offline restart, update transition, storage boundary, permission behavior, uninstall/reinstall, and any untested requirement.

## Sources

- [WebKit Features in Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [Safari 18.6 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-18_6-release-notes)
- [WebKit Web Push for iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [web.dev installation](https://web.dev/learn/pwa/installation)
- [Microsoft Edge PWA documentation](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/)
- [Apple Safari web apps on Mac](https://support.apple.com/guide/safari/use-safari-web-apps-sfri407b2f6b/mac)
