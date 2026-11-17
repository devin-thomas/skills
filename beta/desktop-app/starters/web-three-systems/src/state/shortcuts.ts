// The page's view of the one shortcut table (shortcuts.json at the project
// root; the macOS menu reads the same file). `mod` is Ctrl on Windows and Linux
// and Command on macOS. Labels are written as the system writes them, as one
// string: "Ctrl+Shift+E" on Windows and Linux, "⇧⌘E" on macOS.
import table from '../../shortcuts.json';
import type { Platform } from '../bridge';

export interface Shortcut {
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type CommandId = keyof typeof table.commands;

export const SHORTCUTS = table.commands as Record<CommandId, Shortcut | null>;

let platform: Platform = 'windows';

export function setShortcutPlatform(next: Platform) {
  platform = next;
}

const MAC_KEYS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: '⌫', Delete: '⌦', ' ': 'Space', Enter: '↩' };
const PC_KEYS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space' };

/** The shortcut as this system writes it, as one string in a one-item list (one key cap). */
export function keysOf(shortcut: Shortcut | null): string[] {
  if (!shortcut) return [];
  if (platform === 'macos') {
    const key = MAC_KEYS[shortcut.key] ?? shortcut.key.toUpperCase();
    return [`${shortcut.alt ? '⌥' : ''}${shortcut.shift ? '⇧' : ''}${shortcut.mod ? '⌘' : ''}${key}`];
  }
  const key = PC_KEYS[shortcut.key] ?? (shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return [[...(shortcut.mod ? ['Ctrl'] : []), ...(shortcut.alt ? ['Alt'] : []), ...(shortcut.shift ? ['Shift'] : []), key].join('+')];
}

/** The same chord for `aria-keyshortcuts`. */
export function ariaKeys(shortcut: Shortcut | null): string | undefined {
  if (!shortcut) return undefined;
  const key = shortcut.key === ' ' ? 'Space' : shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  return [...(shortcut.mod ? [platform === 'macos' ? 'Meta' : 'Control'] : []), ...(shortcut.alt ? ['Alt'] : []), ...(shortcut.shift ? ['Shift'] : []), key].join('+');
}

export function matches(event: KeyboardEvent, shortcut: Shortcut | null): boolean {
  if (!shortcut) return false;
  const mod = platform === 'macos' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  const noMod = !event.metaKey && !event.ctrlKey;
  return (shortcut.mod ? mod : noMod) && event.altKey === Boolean(shortcut.alt) && event.shiftKey === Boolean(shortcut.shift) && event.key.toLowerCase() === shortcut.key.toLowerCase();
}
