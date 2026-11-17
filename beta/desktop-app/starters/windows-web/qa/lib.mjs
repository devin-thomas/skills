// Shared helpers for the screenshot and audit scripts. Everything runs headless
// in the installed Edge (or Chrome) channel; no window is shown and no browser
// binary is downloaded. The production build is served from this process on
// 127.0.0.1, so there is no separate server to stop.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const dist = join(root, 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

export async function serve(dir = dist) {
  if (!existsSync(join(dir, 'index.html'))) throw new Error(`No build at ${dir}. Run "pnpm build" first.`);
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = normalize(join(dir, path === '/' ? 'index.html' : path));
      if (!file.startsWith(dir)) throw new Error('outside root');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

export async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      const browser = await chromium.launch({ channel, headless: true });
      return { browser, channel };
    } catch (error) {
      console.warn(`channel ${channel} unavailable: ${String(error).split('\n')[0]}`);
    }
  }
  throw new Error('Neither Edge nor Chrome could be launched headless.');
}

export const FIXED_TIME = new Date('2026-11-14T14:14:00');

export async function openPage(browser, { width, height, scale = 1, theme = 'light', reducedMotion = 'no-preference' }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: theme,
    reducedMotion,
    locale: 'en-US',
    timezoneId: 'America/Chicago',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_TIME);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return { context, page, errors };
}

export async function load(page, base, hash = '') {
  await page.goto(`${base}/${hash ? `#${hash}` : ''}`);
  await page.waitForSelector('.app');
  await page.evaluate(() => document.fonts.ready);
}

export const BODY = `The plan for the week, in the order it has to happen.

1. Finish the list view and measure it with ten thousand rows.
2. Write the three journeys down and count the steps in each.

If Thursday at 3:00 PM still works, the review happens then.`;

/** Writes a complete note the way a person would: by typing. Change this with the app's first screen. */
export async function fill(page) {
  await page.fill('#field-title', 'Plan for the week');
  await page.fill('#field-body', BODY);
  await page.waitForTimeout(350); // let the draft save
}

export async function park(page) {
  // Park the pointer on the empty title bar so nothing shows a hover state.
  await page.mouse.move(300, 4);
}

/** Resolves when no CSS transition or animation is running (spinners excepted). */
export async function settle(page) {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState !== 'running'),
    null,
    { timeout: 5000 },
  );
  await page.waitForTimeout(60);
}
