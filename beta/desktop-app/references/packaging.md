# Packaging a content app for Windows, macOS and Linux

How a content app (an Electron shell over a bundled command-line tool) becomes something a person installs on each system, and how an agent checks the installed app without taking the owner's focus. The scripts are in the three-system starter (`scripts/package.ts`, `scripts/stage.ts`, `scripts/install.*`, `scripts/installed-check.*`, `scripts/linux/`, `scripts/mac/`). **Proven in 1 build** (the media converter, 2026-11-15) unless marked; Windows install through Explorer is proven in 2 (the mail app too). Nothing uses a hosted build service: Windows builds on the owner's Windows machine, macOS and Linux on a Mac (Linux in containers).

## The owner's distribution decisions

From build 2. They are standing defaults for this branch; record any change in the app's decisions file.

- **No Apple Developer ID.** The macOS build is signed ad hoc and not notarized, and it may still be released to other people with short instructions for opening an app from an unidentified developer ("other users can still launch what I release and we can give simple instructions for users").
- **Bundled helpers ship in what is released**, with their notices ("if it's simpler for users to have it bundled I would prefer that").
- **Apple silicon only on macOS.** Nothing promises Intel Macs.
- **Linux is tested in containers on the Macs, never WSL.**
- An app whose tool exists in another form already keeps that form: build 2's tool stayed exactly what it was, with no new mode made to suit the interface.

## What gets made

| Target | Built on | Command | Output (build 2 sizes) |
| --- | --- | --- | --- |
| Windows x64 | Windows | `pnpm package:win` | `out\<exeName>-win32-x64\`, installed per user (365 MB folder) |
| macOS arm64 | a Mac | `pnpm package:mac` | `<productName>.app`, signed, and a zip (263 MB app, 122 MB zip) |
| Linux arm64 and x64 | a Mac with Docker, or Linux | `pnpm package:linux-arm64`, `pnpm package:linux-x64` | a `.deb` and a portable `.tar.gz` per architecture (86 to 91 MB deb, 122 to 130 MB tar.gz) |

Each runs `@electron/packager` 20 with an explicit keep-list (package.json, app.config.json, the shortcut table, `electron/` without the test instrumentation, `dist/`, the icon) and no `node_modules`: the main process has no runtime dependency. Packager 20 passes its hooks one object (`{ buildPath, ... }`) and expects a promise; the older callback form fails with a path error. Electron 42 and later do not download their binary on install: run `pnpm electron:install` (and `npx install-electron --no` in a Dockerfile).

## Helpers inside the app

- One binary per system and processor in `staging/bin/<platform>-<arch>/`, a folder Git ignores; `scripts/stage.ts` puts the real tool or the placeholder there and records which. The packager copies the folder beside `app.asar` (`resources/bin/<platform>-<arch>/`, `Contents/Resources/bin/...` on macOS) with a `manifest.json` of sizes and hashes, plus `THIRD-PARTY-NOTICES.txt`.
- Never inside the asar archive: a program there cannot be started. Make archives of Linux and macOS builds on their own family so the executable bits survive.
- **Build your own third-party binaries when the published ones are big.** Build 2 built an audio-only LGPL FFmpeg with LAME for all five targets from one configure line (about 3.5 MB per program, 7 MB the pair), instead of the published LGPL builds (264 MB added to the Windows app and 281 MB to the Linux x64 app, linking 43 to 45 libraries, each needing its notice). One configure line also means the tool sees the same FFmpeg everywhere.
- **Notices.** One UTF-8 file, rebuilt on every package run so it can never be stale: the statement of each licence, where the exact source is (address and checksum), that it is unmodified, the configure line of each shipped copy, and the full licence texts, including the run-time libraries linked into the copies (mingw-w64 and winpthreads on Windows, musl on Linux). Reachable from About. An engineer's reading, not legal advice: one read by someone qualified is due before a public release.
- **Check the current release of anything pinned from memory.** Build 2 pinned LAME 3.100 from memory; the current release was 4.0 (July 2026), whose `configure` needs `pkg-config`.

## Windows

- Unsigned packager folder, copied per user to `%LOCALAPPDATA%\Programs\<productName>` with a Start Menu shortcut; no administrator rights, no installer program. SmartScreen will warn about an unsigned app that arrives by download (not tried).
- **Install and check through Explorer.** An agent session inside a packaged (MSIX) desktop app has its `%APPDATA%` and `%LOCALAPPDATA%` writes redirected into that package, invisible to the owner's apps. `scripts\run-as-user.ps1` hands Explorer a shortcut, so the script runs in the owner's real environment. Each step writes `qa\evidence\installed-<step>.txt`. (2 builds.)
- **The windowless runner.** That shortcut starts `conhost.exe --headless powershell.exe ...`: a console with no window. Any visible console takes the foreground, and when it closes Windows hands the foreground to whatever app is entitled to it. A `.cmd` handed to Explorer opens one; so does a shortcut to `powershell.exe` set to Minimized with `-WindowStyle Hidden`, wherever Windows Terminal is the default terminal (`HKCU\Console\%%Startup` delegates to it), because Terminal opens its own window and ignores both (microsoft/terminal issue 12464; seen on every call, 0.45 to 0.77 s in front). (1 build.)
- Arguments given when starting a shortcut are added after the shortcut's own, so `launch` starts the real shortcut and still passes `--no-activate` and `--data-dir`; a PATH emptied in the launching process reaches the app.
- **Never a second launch to reach the running app.** Build 2's `collect` step (a second launch asking for diagnostics, from a PowerShell Explorer had started) brought the running app's window to the foreground twice, although it asked for no focus: Chromium's process singleton calls `AllowSetForegroundWindow` for the running app in the second process before any app code runs, and the visible console's closing gave that right its moment. `collect`, `about` and `quit` now go through the app's control channel (`scripts\control.ps1`, a pipe client in PowerShell that starts no program), which grants nothing. They need the `data-dir` the `launch` step used (the channel is found through `control.json` there), and `launch` must have had `no-activate`, which also makes the app serve the channel. (1 build.)
- **Installing never quits a running app.** `install.ps1` stops and says to close the app first: asking it to quit by starting its exe again is a second launch, and the running copy may be the owner's own window.
- **Focus on Windows: what proves it.** Run `measure\foreground-sampler.ps1 -App <installed exe>` in the agent's own shell from before the install to after the quit; it records every change of the foreground window and fails if the app's window was ever in front. Launches from an agent's own session cannot show the problem (that session holds no right to the foreground), so before claiming a change keeps focus, run `measure/focus-experiment.ts --first explorer --route explorer` against the development app. Build 2, after both fixes: the installed check through Explorer with the sampler running recorded no change of the foreground at all, 3 requests through the channel, 0 second launches.

## macOS

- **Signing.** Ad hoc (identity `-`) with the hardened runtime, inside the packager after the helpers are in place, so every Mach-O file is signed in one pass. The package script fails unless `codesign --verify --deep --strict` passes and every helper carries the runtime flag.
- **Entitlements.** The app and Electron's helper apps get `allow-jit` and `disable-library-validation`. The second is needed only because the signature is ad hoc: with the hardened runtime a program may load only libraries signed by Apple or its own team, an ad-hoc signature has no team, and the app then cannot load its own Electron Framework. **It verifies and then dies at launch without it**; the package script checks for it. The bundled helpers get no entitlement: a hardened app needs none to start a program inside its own bundle.
- **Zip** with `ditto -c -k --sequesterRsrc --keepParent`, on a Mac.
- **Install** by copying the bundle into an Applications folder with `ditto`; verify the signature again after the copy.
- **Test the real launcher from the internal disk.** An app started by `open` that touches a removable volume stops at its first file call and waits for the prompt "would like to access files on a removable volume", which nobody is there to answer; the same app started from ssh is not asked, which hides the problem.
- **A modal alert hangs every check.** A main-process error under a normal launch shows a modal alert; while it is up the app answers no second launch and ignores a polite stop. A check that hangs is most likely an alert on a screen nobody is watching. Launch with `--no-activate`, which sends the error to stderr instead.
- **What another person sees.** Copies made by `scp`, `rsync` or a mounted disk carry no quarantine mark and open. A download is quarantined: `spctl --assess` says rejected, `syspolicy_check distribution` reports "Adhoc Signed App" and "Notary Ticket Missing", and the person opens it from System Settings, Privacy & Security, Open Anyway (Apple's instructions, support.apple.com/102445, as read for report 10). That dialog was not produced in build 2. With a Developer ID later: `MAC_SIGN_IDENTITY` switches to the strict entitlements; notarization and stapling are not scripted yet.
- **Universal builds** were not made: report 10 measured 487 MB universal against 252 MB arm64, and every helper must be universal or listed in `osxUniversal.x64ArchFiles`.

## Linux

- **Two forms per architecture**: a `.deb` for Debian and Ubuntu, and a portable `.tar.gz` with an `install-for-user.sh`. The `.deb` is assembled inside a Debian container's own filesystem, because it needs root ownership and a setuid file a shared folder may not keep.
- **The `.deb`** installs to `/opt/<name>`, a command in `/usr/bin`, the desktop entry `<appId>.desktop` with `StartupWMClass=<appId>`, and hicolor icons from 16 to 512 px; the packaged `package.json` gets `desktopName` so the window's class equals the entry's name. `Categories` and `MimeType` come from `app.config.json`.
- **Depend on the 64-bit-time library names first**: `libasound2t64 | libasound2`, and likewise for GTK, ATK, CUPS. With a bare `libasound2`, apt on Ubuntu 24.04 picks `liboss4-salsa-asound2`, which lacks a symbol Chromium needs, and the app does not start.
- **The sandbox stays on.** Never `--no-sandbox`, in the desktop entry or anywhere. The `.deb` carries `chrome-sandbox` root-owned with mode 4755 (repaired by `postinst`) and, for Ubuntu 23.10 and later, an AppArmor profile (unconfined plus `userns`) installed only where AppArmor is on and its parser accepts the file (Debian 12's 3.0.8 rejects it; Ubuntu 24.04's 4.0.1 and 26.04's 5.0.2 accept it).
- **A tarball, not an AppImage, when the sandbox helper is needed.** An AppImage cannot hold a root-owned setuid file (its mount is `nosuid`), so on Ubuntu 23.10 and later it needs `--no-sandbox`. The portable tarball has the same limit but says so in its README and offers the fix. The Ubuntu restriction itself is a kernel setting a container does not have, so it was never reproduced; it needs one pass on a real Ubuntu.
- **Containers.** Debian 12 and Ubuntu 24.04 and 26.04 arm64 containers on a Mac (OrbStack), with `--security-opt seccomp=unconfined` so the sandbox can make its namespaces; in a default container the app stops at start rather than run unsandboxed. x64 ran only under emulation, where its memory figure means nothing.

## Fuses

Electron's fuses are switches in the Electron binary that close doors an app does not use. Flip them on the freshly extracted Electron (the packager's `afterExtract`), before the rename, the Windows resource edit and macOS signing; on Apple silicon the flip voids Electron's own ad-hoc signature, so sign it again and let the packager's signing follow. **The current starter's `scripts/package.ts` does not flip them yet** (premium bar, rule 108). An earlier JavaScript version of the starter did, and proved it on 2026-11-19 on macOS arm64 with every probe below, on Linux arm64 by reading the wire back only, and not on Windows. After flipping, read the wire back from the packaged app and, on the app's own system, try each door.

| Fuse | Value | Why |
| --- | --- | --- |
| EnableNodeOptionsEnvironmentVariable | off | `NODE_OPTIONS=--require=<file>` would run that file inside the app; Electron logs that it ignored it |
| EnableNodeCliInspectArguments | off | `--inspect` would open a debugger into the main process. Playwright's `_electron` needs it, so drive the development app, which is never fused |
| OnlyLoadAppFromAsar | on | the app's code is read only from `app.asar` |
| EnableEmbeddedAsarIntegrityValidation | on, macOS only | the packager records the archive's hash in Info.plist; a changed byte inside a file the app loads stops it. Appending bytes is not detected (the check covers the header and each file's blocks), so the probe edits the main process file inside the archive. Turn it on for another system only after its packaged app has started with it |
| GrantFileProtocolExtraPrivileges | off | the page is served from `app://`, never `file://`; `protocol.handle` still reads `dist/` through `net.fetch` |
| RunAsNode | on, with a written reason | the installed checks run the installed app's own binary as Node (step `helpers`, and `scripts/control.cjs` on macOS and Linux). Next step: move those to system Node or to a control-channel command, re-prove the installed check on all three systems, then turn it off |
| EnableCookieEncryption | default (off) | on macOS it asks the Keychain for a key, which can raise a Keychain dialog that takes focus; the page sets no cookies |

## Checking the installed app

The same steps on every system (`installed-check.ps1` on Windows, `installed-check.sh` on macOS and Linux), through files, never input events:

| Step | What it proves |
| --- | --- |
| `list` | What is installed and where; on macOS each signature, the entitlements and Gatekeeper's verdict; on Linux the package, sandbox helper, desktop entry, icons and libraries |
| `helpers` | Every helper is inside the app, executable, matches the manifest, and runs from there. **The installed app's own executable runs the check as Node** (`ELECTRON_RUN_AS_NODE=1`), so the helpers are started by the program that starts them in use, by absolute path, with PATH emptied. This needs Electron's RunAsNode fuse, which is on by default and which rule 108 keeps on for this reason alone (see Fuses) |
| `launch` | The app starts from its real launcher: the Start Menu shortcut, `open -g` on the bundle, the desktop entry's command; with `--no-activate`, a throwaway `--data-dir` and an empty PATH |
| `memory` | Private memory over the app's processes by each system's definition, read from outside, against the budget and ceiling ([measurement](measurement.md)) |
| `collect` | The running app is the installed, packaged one, where it found its helpers, and that the check reached it only through its control channel (its count of second launches is 0). Run it after `memory`: asking changes the figure |
| `quit`, `uninstall` | The app closes through its own `--quit`, sent through the channel; the installed copy is removed, never the data folder |

The control channel is found through `control.json` in the data folder, so `collect`, `about` and `quit` carry the same `--data-dir` as `launch` (`DATA_DIR` on macOS and Linux). The app serves the channel only when `launch` passed `--no-activate` (`NO_ACTIVATE=1`) or `--control` (`LAUNCH_EXTRA=--control`, which the Linux container check uses with the desktop entry's own command). On macOS and Linux the request is sent by `scripts/control.cjs`, run by the installed app's own executable acting as Node; no installed run on either has used it yet (the channel itself ran there in the development app).

## Results, for comparison

| System | Installed and launched from the real launcher | Helpers | Memory after idle |
| --- | --- | --- | --- |
| Windows 11 | Yes, Start Menu shortcut, PATH empty; with both focus fixes no change of the foreground from install to quit | 21 checks passed, run by the installed exe | 304.4 MB over 4 processes after 5 minutes (budget 300); 243.2 MB over 3 with the network service in the main process |
| macOS 27.2 | Yes, `open -g` from a scratch Applications folder on the internal disk; frontmost app unchanged | 21 checks passed, run by the hardened app's own executable | 110 MB footprint over 4 processes after 5 minutes |
| Linux arm64 (Debian 12, Ubuntu 24.04 and 26.04 containers) | Yes, from the desktop entry with PATH empty under Xvfb; renderer sandboxed (`Seccomp: 2`) | 24 checks passed | 139 to 152 MB anonymous plus swap over 7 processes, 20 s after launch |

## Not done

Turning the RunAsNode fuse off (see Fuses); asar integrity on Windows and Linux; a Windows installer, code signing or update feed; Developer ID, notarization, a DMG, universal or Intel macOS builds; rpm, AppImage, Flatpak or Snap; Electron's licence files inside the macOS bundle (the packager leaves them beside the `.app`, so the zip does not carry them); Windows on arm64; any Linux desktop session outside a container; x64 Linux on real hardware.
