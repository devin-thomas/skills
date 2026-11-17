// The one table of keyboard shortcuts. The key handler, the command palette
// and the tooltips all read it, so a shortcut cannot exist in one place only.
// Every shortcut uses Ctrl. None uses a key that edits text (A, C, V, X, Z, Y,
// Backspace, Delete, arrows, Home, End).

export interface Shortcut {
  key: string;
  shift?: boolean;
}

export const SHORTCUTS = {
  palette: { key: 'k' },
  clear: { key: 'd', shift: true },
  focusTitle: { key: 't', shift: true },
  focusBody: { key: 'm', shift: true },
  items: { key: 'r', shift: true },
  theme: { key: 'l', shift: true },
} as const satisfies Record<string, Shortcut>;

export function keysOf(shortcut: Shortcut): string[] {
  const key = shortcut.key === 'Enter' ? '↵' : shortcut.key.toUpperCase();
  return ['Ctrl', ...(shortcut.shift ? ['Shift'] : []), key];
}

export function matches(event: KeyboardEvent, shortcut: Shortcut): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    event.shiftKey === Boolean(shortcut.shift) &&
    event.key.toLowerCase() === shortcut.key.toLowerCase()
  );
}
