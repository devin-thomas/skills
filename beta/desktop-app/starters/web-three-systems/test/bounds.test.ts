// Window restoration, decided without a window (electron/bounds.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBounds } from '../electron/bounds.ts';
import type { Display, Rect, Size } from '../electron/bounds.ts';

const defaultSize = { width: 1120, height: 760 };
const minSize = { minWidth: 720, minHeight: 480 };
const main = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const right = { id: 2, workArea: { x: 1920, y: 0, width: 2560, height: 1400 } };
const small = { id: 3, workArea: { x: -1280, y: 200, width: 1280, height: 680 } };
const place = (saved: unknown, displays: Display[] = [main, right], extra: { positionIsReal?: boolean } = {}) => initialBounds({ saved, displays, primaryId: 1, positionIsReal: true, defaultSize, minSize, ...extra });
const inside = (b: Size & { x?: number; y?: number }, a: Rect) => b.x !== undefined && b.y !== undefined && b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;

test('nothing saved: default size, centred on the primary display', () => {
  const r = place(undefined);
  assert.deepEqual(r.bounds, { x: 400, y: 140, width: 1120, height: 760 });
  assert.equal(r.maximized, false);
  assert.equal(r.displayId, 1);
});

test('a window on the second display reopens there, unchanged', () => {
  const r = place({ x: 2100, y: 100, width: 1200, height: 800 });
  assert.deepEqual(r.bounds, { x: 2100, y: 100, width: 1200, height: 800 });
  assert.equal(r.displayId, 2);
});

test('the second display was unplugged: saved size, centred on the primary', () => {
  const r = place({ x: 2100, y: 100, width: 1200, height: 800 }, [main]);
  assert.equal(r.displayId, 1);
  assert.deepEqual(r.bounds, { x: 360, y: 120, width: 1200, height: 800 });
  assert.match(r.why, /no connected display/);
});

test('a title bar only a sliver on screen does not count as on screen', () => {
  const r = place({ x: 1880, y: 100, width: 1000, height: 700 }, [main]);
  assert.equal(r.displayId, 1);
  assert.ok(inside(r.bounds, main.workArea));
});

test('a window larger than the display it reopens on is shrunk to fit, not below the minimum', () => {
  // Most of the title bar (1,250 of 2,400 px) is on the small display.
  const r = place({ x: -1250, y: 220, width: 2400, height: 1300 }, [main, small]);
  assert.equal(r.displayId, 3);
  assert.deepEqual(r.bounds, { x: -1280, y: 200, width: 1280, height: 680 });
  assert.ok(inside(r.bounds, small.workArea));
});

test('a window partly below the work area is moved up into it', () => {
  const r = place({ x: 200, y: 900, width: 1000, height: 700 });
  assert.ok(inside(r.bounds, main.workArea));
  assert.equal(r.bounds.width, 1000);
  assert.equal(r.bounds.height, 700);
});

test('a window saved maximized reopens maximized over its normal bounds', () => {
  const r = place({ x: 2100, y: 100, width: 1200, height: 800, maximized: true });
  assert.equal(r.maximized, true);
  assert.deepEqual(r.bounds, { x: 2100, y: 100, width: 1200, height: 800 });
});

test('a saved size below the minimum is raised to it', () => {
  const r = place({ x: 100, y: 100, width: 300, height: 200 });
  assert.equal(r.bounds.width, 720);
  assert.equal(r.bounds.height, 480);
});

test('garbage in the saved state is ignored', () => {
  for (const saved of [null, {}, { width: 'wide' }, { width: -5, height: 10 }, { width: NaN, height: 600 }]) {
    const r = place(saved);
    assert.deepEqual(r.bounds, { x: 400, y: 140, width: 1120, height: 760 });
  }
});

test('where the compositor places windows only the size is restored, and it still fits', () => {
  const r = place({ width: 4000, height: 3000, maximized: true }, [main], { positionIsReal: false });
  assert.deepEqual(r.bounds, { width: 1920, height: 1040 });
  assert.equal(r.maximized, true);
  assert.equal('x' in r.bounds, false);
});
