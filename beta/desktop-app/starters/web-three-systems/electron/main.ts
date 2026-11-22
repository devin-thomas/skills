// Main process for a content app on Windows, macOS and Linux.
//
// Window recipe: created hidden with the saved theme colour as its background,
// shown at first paint, the system's own window buttons kept over a page-drawn
// title bar, page served from the app:// scheme. The page talks to this process
// only through the functions in preload.ts. Everything that differs between the
// three systems is in shell.ts and the modules it names; everything that runs
// the bundled command-line tool is in tool/.
//
// Built by scripts/build-electron.ts into dist/electron/main.mjs (an ES module, with the
// runtime kits bundled in), which is package.json's main.
//
// Flags:
//   --no-activate        show the window without taking focus, and serve the control channel
//   --control            serve the control channel (control.ts) without --no-activate
//   --data-dir=<folder>  keep all app data in this folder instead of the per-user one
// Commands for the running app (more in shell.ts). A script sends them through the control
// channel (scripts/control.cjs, scripts/control.ps1, or ask() from scripts/lib/launch.ts);
// started as `<app> --data-dir=<d> <command>` the executable sends them there itself and ends,
// and never becomes a second instance:
//   --diagnostics=<file> write a JSON description of the running app (diagnostics() below)
//   --capture=<file>     write a PNG of the window's page
//   --show-about         open the About dialog (do this before --capture to record it)
//   --quit               quit, asking first if a job is running (never asking with --no-activate)
// Development builds only: --qa-* flags load dist/electron/qa.mjs (typing, kill test, marks).

// First, so it is evaluated before any other module: no error box under --no-activate.
import './no-dialog.ts';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, ipcMain, Menu, net, protocol, session, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import config from '../app.config.json' with { type: 'json' };
import * as boundary from './boundary.ts';
import type { Boundary } from './boundary.ts';
import * as control from './control.ts';
import type { Channel, Reply } from './control.ts';
import { ROOT } from './paths.ts';
import type { Colours } from './platform.ts';
import * as appShell from './shell.ts';
import { createNative } from './tool/index.ts';
import type { SavedWindow } from './window.ts';

const arg = (name: string, argv = process.argv): string | null => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const has = (name: string, argv = process.argv): boolean => argv.includes(`--${name}`);

app.setName(config.productName);

// The network service runs inside the main process instead of a process of its own. This is a
// default with one condition: the page makes no network request (the Content-Security-Policy
// below says connect-src 'none'), so the service only carries the app:// protocol's file reads
// and a separate process isolates nothing. Build 2 measured on Windows after five idle minutes:
// 306.8 MB over 4 processes before, 237.9 MB over 3 after (installed: 304.4 to 243.2 MB); macOS
// and Linux about 10 MB less. An app whose page talks to a server sets this to false and records
// why in docs/DECISIONS.md; measure/shell-check.ts fails the switch without connect-src 'none'.
// Chromium 156's feature for it is "NetworkServiceInProcess2" (content_features.cc).
const NETWORK_SERVICE_IN_PROCESS = true;
if (NETWORK_SERVICE_IN_PROCESS) {
  const features = app.commandLine.getSwitchValue('enable-features');
  app.commandLine.appendSwitch('enable-features', [features, 'NetworkServiceInProcess2'].filter(Boolean).join(','));
}
const dataOverride = arg('data-dir');
if (dataOverride) app.setPath('userData', path.resolve(dataOverride));

// The built page (vite build writes dist/page; dist/electron holds this process).
const dist = path.join(ROOT, 'dist', 'page');
const ORIGIN = 'app://local';
// The page's own colours, as hex, for what the system draws before and around the page: the
// window's background is the page's chrome colour, the window-button glyphs are its text colour.
// Keep them equal to tokens/design-tokens.json.
const COLOURS: Colours = { chrome: { light: '#f6f5f3', dark: '#141413' }, symbol: { light: '#1c1c1b', dark: '#f1f1f0' } };

let win: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// ---- small persisted window state ----------------------------------------

const stateFile = () => path.join(app.getPath('userData'), 'window.json');

function readState(): SavedWindow {
  try {
    const saved: unknown = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    return saved !== null && typeof saved === 'object' ? (saved as SavedWindow) : {};
  } catch {
    return {};
  }
}

function writeState(patch: Record<string, unknown>): void {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify({ ...readState(), ...patch }));
  } catch {
    // Window state is a convenience; losing it is harmless.
  }
}

// ---- IPC ------------------------------------------------------------------

/** The sender of an IPC message, as far as trusted() reads it (Electron's events, and the menu kit's). */
// `sender` is all the menu kit's IpcEventLike names; the event it passes is still Electron's, with senderFrame.
type Sender = { sender?: unknown; senderFrame?: { url?: string } | null };

function trusted(event: Sender): boolean {
  return event.senderFrame?.url?.startsWith(`${ORIGIN}/`) === true;
}

// ---- the bundled tool -------------------------------------------------------
// Locating, checking and running it live in electron/tool (the shell's half of
// src/bridge.ts). This is the only place it is created.
const native = createNative({
  config,
  getWindow: () => win,
  system: appShell.platform.SYSTEM,
  projectDir: ROOT,
});

// ---- diagnostics ----------------------------------------------------------
// One object for everything: the app, the window, the tool, the shell, and the
// PATH the main process sees (an installed check proves from it that nothing is
// looked up there). Written by shell.ts for --diagnostics.

async function diagnostics() {
  return {
    app: app.getVersion(),
    packaged: app.isPackaged,
    pid: process.pid,
    exe: process.execPath,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    userData: app.getPath('userData'),
    env: { PATH: process.env['PATH'] ?? process.env['Path'] ?? null },
    native: native.diagnostics(), // tool location, status, the running job (electron/tool)
    window: win && !win.isDestroyed() ? { visible: win.isVisible(), focused: win.isFocused(), bounds: win.getBounds(), title: win.getTitle() } : null,
    quit: { approved: quitApproved },
    control: channel ? { endpoint: channel.endpoint } : null,
    boundary: guard ? guard.describe() : null, // permissions allowed and recent decisions (electron/boundary.ts)
    shell: await appShell.describe(), // system, window, menu, life cycle, memory (electron/shell.ts)
    at: new Date().toISOString(),
  };
}

/** What --diagnostics writes, for the scripts that read it. */
export type Diagnostics = Awaited<ReturnType<typeof diagnostics>>;

// ---- quitting -------------------------------------------------------------
// With a job running, the window's close and the app's quit ask first
// (native.confirmQuitDuringJob). `quiet` is a request from a launch that asked
// for no focus: then no question is shown and the job carries on.

let quitApproved = false;

/** Resolves true when the app may close or quit now. */
function mayQuit(quiet: boolean): Promise<boolean> {
  if (quitApproved || !native.jobRunning) return Promise.resolve(true);
  return native.confirmQuitDuringJob(win, { quiet });
}

/** --quit from a script or a second launch: quit on every system, after the same question. */
function requestQuit(quiet: boolean): void {
  void mayQuit(quiet).then((go) => {
    if (!go) return;
    quitApproved = true;
    if (win && !win.isDestroyed()) win.close();
    if (!appShell.platform.facts(app).closingLastWindowQuits) app.quit();
  });
}

// Command-Q, the Dock's Quit, Control+Q on Linux, a system shutdown: anything that quits the app.
// These come from a person, so the question is asked; --quit has asked (or not) in requestQuit.
app.on('before-quit', (event) => {
  if (quitApproved || !native.jobRunning) return;
  event.preventDefault();
  void mayQuit(false).then((go) => {
    if (!go) return;
    quitApproved = true;
    app.quit();
  });
});

// ---- commands of this file ----------------------------------------------------
// Files are written with the synchronous calls on purpose: the first asynchronous
// file call in the main process starts libuv's worker threads, which on Windows
// commit about 32 MB that never goes away (see shell.ts, writeJson).

async function handleCommands(argv: string[]): Promise<boolean> {
  const captureFile = arg('capture', argv);
  if (has('show-about', argv) && win && !win.isDestroyed()) {
    await win.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('app-show-about')); true");
    await new Promise((r) => setTimeout(r, 400));
  }
  if (captureFile && win && !win.isDestroyed()) {
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.resolve(captureFile), image.toPNG());
  }
  if (has('quit', argv)) requestQuit(has('no-activate', argv));
  return Boolean(captureFile || has('quit', argv) || has('show-about', argv));
}

// ---- saved state ----------------------------------------------------------
// The page's unsaved work is a small JSON document per key. It is written here,
// synchronously and atomically, so a kill right after a save loses nothing.
// Add a key here for each document the page saves.

const DRAFT_KEY = `${config.storagePrefix}.draft.v1`;
const STATE_KEYS = new Set([DRAFT_KEY]);
const stateDir = () => path.join(app.getPath('userData'), 'data', 'state');

function writeSavedState(key: unknown, json: unknown): void {
  if (typeof key !== 'string' || !STATE_KEYS.has(key) || typeof json !== 'string' || json.length > 4 * 1024 * 1024) return;
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    const file = path.join(stateDir(), `${key}.json`);
    fs.writeFileSync(`${file}.tmp`, json);
    fs.renameSync(`${file}.tmp`, file);
  } catch {
    // The page keeps the work in memory and saves again on the next change.
  }
}

function readSavedState(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of STATE_KEYS) {
    try {
      out[key] = fs.readFileSync(path.join(stateDir(), `${key}.json`), 'utf8');
    } catch {
      // Nothing saved yet.
    }
  }
  return out;
}

/** One invoke handler, refused for any sender but the app's own page. */
export type Handle = (channel: string, work: (...args: unknown[]) => unknown) => void;
const handle: Handle = (channel, work) => {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    if (!trusted(event)) throw new Error('untrusted sender');
    return work(...args);
  });
};

function registerIpc(): void {
  handle('app:bootstrap', async () => ({
    stored: readSavedState(),
    platform: appShell.platform.SYSTEM,
    about: { appVersion: app.getVersion(), dataDir: path.join(app.getPath('userData'), 'data') },
    tool: await native.status(),
  }));
  native.registerIpc({ handle, ipcMain, trusted });
  ipcMain.on('app:save-state', (event, key: unknown, json: unknown) => {
    if (trusted(event)) writeSavedState(key, json);
  });
  ipcMain.on('app:theme', (event, theme: unknown) => {
    if (!trusted(event) || (theme !== 'light' && theme !== 'dark') || !win || win.isDestroyed()) return;
    appShell.applyTheme(win, theme, { config, colours: COLOURS });
    writeState({ theme });
  });
}

// ---- window ---------------------------------------------------------------
// The window recipe, the menu and everything that differs between Windows,
// macOS and Linux live in shell.ts and the modules it names. This file only
// hands them its own state.

/** `inactive`: show without taking focus. By default, what the launch being handled asked for. */
function createWindow({ inactive = appShell.quiet() }: { inactive?: boolean } = {}): BrowserWindow {
  const target = appShell.createWindow({
    config,
    origin: ORIGIN,
    colours: COLOURS,
    preload: path.join(ROOT, 'dist', 'electron', 'preload.cjs'),
    saved: readState(),
    save: writeState,
    inactive,
  });
  win = target;

  // A running job's outcome would be lost by closing: ask first (on every system).
  target.on('close', (event) => {
    if (quitApproved || !native.jobRunning) return;
    event.preventDefault();
    void mayQuit(false).then((go) => {
      if (go && !target.isDestroyed()) {
        quitApproved = true;
        target.close();
      }
    });
  });
  target.on('closed', () => {
    if (win === target) win = null;
    quitApproved = false; // a reopened window (macOS) asks again
    appShell.windowChanged();
  });
  appShell.windowChanged();

  // Development-only test instrumentation; never present in the packaged app. electron/qa.ts is
  // built on its own into dist/electron/qa.mjs and loaded by a path computed here, so it is
  // never bundled into this file (measure/shell-check.ts holds that), and scripts/package.ts
  // leaves it out.
  if (!app.isPackaged && process.argv.some((a) => a.startsWith('--qa-'))) {
    const launchedAt = Date.now();
    target.webContents.once('did-finish-load', () => {
      const qa = pathToFileURL(path.join(ROOT, 'dist', 'electron', 'qa.mjs')).href;
      void (import(qa) as Promise<typeof import('./qa.ts')>).then((module) => module.run(target, writeSavedState, { launchedAt, draftKey: DRAFT_KEY, system: appShell.platform.SYSTEM }));
    });
  }
  return target;
}

// ---- lifecycle ------------------------------------------------------------
// What kind of launch this is decides how it reaches a running app (control.ts, classify):
//   command  (--diagnostics, --capture, --quit, ...): sent through the control channel and
//            ended here, answered or not. It never becomes the app and never asks for the
//            single-instance lock, so Chromium's process singleton never hands the running app
//            the right to take the foreground (on Windows the second process grants it with
//            AllowSetForegroundWindow before any of the app's code runs).
//   agent    (--no-activate, --control, --qa-*): handed to a running app through the channel
//            when one answers; otherwise this launch becomes the app.
//   person   the normal path: the lock, and a second launch that brings the window forward.

const launchKind = control.classify(process.argv);
let channel: Channel | null = null;
let guard: Boundary | null = null;

function forward(waitMs: number): Promise<Reply> {
  return control.send(app.getPath('userData'), process.argv.slice(1), { cwd: process.cwd(), waitMs, timeoutMs: 120_000 });
}

function endAfter(reply: Reply): void {
  process.stdout.write(`${JSON.stringify(reply)}\n`);
  app.exit(reply.ok ? 0 : reply.answered ? 1 : 2);
}

function start(): void {
  appShell.identify(app, config);

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  // Second launches, files opened with the app, the Dock, closing and quitting.
  appShell.start({ app, config, getWindow: () => win, createWindow, handleCommands, diagnostics });

  void app.whenReady().then(() => {
    // Before any web contents exists: permissions denied but the allowed few, no navigation
    // away, no new windows, no <webview> (electron/boundary.ts).
    guard = boundary.install({ app, session, origin: ORIGIN, openExternal: (url) => void shell.openExternal(url) });
    appShell.installMenu({ app, Menu, ipcMain, facts: appShell.platform.facts(app), productName: config.productName, trusted, getWindow: () => win, openWindow: () => createWindow() });
    protocol.handle('app', async (request) => {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.normalize(path.join(dist, rel));
      // dist + separator: a sibling folder whose name starts with the same letters is outside.
      if (!file.startsWith(dist + path.sep)) return new Response('forbidden', { status: 403 });
      const response = await net.fetch(pathToFileURL(file).toString());
      if (!file.endsWith('.html')) return response;
      // The page loads only its own files and makes no network request of any kind.
      const headers = new Headers(response.headers);
      headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
      );
      return new Response(response.body, { status: response.status, headers });
    });
    registerIpc();
    native.start(); // checks the tool and reconciles job records left by a killed run
    createWindow();
    // Scripts reach this app only through the control channel, and only when they started it.
    if (control.serves(process.argv)) {
      channel = control.serve({ userData: app.getPath('userData'), system: appShell.platform.SYSTEM, pid: process.pid, name: config.exeName, run: appShell.controlRequest });
      app.on('will-quit', () => channel?.close());
    }
  });
}

if (launchKind === 'command') {
  void forward(20_000).then(endAfter);
} else if (launchKind === 'agent' && control.readInfo(app.getPath('userData'))) {
  void forward(0).then((reply) => (reply.answered ? endAfter(reply) : start()));
} else {
  start();
}
