# The bridge between the page and the shell

`src/bridge.ts` is the whole interface. The page (`src/`) is built against it and against the stand-in in `src/bridge.fake.ts`; the shell (`electron/preload.ts` and `electron/main.ts`) implements it. Neither side changes it alone: a change is a lead decision recorded in `docs/DECISIONS.md`. Write this file and `docs/TOOL-CONTRACT.md` before any builder starts; in build 2 five builders in separate worktrees built against the two and merged with no conflicts.

## Who owns what

| Thing | Owner | Notes |
| --- | --- | --- |
| Unsaved work | The page | Saved through `saveState`; the main process writes it to a file at once, so a kill loses at most the last moment |
| The theme | The page chooses, the shell keeps | `setTheme` tells the shell, which saves it, paints the window in it at the next start and names it in the page's address (`index.html#theme=dark`) |
| The system | The shell | `bootstrap().platform`; the page sets `data-platform` on the root and never reads the user agent |
| File paths | The shell | The page never sees a path. Files are named by opaque ids the shell keeps; a dropped file's location is resolved in the preload with `webUtils.getPathForFile` and goes straight to the main process |
| Running the tool | The shell | `electron/tool/`. One job at a time |
| Words | The page | The shell sends codes and numbers. `Problem.details` and `ToolStatus.details` are developer text: the page only ever copies them (Copy details) and never shows them |

## Commands from the shell

The macOS menu bar, the Dock menu and a script (`--menu-command=<id>` through the control channel, `electron/control.ts`) can send a command. The shell sends a command id through `onMenuCommand`; the page runs it through its one command registry, the same path a shortcut takes. The page reports which commands can run through `setMenuState`, so a menu item is dimmed exactly when its shortcut would do nothing. The ids are the keys of `shortcuts.json`.

## The stand-in

`src/bridge.fake.ts` implements `DesktopBridge` for a plain browser. The headless audit and the screenshot script reach every state through it, chosen in the address's fragment (`#fixture=job-failed-OUTPUT_IN_USE&platform=macos`). It must cover every state the app can be in: one fixture per designed empty, loading, error and dense state, and one per primary action in the tool contract's error table.
