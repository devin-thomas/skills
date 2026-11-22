// The application menu, the Dock menu and the path a command takes from
// outside the page into it.
//
// The behaviour lives in @uppercut-labs/electron-command-menu: building the menus from
// the one shortcut table, sending a chosen item's id to the page on `app:menu-command`
// (the page runs it through its command registry), dimming items the page reports it
// cannot run on `app:menu-state`, ignoring an item fired by its key while the page had
// keyboard focus (the page's own shortcut table has already handled that key), and
// running a text field's own undo and redo for commands named 'undo' and 'redo'. This
// file holds only what is the app's: the menus themselves. The kit is bundled into
// dist/electron/main.mjs (scripts/build-electron.ts).
//
// macOS has a menu bar that must hold every command; Windows and Linux get no
// menu at all (a menu there would draw a bar inside the window). Which of the
// two applies comes from platform.ts.
import { createCommandMenu, toAccelerator } from '@uppercut-labs/electron-command-menu';
import type { InstallOptions, TemplateContext, TemplateEntry } from '@uppercut-labs/electron-command-menu';
import shortcuts from '../shortcuts.json' with { type: 'json' };
import type { Facts } from './platform.ts';

/** The one shortcut table (shortcuts.json). */
const TABLE: Record<string, { key: string; mod?: boolean; shift?: boolean; alt?: boolean } | null> = shortcuts.commands;
/** Each command's key in Electron's accelerator form for macOS, the only system with a menu bar. */
export const KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(TABLE).flatMap(([id, chord]) => {
    const accelerator = toAccelerator(chord, 'macos');
    return accelerator ? [[id, accelerator]] : [];
  }),
);
/** Commands that make sense with no window open: the window is reopened first. */
const WITHOUT_WINDOW = ['about'];
export const CHANNELS = { command: 'app:menu-command', state: 'app:menu-state' };
const SEPARATOR: TemplateEntry = { type: 'separator' };

/**
 * The macOS menu bar. Order and contents follow Apple's guidelines: app menu, File, Edit, View, the app's own menus, Window, Help. Items made with
 * `item` are the app's commands; items with `role` are the system's and never pass through
 * the page. Replace the starter's commands with the app's; measure/shell-check.ts fails if a
 * command in shortcuts.json is missing here or the other way round.
 */
function appTemplate({ productName, item }: TemplateContext): TemplateEntry[] {
  return [
    {
      label: productName,
      submenu: [item('about', `About ${productName}`), SEPARATOR, { role: 'services' }, SEPARATOR, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, SEPARATOR, { role: 'quit' }],
    },
    {
      label: 'File',
      submenu: [item('run-example', 'Run Example'), item('cancel-example', 'Cancel Example'), SEPARATOR, { role: 'close' }],
    },
    {
      label: 'Edit',
      submenu: [{ role: 'undo' }, { role: 'redo' }, SEPARATOR, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'delete' }, { role: 'selectAll' }, SEPARATOR, item('clear-note', 'Clear Note')],
    },
    {
      label: 'View',
      submenu: [item('focus-title', 'Go to Title'), item('focus-body', 'Go to Note'), item('show-items', 'Show Items'), SEPARATOR, item('toggle-theme', 'Switch Between Light and Dark'), SEPARATOR, { role: 'togglefullscreen' }],
    },
    { role: 'windowMenu' },
    { role: 'help', submenu: [item('command-palette', 'All Actions…')] },
  ];
}

/** The Dock menu on macOS: what a person starts from the Dock. The Dock adds windows, Hide and Quit itself. */
function dockAppTemplate({ item }: Pick<TemplateContext, 'item'>): TemplateEntry[] {
  return [item('run-example', 'Run Example')];
}

const menu = createCommandMenu({
  commands: TABLE,
  template: appTemplate,
  dockTemplate: dockAppTemplate,
  workWithoutWindow: WITHOUT_WINDOW,
  channels: CHANNELS,
});

/** The menus as plain data with macOS accelerators, for measure/shell-check.ts. */
const plainItem = (command: string, label: string, extra: Partial<TemplateEntry> = {}): TemplateEntry => ({ command, label, ...(KEYS[command] ? { accelerator: KEYS[command] } : {}), ...extra });
export const template = (productName: string) => appTemplate({ productName, item: plainItem });
export const dockTemplate = () => dockAppTemplate({ item: plainItem });

/**
 * Set up the menu for this system. Call once, after the app is ready.
 * `facts` comes from platform.ts; `trusted(event)` is main.ts's check that an IPC
 * message came from the app's own page.
 */
export function install({ facts, ...options }: Omit<InstallOptions, 'menuBar' | 'dockMenu' | 'platform'> & { facts: Pick<Facts, 'menuBar' | 'dockMenu'> }): void {
  menu.install({ ...options, menuBar: facts.menuBar, dockMenu: facts.dockMenu, platform: 'macos' });
}

export const WORK_WITHOUT_WINDOW = new Set(WITHOUT_WINDOW);
export const send = (command: string) => menu.send(command);
export const setState = (state: unknown) => menu.setState(state);
export const windowChanged = () => menu.windowChanged();
export const describe = () => menu.describe();
