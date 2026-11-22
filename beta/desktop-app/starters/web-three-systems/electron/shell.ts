// The shell's life cycle on every system, and the one module main.ts needs
// for everything about the window, the menu and the system the app is on.
//
//   platform.ts  which system this is and what follows from it (the only file that asks)
//   window.ts    the main window
//   menu.ts      the menu bar, the Dock menu and commands sent to the page
//   memory.ts    private memory of the running app by the system's definition
//   shell.ts     start-up identity, second launches, files opened with the app,
//                closing and quitting, and the shell's part of --diagnostics
//
// Commands for the running app, besides the ones in main.ts. Scripts send them through the
// control channel (control.ts); a launch carrying one is forwarded there by main.ts:
//   --diagnostics=<file>     main.ts's description plus a "shell" section (see describe below)
//   --menu-command=<id>      deliver a command to the page exactly as a menu choice would
//   --full-screen=on|off     enter or leave full screen
//   --close-window           close the window as its close button would (the app stays running where the system expects that)
//   --quit                   quit the app on every system
//   --no-activate            with no other flag: show the window without giving it focus (a
//                            script's launch with this flag is handed over through the channel too)
//   --qa-press=<keys>        development builds only: one key press into the page ("Control+Q", "F11")
//   --qa-menu-state=<json>   development builds only: which commands can run, as the page reports it
// A flag for the first launch, besides --no-activate and --data-dir in main.ts:
//   --reveal-record=<file>   write how the window was first shown and whether it has focus
// A file named on the command line is opened with the app (see "files opened with the app").
import fs from 'node:fs';
import path from 'node:path';
import type { App, BrowserWindow, KeyboardInputEvent } from 'electron';
import * as memory from './memory.ts';
import * as shellMenu from './menu.ts';
import { ROOT } from './paths.ts';
import * as platform from './platform.ts';
import type { AppConfig } from './platform.ts';
import * as shellWindow from './window.ts';

const arg = (name: string, argv: string[]): string | null => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const has = (name: string, argv: string[]): boolean => argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** What main.ts hands this module in start(). */
export interface ShellContext {
  app: App;
  config: AppConfig;
  getWindow: () => BrowserWindow | null;
  createWindow: (options?: { inactive?: boolean }) => BrowserWindow;
  handleCommands: (argv: string[]) => Promise<boolean>;
  diagnostics: () => Promise<unknown>;
}

let ctx: ShellContext | null = null;
const context = (): ShellContext => {
  if (!ctx) throw new Error('shell.start() has not run');
  return ctx;
};
// secondLaunches: launches that reached this app through Chromium's process singleton (a person
// opening the app or a file again). controlRequests: requests through the control channel
// (control.ts), the only way scripts reach the app. A check proves that no script used a
// second instance by finding secondLaunches still at 0.
const seen = { secondLaunches: 0, controlRequests: 0, activations: 0, filesOpened: 0, startedAt: Date.now() };
let lastSecondLaunchAt = 0;
const ACKNOWLEDGE_MS = 500;

// ---- focus ------------------------------------------------------------------
// A launch with --no-activate must never take focus, whether it starts the app or
// reaches the running one, with or without a file. Every path that shows, restores
// or creates the window asks quiet() (measure/shell-check.ts checks that no other
// show(), focus(), restore() or moveTop() call creeps in).

/** Whether the launch being handled asked for no focus: the first launch's flags, then each control request (always) or second launch. */
let launchQuiet = process.argv.includes('--no-activate');

export function quiet(): boolean {
  return launchQuiet;
}

// ---- files opened with the app ---------------------------------------------
// A file can arrive from outside the page: dropped on the Dock icon or opened
// with the app in Finder (macOS, the open-file event), or named on the command
// line by a file manager (Windows and Linux, at launch and on a second launch).
// All of them end up here. The paths wait in `opened`, and the page is sent
// the open-files command. The page never sees a path: its open-files handler
// asks the main process, whose handler calls takeOpenedFiles() first and
// registers those paths under opaque ids; with none waiting it opens the
// system's file dialog. The starter's page has no open-files command yet.

const opened: string[] = [];

export function takeOpenedFiles(): string[] {
  return opened.splice(0, opened.length);
}

/** How many files are waiting for the page to take them. */
export function filesWaiting(): number {
  return opened.length;
}

function openFiles(paths: string[]): void {
  const fresh = paths.filter((p) => !opened.includes(p));
  if (!fresh.length) return;
  opened.push(...fresh);
  seen.filesOpened += fresh.length;
  if (ctx?.app.isReady()) void shellMenu.send('open-files');
}

/** Files named on a command line: every argument that is not a flag and is an existing file. */
function filesIn(argv: string[], cwd: string): string[] {
  const { app } = context();
  const self = [process.execPath, app.getAppPath(), path.join(ROOT, 'dist', 'electron', 'main.mjs')].map((p) => path.resolve(p));
  const out: string[] = [];
  for (const a of argv.slice(1)) {
    if (a.startsWith('-')) continue;
    const file = path.resolve(cwd, a);
    if (self.includes(file)) continue;
    try {
      if (fs.statSync(file).isFile()) out.push(file);
    } catch {
      // Not a file: ignore it.
    }
  }
  return out;
}

// ---- diagnostics ------------------------------------------------------------

/** The shell's part of --diagnostics: enough to check the shell on any system without input events. */
export async function describe() {
  const { app, config, getWindow } = context();
  const facts = platform.facts(app);
  return {
    system: facts.system,
    arch: process.arch,
    systemVersion: process.getSystemVersion(),
    // Linux only: which display protocol is in use and what it was chosen from.
    session:
      facts.system === 'linux'
        ? {
            type: facts.session,
            XDG_SESSION_TYPE: process.env['XDG_SESSION_TYPE'] ?? null,
            XDG_CURRENT_DESKTOP: process.env['XDG_CURRENT_DESKTOP'] ?? null,
            waylandDisplay: process.env['WAYLAND_DISPLAY'] ?? null,
            x11Display: process.env['DISPLAY'] ?? null,
            ozonePlatformSwitch: app.commandLine.getSwitchValue('ozone-platform') || null,
            desktopName: platform.desktopName(config),
            sandbox: !app.commandLine.hasSwitch('no-sandbox'),
          }
        : null,
    facts,
    window: await shellWindow.describe(getWindow()),
    menu: shellMenu.describe(),
    lifecycle: { ...seen, uptimeSeconds: Math.round((Date.now() - seen.startedAt) / 1000), filesWaiting: opened.length, closingLastWindowQuits: facts.closingLastWindowQuits, lastLaunchAskedNoFocus: launchQuiet },
    memory: await memory.measure(app, config),
  };
}

// Written with the synchronous calls on purpose. The first asynchronous file call in the
// main process starts libuv's four worker threads, and on Windows each commits an 8 MB
// stack: 32 MB of private memory that stays (measured: 285 MB before, 318 MB after).
// Asking for diagnostics should not change the figure it reports.
function writeJson(file: string, value: unknown): void {
  const target = path.resolve(file);
  fs.writeFileSync(`${target}.tmp`, JSON.stringify(value, null, 2));
  fs.renameSync(`${target}.tmp`, target);
}

// ---- commands from scripts (the control channel) and from second launches ------

function settled(win: BrowserWindow, events: ('enter-full-screen' | 'leave-full-screen')[], ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      for (const name of events) win.removeListener(name as 'enter-full-screen', done);
      resolve();
    };
    for (const name of events) win.once(name as 'enter-full-screen', done);
    setTimeout(done, ms);
  });
}

/** Carry out the commands of a control request or a second launch. Resolves true when any was acted on. */
async function commands(argv: string[]): Promise<boolean> {
  const { app, getWindow, handleCommands, diagnostics } = context();
  const live = (): BrowserWindow | null => {
    const win = getWindow();
    return win && !win.isDestroyed() ? win : null;
  };
  let handled = false;

  const fullScreen = arg('full-screen', argv);
  const forFullScreen = live();
  if (fullScreen && forFullScreen) {
    const want = fullScreen === 'on';
    if (forFullScreen.isFullScreen() !== want) {
      forFullScreen.setFullScreen(want);
      await settled(forFullScreen, ['enter-full-screen', 'leave-full-screen'], 5000);
      await sleep(300); // let the page lay out again
    }
    handled = true;
  }

  const command = arg('menu-command', argv);
  if (command) {
    await shellMenu.send(command);
    handled = true;
  }

  // Development builds only: put one key press into the page's input, to test the keys the
  // shell handles itself (platform.ts, shellKeys). "Control+Q", "F11".
  const press = arg('qa-press', argv);
  const forPress = live();
  if (press && !app.isPackaged && forPress) {
    const parts = press.split('+');
    const keyCode = parts.pop() ?? '';
    const modifiers = parts.map((p) => p.toLowerCase()) as KeyboardInputEvent['modifiers'];
    forPress.webContents.sendInputEvent({ type: 'keyDown', keyCode, ...(modifiers ? { modifiers } : {}) });
    live()?.webContents.sendInputEvent({ type: 'keyUp', keyCode, ...(modifiers ? { modifiers } : {}) });
    await sleep(1500);
    handled = true;
  }

  // Development builds only: set which commands can run, as the page would on app:menu-state.
  const menuState = arg('qa-menu-state', argv);
  if (menuState && !app.isPackaged) {
    try {
      shellMenu.setState(JSON.parse(menuState));
    } catch {
      // Not JSON: ignore it.
    }
    handled = true;
  }

  // main.ts's one description of the app, which includes this file's (describe above).
  const file = arg('diagnostics', argv);
  if (file) {
    writeJson(file, await diagnostics());
    handled = true;
  }

  // main.ts's own flags: --show-about, --capture, --quit (quits on every system, asking first while a job runs).
  if (await handleCommands(argv.filter((a) => !a.startsWith('--diagnostics=')))) handled = true;

  if (has('close-window', argv)) {
    live()?.close();
    handled = true;
  }
  return handled;
}

/**
 * Bring the window back for a plain launch that reached the app. Without focus (--no-activate)
 * nothing may activate it: on Windows restore() activates a minimized window, so
 * the window is shown with showInactive, which also brings back a minimized window
 * without activating it (SW_SHOWNOACTIVATE).
 */
function showWindow(withoutFocus: boolean): void {
  const { app, getWindow, createWindow } = context();
  const win = getWindow();
  if (!win || win.isDestroyed()) {
    if (app.isReady()) createWindow({ inactive: withoutFocus });
    return;
  }
  if (withoutFocus) {
    platform.show(win, app, true);
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/**
 * One launch that reached the running app, by either way in: its flags, the files it names,
 * and, when it carried neither, bringing the window back. `quiet`: without focus.
 */
async function handleLaunch(argv: string[], cwd: string, { quiet }: { quiet: boolean }): Promise<{ handled: boolean; files: number }> {
  launchQuiet = quiet;
  const withQuiet = quiet && !has('no-activate', argv) ? [...argv, '--no-activate'] : argv;
  const handled = await commands(withQuiet);
  const files = filesIn(withQuiet, cwd);
  if (files.length) openFiles(files);
  // A plain launch, or one that opens a file, brings the window forward (or back, without focus).
  if (!handled) showWindow(quiet);
  return { handled, files: files.length };
}

/** A request through the control channel (control.ts): always without focus. */
export function controlRequest(argv: string[], cwd: string): Promise<{ handled: boolean; files: number }> {
  seen.controlRequests += 1;
  return handleLaunch(argv, cwd, { quiet: true });
}

// ---- start ------------------------------------------------------------------

/** Tell the system which app this is. Call before the single-instance lock is asked for. */
export function identify(app: App, config: AppConfig): void {
  platform.identify(app, config);
}

/**
 * Register the life-cycle handlers. Call once, before the app is ready, in the
 * instance that holds the single-instance lock.
 *
 *   getWindow       () => the main window or null
 *   createWindow    () => creates the main window and returns it
 *   handleCommands  main.ts's handler for its own commands
 *   diagnostics     main.ts's description of the running app
 */
export function start(options: ShellContext): void {
  ctx = options;
  const { app, getWindow, createWindow } = options;
  const facts = platform.facts(app);

  // A person opening the app (or a file with it) again. Scripts never come this way: a launch
  // carrying a command flag, --no-activate or a --qa-* flag is sent through the control channel
  // by main.ts before it asks for the single-instance lock (control.ts explains why).
  app.on('second-instance', (_event, argv, cwd) => {
    seen.secondLaunches += 1;
    lastSecondLaunchAt = Date.now();
    void handleLaunch(argv, cwd, { quiet: has('no-activate', argv) });
  });

  // macOS: a file opened with the app or dropped on its Dock icon. This can fire
  // before the app is ready, which is why it is registered here and not later.
  app.on('open-file', (event, file) => {
    event.preventDefault();
    openFiles([file]);
    // The system has already brought the app forward if the person asked for that;
    // a window that was put away in the Dock still has to come back, unless the last
    // launch asked for no focus (a scripted `open -g`).
    const win = getWindow();
    if (win && !win.isDestroyed() && win.isMinimized() && !quiet()) win.restore();
  });

  // macOS: the Dock icon was clicked, or the app was opened again while running.
  // The event does not say whether the system brought the app forward (`open -g`
  // does not), so a window made or shown here follows the last launch's request.
  app.on('activate', () => {
    seen.activations += 1;
    const win = getWindow();
    if (!win || win.isDestroyed()) {
      if (app.isReady()) createWindow();
    } else if (!win.isVisible()) platform.show(win, app, quiet());
  });

  app.on('window-all-closed', () => {
    if (facts.closingLastWindowQuits) app.quit();
  });

  // A second launch waits for this app to acknowledge it. If the app quits before the
  // acknowledgement has gone out (a --quit with no window open is that fast), the second
  // launch takes this app for dead and stays running in its place, with no window (seen on
  // macOS). So a quit that comes within a moment of a second launch waits out that moment.
  app.on('before-quit', (event) => {
    const wait = lastSecondLaunchAt + ACKNOWLEDGE_MS - Date.now();
    if (wait <= 0) return;
    event.preventDefault();
    setTimeout(() => app.quit(), wait);
  });

  // Files named at launch, and files that arrived before the window existed.
  void app.whenReady().then(() => {
    const files = filesIn(process.argv, process.cwd());
    setTimeout(() => {
      if (files.length) openFiles(files);
      else if (opened.length) void shellMenu.send('open-files');
    }, 0);
  });
}

export { platform };
export const createWindow = shellWindow.create;
export const applyTheme = shellWindow.applyTheme;
export const installMenu = shellMenu.install;
export const windowChanged = shellMenu.windowChanged;
export const sendCommand = shellMenu.send;
