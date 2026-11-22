// Test instrumentation for the development shell. main.ts loads it (as dist/electron/qa.mjs)
// only when the app is not packaged and a --qa-* flag is present; the packaged app does not
// include it (scripts/package.ts leaves it out, and the main bundle never imports it).
//
//   --qa-typing=<out.json>          key-event-to-frame latency while typing, short and long draft, and palette open time
//   --qa-type-then-wait=<out.json>  type a known text into the body, report the PID and last key time, then stay open
//                                   (the kill test terminates this process from outside)
//   --qa-read-body=<out.json>       report the restored body text, then quit
//   --qa-long=<n>                   with --qa-type-then-wait: start from a body of n characters
//   --qa-marks=<out.json>           launch and first-frame times, the display, and the result of --qa-bench
//   --qa-bench=<script.js>          run a scripted workload inside the page (measure/workload.js) and record what it returns
//   --qa-exit-after=<seconds>       quit after this long (the measurement harness uses it)
//
// The typing and kill tests need one text field with the id in FIELD and a saved
// document shaped by draftJson(). Change both when the app's main field changes.
//
// Measurement comes from @uppercut-labs/electron-qa-measurements, a development dependency
// imported here at run time and never bundled. Every key goes into the page through the
// DevTools protocol with the page told it has focus, and every kit call is given that
// injector, so the window is never focused and no system input is used.
//
// The verdict: the premium bar's published limits decide (references/premium-bar.md, rules 7,
// 27 and 41). See qa/premium-gate.ts.
import fs from 'node:fs';
import path from 'node:path';
import { app, screen } from 'electron';
import type { BrowserWindow, KeyboardInputEvent } from 'electron';
import type { KeyInjector, WindowLike } from '@uppercut-labs/electron-qa-measurements';
import { judge } from '../qa/premium-gate.ts';
import { stackOf } from './errors.ts';

type Kit = typeof import('@uppercut-labs/electron-qa-measurements');
type WriteState = (key: string, json: string) => void;
export interface QaOptions {
  launchedAt: number;
  draftKey: string;
  system: 'windows' | 'macos' | 'linux';
}

/** The field these tests type into: the note's body. */
const FIELD = '#field-body';
/** The saved document the page restores from, holding `body` in its main text field. */
const draftJson = (title: string, body: string) => JSON.stringify({ v: 1, title, body, savedAt: Date.now() });

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const kitOf = (): Promise<Kit> => import('@uppercut-labs/electron-qa-measurements');

/**
 * The window as the kit's WindowLike, which takes input events with any `type` string where
 * Electron names its four key event types. It has no focus(): the kit cannot focus the window
 * through it, whatever it is asked.
 */
function windowFor(win: BrowserWindow): WindowLike {
  return {
    getBounds: () => win.getBounds(),
    isVisible: () => win.isVisible(),
    isFocused: () => win.isFocused(),
    close: () => win.close(),
    webContents: {
      executeJavaScript: (source) => win.webContents.executeJavaScript(source) as Promise<unknown>,
      sendInputEvent: (event) => win.webContents.sendInputEvent({ ...event, type: event.type as KeyboardInputEvent['type'] } as KeyboardInputEvent),
      reload: () => win.webContents.reload(),
      once: (event, listener) => win.webContents.once(event as 'did-finish-load', listener),
    },
  };
}

/** The DevTools protocol on this window's page, with the page behaving as focused. */
async function protocolInjector(win: BrowserWindow, kit: Kit): Promise<KeyInjector> {
  const dbg = win.webContents.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');
  const send = (method: string, params: Record<string, unknown> = {}) => dbg.sendCommand(method, params) as Promise<unknown>;
  await kit.emulatePageFocus(send);
  return kit.createProtocolInjector(send);
}

async function typingScenario(win: BrowserWindow, outFile: string, writeState: WriteState, options: QaOptions): Promise<void> {
  const kit = await kitOf();
  const display = screen.getDisplayMatching(win.getBounds());
  let injector = await protocolInjector(win, kit);
  await sleep(800);

  // An empty draft: 220 keys into the body.
  const emptyDraft = await kit.measureTyping(windowFor(win), { field: FIELD, text: kit.generateText(220), injector });

  // The palette: Ctrl+K (Command+K on macOS) to the frame that shows it.
  const palette = await kit.measureCommandPalette(windowFor(win), { openSelector: '.palette', injector, modifier: options.system === 'macos' ? 'meta' : 'control' });

  // A long draft: restart the page with about 20,000 characters already in the body.
  writeState(options.draftKey, draftJson('Long draft', kit.generateText(20000)));
  await kit.reloadPage(windowFor(win));
  injector = await protocolInjector(win, kit);
  await sleep(800);
  const longDraft = await kit.measureTyping(windowFor(win), { field: FIELD, text: kit.generateText(220), injector });

  const gate = await judge({ typing: { emptyDraft, longDraft }, palette, windowFocusedAfterTyping: win.isFocused() });
  const report = {
    at: new Date().toISOString(),
    display: { hz: display.displayFrequency, scale: display.scaleFactor },
    window: kit.describeWindow(windowFor(win)),
    note: 'Times run from the key event timestamp to the end of the frame that rendered the change, on the page clock. They do not include the compositor or the display.',
    emptyDraft,
    longDraft,
    palette,
    gate,
    passed: gate.passed,
  };
  await kit.writeJsonReport(path.resolve(outFile), report);
}

async function typeThenWait(win: BrowserWindow, outFile: string, writeState: WriteState, options: QaOptions): Promise<void> {
  const kit = await kitOf();
  const longCount = Number(arg('qa-long') ?? 0);
  if (longCount > 0) {
    writeState(options.draftKey, draftJson('Kill test', kit.generateText(longCount)));
    await kit.reloadPage(windowFor(win));
  }
  const injector = await protocolInjector(win, kit);
  await sleep(800);
  const text = `Kill test ${Date.now()}: this sentence must survive the process being terminated. `;
  const record = await kit.typeAndRecord(windowFor(win), { field: FIELD, text, injector });
  fs.writeFileSync(path.resolve(outFile), JSON.stringify(record));
}

async function readBody(win: BrowserWindow, outFile: string): Promise<void> {
  const kit = await kitOf();
  await sleep(600);
  const body = await kit.readField(windowFor(win), FIELD);
  fs.writeFileSync(path.resolve(outFile), JSON.stringify({ body }));
  win.close();
}

/**
 * Launch-to-first-frame marks and an optional scripted workload, for measure/run.py. The marks
 * are written as soon as the first frame is in, before the workload runs: run.py waits for
 * firstFrameAfterLoad to time everything after it, and the workload takes most of a minute.
 */
async function marksScenario(win: BrowserWindow, outFile: string, options: QaOptions): Promise<void> {
  const kit = await kitOf();
  const exitAfter = Number(arg('qa-exit-after') ?? 0);
  const marks: Record<string, unknown> = {
    ...(await kit.measureLaunchMarks(windowFor(win), {
      launchedAt: options.launchedAt,
      getDisplay: (bounds) => {
        const d = bounds ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
        return { hz: d.displayFrequency, scale: d.scaleFactor, primary: d.id === screen.getPrimaryDisplay().id };
      },
    })),
  };
  const flush = () => fs.writeFileSync(path.resolve(outFile), JSON.stringify({ pid: process.pid, marks }, null, 2));
  flush();
  if (exitAfter > 0)
    setTimeout(() => {
      flush();
      app.quit();
    }, exitAfter * 1000);
  const bench = arg('qa-bench');
  if (bench) {
    try {
      marks['bench'] = await win.webContents.executeJavaScript(fs.readFileSync(path.resolve(bench), 'utf8'));
    } catch (error) {
      marks['benchError'] = String(error);
    }
    flush();
  }
}

export async function run(win: BrowserWindow, writeState: WriteState, options: QaOptions): Promise<void> {
  try {
    const marks = arg('qa-marks');
    if (marks) return await marksScenario(win, marks, options);
    const typing = arg('qa-typing');
    const typeWait = arg('qa-type-then-wait');
    const read = arg('qa-read-body');
    if (typing) {
      await typingScenario(win, typing, writeState, options);
      win.close();
    } else if (typeWait) await typeThenWait(win, typeWait, writeState, options);
    else if (read) await readBody(win, read);
  } catch (error) {
    process.stderr.write(`qa: ${stackOf(error)}\n`);
    const out = arg('qa-typing') ?? arg('qa-type-then-wait') ?? arg('qa-read-body') ?? arg('qa-marks');
    if (out) fs.writeFileSync(path.resolve(out), JSON.stringify({ error: stackOf(error) }));
    if (!win.isDestroyed()) win.close();
  }
}
