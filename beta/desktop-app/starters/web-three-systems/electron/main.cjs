// Main process for a content app on Windows, macOS and Linux.
//
// Window recipe: created hidden with the saved theme colour as its background,
// shown at first paint, the system's own window buttons kept over a page-drawn
// title bar, page served from the app:// scheme. The page talks to this process
// only through the functions in preload.cjs. Everything that differs between the
// three systems is in shell.cjs and the modules it names; everything that runs
// the bundled command-line tool is in tool/.
//
// Flags:
//   --no-activate        show the window without taking focus, and serve the control channel
//   --control            serve the control channel (control.cjs) without --no-activate
//   --data-dir=<folder>  keep all app data in this folder instead of the per-user one
// Commands for the running app (more in shell.cjs). A script sends them through the control
// channel (scripts/control.cjs, scripts/control.ps1, or ask() from scripts/lib/launch.mjs);
// started as `<app> --data-dir=<d> <command>` the executable sends them there itself and ends,
// and never becomes a second instance:
//   --diagnostics=<file> write a JSON description of the running app (diagnostics() below)
//   --capture=<file>     write a PNG of the window's page
//   --show-about         open the About dialog (do this before --capture to record it)
//   --quit               quit, asking first if a job is running (never asking with --no-activate)
// Development builds only: --qa-* flags load electron/qa.cjs (typing, kill test, marks).
'use strict';

// A launch that asked for no focus never shows Electron's error box for a main-process
// error (that box is modal and takes focus); the error goes to stderr and the app ends.
// Registered before anything else is loaded, so an error in any module below is caught.
// A person's launch keeps the box: it is the only way they would learn of the error.
if (process.argv.includes('--no-activate')) {
  process.on('uncaughtException', (error) => {
    process.stderr.write(`main process error (no dialog under --no-activate): ${error?.stack ?? error}\n`);
    process.exit(70);
  });
}

const { app, ipcMain, Menu, net, protocol, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const config = require('../app.config.json');
const appShell = require('./shell.cjs');
const control = require('./control.cjs');

const arg = (name, argv = process.argv) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const has = (name, argv = process.argv) => argv.includes(`--${name}`);

app.setName(config.productName);

// The network service runs inside the main process instead of a process of its own. This is a
// default with one condition: the page makes no network request (the Content-Security-Policy
// below says connect-src 'none'), so the service only carries the app:// protocol's file reads
// and a separate process isolates nothing. Build 2 measured on Windows after five idle minutes:
// 306.8 MB over 4 processes before, 237.9 MB over 3 after (installed: 304.4 to 243.2 MB); macOS
// and Linux about 10 MB less. An app whose page talks to a server sets this to false and records
// why in docs/DECISIONS.md; measure/shell-check.mjs fails the switch without connect-src 'none'.
// Chromium 156's feature for it is "NetworkServiceInProcess2" (content_features.cc).
const NETWORK_SERVICE_IN_PROCESS = true;
if (NETWORK_SERVICE_IN_PROCESS) {
  const features = app.commandLine.getSwitchValue('enable-features');
  app.commandLine.appendSwitch('enable-features', [features, 'NetworkServiceInProcess2'].filter(Boolean).join(','));
}
const dataOverride = arg('data-dir');
if (dataOverride) app.setPath('userData', path.resolve(dataOverride));

const dist = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://local';
// The page's own colours, as hex, for what the system draws before and around the page: the
// window's background is the page's chrome colour, the window-button glyphs are its text colour.
// Keep them equal to tokens/design-tokens.json.
const COLOURS = { chrome: { light: '#f6f5f3', dark: '#141413' }, symbol: { light: '#1c1c1b', dark: '#f1f1f0' } };

/** @type {import('electron').BrowserWindow | null} */
let win = null;

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// ---- small persisted window state ----------------------------------------

const stateFile = () => path.join(app.getPath('userData'), 'window.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(patch) {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify({ ...readState(), ...patch }));
  } catch {
    // Window state is a convenience; losing it is harmless.
  }
}

function onScreen(bounds) {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return bounds.x < a.x + a.width - 80 && bounds.x + bounds.width > a.x + 80 && bounds.y >= a.y - 8 && bounds.y < a.y + a.height - 80;
  });
}

// ---- IPC ------------------------------------------------------------------

function trusted(event) {
  return event.senderFrame?.url?.startsWith(`${ORIGIN}/`) === true;
}

// ---- the bundled tool -------------------------------------------------------
// Locating, checking and running it live in electron/tool (the shell's half of
// src/bridge.ts). This is the only place it is created.
const native = require('./tool/index.cjs').createNative({
  config,
  getWindow: () => win,
  system: appShell.platform.SYSTEM,
  projectDir: path.join(__dirname, '..'),
});

// ---- diagnostics ----------------------------------------------------------
// One object for everything: the app, the window, the tool, the shell, and the
// PATH the main process sees (an installed check proves from it that nothing is
// looked up there). Written by shell.cjs for --diagnostics.

async function diagnostics() {
  return {
    app: app.getVersion(),
    packaged: app.isPackaged,
    pid: process.pid,
    exe: process.execPath,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    userData: app.getPath('userData'),
    env: { PATH: process.env.PATH ?? process.env.Path ?? null },
    native: native.diagnostics(), // tool location, status, the running job (electron/tool)
    window: win && !win.isDestroyed() ? { visible: win.isVisible(), focused: win.isFocused(), bounds: win.getBounds(), title: win.getTitle() } : null,
    quit: { approved: quitApproved },
    control: channel ? { endpoint: channel.endpoint } : null,
    shell: await appShell.describe(), // system, window, menu, life cycle, memory (electron/shell.cjs)
    at: new Date().toISOString(),
  };
}

// ---- quitting -------------------------------------------------------------
// With a job running, the window's close and the app's quit ask first
// (native.confirmQuitDuringJob). `quiet` is a request from a launch that asked
// for no focus: then no question is shown and the job carries on.

let quitApproved = false;

/** Resolves true when the app may close or quit now. */
function mayQuit(quiet) {
  if (quitApproved || !native.jobRunning) return Promise.resolve(true);
  return native.confirmQuitDuringJob(win, { quiet });
}

/** --quit from a script or a second launch: quit on every system, after the same question. */
function requestQuit(quiet) {
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
// commit about 32 MB that never goes away (see shell.cjs, writeJson).

async function handleCommands(argv) {
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

function writeSavedState(key, json) {
  if (!STATE_KEYS.has(key) || typeof json !== 'string' || json.length > 4 * 1024 * 1024) return;
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    const file = path.join(stateDir(), `${key}.json`);
    fs.writeFileSync(`${file}.tmp`, json);
    fs.renameSync(`${file}.tmp`, file);
  } catch {
    // The page keeps the work in memory and saves again on the next change.
  }
}

function readSavedState() {
  const out = {};
  for (const key of STATE_KEYS) {
    try {
      out[key] = fs.readFileSync(path.join(stateDir(), `${key}.json`), 'utf8');
    } catch {
      // Nothing saved yet.
    }
  }
  return out;
}

function handle(channel, work) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!trusted(event)) throw new Error('untrusted sender');
    return work(...args);
  });
}

function registerIpc() {
  handle('app:bootstrap', async () => ({
    stored: readSavedState(),
    platform: appShell.platform.SYSTEM,
    about: { appVersion: app.getVersion(), dataDir: path.join(app.getPath('userData'), 'data') },
    tool: await native.status(),
  }));
  native.registerIpc({ handle, ipcMain, trusted, dataDir: () => app.getPath('userData') });
  ipcMain.on('app:save-state', (event, key, json) => {
    if (trusted(event)) writeSavedState(key, json);
  });
  ipcMain.on('app:theme', (event, theme) => {
    if (!trusted(event) || (theme !== 'light' && theme !== 'dark') || !win || win.isDestroyed()) return;
    appShell.applyTheme(win, theme, { config, colours: COLOURS });
    writeState({ theme });
  });
}

// ---- window ---------------------------------------------------------------
// The window recipe, the menu and everything that differs between Windows,
// macOS and Linux live in shell.cjs and the modules it names. This file only
// hands them its own state.

/** `inactive`: show without taking focus. By default, what the launch being handled asked for. */
function createWindow({ inactive = appShell.quiet() } = {}) {
  win = appShell.createWindow({
    config,
    origin: ORIGIN,
    colours: COLOURS,
    preload: path.join(__dirname, 'preload.cjs'),
    saved: readState(),
    save: writeState,
    onScreen,
    inactive,
  });

  // A running job's outcome would be lost by closing: ask first (on every system).
  const target = win;
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

  // Development-only test instrumentation; never present in the packaged app.
  if (!app.isPackaged && process.argv.some((a) => a.startsWith('--qa-'))) {
    const launchedAt = Date.now();
    target.webContents.once('did-finish-load', () => {
      void require('./qa.cjs').run(target, writeSavedState, { launchedAt, draftKey: DRAFT_KEY });
    });
  }
  return target;
}

// ---- lifecycle ------------------------------------------------------------
// What kind of launch this is decides how it reaches a running app (control.cjs, classify):
//   command  (--diagnostics, --capture, --quit, ...): sent through the control channel and
//            ended here, answered or not. It never becomes the app and never asks for the
//            single-instance lock, so Chromium's process singleton never hands the running app
//            the right to take the foreground (on Windows the second process grants it with
//            AllowSetForegroundWindow before any of the app's code runs).
//   agent    (--no-activate, --control, --qa-*): handed to a running app through the channel
//            when one answers; otherwise this launch becomes the app.
//   person   the normal path: the lock, and a second launch that brings the window forward.

const launchKind = control.classify(process.argv);
/** @type {{ endpoint: string, close: () => void } | null} */
let channel = null;

function forward(waitMs) {
  return control.send(app.getPath('userData'), process.argv.slice(1), { cwd: process.cwd(), waitMs, timeoutMs: 120_000 });
}

function endAfter(reply) {
  process.stdout.write(`${JSON.stringify(reply)}\n`);
  app.exit(reply.ok ? 0 : reply.answered ? 1 : 2);
}

function start() {
  appShell.identify(app, config);

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  // Second launches, files opened with the app, the Dock, closing and quitting.
  appShell.start({ app, config, getWindow: () => win, createWindow, handleCommands, diagnostics });

  app.whenReady().then(() => {
    appShell.installMenu({ app, Menu, ipcMain, facts: appShell.platform.facts(app), productName: config.productName, trusted, getWindow: () => win, openWindow: () => createWindow() });
    protocol.handle('app', async (request) => {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.normalize(path.join(dist, rel));
      if (!file.startsWith(dist)) return new Response('forbidden', { status: 403 });
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
