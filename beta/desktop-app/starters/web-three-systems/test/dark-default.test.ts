// Desktop apps are dark by default (D-020). Every app is copied from this starter and inherits this
// test: it fails when a fresh profile renders anything but dark, whatever the operating system's
// theme is. Light is only a choice the person saved, and a saved choice is kept.
//
// The page is built into a throwaway folder and opened in a real browser whose system theme is
// light, in a fresh browser profile (empty storage), the way a first run looks.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { launchBrowser, serveFolder } from '@uppercut-labs/browser-qa-harness';
import type { Browser, Page } from 'playwright-core';
import { DEFAULT_THEME, initialTheme } from '../electron/theme.ts';

const root = path.join(import.meta.dirname, '..');

let out = '';
let browser: Browser;
let site: { url: string; close: () => Promise<void> };
const SIZE = { width: 1180, height: 760 };

before(async () => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-dark-'));
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, stdio: 'pipe' });
  ({ browser } = await launchBrowser({ envVar: 'QA_BROWSER', channels: ['msedge', 'chrome', 'bundled'], args: process.platform === 'linux' ? ['--disable-dev-shm-usage'] : [] }));
  const served = await serveFolder(out, { requireIndex: true, cacheControl: 'no-store' });
  site = { url: served.url.replace(/\/$/, ''), close: () => served.close() };
});

after(async () => {
  await browser?.close();
  await site?.close();
  if (out) fs.rmSync(out, { recursive: true, force: true });
});

/** A new browser profile (empty storage) whose system theme is `system`, with the page open on the stand-in bridge. */
async function open(system: 'light' | 'dark', hash = '') {
  const context = await browser.newContext({ viewport: SIZE, colorScheme: system, locale: 'en-US' });
  const page = await context.newPage();
  await page.goto(`${site.url}/#fixture=default${hash}`);
  await page.waitForSelector('.app');
  return { context, page };
}

// Written as text so this file needs no browser types: it runs inside the page.
const APPEARANCE = `(() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return {
    theme: document.documentElement.dataset.theme,
    scheme: getComputedStyle(document.documentElement).colorScheme,
    lightness: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
    systemIsDark: matchMedia('(prefers-color-scheme: dark)').matches,
  };
})()`;

interface Appearance {
  theme: string;
  scheme: string;
  lightness: number;
  systemIsDark: boolean;
}

/** What the page shows: its theme name, its colour scheme and how light its background is (0 black, 1 white). */
const appearance = (page: Page): Promise<Appearance> => page.evaluate(APPEARANCE);

test('the shell starts dark with no saved choice, and keeps a saved light', () => {
  assert.equal(DEFAULT_THEME, 'dark');
  for (const none of [undefined, null, '', 'dark', 'system', 'auto', 1, {}, 'LIGHT']) assert.equal(initialTheme(none), 'dark', String(none));
  assert.equal(initialTheme('light'), 'light');
});

test('the main window takes its theme from initialTheme and never asks the system', () => {
  const window = fs.readFileSync(path.join(root, 'electron', 'window.ts'), 'utf8');
  assert.match(window, /initialTheme\(saved\.theme\)/, 'electron/window.ts must choose the theme with initialTheme (electron/theme.ts)');
  assert.doesNotMatch(window, /nativeTheme|shouldUseDarkColors/, 'a first run must not follow the system theme');
});

test('a fresh profile renders dark while the system theme is light', async () => {
  const { context, page } = await open('light');
  try {
    const shown = await appearance(page);
    assert.equal(shown.systemIsDark, false, 'the test must run with a light system theme');
    assert.equal(shown.theme, 'dark', 'a fresh profile must start in the dark theme');
    assert.equal(shown.scheme, 'dark');
    assert.ok(shown.lightness < 0.25, `a fresh profile must paint a dark background, got lightness ${shown.lightness.toFixed(2)}`);
  } finally {
    await context.close();
  }
});

test('a fresh profile renders dark while the system theme is dark too', async () => {
  const { context, page } = await open('dark');
  try {
    const shown = await appearance(page);
    assert.equal(shown.theme, 'dark');
    assert.ok(shown.lightness < 0.25);
  } finally {
    await context.close();
  }
});

test('light is a remembered choice: saved in the page, or named by the shell from its saved state', async () => {
  const { context, page } = await open('dark');
  try {
    await page.evaluate("localStorage.setItem('app.theme', 'light')");
    await page.reload();
    await page.waitForSelector('.app');
    const saved = await appearance(page);
    assert.equal(saved.theme, 'light', 'a saved light choice must be kept');
    assert.ok(saved.lightness > 0.5, `light must paint a light background, got lightness ${saved.lightness.toFixed(2)}`);
  } finally {
    await context.close();
  }
  for (const [named, expected] of [['light', 'light'], ['dark', 'dark']] as const) {
    const fresh = await open('dark', `&theme=${named}`);
    try {
      assert.equal((await appearance(fresh.page)).theme, expected, `the shell naming ${named} must win`);
    } finally {
      await fresh.context.close();
    }
  }
});
