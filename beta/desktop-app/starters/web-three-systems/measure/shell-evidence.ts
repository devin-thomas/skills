// Starts the real app, collects what proves the shell is right on this system,
// and quits it again. Works the same on Windows, macOS and Linux and uses no
// input events: every request goes through the app's control channel
// (electron/control.ts), and the run fails if the app counts a single second launch.
//
//   node measure/shell-evidence.ts --out <folder> [--idle <seconds>] [--steps <list>]
//                                   [--data-dir <folder>] [--bounds x,y,width,height]
//                                   [--observe <program>] [--expect-buttons left|right] [-- <extra app arguments>]
//
// --observe names a program to run while the app is up, after each picture of the page, with
// OBSERVE_OUT, OBSERVE_NAME and APP_PID in its environment. scripts/linux-container uses it to
// take a picture of the whole display and ask the window manager about the window.
//
// Always: start with --no-activate and a throwaway data folder, wait for the
// window, wait --idle seconds (default 20; 300 judges the memory budget), then write
//   shown.json         written by the app as it shows its window: how, and whether it has focus
//   memory.json        private memory over the process tree, from scripts/memory-tree.*,
//                      read before the app is asked for anything (memory-after-asking.json: after)
//   diagnostics.json   the app's own description, with the "shell" section
//   page.png           the page as the app captured it
//   window.png         macOS: the window as the display shows it, traffic lights included
//   display-*.png      with --observe: the whole display (Linux container)
//   summary.json       what was run and what was found
// and quit through --quit, checking that the process ended and that the app was reached only
// through its channel (lifecycle.secondLaunches 0).
//
// --steps adds, in this order:
//   menu          deliver a command through the menu path and record that it was sent
//   full-screen   enter full screen, record diagnostics and a capture, leave again
//   close-reopen  close the window, record whether the app is still running, start the executable
//                 again with --no-activate (it hands over through the channel), record
//   open-file     start the executable again with a file argument (handed over the same way) and
//                 record that it is waiting for the page
//   keys          the keys the shell handles where there is no menu bar (Linux: F11, then Control+Q, which ends the run)
//   dock          macOS, with close-reopen: reopen through `open` (what a Dock click sends) and open a file with the running app
//
// It never makes a second instance of the app: commands go through the control channel
// from this process, and a file or a plain --no-activate is handed over by starting the
// executable again, which passes it through the channel and ends without asking for the
// single-instance lock. In build 2 a second instance started from a process Explorer had
// started brought the window forward. The window still opens, so on the owner's machine run
// it only when he has said the machine is free; otherwise in the Linux container
// (scripts/linux-container) or on a Mac nobody is using, always from the agent's own shell.
// It builds the main process and runs measure/shell-check.ts first (checkBeforeLaunch in
// scripts/lib/launch.ts), and starts nothing if either fails.
//
// The window opens on the primary display unless --bounds puts it elsewhere.
// Nothing is stopped by name: the app is asked to quit, and only if it has not
// ended 15 s later is the one process this script started ended by its id.
import { spawn, execFileSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Diagnostics } from '../electron/main.ts';
import { template } from '../electron/menu.ts';
import { checkBeforeLaunch, control, electronBinary, root } from '../scripts/lib/launch.ts';

const electron = electronBinary(); // the path of the Electron binary
const argv = process.argv.slice(2);
const split = argv.indexOf('--');
const own = split === -1 ? argv : argv.slice(0, split);
const extra = split === -1 ? [] : argv.slice(split + 1);
function opt(name: string): string | null;
function opt(name: string, fallback: string): string;
function opt(name: string, fallback: string | null = null): string | null {
  const i = own.indexOf(`--${name}`);
  return i === -1 ? fallback : (own[i + 1] ?? fallback);
}

const out = resolve(opt('out', join(root, 'measure', 'out', 'shell', process.platform)));
const idle = Number(opt('idle', '20'));
const steps = (opt('steps', '') ?? '').split(',').filter(Boolean);
const ownData = !opt('data-dir');
const dataDir = resolve(opt('data-dir', join(tmpdir(), `shell-evidence-${process.pid}`)));
const bounds = opt('bounds');
const observe = opt('observe');
const expectButtons = opt('expect-buttons');
mkdirSync(out, { recursive: true });
mkdirSync(dataDir, { recursive: true });
if (bounds) {
  const [x, y, width, height] = bounds.split(',').map(Number);
  writeFileSync(join(dataDir, 'window.json'), JSON.stringify({ bounds: { x, y, width, height } }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** What one run found, written to summary.json. */
interface Summary {
  at: string;
  platform: string;
  out: string;
  steps: string[];
  extra: string[];
  checks: Record<string, { pass: boolean; detail?: unknown }>;
  notes: string[];
  system?: string;
  session?: unknown;
  windowOptions?: unknown;
  titleBar?: unknown;
  memory?: unknown;
  fullScreen?: unknown;
  error?: string;
  passed?: boolean;
}
const summary: Summary = { at: new Date().toISOString(), platform: process.platform, out, steps, extra, checks: {}, notes: [] };
const check = (name: string, pass: unknown, detail?: unknown) => {
  summary.checks[name] = { pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) };
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail === undefined ? '' : ` ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};

// The launch rules (scripts/lib/launch.ts): the main process is built and the static check
// passes before anything starts.
try {
  checkBeforeLaunch();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const base = [root, `--data-dir=${dataDir}`, ...extra];
const log = openSync(join(out, 'app.log'), 'w');
const revealRecord = join(out, 'shown.json');
if (existsSync(revealRecord)) rmSync(revealRecord);
const app = spawn(electron, [...base, '--no-activate', `--reveal-record=${revealRecord}`], { cwd: root, stdio: ['ignore', log, log], env: process.env });
let exited: { code: number | null; signal: NodeJS.Signals | null } | null = null;
app.on('exit', (code, signal) => (exited = { code, signal }));

/** Every time this script started the executable again. Each must end by itself once it has handed its arguments over. */
const secondLaunches: ChildProcess[] = [];
/** Requests this script sent through the control channel, to compare with the app's own count. */
let controlRequests = 0;

/**
 * Hands flags to the running app and waits for the files they ask for. Commands go through the
 * control channel (electron/control.ts) from this process; a file or a plain --no-activate is
 * handed over by starting the executable again, which passes it through the channel and ends.
 * Neither is a second instance of the app.
 */
async function ask(flags: string[], waitFor: string[] = [], timeoutMs = 20_000): Promise<boolean> {
  if (!flags.some(control.isCommandFlag)) return launchAgain(flags, waitFor, timeoutMs);
  for (const file of waitFor) if (existsSync(file)) rmSync(file);
  const reply = await control.send(dataDir, flags, { waitMs: 10_000, timeoutMs });
  controlRequests += 1;
  if (!reply.ok) summary.notes.push(`the app did not carry out ${flags.join(' ')}: ${reply.error}`);
  const started = Date.now();
  while (!waitFor.every((file) => existsSync(file)) && Date.now() - started < timeoutMs) await sleep(100);
  return waitFor.every((file) => existsSync(file));
}

function launchAgain(flags: string[], waitFor: string[] = [], timeoutMs = 20_000): Promise<boolean> {
  controlRequests += 1;
  return new Promise((done) => {
    for (const file of waitFor) if (existsSync(file)) rmSync(file);
    const child = spawn(electron, [...base, ...flags], { cwd: root, stdio: 'ignore', env: process.env });
    secondLaunches.push(child);
    const started = Date.now();
    const poll = setInterval(() => {
      const there = waitFor.every((file) => existsSync(file));
      if ((there && child.exitCode !== null) || Date.now() - started > timeoutMs) {
        clearInterval(poll);
        done(there);
      }
    }, 100);
  });
}

/** Ask the app for its diagnostics, with any other flags; `capture` also asks for a picture of the page. */
async function diagnostics(name: string, more: string[] = [], capture: string | null = null, timeoutMs = 20_000): Promise<Diagnostics | null> {
  const file = join(out, `${name}.json`);
  const picture = capture ? join(out, capture) : null;
  const ok = await ask([`--diagnostics=${file}`, ...more, ...(picture ? [`--capture=${picture}`] : [])], picture ? [file, picture] : [file], timeoutMs);
  if (!ok && !existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as Diagnostics;
}

/**
 * A picture of the window as the display shows it, with the system's own title bar parts,
 * which a page capture cannot contain. macOS only here: Linux display pictures are taken by
 * scripts/linux-container, and Windows caption buttons are outside this script's reach.
 */
function windowShot(shell: Diagnostics['shell'] | undefined, name: string): void {
  const moment = name.replace(/\.png$/, '');
  if (observe) {
    try {
      execFileSync(observe, [], { timeout: 60_000, stdio: 'ignore', env: { ...process.env, OBSERVE_OUT: out, OBSERVE_NAME: moment, APP_PID: String(app.pid) } });
      check(`display picture display-${moment}.png`, existsSync(join(out, `display-${moment}.png`)));
    } catch (error) {
      summary.notes.push(`--observe failed at ${moment}: ${String(error).split('\n')[0]}`);
    }
  }
  if (process.platform !== 'darwin') return;
  const id = shell?.window?.mediaSourceId?.split(':')[1] ?? '';
  try {
    execFileSync('/usr/sbin/screencapture', ['-x', '-o', '-l', id, join(out, name)], { timeout: 20_000 });
    check(`window picture ${name}`, existsSync(join(out, name)));
  } catch (error) {
    summary.notes.push(`screencapture could not take ${name}: ${String(error).split('\n')[0]}`);
  }
}

/** What scripts/memory-tree.* print. */
interface TreeMemory {
  privateMB: number;
  processes: number;
  budgetMB: number;
  ceilingMB: number;
  definition: string;
  withinBudget: boolean;
  underCeiling: boolean;
}

function memoryScript(pid: number | undefined): TreeMemory {
  const scripts = join(root, 'scripts');
  const call: [string, string[]] =
    process.platform === 'win32'
      ? ['powershell', ['-NoProfile', '-NonInteractive', '-File', join(scripts, 'memory-tree.ps1'), '-ProcessId', String(pid)]]
      : ['sh', [join(scripts, process.platform === 'darwin' ? 'memory-tree.macos.sh' : 'memory-tree.linux.sh'), String(pid)]];
  return JSON.parse(execFileSync(call[0], call[1], { encoding: 'utf8', timeout: 120_000 })) as TreeMemory;
}

try {
  // 1. The window appears, without focus where the system allows. The app writes this record
  // itself as it shows the window, so nothing has to be asked of it yet.
  type Shown = { pid: number; reveal: { trigger: string; call: string; withoutFocusPossible: boolean }; visible: boolean; focused: boolean };
  let first: Shown | null = null;
  for (let i = 0; i < 300 && !first && !exited; i++) {
    await sleep(100);
    if (existsSync(revealRecord)) {
      try {
        first = JSON.parse(readFileSync(revealRecord, 'utf8')) as Shown;
      } catch {
        // Still being written.
      }
    }
  }
  check('app started and showed its window', first, first ? { pid: first.pid } : (exited ?? 'no record of the window being shown in 30 s'));
  if (!first) throw new Error('the app did not start');
  check('the window belongs to the process this script started', first.pid === app.pid, { shown: first.pid, started: app.pid });
  const reveal = first.reveal;
  check('window revealed', first.visible, reveal);
  check('revealed without the fallback', !/fallback/.test(reveal.trigger), reveal.trigger);
  if (reveal.withoutFocusPossible) check('window does not have focus', first.focused === false, { focused: first.focused, call: reveal.call });
  else summary.notes.push('This session cannot show a window without focus; the window was shown normally.');

  // 2. Idle, then memory by this system's definition, from outside, before the app has been
  // asked for anything. Asking changes the answer: a request that writes a file can leave about 30 MB in the
  // main process on Windows, and capturing the page makes the graphics process grow (on macOS
  // by about 50 MB that it keeps, and several times that for a moment).
  await sleep(idle * 1000);
  if (exited) throw new Error(`the app ended while idle: ${JSON.stringify(exited)}`);
  const memory = memoryScript(app.pid);
  writeFileSync(join(out, 'memory.json'), JSON.stringify(memory, null, 2));
  // The budget is for the app after five minutes idle; a shorter wait is recorded but not judged.
  const figure = `${memory.privateMB} MB of ${memory.budgetMB} MB (${memory.definition}, ${memory.processes} processes, ${idle} s idle)`;
  if (idle >= 300) check('memory within the budget after five minutes idle', memory.withinBudget, figure);
  else summary.notes.push(`Memory after ${idle} s idle: ${figure}. The budget applies after 300 s idle; run with --idle 300 to judge it.`);
  check('memory under the ceiling', memory.underCeiling, `${memory.privateMB} MB of ${memory.ceilingMB} MB`);

  // 3. The main record: the app's own description, with its own memory figure.
  const main = await diagnostics('diagnostics');
  check('diagnostics written', main);
  if (!main) throw new Error('the app wrote no diagnostics');
  const shell = main.shell;
  const chosen = shell.window.chosen;
  summary.system = shell.system;
  summary.session = shell.session;
  summary.windowOptions = chosen?.options;
  summary.titleBar = { rect: shell.window.page?.titlebarAreaRect, env: shell.window.page?.env, reservedLeft: shell.window.page?.reservedLeft, reservedRight: shell.window.page?.reservedRight, windowButtonPosition: shell.window.windowButtonPosition };
  // The same reading again now that the app has been asked once, beside the app's own figure.
  const after = memoryScript(app.pid);
  writeFileSync(join(out, 'memory-after-asking.json'), JSON.stringify(after, null, 2));
  summary.memory = {
    definition: memory.definition,
    idleSeconds: idle,
    beforeAsking: { privateMB: memory.privateMB, processes: memory.processes },
    afterAsking: { privateMB: after.privateMB, processes: after.processes },
    costOfAskingMB: Math.round((after.privateMB - memory.privateMB) * 10) / 10,
    appsOwnFigure: { privateMB: shell.memory.privateMB, processes: shell.memory.processes, scope: shell.memory.scope },
  };
  check('the app and the script agree on memory', Math.abs(after.privateMB - shell.memory.privateMB) <= Math.max(15, after.privateMB * 0.1), summary.memory);
  const page = shell.window.page ?? {};
  check('title bar overlay visible to the page', page.overlayVisible === true, page.titlebarAreaRect);
  check('overlay height is the bar height', page.titlebarAreaRect?.height === chosen?.barHeight, { rect: page.titlebarAreaRect?.height, bar: chosen?.barHeight });
  check('window buttons take room on one side', (page.reservedLeft ?? 0) + (page.reservedRight ?? 0) > 0, { left: page.reservedLeft, right: page.reservedRight });
  if (expectButtons) check(`window buttons are on the ${expectButtons}`, expectButtons === 'left' ? (page.reservedLeft ?? 0) > 0 && page.reservedRight === 0 : (page.reservedRight ?? 0) > 0 && page.reservedLeft === 0, { left: page.reservedLeft, right: page.reservedRight });
  check('env() values match the overlay rectangle', page.env && page.titlebarAreaRect && page.env.x === page.titlebarAreaRect.x && page.env.width === page.titlebarAreaRect.width, page.env);
  if (shell.system === 'macos') {
    const applicationMenu = shell.menu?.applicationMenu;
    // Every top-level menu of electron/menu.ts, and nothing the system added or dropped.
    check('menu bar present', Array.isArray(applicationMenu) && applicationMenu.length === template('app').length, applicationMenu?.map((m) => m.label));
    const buttons = shell.window.windowButtonPosition;
    check('traffic lights centred in the bar', buttons && chosen && Math.abs(buttons.y + 7 - chosen.barHeight / 2) <= 1, buttons);
  } else check('no menu bar', shell.menu?.applicationMenu === null);

  // Pictures: the page as the app captures it, and the window as the display shows it.
  await diagnostics('diagnostics-with-capture', [], 'page.png');
  check('page captured', existsSync(join(out, 'page.png')));
  windowShot(shell, 'window.png');

  // 4. Optional steps.
  if (steps.includes('menu')) {
    const after = await diagnostics('diagnostics-menu', ['--menu-command=about']);
    check('a command reached the page through the menu path', (after?.shell.menu?.commandsSent ?? 0) > (shell.menu?.commandsSent ?? 0), { sent: after?.shell.menu?.commandsSent });
    // Dimming: say two commands cannot run, as the page would, and look for them in the menus.
    const dimmed = await diagnostics('diagnostics-menu-dimmed', ['--qa-menu-state={"run-example":false,"clear-note":false}']);
    type Entry = { command?: string; enabled?: boolean; submenu?: Entry[] };
    const flat = (items: Entry[] | null | undefined): Entry[] => (items ?? []).flatMap((entry) => [entry, ...flat(entry.submenu)]);
    const state = (d: Diagnostics | null, command: string) => flat(d?.shell.menu?.applicationMenu).filter((entry) => entry.command === command).map((entry) => entry.enabled);
    check('the page can dim commands', dimmed?.shell.menu?.pageState['run-example'] === false && (shell.system !== 'macos' || (state(dimmed, 'run-example').every((on) => on === false) && state(dimmed, 'clear-note').every((on) => on === false) && state(dimmed, 'toggle-theme').every((on) => on === true))), { run: state(dimmed, 'run-example'), clear: state(dimmed, 'clear-note'), theme: state(dimmed, 'toggle-theme'), dock: dimmed?.shell.menu?.dockMenu });
    await ask(['--qa-menu-state={}']);
  }
  if (steps.includes('open-file')) {
    const file = join(out, 'page.png');
    await ask([file, '--no-activate']);
    await sleep(2500);
    const after = await diagnostics('diagnostics-open-file', ['--no-activate']);
    check('a file named when the executable was started again reached the shell', (after?.shell.lifecycle.filesOpened ?? 0) >= 1, { opened: after?.shell.lifecycle.filesOpened, waiting: after?.shell.lifecycle.filesWaiting, sent: after?.shell.menu?.commandsSent });
    if (reveal.withoutFocusPossible) check('starting the executable again with a file and --no-activate left the window without focus', after?.shell.window.focused === false, { focused: after?.shell.window.focused });
  }
  if (reveal.withoutFocusPossible) {
    // Starting the executable again with --no-activate and no other flag brings the window back
    // without focus, even from minimized, where restore() would have activated it.
    await ask(['--no-activate']);
    await sleep(1500);
    const plain = await diagnostics('diagnostics-plain-second-launch', ['--no-activate']);
    check('starting the executable again with --no-activate left the window without focus', plain?.shell.window.focused === false && plain?.shell.window.visible === true, { focused: plain?.shell.window.focused, visible: plain?.shell.window.visible });
  }
  // Full screen runs after the second-launch focus checks: some window managers (openbox on X11)
  // focus a window that enters full screen, which would hide what --no-activate did.
  if (steps.includes('full-screen')) {
    const full = await diagnostics('diagnostics-full-screen', ['--full-screen=on'], 'page-full-screen.png', 30_000);
    check('entered full screen', full?.shell.window.fullScreen === true, full?.shell.window.page?.titlebarAreaRect);
    windowShot(full?.shell, 'window-full-screen.png');
    summary.fullScreen = { rect: full?.shell.window.page?.titlebarAreaRect, env: full?.shell.window.page?.env, displayModes: full?.shell.window.page?.displayModes, windowButtonPosition: full?.shell.window.windowButtonPosition };
    const back = await diagnostics('diagnostics-after-full-screen', ['--full-screen=off']);
    check('left full screen', back?.shell.window.fullScreen === false, back?.shell.window.page?.titlebarAreaRect);
  }
  if (steps.includes('close-reopen')) {
    await ask(['--close-window']);
    await sleep(1500);
    if (shell.facts.closingLastWindowQuits) {
      check('closing the window ended the app', exited !== null, exited);
    } else {
      const closed = await diagnostics('diagnostics-window-closed');
      check('closing the window left the app running', exited === null && closed?.shell.window.open === false, { open: closed?.shell.window.open });
      check('commands that need the window are dimmed while it is closed', closed?.shell.menu?.dockMenu?.find((d) => d.command === 'run-example')?.enabled === false, closed?.shell.menu?.dockMenu);
      await ask(['--no-activate']);
      await sleep(2500);
      const again = await diagnostics('diagnostics-reopened');
      check('starting the executable again reopened the window', again?.shell.window.open === true && again?.shell.window.visible === true, { visible: again?.shell.window.visible });
      if (process.platform === 'darwin' && steps.includes('dock')) {
        // The real paths: `open` sends the running app what a click on its Dock icon sends,
        // and what a file dropped on that icon sends. -g keeps the app in the background.
        const bundle = electron.slice(0, electron.indexOf('/Contents/MacOS/'));
        await ask(['--close-window']);
        await sleep(1500);
        execFileSync('/usr/bin/open', ['-g', bundle]);
        await sleep(3000);
        const dock = await diagnostics('diagnostics-dock-reopen');
        check('opening the running app again reopened the window', (dock?.shell.lifecycle.activations ?? 0) > (again?.shell.lifecycle.activations ?? 0) && dock?.shell.window.open === true, { activations: dock?.shell.lifecycle.activations, open: dock?.shell.window.open });
        execFileSync('/usr/bin/open', ['-g', '-a', bundle, join(out, 'memory.json')]);
        await sleep(3000);
        const dropped = await diagnostics('diagnostics-dock-file');
        check('a file opened with the running app reached the shell', (dropped?.shell.lifecycle.filesOpened ?? 0) > (dock?.shell.lifecycle.filesOpened ?? 0), { opened: dropped?.shell.lifecycle.filesOpened, waiting: dropped?.shell.lifecycle.filesWaiting });
      }
    }
  }
  if (steps.includes('keys')) {
    // Keys the shell handles itself where there is no menu bar (development builds only: the
    // key is put into the page's input the way the starter's typing test does it).
    const keys = shell.facts.shellKeys.filter((k) => k.through === 'before-input-event');
    if (!keys.length) summary.notes.push('This system has no shell-handled keys outside the menu; the keys step did nothing.');
    const fullScreenKey = keys.find((k) => k.does === 'full screen');
    if (fullScreenKey) {
      const on = await diagnostics('diagnostics-key-full-screen', [`--qa-press=${fullScreenKey.keys}`]);
      check(`${fullScreenKey.keys} entered full screen`, on?.shell.window.fullScreen === true);
      const off = await diagnostics('diagnostics-key-full-screen-off', [`--qa-press=${fullScreenKey.keys}`]);
      check(`${fullScreenKey.keys} left full screen`, off?.shell.window.fullScreen === false);
    }
    const quitKey = keys.find((k) => k.does === 'quit');
    if (quitKey) {
      await ask([`--qa-press=${quitKey.keys}`]);
      for (let i = 0; i < 100 && !exited; i++) await sleep(100);
      check(`${quitKey.keys} quit the app`, exited !== null, exited);
    }
  }
} catch (error) {
  summary.error = error instanceof Error ? String(error.stack ?? error.message) : String(error);
  console.error(summary.error);
} finally {
  // 5. The app was reached only through its channel: its own count of second launches is 0.
  if (!exited) {
    const last = await diagnostics('diagnostics-last');
    const life = last?.shell?.lifecycle;
    check('no request reached the app through a second instance', life?.secondLaunches === 0 && (life?.controlRequests ?? 0) >= controlRequests, { secondLaunches: life?.secondLaunches, controlRequests: life?.controlRequests, sentByThisScript: controlRequests });
  }
  // 6. Quit through the app's own path.
  if (!exited) {
    await ask(['--quit']);
    for (let i = 0; i < 150 && !exited; i++) await sleep(100);
    check('quit ended the app', exited !== null, exited);
    if (!exited) {
      summary.notes.push(`The app did not end after --quit; process ${app.pid}, which this script started, was ended by its id.`);
      app.kill();
    }
  }
  // A started-again executable that outlives the app has taken its place. None may be left;
  // any that is gets ended by its id.
  for (let i = 0; i < 50 && secondLaunches.some((c) => c.exitCode === null && c.signalCode === null); i++) await sleep(100);
  const left = secondLaunches.filter((c) => c.exitCode === null && c.signalCode === null);
  check('no executable started again was left running', left.length === 0, left.map((c) => c.pid));
  for (const child of left) child.kill();
  if (left.length) await sleep(1000);
  if (ownData) rmSync(dataDir, { recursive: true, force: true });
  summary.passed = !summary.error && Object.values(summary.checks).every((c) => c.pass);
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`${summary.passed ? 'passed' : 'FAILED'}: ${out}`);
  process.exit(summary.passed ? 0 : 1);
}
