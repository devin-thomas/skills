// Main process for a Windows content app.
//
// Window recipe: created hidden with the saved theme colour as its background,
// shown at first paint, native caption buttons kept through titleBarOverlay,
// page served from the app:// scheme. The page talks to this process only
// through the functions in preload.cjs.
//
// Flags:
//   --no-activate        show the window without taking focus
//   --data-dir=<folder>  keep all app data in this folder instead of the per-user one
// Flags a second launch can pass to the instance that is already running:
//   --diagnostics=<file> write a JSON description of the running app
//   --capture=<file>     write a PNG of the window's page
//   --show-about         open the About dialog (do this before --capture to record it)
//   --quit               close the window as if its close button was pressed
'use strict';

const { app, BrowserWindow, Menu, ipcMain, nativeTheme, net, protocol, screen, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const config = require('../app.config.json');
const { locateCli, runCli } = require('./cli/run.cjs');

const arg = (name, argv = process.argv) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const has = (name, argv = process.argv) => argv.includes(`--${name}`);

app.setName(config.productName);
app.setAppUserModelId(config.appId);
const dataOverride = arg('data-dir');
if (dataOverride) app.setPath('userData', path.resolve(dataOverride));

const dist = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://local';
// The chrome colour of each theme, as hex: keep in step with `chrome` in tokens/design-tokens.json.
const CHROME = { light: '#f6f5f3', dark: '#141413' };
const SYMBOL = { light: '#1c1c1b', dark: '#f1f1f0' };
const BAR = config.titleBarHeight;

/** @type {BrowserWindow | null} */
let win = null;
let cliStatus = null;

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

// ---- command-line tool ----------------------------------------------------
// The app's logic lives in an installed CLI (or a separate core). This process
// only finds it, runs it with an argument array and a time limit, and reads
// its output. Add one function per CLI call the page needs; never pass page
// input to a shell.

async function readCliStatus() {
  if (!config.cli.shim) return { configured: false, found: false, version: null, detail: null, node: null, script: null };
  const cli = locateCli(config.cli);
  if (!cli.ok) return { configured: true, found: false, version: null, detail: cli.detail, node: null, script: null };
  const run = await runCli(cli, config.cli.versionArgs, { timeoutMs: 10_000, maxBytes: 64 * 1024 });
  const version = run.code === 0 ? run.stdout.trim().split(/\r?\n/)[0] : null;
  const detail = version ? null : run.timedOut ? 'The command-line tool did not answer in 10 seconds.' : (run.spawnError ?? run.stderr.trim().slice(0, 400));
  return { configured: true, found: true, version, detail, node: cli.node, script: cli.cliJs };
}

// ---- diagnostics ----------------------------------------------------------

function diagnostics() {
  return {
    app: app.getVersion(),
    packaged: app.isPackaged,
    pid: process.pid,
    exe: process.execPath,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    userData: app.getPath('userData'),
    cli: cliStatus,
    window: win && !win.isDestroyed() ? { visible: win.isVisible(), focused: win.isFocused(), bounds: win.getBounds(), title: win.getTitle() } : null,
    at: new Date().toISOString(),
  };
}

async function handleCommands(argv) {
  const diagnosticsFile = arg('diagnostics', argv);
  const captureFile = arg('capture', argv);
  if (has('show-about', argv) && win && !win.isDestroyed()) {
    await win.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('app-show-about')); true");
    await new Promise((r) => setTimeout(r, 400));
  }
  if (diagnosticsFile) await fsp.writeFile(path.resolve(diagnosticsFile), JSON.stringify(diagnostics(), null, 2));
  if (captureFile && win && !win.isDestroyed()) {
    const image = await win.webContents.capturePage();
    await fsp.writeFile(path.resolve(captureFile), image.toPNG());
  }
  if (has('quit', argv)) win?.close();
  return Boolean(diagnosticsFile || captureFile || has('quit', argv) || has('show-about', argv));
}

// ---- saved state ----------------------------------------------------------
// The page's unsaved work is a small JSON document per key. It is written here,
// synchronously and atomically, so a kill right after a save loses nothing.
// Add a key here for each document the page saves.

const STATE_KEYS = new Set([`${config.storagePrefix}.draft.v1`]);
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

// ---- IPC ------------------------------------------------------------------

function trusted(event) {
  return event.senderFrame?.url?.startsWith(`${ORIGIN}/`) === true;
}

function handle(channel, work) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!trusted(event)) throw new Error('untrusted sender');
    return work(...args);
  });
}

function registerIpc() {
  handle('app:bootstrap', async () => {
    cliStatus = await readCliStatus();
    return {
      stored: readSavedState(),
      about: { appVersion: app.getVersion(), dataDir: path.join(app.getPath('userData'), 'data'), cli: cliStatus },
    };
  });
  ipcMain.on('app:save-state', (event, key, json) => {
    if (trusted(event)) writeSavedState(key, json);
  });
  ipcMain.on('app:theme', (event, theme) => {
    if (!trusted(event) || (theme !== 'light' && theme !== 'dark') || !win || win.isDestroyed()) return;
    win.setBackgroundColor(CHROME[theme]);
    win.setTitleBarOverlay({ color: '#00000000', symbolColor: SYMBOL[theme], height: BAR });
    writeState({ theme });
  });
}

// ---- window ---------------------------------------------------------------

function createWindow() {
  const state = readState();
  const theme = state.theme === 'light' || state.theme === 'dark' ? state.theme : nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  const primary = screen.getPrimaryDisplay().workArea;
  const size = { width: Math.min(1280, primary.width), height: Math.min(800, primary.height) };
  const saved = state.bounds && onScreen(state.bounds) ? state.bounds : null;

  const initial = saved ?? { ...size, x: Math.round(primary.x + (primary.width - size.width) / 2), y: Math.round(primary.y + (primary.height - size.height) / 2) };

  win = new BrowserWindow({
    ...initial,
    minWidth: 560,
    minHeight: 420,
    show: false,
    title: config.productName,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: CHROME[theme],
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: SYMBOL[theme], height: BAR },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });

  // Reveal at first paint, with a fallback so the window can never stay hidden.
  let shown = false;
  const reveal = () => {
    if (shown || !win || win.isDestroyed()) return;
    shown = true;
    if (has('no-activate')) win.showInactive();
    else win.show();
  };
  win.once('ready-to-show', reveal);
  setTimeout(reveal, 3000);

  // The page never navigates and never opens windows. Links open in the browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Native editing menu for text, in place of the browser's context menu.
  win.webContents.on('context-menu', (_event, params) => {
    const items = [];
    if (params.isEditable) {
      items.push({ role: 'cut', enabled: params.editFlags.canCut }, { role: 'copy', enabled: params.editFlags.canCopy }, { role: 'paste', enabled: params.editFlags.canPaste }, { type: 'separator' }, { role: 'selectAll' });
    } else if (params.selectionText.trim()) {
      items.push({ role: 'copy' });
    }
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  // With a hidden title bar Windows reports the window a few pixels larger than
  // the size it was created with. Remove that difference before saving, or the
  // window would grow a little on every restart.
  const created = win.getBounds();
  const grow = { width: created.width - initial.width, height: created.height - initial.height };
  const saveBounds = () => {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isMaximized()) return;
    const b = win.getBounds();
    writeState({ bounds: { x: b.x, y: b.y, width: b.width - grow.width, height: b.height - grow.height } });
  };
  win.on('resized', saveBounds);
  win.on('moved', saveBounds);

  // If the app can be mid-way through work whose outcome would be lost or left
  // unknown by closing (a submission, a write), ask here before closing:
  // win.on('close', (event) => { if (busy()) { ...dialog.showMessageBoxSync...; event.preventDefault(); } });
  win.on('closed', () => {
    win = null;
  });

  // Development-only test instrumentation; never present in the packaged app.
  if (!app.isPackaged && process.argv.some((a) => a.startsWith('--qa-'))) {
    const launchedAt = Date.now();
    win.webContents.once('did-finish-load', () => {
      void require('./qa.cjs').run(win, writeSavedState, { launchedAt, draftKey: `${config.storagePrefix}.draft.v1` });
    });
  }

  void win.loadURL(`${ORIGIN}/index.html`);
}

// ---- lifecycle ------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    void handleCommands(argv).then((handled) => {
      if (handled || !win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    });
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle('app', async (request) => {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.normalize(path.join(dist, rel));
      if (!file.startsWith(dist)) return new Response('forbidden', { status: 403 });
      const response = await net.fetch(pathToFileURL(file).toString());
      if (!file.endsWith('.html')) return response;
      // The page loads only its own files and makes no network request of any kind.
      // An app that talks to a server names its origins in connect-src here.
      const headers = new Headers(response.headers);
      headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
      );
      return new Response(response.body, { status: response.status, headers });
    });
    registerIpc();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
