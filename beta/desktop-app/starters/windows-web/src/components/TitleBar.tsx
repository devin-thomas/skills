import { List, Moon, Search, Sun } from 'lucide-react';
import config from '../../app.config.json';
import { SHORTCUTS, keysOf } from '../state/shortcuts';
import { Kbd, Tip } from './ui';

// The page draws the title bar; the shell keeps the native caption buttons on
// its right through titleBarOverlay. Nothing is drawn in that reserved strip.
// Only what a person needs sits here: no build, fixture or debug text.

function Mark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none text-fg" aria-hidden="true">
      <rect width="16" height="16" rx="4" fill="currentColor" />
      <path d="M5 5.5h6M5 8h6M5 10.5h3.5" fill="none" stroke="var(--surface)" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function TitleBar({
  title,
  theme,
  railOpen,
  onToggleTheme,
  onOpenPalette,
  onToggleRail,
}: {
  title: string;
  theme: 'light' | 'dark';
  railOpen: boolean;
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onToggleRail: () => void;
}) {
  const themeLabel = theme === 'dark' ? 'Use the light theme' : 'Use the dark theme';
  const railLabel = railOpen ? 'Hide items' : 'Show items';
  return (
    <header className="titlebar">
      <Mark />
      <h1 className="flex-none font-medium text-fg">{config.productName}</h1>
      <span className="min-w-0 truncate text-fg-3">{title}</span>
      <span className="min-w-2 flex-1" />
      <button type="button" className="btn btn-sm btn-ghost" aria-keyshortcuts="Control+K" onClick={onOpenPalette}>
        <Search size={14} strokeWidth={1.75} aria-hidden="true" />
        <span>Commands</span>
        <span className="only-wide flex gap-0.5" aria-hidden="true">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <Tip label={railLabel} keys={keysOf(SHORTCUTS.items)}>
        <button type="button" className="btn btn-icon only-narrow" aria-label={railLabel} aria-expanded={railOpen} onClick={onToggleRail}>
          <List size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Tip>
      <Tip label={themeLabel} keys={keysOf(SHORTCUTS.theme)}>
        <button type="button" className="btn btn-icon" aria-label={themeLabel} onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={16} strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </Tip>
    </header>
  );
}
