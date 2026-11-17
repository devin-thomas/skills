// Shared helpers for the screenshot and audit scripts. Everything runs headless;
// no window is shown and nothing can take focus or make a sound. The production
// build is served from this process on 127.0.0.1, so there is no separate server
// to stop. The page runs against the stand-in bridge (src/bridge.fake.ts), whose
// fixture is chosen in the address's fragment.
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

// Muted always, and headless: no window opens and nothing takes focus.
const ARGS = ['--mute-audio'];
// Linux containers usually have a small /dev/shm.
if (process.platform === 'linux') ARGS.push('--disable-dev-shm-usage');

// Browser, in order: QA_BROWSER (a path to any Chromium-family executable), Edge, Chrome,
// then Playwright's own Chromium if it has been fetched (`pnpm exec playwright-core install
// chromium`): the route for Linux on arm64, where neither Edge nor Chrome exists.
export async function launch() {
  const tried = [];
  const attempts = [
    ...(process.env.QA_BROWSER ? [['QA_BROWSER', { executablePath: process.env.QA_BROWSER }]] : []),
    ['msedge', { channel: 'msedge' }],
    ['chrome', { channel: 'chrome' }],
    ['playwright-chromium', {}],
  ];
  for (const [name, options] of attempts) {
    try {
      const browser = await chromium.launch({ ...options, headless: true, args: ARGS });
      return { browser, channel: name };
    } catch (error) {
      tried.push(`${name}: ${String(error).split('\n')[0]}`);
    }
  }
  throw new Error(`No browser could be launched headless.\n${tried.join('\n')}`);
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
  // "Copy details" writes to the clipboard. A headless browser may share the machine's
  // clipboard, which belongs to the person using it (build 2 overwrote it once): the write
  // is caught here instead, and the checks read what would have been copied from
  // window.__copied.
  await context.addInitScript(() => {
    window.__copied = [];
    const capture = async (text) => {
      window.__copied.push(String(text));
    };
    try {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: capture, readText: async () => window.__copied.at(-1) ?? '' } });
    } catch {
      // The page then takes its own fallback, which is caught below.
    }
    document.execCommand = (command) => {
      if (command === 'copy') window.__copied.push(String(document.getSelection() ?? ''));
      return command === 'copy';
    };
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

/** Opens the app on a fixture of the stand-in bridge (src/bridge.fake.ts), with options ("platform=macos"). */
export async function load(page, base, fixture = 'default', options = '') {
  await page.goto(`${base}/#fixture=${fixture}${options ? `&${options}` : ''}`);
  await page.waitForSelector('.app');
  await page.evaluate(() => document.fonts.ready);
}

/** Calls the page made to the stand-in bridge, by name. */
export const calls = (page, name) => page.evaluate((n) => (window.__desktopCalls ?? []).filter((c) => c.name === n), name);

/** The modifier for a platform's key family: Meta on macOS, Control elsewhere. */
export const modFor = (platform) => (platform === 'macos' ? 'Meta' : 'Control');

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
