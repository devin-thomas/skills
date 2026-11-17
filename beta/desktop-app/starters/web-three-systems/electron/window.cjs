// The main window, the same recipe on every system: created hidden in the
// theme's colour, revealed once the page has painted, the system's own window
// buttons kept over a page-drawn title bar, size and position remembered.
// What differs per system comes from platform.cjs.
'use strict';

const { app, BrowserWindow, Menu, nativeTheme, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const platform = require('./platform.cjs');
const shellMenu = require('./menu.cjs');

// The default and minimum window come from app.config.json (`window`). The audit lays the
// page out at exactly these sizes (qa/audit.mjs), so the two can never disagree.
const sizes = (config) => ({
  DEFAULT_SIZE: { width: config.window.width, height: config.window.height },
  MIN_SIZE: { minWidth: config.window.minWidth, minHeight: config.window.minHeight },
});

/** What was chosen for the current window, kept for --diagnostics. */
let chosen = null;

const flag = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/** Development only: window options to lay over the platform's, as JSON, for the container tests. */
function testOverride() {
  if (app.isPackaged) return {};
  try {
    return JSON.parse(flag('qa-window-options') ?? '{}');
  } catch {
    return {};
  }
}

function initialBounds(saved, onScreen, facts, { DEFAULT_SIZE, MIN_SIZE }) {
  const area = screen.getPrimaryDisplay().workArea;
  const size = { width: Math.min(DEFAULT_SIZE.width, area.width), height: Math.min(DEFAULT_SIZE.height, area.height) };
  const kept = saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) ? saved : null;
  if (!facts.positionIsReal) {
    // The compositor places the window; only the size is ours to restore.
    return kept ? { width: Math.max(MIN_SIZE.minWidth, kept.width), height: Math.max(MIN_SIZE.minHeight, kept.height) } : size;
  }
  if (kept && Number.isFinite(kept.x) && Number.isFinite(kept.y) && onScreen(kept)) return { x: kept.x, y: kept.y, width: kept.width, height: kept.height };
  return { ...size, x: Math.round(area.x + (area.width - size.width) / 2), y: Math.round(area.y + (area.height - size.height) / 2) };
}

/**
 * Create the main window and start loading the page.
 *
 *   config    app.config.json
 *   origin    the page's origin ("app://local")
 *   colours   { chrome: { light, dark }, symbol: { light, dark } } as hex
 *   preload   path of the preload script
 *   saved     the saved window state ({ theme, bounds }) or {}
 *   save      (patch) => void, merges into the saved window state
 *   onScreen  (bounds) => boolean, true when the bounds are on a connected display
 *   inactive  show without taking focus (--no-activate)
 */
function create({ config, origin, colours, preload, saved, save, onScreen, inactive }) {
  const facts = platform.facts(app);
  const size = sizes(config);
  // A saved choice wins; otherwise the system's setting. An app with a product default
  // (one theme first, whatever the system says) sets it here and records it in docs/DECISIONS.md.
  const theme = saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  const initial = initialBounds(saved.bounds, onScreen, facts, size);
  const perSystem = { ...platform.windowOptions({ theme, config, colours }), ...testOverride() };
  const createdAt = Date.now();

  const win = new BrowserWindow({
    ...initial,
    ...size.MIN_SIZE,
    show: false,
    title: config.productName,
    backgroundColor: colours.chrome[theme],
    ...perSystem,
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });
  chosen = { theme, initial, options: perSystem, barHeight: platform.barHeight(config), reveal: null, fullScreen: [] };

  // Reveal at first paint, with a fallback so the window can never stay hidden.
  let shown = false;
  const reveal = (trigger) => () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    const call = platform.show(win, app, inactive);
    chosen.reveal = { trigger, afterMs: Date.now() - createdAt, call, withoutFocusAsked: inactive, withoutFocusPossible: facts.canShowInactive };
    // --reveal-record=<file>: say how the window was shown and whether it has focus, half a
    // second on. A test reads this in place of asking the running app, because asking (any
    // request through the control channel) changes what the app's memory looks like afterwards.
    const record = flag('reveal-record');
    if (record) {
      setTimeout(() => {
        if (win.isDestroyed()) return;
        try {
          fs.writeFileSync(path.resolve(record), JSON.stringify({ pid: process.pid, at: new Date().toISOString(), reveal: chosen.reveal, visible: win.isVisible(), focused: win.isFocused() }, null, 2));
        } catch {
          // The record is for tests only.
        }
      }, 500);
    }
  };
  if (facts.revealOn.includes('ready-to-show')) win.once('ready-to-show', reveal('ready-to-show'));
  if (facts.revealOn.includes('did-finish-load')) win.webContents.once('did-finish-load', reveal('did-finish-load'));
  setTimeout(reveal('fallback after 3 s'), 3000);

  // The page never navigates and never opens windows. Links open in the browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${origin}/`)) event.preventDefault();
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

  // Keys the system expects that the page's shortcut table does not use, on
  // systems with no menu bar to carry them.
  const keys = facts.shellKeys.filter((k) => k.match);
  if (keys.length) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.isAutoRepeat) return;
      const hit = keys.find(({ match }) => input.key.toLowerCase() === match.key && input.control === Boolean(match.control) && input.shift === Boolean(match.shift) && input.alt === Boolean(match.alt) && input.meta === Boolean(match.meta));
      if (!hit) return;
      event.preventDefault();
      if (hit.does === 'quit') app.quit();
      else if (hit.does === 'close window') win.close();
      else if (hit.does === 'full screen') win.setFullScreen(!win.isFullScreen());
      else if (hit.command) void shellMenu.send(hit.command);
    });
  }

  // With a hidden title bar Windows reports the window a few pixels larger than
  // the size it was created with. Remove that difference before saving, or the
  // window would grow a little on every restart. The difference is measured, so
  // it is zero on a system that reports the size it was given.
  const created = win.getBounds();
  const grow = { width: created.width - initial.width, height: created.height - initial.height };
  chosen.growth = grow;
  const saveBounds = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isMaximized() || win.isFullScreen()) return;
    const b = win.getBounds();
    const size = { width: b.width - grow.width, height: b.height - grow.height };
    save({ bounds: facts.positionIsReal ? { x: b.x, y: b.y, ...size } : size });
  };
  win.on('resized', saveBounds);
  win.on('moved', saveBounds);
  if (facts.system === 'linux') {
    // "resized" and "moved" are not sent on Linux; save a moment after the last change instead.
    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(saveBounds, 300);
    };
    win.on('resize', soon);
    win.on('move', soon);
    win.on('closed', () => clearTimeout(timer));
  }

  win.on('enter-full-screen', () => chosen.fullScreen.push(['enter', Date.now() - createdAt]));
  win.on('leave-full-screen', () => chosen.fullScreen.push(['leave', Date.now() - createdAt]));

  // The page sets its theme from the address before its first paint, so it always matches
  // the colour the window was created with (index.html).
  void win.loadURL(`${origin}/index.html#theme=${theme}`);
  return win;
}

/** The page changed theme: repaint the parts of the window the system draws. */
function applyTheme(win, theme, { config, colours }) {
  if (!win || win.isDestroyed() || (theme !== 'light' && theme !== 'dark')) return;
  win.setBackgroundColor(colours.chrome[theme]);
  // The traffic lights on macOS colour themselves; elsewhere the glyph colour is ours.
  if (platform.facts(app).overlayColours) win.setTitleBarOverlay({ color: '#00000000', symbolColor: colours.symbol[theme], height: platform.barHeight(config) });
}

/** What the page sees of the title bar: the overlay rectangle and the env() values it lays out with. */
const PAGE_PROBE = `(() => {
  const wco = navigator.windowControlsOverlay;
  const rect = wco && wco.getTitlebarAreaRect ? wco.getTitlebarAreaRect() : null;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;left:env(titlebar-area-x,-1px);top:env(titlebar-area-y,-1px);width:env(titlebar-area-width,0px);height:env(titlebar-area-height,0px)';
  document.documentElement.appendChild(probe);
  const style = getComputedStyle(probe);
  const env = { x: parseFloat(style.left), y: parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) };
  probe.remove();
  const bar = document.querySelector('.titlebar, header');
  const box = bar ? bar.getBoundingClientRect() : null;
  const modes = ['window-controls-overlay', 'fullscreen', 'standalone', 'browser'].filter((m) => matchMedia('(display-mode: ' + m + ')').matches);
  return {
    overlayVisible: wco ? wco.visible : null,
    titlebarAreaRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    env,
    reservedLeft: rect ? rect.x : null,
    reservedRight: rect ? innerWidth - rect.x - rect.width : null,
    inner: { width: innerWidth, height: innerHeight },
    devicePixelRatio,
    displayModes: modes,
    pageBar: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    focused: document.hasFocus(),
  };
})()`;

/** The window as it is now, for --diagnostics. */
async function describe(win) {
  if (!win || win.isDestroyed()) return { open: false, chosen };
  let page = null;
  try {
    page = await Promise.race([win.webContents.executeJavaScript(PAGE_PROBE), new Promise((r) => setTimeout(() => r({ error: 'the page did not answer in 3 s' }), 3000))]);
  } catch (error) {
    page = { error: String(error) };
  }
  const display = screen.getDisplayMatching(win.getBounds());
  return {
    open: true,
    chosen,
    visible: win.isVisible(),
    focused: win.isFocused(),
    minimized: win.isMinimized(),
    maximized: win.isMaximized(),
    fullScreen: win.isFullScreen(),
    bounds: win.getBounds(),
    contentBounds: win.getContentBounds(),
    // macOS only: where the traffic lights are now.
    windowButtonPosition: typeof win.getWindowButtonPosition === 'function' ? win.getWindowButtonPosition() : null,
    // The system's id for the window ("window:<id>:0"), for a display-level screenshot of just this window.
    mediaSourceId: win.getMediaSourceId(),
    display: { id: display.id, scaleFactor: display.scaleFactor, hz: display.displayFrequency, workArea: display.workArea, primary: display.id === screen.getPrimaryDisplay().id },
    page,
  };
}

module.exports = { create, applyTheme, describe };
