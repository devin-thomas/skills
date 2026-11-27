// The theme the real shell opens in, on a throwaway data folder per case, through the control
// channel only (never a second instance, never focus). Four cases (D-020, D-022):
//
//   unmarked  window.json holds light with no mark of a choice (what a page that reports its
//             starting theme, or an older build, can leave behind): the window opens dark, its
//             colour is the dark chrome colour, the page is dark, and window.json is rewritten dark.
//   chosen    window.json holds light with themeChosenBy "user": the window opens light, and the
//             mark survives the start.
//   fresh     no window.json: dark.
//   dark      window.json holds dark with no mark: dark, nothing added.
//
// Each case also checks that the system's own parts (menus, scrollbars, the frame) follow the
// app's theme, not the system's, and that the window did not take focus. The page with scripts
// off is checked by test/dark-default.test.ts.
//
// --show-at=<x,y> opens the windows at that point (a second display, so they stay out of the way).
// Usage: node qa/theme-start.ts   (writes qa/evidence/theme-start.json)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Diagnostics } from '../electron/main.ts';
import { launchDev, root } from '../scripts/lib/launch.ts';

const evidence = join(root, 'qa', 'evidence');
const at = process.argv.find((a) => a.startsWith('--show-at='))?.slice(10).split(',').map(Number);
const bounds = at && at.length === 2 ? { x: at[0], y: at[1], width: 1180, height: 760 } : undefined;
// The window's background colours, as electron/main.ts gives them (COLOURS.chrome).
const DARK = '#141413';
const LIGHT = '#f6f5f3';
/** getBackgroundColor() answers #AARRGGBB or #RRGGBB depending on the system; compare the colour part. */
const rgb = (hex: string): string => hex.replace('#', '').slice(-6).toLowerCase();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const failures: string[] = [];
const results: Record<string, unknown> = {};
const check = (trial: string, condition: unknown, message: string): void => {
  if (!condition) failures.push(`${trial}: ${message}`);
};

interface Expect {
  theme: 'dark' | 'light';
  background: string;
  /** fields window.json must hold after the start */
  savedAfter: Record<string, unknown>;
}

async function startCase(name: string, windowState: Record<string, unknown> | null, expect: Expect): Promise<void> {
  const dataDir = join(root, 'qa', 'data', `theme-${name}`);
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  if (windowState) writeFileSync(join(dataDir, 'window.json'), JSON.stringify({ ...windowState, ...(bounds ? { bounds } : {}) }));
  const app = launchDev({ dataDir, timeoutMs: 120_000 });
  try {
    const file = join(evidence, `theme-${name}-diagnostics.json`);
    // The page has to have loaded for its probe to answer: ask until it does.
    let diag: Diagnostics | null = null;
    for (let i = 0; i < 60 && !diag?.shell?.window?.page?.theme; i++) {
      await sleep(500);
      rmSync(file, { force: true });
      const reply = await app.ask([`--diagnostics=${file}`]);
      if (reply.ok && existsSync(file)) diag = JSON.parse(readFileSync(file, 'utf8')) as Diagnostics;
    }
    rmSync(file, { force: true });
    const win = diag?.shell?.window;
    check(name, win?.open, 'the window is not open');
    check(name, win?.chosen?.theme === expect.theme, `the window chose ${win?.chosen?.theme}, expected ${expect.theme}`);
    check(name, win && rgb(win.backgroundColor ?? '') === rgb(expect.background), `the window background is ${win?.backgroundColor}, expected ${expect.background}`);
    check(name, win?.nativeTheme?.themeSource === expect.theme, `the system's own parts follow ${win?.nativeTheme?.themeSource}, expected ${expect.theme}`);
    check(name, win?.page?.theme === expect.theme, `the page is in ${win?.page?.theme}, expected ${expect.theme}`);
    check(name, win?.page?.dark === (expect.theme === 'dark'), `the page's colour scheme is ${win?.page?.dark ? 'dark' : 'light'}`);
    check(name, win?.focused === false, 'the window took focus');
    // A fresh data folder has no window.json until the window's size is first saved.
    const stateFile = join(dataDir, 'window.json');
    const saved = existsSync(stateFile) ? (JSON.parse(readFileSync(stateFile, 'utf8')) as Record<string, unknown>) : {};
    for (const [k, v] of Object.entries(expect.savedAfter)) check(name, saved[k] === v, `window.json ${k} is ${JSON.stringify(saved[k])}, expected ${JSON.stringify(v)}`);
    if (!('themeChosenBy' in expect.savedAfter)) check(name, !('themeChosenBy' in saved), `window.json has themeChosenBy ${JSON.stringify(saved['themeChosenBy'])} with no pick made`);
    const life = await app.lifecycle();
    check(name, life?.secondLaunches === 0, `the app counted ${life?.secondLaunches} second launches`);
    results[name] = {
      theme: win?.chosen?.theme,
      background: win?.backgroundColor,
      themeSource: win?.nativeTheme?.themeSource,
      page: win?.page && { theme: win.page.theme, background: win.page.pageBackground, dark: win.page.dark },
      savedAfter: saved,
    };
  } finally {
    await app.stop();
    await app.exited;
    rmSync(dataDir, { recursive: true, force: true });
  }
}

mkdirSync(evidence, { recursive: true });
await startCase('unmarked', { theme: 'light' }, { theme: 'dark', background: DARK, savedAfter: { theme: 'dark' } });
await startCase('chosen', { theme: 'light', themeChosenBy: 'user' }, { theme: 'light', background: LIGHT, savedAfter: { theme: 'light', themeChosenBy: 'user' } });
await startCase('fresh', null, { theme: 'dark', background: DARK, savedAfter: {} });
await startCase('dark', { theme: 'dark' }, { theme: 'dark', background: DARK, savedAfter: { theme: 'dark' } });
writeFileSync(join(evidence, 'theme-start.json'), JSON.stringify({ at: new Date().toISOString(), system: process.platform, results, failures, passed: failures.length === 0 }, null, 2));
if (failures.length) {
  console.error(`theme-start: ${failures.length} failure(s)\n${failures.map((f) => `  ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`theme-start: all cases pass (${Object.keys(results).join(', ')})`);
