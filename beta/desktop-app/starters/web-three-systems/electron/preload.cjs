// The only surface the page can reach. Context isolation and the sandbox are
// on; the page gets these functions and nothing else from Electron. The list is
// exactly `DesktopBridge` in src/bridge.ts (test/preload.test.cjs compares the
// two). Each function is one narrow call; ipcRenderer itself is never exposed.
// The page never sees a file path: files are named by opaque ids the main
// process keeps (a dropped file's location is resolved here with
// webUtils.getPathForFile and sent straight to the main process).
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/** Subscribes `listener` to one channel from the shell; returns the unsubscribe function. */
function subscribe(channel, listener) {
  if (typeof listener !== 'function') return () => {};
  const forward = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, forward);
  return () => {
    ipcRenderer.removeListener(channel, forward);
  };
}

contextBridge.exposeInMainWorld('desktop', {
  /** Saved state, the system, the app version and data folder, and the tool's status. */
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  setTheme: (theme) => ipcRenderer.send('app:theme', theme),
  /** Saved at once by the main process, so unsaved work survives the app being killed. */
  saveState: (key, json) => ipcRenderer.send('app:save-state', key, json),

  /** Start the example job; resolves with its id as soon as it is recorded. */
  startJob: (request) => ipcRenderer.invoke('job:start', request),
  cancelJob: (jobId) => ipcRenderer.send('job:cancel', jobId),
  onJob: (listener) => subscribe('job:update', listener),

  /** A command chosen in the menu bar, the Dock menu or sent by a script through the control channel: one command id. */
  onMenuCommand: (listener) => subscribe('app:menu-command', listener),
  /** Which commands can run now, so the shell can dim the matching menu items: one object of id to boolean. */
  setMenuState: (enabled) => ipcRenderer.send('app:menu-state', enabled),
});
