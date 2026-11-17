# Decisions

Append-only. Each entry says what was decided, by whom, when, and what it changes. Entries D-001 to D-006 came with the starter; each is a default from one build (the mail app, 2026-11-15), so a later entry may override one by saying why.

## D-001 Electron shell and web UI

Inherited default. The page is React and TypeScript; the shell is Electron; the app is its own program with its own processes. Memory is summed as private bytes over the process tree: about 300 MB is the budget and 680 MB is the ceiling no build may pass . Both numbers live in `app.config.json`.

## D-002 Logic stays outside the page

Inherited default. The page asks the main process through the functions in `electron/preload.cjs`; the main process runs the installed command-line tool or core. The page holds no credentials and makes no network request (`connect-src 'none'`). An app that needs a server names its origins in the Content-Security-Policy in `electron/main.cjs` and records why here.

## D-003 System node.exe runs an npm-global tool

Inherited default. The app reads the tool's `.cmd` shim to find its script and starts the system `node.exe` with an argument array. It never runs the shim, never uses a shell, and does not use Electron's own Node.

## D-004 Plain language in the interface

Inherited default. Headings, buttons and first-line status speak in outcomes. Identifiers, hashes and raw tool output sit behind a Details control (mark it `data-details`). The audit scans rendered text for the terms in `qa/banned-terms.json`.

## D-005 Title bar height

Inherited default. 36 px, matching the `titleBarOverlay` height so the native caption buttons and the bar are one strip. The Windows default is 32 px; the difference is deliberate and recorded.

## D-006 Buttons scale on press, rows do not

Inherited default. Web-styled buttons scale to 0.97 while pressed. List rows, menu items and title-bar controls do not.

## Preferences ledger

Every preference the app offers is listed here with the reason a default could not serve. The starter has one: the theme, because the system setting cannot say which a person wants for this app alone.
