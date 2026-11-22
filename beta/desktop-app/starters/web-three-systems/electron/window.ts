// The main window, the same recipe on every system: created hidden in the
// theme's colour, revealed once the page has painted, the system's own window
// buttons kept over a page-drawn title bar, size and position remembered.
// What differs per system comes from platform.ts.
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, screen, shell } from 'electron';
import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions, Point, Rectangle } from 'electron';
import * as platform from './platform.ts';
import type { AppConfig, Colours, Facts, Theme } from './platform.ts';
import * as shellMenu from './menu.ts';
import { initialTheme } from './theme.ts';

// The default and minimum window come from app.config.json (`window`). The audit lays the
// page out at exactly these sizes (qa/audit.ts), so the two can never disagree.
const sizes = (config: AppConfig) => ({
  DEFAULT_SIZE: { width: config.window.width, height: config.window.height },
  MIN_SIZE: { minWidth: config.window.minWidth, minHeight: config.window.minHeight },
});

type Reveal = { trigger: string; afterMs: number; call: 'show' | 'showInactive'; withoutFocusAsked: boolean; withoutFocusPossible: boolean };
type Bounds = { x?: number; y?: number; width: number; height: number };
/** What was chosen for the current window, kept for --diagnostics. */
export interface Chosen {
  theme: Theme;
  initial: Bounds;
  options: BrowserWindowConstructorOptions;
  barHeight: number;
  reveal: Reveal | null;
  fullScreen: ['enter' | 'leave', number][];
  growth?: { width: number; height: number };
}
let chosen: Chosen | null = null;

const flag = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/** Development only: window options to lay over the platform's, as JSON, for the container tests. */
function testOverride(): BrowserWindowConstructorOptions {
  if (app.isPackaged) return {};
  try {
    return JSON.parse(flag('qa-window-options') ?? '{}') as BrowserWindowConstructorOptions;
  } catch {
    return {};
  }
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function initialBounds(saved: unknown, onScreen: (bounds: Rectangle) => boolean, facts: Facts, { DEFAULT_SIZE, MIN_SIZE }: ReturnType<typeof sizes>): Bounds {
  const area = screen.getPrimaryDisplay().workArea;
  const size = { width: Math.min(DEFAULT_SIZE.width, area.width), height: Math.min(DEFAULT_SIZE.height, area.height) };
  const s = saved !== null && typeof saved === 'object' ? (saved as Partial<Record<'x' | 'y' | 'width' | 'height', unknown>>) : {};
  const kept = finite(s.width) && finite(s.height) ? { width: s.width, height: s.height } : null;
  if (!facts.positionIsReal) {
    // The compositor places the window; only the size is ours to restore.
    return kept ? { width: Math.max(MIN_SIZE.minWidth, kept.width), height: Math.max(MIN_SIZE.minHeight, kept.height) } : size;
  }
  if (kept && finite(s.x) && finite(s.y) && onScreen({ x: s.x, y: s.y, ...kept })) return { x: s.x, y: s.y, width: kept.width, height: kept.height };
  return { ...size, x: Math.round(area.x + (area.width - size.width) / 2), y: Math.round(area.y + (area.height - size.height) / 2) };
}

/** The saved window state main.ts keeps in window.json. */
export interface SavedWindow {
  theme?: unknown;
  bounds?: unknown;
}

/**
 * What create() needs.
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
export interface CreateOptions {
  config: AppConfig;
  origin: string;
  colours: Colours;
  preload: string;
  saved: SavedWindow;
  save: (patch: Record<string, unknown>) => void;
  onScreen: (bounds: Rectangle) => boolean;
  inactive: boolean;
}

/** Create the main window and start loading the page. */
export function create({ config, origin, colours, preload, saved, save, onScreen, inactive }: CreateOptions): BrowserWindow {
  const facts = platform.facts(app);
  const size = sizes(config);
  // Dark unless the person saved light (electron/theme.ts, D-020). The system's setting is not read.
  const theme: Theme = initialTheme(saved.theme);
  const initial = initialBounds(saved.bounds, onScreen, facts, size);
  const perSystem: BrowserWindowConstructorOptions = { ...platform.windowOptions({ theme, config, colours }), ...testOverride() };
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
  const record: Chosen = { theme, initial, options: perSystem, barHeight: platform.barHeight(config), reveal: null, fullScreen: [] };
  chosen = record;

  // Reveal at first paint, with a fallback so the window can never stay hidden.
  let shown = false;
  const reveal = (trigger: string) => () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    const call = platform.show(win, app, inactive);
    record.reveal = { trigger, afterMs: Date.now() - createdAt, call, withoutFocusAsked: inactive, withoutFocusPossible: facts.canShowInactive };
    // --reveal-record=<file>: say how the window was shown and whether it has focus, half a
    // second on. A test reads this in place of asking the running app, because asking (any
    // request through the control channel) changes what the app's memory looks like afterwards.
    const file = flag('reveal-record');
    if (file) {
      setTimeout(() => {
        if (win.isDestroyed()) return;
        try {
          fs.writeFileSync(path.resolve(file), JSON.stringify({ pid: process.pid, at: new Date().toISOString(), reveal: record.reveal, visible: win.isVisible(), focused: win.isFocused() }, null, 2));
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
    const items: MenuItemConstructorOptions[] = [];
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
      const hit = keys.find(({ match }) => match !== undefined && input.key.toLowerCase() === match.key && input.control === Boolean(match.control) && input.shift === Boolean(match.shift) && input.alt === Boolean(match.alt) && input.meta === Boolean(match.meta));
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
  record.growth = grow;
  const saveBounds = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isMaximized() || win.isFullScreen()) return;
    const b = win.getBounds();
    const kept = { width: b.width - grow.width, height: b.height - grow.height };
    save({ bounds: facts.positionIsReal ? { x: b.x, y: b.y, ...kept } : kept });
  };
  win.on('resized', saveBounds);
  win.on('moved', saveBounds);
  if (facts.system === 'linux') {
    // "resized" and "moved" are not sent on Linux; save a moment after the last change instead.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(saveBounds, 300);
    };
    win.on('resize', soon);
    win.on('move', soon);
    win.on('closed', () => clearTimeout(timer));
  }

  win.on('enter-full-screen', () => record.fullScreen.push(['enter', Date.now() - createdAt]));
  win.on('leave-full-screen', () => record.fullScreen.push(['leave', Date.now() - createdAt]));

  // The page sets its theme from the address before its first paint, so it always matches
  // the colour the window was created with (index.html).
  void win.loadURL(`${origin}/index.html#theme=${theme}`);
  return win;
}

/** The page changed theme: repaint the parts of the window the system draws. */
export function applyTheme(win: BrowserWindow | null, theme: unknown, { config, colours }: { config: AppConfig; colours: Colours }): void {
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

/** What PAGE_PROBE returns from inside the page. */
export interface PageProbe {
  overlayVisible: boolean | null;
  titlebarAreaRect: Rectangle | null;
  env: Rectangle;
  reservedLeft: number | null;
  reservedRight: number | null;
  inner: { width: number; height: number };
  devicePixelRatio: number;
  displayModes: string[];
  pageBar: Rectangle | null;
  dark: boolean;
  focused: boolean;
}

/** The window for --diagnostics. With no window open, only `open` and `chosen`. */
export interface WindowDescription {
  open: boolean;
  chosen: Chosen | null;
  visible?: boolean;
  focused?: boolean;
  minimized?: boolean;
  maximized?: boolean;
  fullScreen?: boolean;
  bounds?: Rectangle;
  contentBounds?: Rectangle;
  windowButtonPosition?: Point | null;
  mediaSourceId?: string;
  display?: { id: number; scaleFactor: number; hz: number; workArea: Rectangle; primary: boolean };
  /** The probe's answer, or why there is none. */
  page?: Partial<PageProbe> & { error?: string };
}

/** The window as it is now, for --diagnostics. */
export async function describe(win: BrowserWindow | null): Promise<WindowDescription> {
  if (!win || win.isDestroyed()) return { open: false, chosen };
  let page: Partial<PageProbe> & { error?: string };
  try {
    page = await Promise.race([win.webContents.executeJavaScript(PAGE_PROBE) as Promise<PageProbe>, new Promise<{ error: string }>((r) => setTimeout(() => r({ error: 'the page did not answer in 3 s' }), 3000))]);
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
