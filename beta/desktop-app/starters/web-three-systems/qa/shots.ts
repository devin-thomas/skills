// Captures every state at the app's default and minimum window, two device
// scales, the dark theme (and light in a full run) and every system's key family, headless. These pictures are
// what the independent critic gets: screenshots only, never the code, the audit or
// the builder's notes. Each state opens on a fixture of the stand-in bridge
// (src/bridge.fake.ts), so every designed state can be photographed directly.
// Usage: node qa/shots.ts [outDir] [--quick]
//   --quick  the default size only, one scale, the dark theme (for critique rounds)
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import { fill, launch, load, modFor, openPage, park, readConfig, root, serve, settle } from './lib.ts';
import type { PageOptions } from './lib.ts';

const W = readConfig().window;

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const outDir = join(root, args.find((a) => !a.startsWith('--')) ?? 'qa/shots');

const SIZES: [number, number][] = quick ? [[W.width, W.height]] : [[W.width, W.height], [W.minWidth, W.minHeight]];
// The page is the same on every system except the title bar inset and the key labels.
const PLATFORMS = quick ? ['windows', 'macos'] : ['windows', 'macos', 'linux'];
const SCALES = quick ? [1] : [1, 1.25];
// Dark is the default theme (D-020): a critique round sees it alone, a full run adds light.
const THEMES = quick ? (['dark'] as const) : (['dark', 'light'] as const);

/** The steps that reach a state, given the page and the key family's modifier. */
type Steps = (page: Page, mod: 'Meta' | 'Control') => Promise<unknown>;

// Every step is given the key family's modifier ("Control" or "Meta"): a page told it runs on
// macOS answers Command, not Control (pressing Control there timed out every keyboard state).
const filterItems = async (page: Page, text: string, mod: 'Meta' | 'Control') => {
  await page.keyboard.press(`${mod}+Shift+R`);
  await page.waitForFunction(() => document.activeElement?.id === 'rail-filter');
  await page.keyboard.type(text);
};

/** Name, the steps that reach the state, and the stand-in fixture. Rewrite for the app; include every designed empty, error and dense state. */
const STATES: [string, Steps, string?][] = [
  ['01-empty', async () => {}],
  ['02-filled', async (page) => fill(page)],
  ['03-list-scrolled', async (page, mod) => {
    await fill(page);
    const list = page.getByRole('listbox', { name: 'All items' });
    // Too narrow to dock the list (the 200% zoom case): the shortcut shows it first.
    if (!(await list.isVisible())) {
      await page.keyboard.press(`${mod}+Shift+R`);
      await list.waitFor({ state: 'visible' });
    }
    await list.evaluate((el: Element) => {
      el.scrollTop = 4212 * 40;
    });
    await page.waitForTimeout(120);
  }],
  ['04-filtered', async (page, mod) => {
    await fill(page);
    await filterItems(page, 'cedar', mod);
  }],
  ['05-no-match', async (page, mod) => filterItems(page, 'zzq', mod)],
  ['06-command-palette', async (page, mod) => {
    await fill(page);
    await page.keyboard.press(`${mod}+k`);
    await page.waitForSelector('.palette');
  }],
  ['07-toast-undo', async (page) => {
    await fill(page);
    await page.click('#action-clear');
    await page.waitForSelector('.toast');
  }],
  ['08-about', async (page, mod) => {
    await page.keyboard.press(`${mod}+k`);
    await page.keyboard.type('about');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.dialog');
  }],
  ['09-window-inactive', async (page) => {
    await fill(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  }],
  // Worst-case content: a 300-character title and a long unbroken body line.
  ['10-worst-case-text', async (page) => {
    await page.fill('#field-title', 'A'.repeat(300));
    await page.fill('#field-body', `${'W'.repeat(200)}\n${'word '.repeat(400)}`);
  }],
];

const { url, close } = await serve();
const { browser, channel } = await launch();
console.log(`serving ${url}, browser channel ${channel}, writing ${outDir}`);
let count = 0;
const problems: string[] = [];

async function capture(dir: string, name: string, steps: Steps, options: PageOptions, fixture = 'default', platform = 'windows'): Promise<void> {
  const { context, page, errors } = await openPage(browser, options);
  try {
    await load(page, url, fixture, `platform=${platform}`);
    await steps(page, modFor(platform));
    await park(page);
    await settle(page);
    // animations: 'disabled' finishes every CSS animation and transition before the capture, so
    // two runs of the same state give the same picture (an entrance caught mid-way differed by
    // up to 95% between identical runs; qa/visual.ts compares these pictures).
    await page.screenshot({ path: join(dir, `${name}.png`), animations: 'disabled' });
    count += 1;
  } catch (error) {
    problems.push(`${name} ${JSON.stringify(options)}: ${String(error).split('\n')[0]}`);
  }
  if (errors.length) problems.push(`${name}: page errors: ${errors.join(' | ')}`);
  await context.close();
}

try {
  for (const [width, height] of SIZES) {
    for (const scale of SCALES) {
      for (const theme of THEMES) {
        const dir = join(outDir, `${width}x${height}@${scale}x-${theme}`);
        await mkdir(dir, { recursive: true });
        for (const [name, steps, fixture] of STATES) await capture(dir, name, steps, { width, height, scale, theme }, fixture);
      }
    }
  }
  // Every system's labels and title bar inset, at the default size in the dark theme.
  for (const platform of PLATFORMS) {
    const dir = join(outDir, `${platform}-${W.width}x${W.height}-dark`);
    await mkdir(dir, { recursive: true });
    for (const [name, steps, fixture] of STATES) await capture(dir, name, steps, { width: W.width, height: W.height, scale: 1, theme: 'dark' }, fixture, platform);
  }
  // A system contrast theme (forced colours), on a dark and a light system, at the default size.
  for (const theme of ['dark', 'light'] as const) {
    const dir = join(outDir, `forced-colors-${W.width}x${W.height}-${theme}`);
    await mkdir(dir, { recursive: true });
    for (const [name, steps, fixture] of STATES) await capture(dir, name, steps, { width: W.width, height: W.height, scale: 1, theme, forcedColors: 'active' }, fixture);
  }
  // The 200% zoom case: the default window zoomed to 200% lays out at half its size in CSS px.
  const zoomDir = join(outDir, `zoom-200-of-${W.width}x${W.height}`);
  await mkdir(zoomDir, { recursive: true });
  for (const theme of THEMES) {
    for (const [name, steps, fixture] of STATES) await capture(zoomDir, `${name}-${theme}`, steps, { width: Math.round(W.width / 2), height: Math.round(W.height / 2), scale: 2, theme }, fixture);
  }
} finally {
  await browser.close();
  await close();
}

console.log(`${count} screenshots written`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
