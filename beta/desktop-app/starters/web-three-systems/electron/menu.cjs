// The application menu, the Dock menu and the path a command takes from
// outside the page into it.
//
// macOS has a menu bar that must hold every command; Windows and Linux get no
// menu at all (a menu there would draw a bar inside the window). Which of the
// two applies comes from platform.cjs.
//
// Commands. Each app command is one of the ids in shortcuts.json. Choosing a
// menu item sends its id to the page on `app:menu-command`; the page runs it
// through its command registry. The page reports which commands can run on
// `app:menu-state` and items are enabled or dimmed to match.
//
// Keys. The page's shortcut table (shortcuts.json) handles every key on
// every system. The menu shows the same keys so a person can learn them, but
// a menu item that fires because its key was pressed while the page had
// keyboard focus is ignored here: the page has already handled that key, and
// forwarding it would run the command twice. The item is forwarded when it was
// chosen with the pointer, or when the page did not have keyboard focus (the
// window is closed, minimised or another part of the app has focus).
'use strict';

const path = require('node:path');

/** The one shortcut table (shortcuts.json), in Electron's accelerator form for macOS. */
const TABLE = require(path.join(__dirname, '..', 'shortcuts.json')).commands;
const KEY_NAMES = { '.': '.', ',': ',', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ' ': 'Space', Enter: 'Return' };
function accelerator(chord) {
  if (!chord) return null;
  const key = KEY_NAMES[chord.key] ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
  return [...(chord.shift ? ['Shift'] : []), ...(chord.alt ? ['Alt'] : []), ...(chord.mod ? ['Command'] : []), key].join('+');
}
const KEYS = Object.fromEntries(Object.entries(TABLE).map(([id, chord]) => [id, accelerator(chord)]).filter(([, a]) => a));

/** Commands that make sense with no window open: the window is reopened first. */
const WORK_WITHOUT_WINDOW = new Set(['about']);

const SEPARATOR = { type: 'separator' };
const item = (command, label) => ({ command, label, ...(KEYS[command] ? { accelerator: KEYS[command] } : {}) });

/**
 * The macOS menu bar as plain data. Order and contents follow Apple's
 * guidelines as read in research report 09: app menu, File, Edit, View, the
 * app's own menus, Window, Help. Items with `command` are the app's; items
 * with `role` are the system's and never pass through the page. Replace the
 * starter's commands with the app's; measure/shell-check.mjs fails if a command
 * in shortcuts.json is missing here or the other way round.
 */
function template(productName) {
  return [
    {
      label: productName,
      submenu: [
        item('about', `About ${productName}`),
        SEPARATOR,
        { role: 'services' },
        SEPARATOR,
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        SEPARATOR,
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [item('run-example', 'Run Example'), item('cancel-example', 'Cancel Example'), SEPARATOR, { role: 'close' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        SEPARATOR,
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' },
        SEPARATOR,
        item('clear-note', 'Clear Note'),
      ],
    },
    {
      label: 'View',
      submenu: [
        item('focus-title', 'Go to Title'),
        item('focus-body', 'Go to Note'),
        item('show-items', 'Show Items'),
        SEPARATOR,
        item('toggle-theme', 'Switch Between Light and Dark'),
        SEPARATOR,
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    { role: 'help', submenu: [item('command-palette', 'All Actions…')] },
  ];
}

/** The Dock menu on macOS: what a person starts from the Dock. The Dock adds windows, Hide and Quit itself. */
function dockTemplate() {
  return [{ command: 'run-example', label: 'Run Example' }];
}

// ---- running state --------------------------------------------------------

/** @type {{ app: any, Menu: any, facts: any, getWindow: () => any, openWindow: () => any } | null} */
let ctx = null;
/** What the page last reported: command id to whether it can run. Ids not named can run. */
let pageState = {};
/** Menu items by command id (a command can sit in more than one menu). */
const itemsByCommand = new Map();
/** Pages that have said they are listening, by webContents id. */
const ready = new Map();
let sent = 0;

function liveWindow() {
  const win = ctx?.getWindow();
  return win && !win.isDestroyed() ? win : null;
}

function canRun(command) {
  if (!liveWindow()) return WORK_WITHOUT_WINDOW.has(command);
  return pageState[command] !== false;
}

function refresh() {
  for (const [command, items] of itemsByCommand) for (const entry of items) entry.enabled = canRun(command);
}

function listening(contents) {
  let entry = ready.get(contents.id);
  if (!entry) {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    entry = { promise, resolve, heard: false, waiting: false };
    ready.set(contents.id, entry);
    contents.once('destroyed', () => {
      ready.delete(contents.id);
      resolve();
    });
  }
  return entry;
}

/**
 * Resolves when the page in `win` can receive a command: at its first
 * `app:menu-state` message, or a moment after it finishes loading if it never
 * sends one.
 */
function whenListening(win) {
  const contents = win.webContents;
  const entry = listening(contents);
  if (!entry.waiting) {
    entry.waiting = true;
    const fallback = () => setTimeout(entry.resolve, 1500);
    if (contents.isLoading()) contents.once('did-finish-load', fallback);
    else fallback();
  }
  return entry.promise;
}

/** Deliver a command to the page, opening the window first when there is none. Resolves true when it was sent. */
async function send(command) {
  if (!ctx) return false;
  let win = liveWindow();
  if (!win) {
    if (!WORK_WITHOUT_WINDOW.has(command)) return false;
    win = ctx.openWindow();
    if (!win) return false;
  }
  await whenListening(win);
  if (win.isDestroyed()) return false;
  win.webContents.send('app:menu-command', command);
  sent += 1;
  return true;
}

async function inTextField(win) {
  try {
    return await win.webContents.executeJavaScript(
      "(() => { const el = document.activeElement; return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|checkbox|radio|range|submit|reset|file|color)$/.test(el.type))); })()",
    );
  } catch {
    return false;
  }
}

/** A menu item was chosen. `byKey` is true when its key was pressed rather than the item picked. */
async function chosen(command, byKey) {
  const win = liveWindow();
  const pageHasKeys = Boolean(win && win.isFocused() && win.webContents.isFocused());
  // An app that puts its own Undo and Redo in the menu (ids 'undo' and 'redo') lets a text
  // field keep its own undo: on macOS a field can only undo through the menu.
  if ((command === 'undo' || command === 'redo') && win && pageHasKeys && (await inTextField(win))) {
    win.webContents[command]();
    return;
  }
  if (byKey && pageHasKeys) return; // The page's shortcut table has this key.
  await send(command);
}

function build(Menu, entries, suffix = '') {
  const withClicks = (list) =>
    list.map((entry) => {
      if (entry.submenu) return { ...entry, submenu: withClicks(entry.submenu) };
      if (!entry.command) return entry;
      const { command, ...rest } = entry;
      return { ...rest, id: `command:${command}${suffix}`, click: (_item, _window, event) => void chosen(command, Boolean(event?.triggeredByAccelerator)) };
    });
  const menu = Menu.buildFromTemplate(withClicks(entries));
  const collect = (m) => {
    for (const entry of m.items) {
      if (entry.submenu) collect(entry.submenu);
      if (typeof entry.id === 'string' && entry.id.startsWith('command:')) {
        const command = entry.id.slice(8).replace(/#.*$/, '');
        if (!itemsByCommand.has(command)) itemsByCommand.set(command, []);
        itemsByCommand.get(command).push(entry);
      }
    }
  };
  collect(menu);
  return menu;
}

/**
 * Set up the menu for this system. Call once, after the app is ready.
 * `trusted(event)` is main.cjs's check that an IPC message came from the app's own page.
 */
function install({ app, Menu, ipcMain, facts, productName, trusted, getWindow, openWindow }) {
  ctx = { app, Menu, facts, getWindow, openWindow };
  itemsByCommand.clear();
  if (facts.menuBar) Menu.setApplicationMenu(build(Menu, template(productName)));
  else Menu.setApplicationMenu(null);
  if (facts.dockMenu && app.dock) app.dock.setMenu(build(Menu, dockTemplate(), '#dock'));

  ipcMain.on('app:menu-state', (event, state) => {
    if (!trusted(event)) return;
    const entry = listening(event.sender);
    entry.heard = true;
    entry.resolve();
    setState(state);
  });
  refresh();
}

/** Which commands can run now, as the page reports it: command id to true or false. Ids not named can run. */
function setState(state) {
  if (!state || typeof state !== 'object') return;
  const next = {};
  for (const [command, enabled] of Object.entries(state)) if (typeof enabled === 'boolean') next[command] = enabled;
  pageState = next;
  refresh();
}

/** Call when the window is created or closed: with no window only a few commands can run. */
function windowChanged() {
  const win = liveWindow();
  if (win) void whenListening(win);
  else pageState = {};
  refresh();
}

// ---- for diagnostics ------------------------------------------------------

function describeMenu(menu) {
  return menu.items.map((entry) => ({
    ...(entry.type === 'separator' ? { separator: true } : { label: entry.label }),
    ...(entry.role ? { role: entry.role } : {}),
    ...(typeof entry.id === 'string' && entry.id.startsWith('command:') ? { command: entry.id.slice(8).replace(/#.*$/, '') } : {}),
    ...(entry.accelerator ? { accelerator: entry.accelerator } : {}),
    ...(entry.type === 'separator' ? {} : { enabled: entry.enabled, visible: entry.visible }),
    ...(entry.submenu ? { submenu: describeMenu(entry.submenu) } : {}),
  }));
}

/** The menu as the system has it now, for --diagnostics. */
function describe() {
  if (!ctx) return null;
  const menu = ctx.Menu.getApplicationMenu();
  return {
    applicationMenu: menu ? describeMenu(menu) : null,
    dockMenu: ctx.facts.dockMenu ? dockTemplate().map((entry) => ({ label: entry.label, command: entry.command, enabled: canRun(entry.command) })) : null,
    pageState,
    pageListening: Boolean(liveWindow() && ready.get(liveWindow().webContents.id)?.heard),
    commandsSent: sent,
  };
}

module.exports = { KEYS, WORK_WITHOUT_WINDOW, template, dockTemplate, install, send, setState, windowChanged, describe };
