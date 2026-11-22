// The theme a window starts in. Desktop apps are dark by default: a fresh install, a fresh data
// folder and any operating-system theme all start dark. Light is a choice the person made and the
// app saved (D-020); nothing else selects it, and the system's setting is never consulted.
import type { Theme } from './platform.ts';

export const DEFAULT_THEME: Theme = 'dark';

/** The theme to open with, from the saved choice (anything unreadable counts as no choice). */
export function initialTheme(saved: unknown): Theme {
  return saved === 'light' ? 'light' : DEFAULT_THEME;
}
