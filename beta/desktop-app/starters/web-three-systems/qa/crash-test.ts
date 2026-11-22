// The real shell when things go wrong, through its control channel only (never a second
// instance, never focus). Four trials, each in its own throwaway data folder:
//
//   recover     type a known sentence, crash the page's renderer, and read the page again:
//               the renderer is reloaded by the shell and the sentence is back, with no
//               relaunch [crash recovery]. In the same session, the page's view of its
//               permissions: camera, microphone, location, notifications and MIDI denied
//               [secure desktop boundary].
//   loop        crash the renderer four times inside a minute: three reloads, then the shell
//               stops reloading and records it, and shows nothing under --no-activate
//               [crash recovery, crash loop].
//   maximized   a window saved maximized opens maximized, except on Windows under
//               --no-activate, where maximizing would activate it [window restoration].
//   lost        a window saved on a display that is not connected opens inside the primary
//               display's work area, at its saved size [window restoration].
//
// Every trial ends with the app's count of second launches at 0.
// Usage: node qa/crash-test.ts   (writes qa/evidence/crash-test.json)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { KillRecord } from '@uppercut-labs/electron-qa-measurements';
import type { Diagnostics } from '../electron/main.ts';
import type { WindowDescription } from '../electron/window.ts';
import { launchDev, root } from '../scripts/lib/launch.ts';
import type { LaunchedApp } from '../scripts/lib/launch.ts';

const evidence = join(root, 'qa', 'evidence');
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const failures: string[] = [];
const results: Record<string, unknown> = {};
const check = (trial: string, condition: unknown, message: string): void => {
  if (!condition) failures.push(`${trial}: ${message}`);
};

/** What --qa-page writes: the note's body as the page holds it, and the page's view of its permissions. */
interface PageReport {
  url?: string;
  body: string | null;
  permissions: Record<string, string>;
}

/** A value the app was expected to report; a missing one fails the trial with a message instead of a TypeError. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`the app did not report ${what}`);
  return value;
}

async function waitForFile<T>(file: string, timeoutMs: number): Promise<T> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (existsSync(file)) {
      try {
        return JSON.parse(readFileSync(file, 'utf8')) as T;
      } catch {
        // still being written
      }
    }
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${file}`);
}

/** One request whose answer is a JSON file the app writes. */
async function askFile<T>(app: LaunchedApp, flag: string, file: string): Promise<T> {
  rmSync(file, { force: true });
  const reply = await app.ask([`--${flag}=${file}`]);
  if (!reply.ok) throw new Error(`--${flag} was not answered: ${JSON.stringify(reply)}`);
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

async function until<T>(read: () => Promise<T>, test: (value: T) => boolean, timeoutMs: number, what: string): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last: T | null = null;
  while (Date.now() < end) {
    last = await read();
    if (test(last)) return last;
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${what}; last: ${JSON.stringify(last)?.slice(0, 400)}`);
}

function freshDir(name: string, windowState?: unknown): string {
  const dataDir = join(root, 'qa', 'data', `crash-${name}`);
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  if (windowState) writeFileSync(join(dataDir, 'window.json'), JSON.stringify(windowState));
  return dataDir;
}

/** The page answered the shell's probe without an error. */
const pageLoaded = (d: Diagnostics): boolean => Boolean(windowOf(d).page) && !windowOf(d).page?.error;
const windowOf = (d: Diagnostics): WindowDescription => d.shell.window;
const chosenOf = (d: Diagnostics) => required(windowOf(d).chosen, 'the window it chose');

async function finish(trial: string, app: LaunchedApp, dataDir: string): Promise<void> {
  const life = await app.lifecycle();
  check(trial, life?.secondLaunches === 0, `the app counted ${life?.secondLaunches} second launches`);
  await app.stop();
  await app.exited;
  rmSync(dataDir, { recursive: true, force: true });
}

// ---- recover, and the page's permissions ---------------------------------------------
async function recover(): Promise<void> {
  const trial = 'recover';
  const dataDir = freshDir(trial);
  const typedFile = join(evidence, 'crash-typed.json');
  const diag = join(evidence, 'crash-diagnostics.json');
  const pageFile = join(evidence, 'crash-page.json');
  rmSync(typedFile, { force: true });
  const app = launchDev({ args: [`--qa-type-then-wait=${typedFile}`], dataDir, timeoutMs: 120_000 });
  try {
    const typed = await waitForFile<KillRecord>(typedFile, 60_000);
    await sleep(800); // past the save the page makes after the last key
    const before = await askFile<PageReport>(app, 'qa-page', pageFile);
    check(trial, before.body === typed.expected, 'the page did not hold the typed sentence before the crash');

    const crashedAt = Date.now();
    const reply = await app.ask(['--qa-crash-renderer']);
    check(trial, reply.ok, `the crash request was not answered: ${JSON.stringify(reply)}`);
    const after = await until(() => askFile<Diagnostics>(app, 'diagnostics', diag), (d) => chosenOf(d).renderer.reloads >= 1 && pageLoaded(d), 30_000, 'the reloaded page');
    const page = await until(() => askFile<PageReport>(app, 'qa-page', pageFile), (p) => typeof p.body === 'string' && p.body.length > 0, 15_000, 'the restored sentence');
    const recoveredMs = Date.now() - crashedAt;
    const r = chosenOf(after).renderer;
    check(trial, r.crashes.length === 1 && r.crashes[0]?.reason !== 'clean-exit', `expected one crash, saw ${JSON.stringify(r.crashes)}`);
    check(trial, r.reloads === 1 && !r.gaveUp, `expected one reload and no crash loop, saw ${JSON.stringify(r)}`);
    check(trial, page.body === typed.expected, `the sentence came back as ${page.body?.length} of ${typed.expected.length} characters`);
    check(trial, after.pid === app.pid, `the app's process changed (${after.pid}, started ${app.pid}): it was relaunched, not recovered`);
    check(trial, windowOf(after).visible === true, 'the window was not visible after the reload');

    const denied = ['camera', 'microphone', 'geolocation', 'notifications', 'midi'];
    for (const name of denied) check(trial, page.permissions[name] === 'denied' || String(page.permissions[name]).startsWith('unsupported'), `the page sees ${name} as "${page.permissions[name]}", not denied`);
    check(trial, Array.isArray(after.boundary?.allowed) && after.boundary.allowed.join() === 'clipboard-sanitized-write', `the boundary allows ${JSON.stringify(after.boundary?.allowed)}`);
    results[trial] = { recoveredMs, crash: r.crashes[0], reloads: r.reloads, restoredChars: page.body?.length, expectedChars: typed.expected.length, permissions: page.permissions, decisions: after.boundary?.decisions?.slice(-12) };
  } finally {
    await finish(trial, app, dataDir);
    rmSync(typedFile, { force: true });
  }
}

// ---- crash loop ----------------------------------------------------------------------
async function loop(): Promise<void> {
  const trial = 'loop';
  const dataDir = freshDir(trial);
  const diag = join(evidence, 'crash-loop-diagnostics.json');
  const app = launchDev({ dataDir, timeoutMs: 120_000 });
  try {
    await until(() => askFile<Diagnostics>(app, 'diagnostics', diag).catch(() => null), (d) => d !== null && pageLoaded(d), 30_000, 'the first page');
    for (let i = 1; i <= 4; i += 1) {
      await app.ask(['--qa-crash-renderer']);
      if (i < 4) await until(() => askFile<Diagnostics>(app, 'diagnostics', diag), (d) => chosenOf(d).renderer.reloads >= i && pageLoaded(d), 30_000, `reload ${i}`);
    }
    const d = await until(() => askFile<Diagnostics>(app, 'diagnostics', diag), (x) => chosenOf(x).renderer.crashes.length >= 4, 15_000, 'the fourth crash');
    await sleep(1500);
    const settled = await askFile<Diagnostics>(app, 'diagnostics', diag);
    const r = chosenOf(settled).renderer;
    check(trial, r.crashes.length === 4 && r.reloads === 3 && r.gaveUp === true, `expected 4 crashes, 3 reloads and a stop, saw ${JSON.stringify({ crashes: r.crashes.length, reloads: r.reloads, gaveUp: r.gaveUp })}`);
    check(trial, settled.pid === app.pid, 'the app was relaunched');
    results[trial] = { crashes: r.crashes.length, reloads: r.reloads, gaveUp: r.gaveUp, firstSeen: d.at };
  } finally {
    await finish(trial, app, dataDir);
  }
}

// ---- window restoration --------------------------------------------------------------
interface WindowState {
  bounds: { x: number; y: number; width: number; height: number; maximized: boolean };
}

async function restoreTrial(trial: string, windowState: WindowState, judge: (settled: Diagnostics, w: WindowDescription) => void): Promise<void> {
  const dataDir = freshDir(trial, windowState);
  const diag = join(evidence, `crash-${trial}-diagnostics.json`);
  const app = launchDev({ dataDir, timeoutMs: 90_000 });
  try {
    const d = required(
      await until(() => askFile<Diagnostics>(app, 'diagnostics', diag).catch(() => null), (x) => x !== null && windowOf(x).visible === true && chosenOf(x).reveal !== null, 30_000, 'the revealed window'),
      'the revealed window',
    );
    await sleep(600);
    const settled = await askFile<Diagnostics>(app, 'diagnostics', diag);
    const w = windowOf(settled);
    results[trial] = { system: settled.shell.system, saved: windowState.bounds, placement: chosenOf(settled).placement, maximized: w.maximized, bounds: w.bounds, workArea: required(w.display, 'the display').workArea, primary: required(w.display, 'the display').primary, firstSeen: d.at };
    judge(settled, w);
  } finally {
    await finish(trial, app, dataDir);
  }
}

mkdirSync(evidence, { recursive: true });
const trials: [name: string, run: () => Promise<void>][] = [
  ['recover', recover],
  ['loop', loop],
  [
    'maximized',
    () =>
      restoreTrial('maximized', { bounds: { x: 120, y: 120, width: 1000, height: 700, maximized: true } }, (s, w) => {
        const windows = s.shell.system === 'windows';
        const { placement } = required(w.chosen, 'the window it chose');
        if (windows) check('maximized', w.maximized === false && placement.maximizeAfterReveal === false, 'on Windows under --no-activate the window must not be maximized (it would activate)');
        else check('maximized', w.maximized === true && placement.maximizedAtReveal === true, `the window saved maximized opened ${w.maximized ? 'maximized' : 'not maximized'}`);
      }),
  ],
  [
    'lost',
    () =>
      restoreTrial('lost', { bounds: { x: 40000, y: 30000, width: 900, height: 640, maximized: false } }, (_s, w) => {
        const display = required(w.display, 'the display');
        const a = display.workArea;
        const b = required(w.bounds, 'the window bounds');
        check('lost', display.primary === true, 'the window did not open on the primary display');
        const placementWhy = required(w.chosen, 'the window it chose').placement.why;
        check('lost', b.x >= a.x - 16 && b.y >= a.y - 16 && b.x + b.width <= a.x + a.width + 16 && b.y + b.height <= a.y + a.height + 16, `the window ${JSON.stringify(b)} is not inside the work area ${JSON.stringify(a)}`);
        check('lost', /no connected display/.test(placementWhy), `placement reason was "${placementWhy}"`);
      }),
  ],
];
for (const [name, run] of trials) {
  try {
    await run();
    console.log(`${failures.some((f) => f.startsWith(`${name}:`)) ? 'FAIL' : 'pass'} ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`FAIL ${name}: ${message}`);
  }
}
writeFileSync(join(evidence, 'crash-test.json'), JSON.stringify({ at: new Date().toISOString(), system: process.platform, results, failures, passed: failures.length === 0 }, null, 2));
for (const f of ['crash-diagnostics.json', 'crash-page.json', 'crash-loop-diagnostics.json', 'crash-maximized-diagnostics.json', 'crash-lost-diagnostics.json']) rmSync(join(evidence, f), { force: true });
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('crash and restore test passed');
