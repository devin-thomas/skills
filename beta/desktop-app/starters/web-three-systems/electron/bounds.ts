// Where the window opens, from what was saved and the displays connected now. No Electron
// import: the decision is a pure function of its inputs, so test/bounds.test.ts can try every
// case (a monitor unplugged, a smaller monitor, a window saved maximized) without a window.
//
// Saved state, written by window.ts:
//   { x, y, width, height, maximized }   x and y only where the system lets an app place its
//                                        window (platform.ts, facts.positionIsReal); width and
//                                        height are the normal (not maximized) size
//
// Rules (premium bar, "Window restoration"):
//   - The window opens on the display it was saved on, at its saved size, when that display is
//     still connected and the saved title bar would be on it.
//   - Otherwise it opens centred on the primary display at its saved size. A saved position is
//     never trusted only because some display exists.
//   - It always fits the work area of the display it opens on: never larger, never partly
//     outside, never smaller than the app's minimum.
//   - A window saved maximized opens maximized, over the normal bounds it had before, so
//     unmaximizing returns it to where the person left it.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Display {
  id: number;
  workArea: Rect;
}
export interface Size {
  width: number;
  height: number;
}
/** What window.ts saved, as read back from window.json: anything at all. */
export type SavedBounds = unknown;
export interface Placement {
  bounds: Size & { x?: number; y?: number };
  maximized: boolean;
  displayId: number;
  why: string;
}

/** Pixels of the title bar that must be on a display for a saved position to count. */
export const GRIP = { width: 120, height: 32 };

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const finite = (...values: unknown[]): boolean => values.every((v) => Number.isFinite(v));
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));
const number = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  return typeof value === 'number' ? value : NaN;
};

/**
 * The display a saved window belongs to: the one holding most of its title bar, or null when no
 * connected display holds a GRIP-sized part of it.
 */
export function homeDisplay(saved: Rect, displays: Display[]): Display | null {
  const bar = { x: saved.x, y: saved.y, width: saved.width, height: GRIP.height };
  let best: Display | null = null;
  let bestArea = 0;
  for (const d of displays) {
    const area = overlap(bar, d.workArea);
    if (area > bestArea) {
      best = d;
      bestArea = area;
    }
  }
  return bestArea >= GRIP.width * Math.min(GRIP.height, saved.height) ? best : null;
}

export function initialBounds({
  saved,
  displays,
  primaryId,
  positionIsReal,
  defaultSize,
  minSize,
}: {
  saved: SavedBounds;
  displays: Display[];
  primaryId: number;
  positionIsReal: boolean;
  defaultSize: Size;
  minSize: { minWidth: number; minHeight: number };
}): Placement {
  const primary = displays.find((d) => d.id === primaryId) ?? displays[0];
  if (!primary) throw new Error('no display is connected');
  const record = saved !== null && typeof saved === 'object' ? (saved as Record<string, unknown>) : null;
  const kept = record && finite(record['width'], record['height']) && number(record, 'width') > 0 && number(record, 'height') > 0 ? { width: number(record, 'width'), height: number(record, 'height') } : null;
  const maximized = Boolean(kept && record?.['maximized'] === true);

  const fit = (size: Size, area: Rect): Size => ({
    width: clamp(Math.round(size.width), minSize.minWidth, area.width),
    height: clamp(Math.round(size.height), minSize.minHeight, area.height),
  });
  const centred = (display: Display, size: Size, why: string): Placement => {
    const a = display.workArea;
    const s = fit(size, a);
    return { bounds: { x: Math.round(a.x + (a.width - s.width) / 2), y: Math.round(a.y + (a.height - s.height) / 2), ...s }, maximized, displayId: display.id, why };
  };

  if (!positionIsReal) {
    // The compositor places the window (Wayland); only its size is the app's to restore.
    return { bounds: fit(kept ?? defaultSize, primary.workArea), maximized, displayId: primary.id, why: kept ? 'size restored; the compositor places the window' : 'default size; the compositor places the window' };
  }
  if (!kept || !record) return centred(primary, defaultSize, 'nothing saved: default size, centred on the primary display');
  if (!finite(record['x'], record['y'])) return centred(primary, kept, 'no saved position: saved size, centred on the primary display');
  const at = { x: number(record, 'x'), y: number(record, 'y'), ...kept };

  const home = homeDisplay(at, displays);
  if (!home) return centred(primary, kept, 'the saved position is on no connected display: saved size, centred on the primary display');

  const a = home.workArea;
  const s = fit(kept, a);
  const x = clamp(Math.round(at.x), a.x, a.x + a.width - s.width);
  const y = clamp(Math.round(at.y), a.y, a.y + a.height - s.height);
  const moved = x !== Math.round(at.x) || y !== Math.round(at.y) || s.width !== Math.round(at.width) || s.height !== Math.round(at.height);
  return { bounds: { x, y, ...s }, maximized, displayId: home.id, why: moved ? 'saved display: moved or shrunk to fit its work area' : 'saved display, position and size' };
}
