// The one place that knows which system the app is running on.
//
// Everything that differs between Windows, macOS and Linux is decided here and
// read from here: the window options (windowOptions), a small set of named
// facts (facts), the app's identity to the system (identify) and how a window
// is first shown (show). No other file in electron/ reads process.platform.
// measure/shell-check.ts fails if one does.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { App, BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import type appConfigJson from '../app.config.json';
import { ROOT } from './paths.ts';

/** app.config.json, plus the one optional key it may gain (macTitleBarHeight). */
export type AppConfig = typeof appConfigJson & { macTitleBarHeight?: number };
export type Theme = 'light' | 'dark';
/** The page's own colours as hex: the window's background (chrome) and the window-button glyphs (symbol). */
export interface Colours {
  chrome: Record<Theme, string>;
  symbol: Record<Theme, string>;
}

/** The system's name as the page knows it (Platform in src/bridge.ts). */
export type SystemName = 'windows' | 'macos' | 'linux';
export const SYSTEM: SystemName = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';

type SwitchesApp = Pick<App, 'commandLine'>;

/**
 * Linux only: the display protocol this process is using, "wayland" or "x11".
 * Electron decides before any of the app's code runs and records its choice
 * in the ozone-platform switch, so that switch is the answer. It chooses
 * Wayland only when XDG_SESSION_TYPE is "wayland" or the switch was given on
 * the command line (Electron 45.3.2, seen in scripts/linux-container).
 */
export function session(app?: SwitchesApp): 'wayland' | 'x11' | null {
  if (SYSTEM !== 'linux') return null;
  const chosen = app?.commandLine.getSwitchValue('ozone-platform');
  if (chosen === 'wayland' || chosen === 'x11') return chosen;
  return process.env['XDG_SESSION_TYPE'] === 'wayland' ? 'wayland' : 'x11';
}

/**
 * Linux: true when a Wayland compositor is there to be used but Electron has
 * chosen X11, because the session did not set XDG_SESSION_TYPE to "wayland"
 * (a compositor started from a console sets it to "tty" or not at all). With
 * no X server the app would not start; through Xwayland it would start and be
 * blurred at fractional scales. A session that says "x11", or a person who
 * passed --ozone-platform, is left alone.
 */
function waylandMissed(): boolean {
  if (SYSTEM !== 'linux') return false;
  if (process.argv.some((a) => a.startsWith('--ozone-platform'))) return false;
  const type = process.env['XDG_SESSION_TYPE'];
  if (type === 'wayland' || type === 'x11') return false;
  const display = process.env['WAYLAND_DISPLAY'];
  if (!display) return false;
  return fs.existsSync(path.isAbsolute(display) ? display : path.join(process.env['XDG_RUNTIME_DIR'] ?? '/nonexistent', display));
}

/**
 * Start the app again with Wayland named on the command line, and end this
 * process. The choice cannot be changed from inside: a switch appended here
 * arrives after Electron has already picked X11 (seen: the app's code runs,
 * then "Missing X server or $DISPLAY").
 */
function startAgainOnWayland(): never {
  spawn(process.execPath, [...process.argv.slice(1), '--ozone-platform=wayland'], { detached: true, stdio: 'inherit' }).unref();
  process.exit(0);
}

// ---- named facts ----------------------------------------------------------

/** A key the shell handles itself, and how. */
export interface ShellKey {
  keys: string;
  does: string;
  through: 'menu role' | 'before-input-event';
  match?: { key: string; control?: boolean; shift?: boolean; alt?: boolean; meta?: boolean };
  command?: string;
}

export interface Facts {
  system: SystemName;
  session: 'wayland' | 'x11' | null;
  /** The modifier the shortcut table uses: Command on macOS, Control elsewhere. */
  commandKey: 'Control' | 'Command';
  /** Closing the last window ends the app. */
  closingLastWindowQuits: boolean;
  /** The system has a menu bar that must hold every command. */
  menuBar: boolean;
  /** Where a person finds the settings and About: the system menu bar or the page. */
  settingsIn: 'page' | 'app menu';
  aboutIn: 'page' | 'app menu';
  /** The app has an icon in a Dock with its own menu. */
  dockMenu: boolean;
  /** A window can be shown without taking focus. */
  canShowInactive: boolean;
  /** Window positions can be read and set. False on Wayland, where the compositor places windows. */
  positionIsReal: boolean;
  /** The title bar overlay takes colours (window buttons drawn by Electron or Windows). */
  overlayColours: boolean;
  /** Window events that mean the page has painted, earliest first. */
  revealOn: ('ready-to-show' | 'did-finish-load')[];
  /** Keys the shell handles itself because the system expects them and the page's table does not use them. */
  shellKeys: ShellKey[];
  /** Files opened with the app arrive in the command line. */
  filesArriveIn: 'argv' | 'open-file event';
}

/**
 * What the rest of the shell may ask about the system. Keep this list short:
 * a new fact is a new way for the three systems to drift apart.
 */
export function facts(app?: SwitchesApp): Facts {
  const wayland = session(app) === 'wayland';
  const common: Facts = {
    system: SYSTEM,
    session: session(app),
    commandKey: 'Control',
    closingLastWindowQuits: true,
    menuBar: false,
    settingsIn: 'page',
    aboutIn: 'page',
    dockMenu: false,
    canShowInactive: true,
    positionIsReal: true,
    overlayColours: true,
    revealOn: ['ready-to-show'],
    shellKeys: [],
    filesArriveIn: 'argv',
  };
  if (SYSTEM === 'macos') {
    return {
      ...common,
      commandKey: 'Command',
      closingLastWindowQuits: false,
      menuBar: true,
      settingsIn: 'app menu',
      aboutIn: 'app menu',
      dockMenu: true,
      overlayColours: false,
      // On macOS these keys are menu items with system roles (menu.ts), listed here for the record.
      shellKeys: [
        { keys: 'Command+Q', does: 'quit', through: 'menu role' },
        { keys: 'Command+W', does: 'close window', through: 'menu role' },
        { keys: 'Command+M', does: 'minimize', through: 'menu role' },
        { keys: 'Command+H', does: 'hide', through: 'menu role' },
        { keys: 'Option+Command+H', does: 'hide others', through: 'menu role' },
        { keys: 'Control+Command+F', does: 'full screen', through: 'menu role' },
      ],
      filesArriveIn: 'open-file event',
    };
  }
  if (SYSTEM === 'linux') {
    return {
      ...common,
      canShowInactive: !wayland,
      positionIsReal: !wayland,
      // ready-to-show is not dependable on every Linux desktop (reports 08 and 10),
      // so the end of the page load also reveals the window. Whichever comes first wins.
      revealOn: ['ready-to-show', 'did-finish-load'],
      shellKeys: [
        { keys: 'Control+Q', does: 'quit', through: 'before-input-event', match: { key: 'q', control: true } },
        { keys: 'Control+W', does: 'close window', through: 'before-input-event', match: { key: 'w', control: true } },
        { keys: 'F11', does: 'full screen', through: 'before-input-event', match: { key: 'f11' } },
        // F10 opens an app's main menu on GNOME and KDE. This app's list of everything it can do is the page's palette.
        { keys: 'F10', does: 'show all actions', through: 'before-input-event', match: { key: 'f10' }, command: 'command-palette' },
      ],
    };
  }
  return common; // Windows: round 1's behaviour, unchanged.
}

// ---- window options -------------------------------------------------------

// macOS 27.2, measured: a window button is 14 pt high;
// the system puts the first one at (9, 9) in a 32 pt title bar, (12, 13) in a
// 40 pt compact toolbar and (19, 19) in a 52 pt toolbar. For any other bar
// height the buttons are centred by the formula the admired apps use (report
// 08), with the same distance from the left edge as from the top.
const LIGHT_HEIGHT = 14;
const SYSTEM_LIGHTS: Record<number, { x: number; y: number }> = { 32: { x: 9, y: 9 }, 40: { x: 12, y: 13 }, 52: { x: 19, y: 19 } };

export function trafficLights(bar: number): { x: number; y: number } {
  const known = SYSTEM_LIGHTS[bar];
  if (known) return { ...known };
  const y = Math.round((bar - LIGHT_HEIGHT) / 2);
  return { x: y, y };
}

/** Title bar height for this system: app.config.json titleBarHeight, or macTitleBarHeight on macOS when it is set. */
export function barHeight(config: Pick<AppConfig, 'titleBarHeight' | 'macTitleBarHeight'>): number {
  return SYSTEM === 'macos' && config.macTitleBarHeight !== undefined && Number.isFinite(config.macTitleBarHeight) ? config.macTitleBarHeight : config.titleBarHeight;
}

function iconFile(name: string): string | undefined {
  const file = path.join(ROOT, 'build', name);
  return fs.existsSync(file) ? file : undefined;
}

/**
 * The BrowserWindow options that differ between systems, and nothing else.
 * `theme` is 'light' or 'dark'; `colours.symbol[theme]` is the colour of the
 * window-button glyphs where the app chooses it.
 *
 * All three keep the system's own window buttons over a page-drawn title bar,
 * and all three turn on the title bar overlay, so the page lays its bar out
 * with env(titlebar-area-x), env(titlebar-area-width) and
 * env(titlebar-area-height) and never needs to know which side the buttons
 * are on.
 */
export function windowOptions({ theme, config, colours }: { theme: Theme; config: AppConfig; colours: Colours }): BrowserWindowConstructorOptions {
  const bar = barHeight(config);
  const overlay = { color: '#00000000', symbolColor: colours.symbol[theme], height: bar };
  switch (SYSTEM) {
    case 'macos':
      // Traffic lights stay native and are moved to the centre line of the page's bar.
      // Only `height` of the overlay applies here; it switches the overlay values on for the page.
      return { titleBarStyle: 'hidden', trafficLightPosition: trafficLights(bar), titleBarOverlay: { height: bar } };
    case 'linux':
      // Electron draws minimize, maximize and close in the overlay, on the side and in the
      // order the desktop's settings give. The frame is left on: `frame: false` is not
      // needed with a hidden title bar (settled by test, see scripts/linux-container).
      return { titleBarStyle: 'hidden', titleBarOverlay: overlay, icon: iconFile('icon-256.png') };
    default:
      // Windows: the caption buttons and snap layouts come from the overlay.
      return { titleBarStyle: 'hidden', titleBarOverlay: overlay, icon: iconFile('icon.ico') };
  }
}

// ---- identity and first show ----------------------------------------------

/** The name of the installed .desktop file on Linux. The packaged file must have exactly this name. */
export function desktopName(config: Pick<AppConfig, 'appId'>): string {
  return `${config.appId}.desktop`;
}

/** Tell the system which app this is. Call first thing, before the app is ready. */
export function identify(app: Pick<App, 'setAppUserModelId' | 'setDesktopName'>, config: Pick<AppConfig, 'appId'>): void {
  if (waylandMissed()) startAgainOnWayland(); // does not return
  if (SYSTEM === 'windows') app.setAppUserModelId(config.appId);
  // Wayland app_id, X11 WM_CLASS and the portal identity all come from this name.
  if (SYSTEM === 'linux') app.setDesktopName(desktopName(config));
  // macOS takes its identity from the bundle.
}

/**
 * Show a window for the first time. `inactive` asks for no focus change
 * (--no-activate): honoured on Windows, macOS and X11; on Wayland the
 * compositor decides and Electron's showInactive is not supported, so the
 * window is simply shown.
 */
export function show(win: Pick<BrowserWindow, 'show' | 'showInactive'>, app: SwitchesApp, inactive: boolean): 'showInactive' | 'show' {
  const used = inactive && facts(app).canShowInactive ? 'showInactive' : 'show';
  win[used]();
  return used;
}

// ---- known gaps -----------------------------------------------------------
// Things a native app on each system has that this shell does not, recorded so
// nothing pretends otherwise (build 2, the media converter). None of them is imitated with drawn chrome. An app built on
// this starter copies this list into its own docs and edits it.
//
// macOS
//   - The window has the plain title-bar shape. The larger corner radius and glass
//     toolbar of a toolbar window need a native toolbar, which Electron does not have.
//   - The bar is this app's height (app.config.json), not one of the system's three
//     (32, 40, 52 pt). The traffic lights are the system's own and are centred in it.
//   - Settings, if the app has any, open in the main window, not a separate settings
//     window: one window keeps the memory budget. Record it if the app differs.
//   - Full screen is named "Toggle Full Screen" (Electron's role label), not
//     "Enter Full Screen" and "Exit Full Screen".
//   - Help has the system's search field and one item; there is no help book.
//   - No AppleScript dictionary or Shortcuts actions. A bundled command-line tool is
//     the scripting path.
//   - The first click on an inactive window only activates it (acceptFirstMouse is
//     left off), so a click meant to bring the window forward changes nothing.
//   - The traffic lights do not follow page zoom; the starter offers no zoom.
// Linux
//   - The same integrated bar on every desktop. KDE's own title bar in the
//     person's theme is not used.
//   - No main-menu button for GNOME; F10 opens the page's list of actions instead.
//   - On Wayland a window cannot be shown without focus or put back where it was;
//     only its size is restored.
//   - No progress on a launcher icon (Electron removed it in 44).
// Windows
//   - Popovers are clipped by the window edge; settings open in the same window (round 1).
