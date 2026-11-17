// Captures every state at two window sizes, two device scales and both themes,
// headless. These pictures are what the independent critic gets: screenshots
// only, never the code, the audit or the builder's notes.
// Usage: node qa/shots.mjs [outDir] [--quick]
//   --quick  one size, one scale, both themes (for critique rounds)
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fill, launch, load, openPage, park, root, serve, settle } from './lib.mjs';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const outDir = join(root, args.find((a) => !a.startsWith('--')) ?? 'qa/shots');

const SIZES = quick ? [[1280, 800]] : [[1280, 800], [1024, 700]];
const SCALES = quick ? [1] : [1, 1.25];
const THEMES = ['light', 'dark'];

const filterItems = async (page, text) => {
  await page.keyboard.press('Control+Shift+R');
  await page.waitForFunction(() => document.activeElement?.id === 'rail-filter');
  await page.keyboard.type(text);
};

/** Name and the steps that reach the state. Rewrite for the app; include every designed empty, error and dense state. */
const STATES = [
  ['01-empty', async () => {}],
  ['02-filled', async (page) => fill(page)],
  ['03-list-scrolled', async (page) => {
    await fill(page);
    const list = page.getByRole('listbox', { name: 'All items' });
    await list.evaluate((el) => {
      el.scrollTop = 4212 * 40;
    });
    await page.waitForTimeout(120);
  }],
  ['04-filtered', async (page) => {
    await fill(page);
    await filterItems(page, 'cedar');
  }],
  ['05-no-match', async (page) => filterItems(page, 'zzq')],
  ['06-command-palette', async (page) => {
    await fill(page);
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.palette');
  }],
  ['07-toast-undo', async (page) => {
    await fill(page);
    await page.click('#action-clear');
    await page.waitForSelector('.toast');
  }],
  ['08-about', async (page) => {
    await page.keyboard.press('Control+k');
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
const problems = [];

async function capture(dir, name, steps, options) {
  const { context, page, errors } = await openPage(browser, options);
  try {
    await load(page, url);
    await steps(page);
    await park(page);
    await settle(page);
    await page.screenshot({ path: join(dir, `${name}.png`) });
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
        for (const [name, steps] of STATES) await capture(dir, name, steps, { width, height, scale, theme });
      }
    }
  }
  // The 200% zoom case: a 1024x700 window zoomed to 200% lays out as 512x350 CSS px.
  const zoomDir = join(outDir, 'zoom-200-of-1024x700');
  await mkdir(zoomDir, { recursive: true });
  for (const theme of THEMES) {
    for (const [name, steps] of STATES.slice(0, 2)) await capture(zoomDir, `${name}-${theme}`, steps, { width: 512, height: 350, scale: 2, theme });
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
