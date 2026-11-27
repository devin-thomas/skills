// The theme a window starts in. Desktop apps are dark by default: a fresh install, a fresh data
// folder and any operating-system theme all start dark, and the system's setting is never
// consulted (D-020). Light is a choice the person made, and only a choice counts: the toggle,
// the menu item and the command palette entry all end in the one action that saves
// `themeChosenBy: "user"` beside the theme (D-022). A saved "light" without that mark is not a
// choice (a page that told the window what it opened with, or an older build, can write one), so
// it opens dark and is reset.
//
// No Electron import: the rule is a pure function of what was saved, so test/dark-default.test.ts
// can try every case without a window.
import type { Theme } from './platform.ts';

export const DEFAULT_THEME: Theme = 'dark';

/** The mark that says a saved theme was an explicit action by the person. */
export const CHOSEN_BY_USER = 'user';

/** The saved window state's theme fields, whatever is in the file. */
export interface SavedTheme {
  theme?: unknown;
  themeChosenBy?: unknown;
}

export interface ResolvedTheme {
  theme: Theme;
  /** a saved light theme that was not a choice and is now dark: window.json is rewritten */
  reset: boolean;
}

/** The theme to open in, and whether a saved light theme was dropped. Anything unreadable counts as no choice. */
export function resolveTheme(saved: SavedTheme): ResolvedTheme {
  if (saved.theme === 'light') {
    return saved.themeChosenBy === CHOSEN_BY_USER ? { theme: 'light', reset: false } : { theme: DEFAULT_THEME, reset: true };
  }
  return { theme: DEFAULT_THEME, reset: false };
}

/** What to merge into window.json when the person picks a theme. */
export function chosenPatch(theme: Theme): { theme: Theme; themeChosenBy: typeof CHOSEN_BY_USER } {
  return { theme, themeChosenBy: CHOSEN_BY_USER };
}

/** What to merge into window.json to drop a saved light theme that was never a choice. */
export function resetPatch(): { theme: typeof DEFAULT_THEME; themeChosenBy: undefined } {
  return { theme: DEFAULT_THEME, themeChosenBy: undefined };
}
