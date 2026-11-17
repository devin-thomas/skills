import { List, Moon, Search, Sun } from 'lucide-react';
import config from '../../app.config.json';
import type { Platform } from '../bridge';
import { SHORTCUTS, ariaKeys, keysOf } from '../state/shortcuts';
import { Kbd, Tip } from './ui';

// The page draws the title bar; the system keeps its own window buttons over it
// on every system (caption buttons on Windows, traffic lights on macOS, the
// buttons the desktop's layout names on Linux). The bar lays itself out inside
// env(titlebar-area-*), which the shell reports, so it never needs to know which
// side the buttons are on. Only what a person needs sits here: no build,
// fixture or debug text.

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
  platform,
  railOpen,
  onToggleTheme,
  onOpenPalette,
  onToggleRail,
}: {
  title: string;
  theme: 'light' | 'dark';
  platform: Platform;
  railOpen: boolean;
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onToggleRail: () => void;
}) {
  const themeLabel = theme === 'dark' ? 'Use the light theme' : 'Use the dark theme';
  const railLabel = railOpen ? 'Hide items' : 'Show items';
  const palette = SHORTCUTS['command-palette'];
  return (
    <header className="titlebar" data-platform-bar={platform}>
      <Mark />
      <h1 className="flex-none font-medium text-fg">{config.productName}</h1>
      <span className="min-w-0 truncate text-fg-3">{title}</span>
      <span className="min-w-2 flex-1" />
      <button type="button" className="btn btn-sm btn-ghost" aria-keyshortcuts={ariaKeys(palette)} onClick={onOpenPalette}>
        <Search size={14} strokeWidth={1.75} aria-hidden="true" />
        <span>Commands</span>
        <span className="only-wide flex gap-0.5" aria-hidden="true">
          {keysOf(palette).map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      </button>
      <Tip label={railLabel} keys={keysOf(SHORTCUTS['show-items'])}>
        <button type="button" className="btn btn-icon only-narrow" aria-label={railLabel} aria-expanded={railOpen} onClick={onToggleRail}>
          <List size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Tip>
      <Tip label={themeLabel} keys={keysOf(SHORTCUTS['toggle-theme'])}>
        <button type="button" className="btn btn-icon" aria-label={themeLabel} onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={16} strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </Tip>
    </header>
  );
}
