// The only surface the page can reach. Context isolation and the sandbox are
// on; the page gets these functions and nothing else from Electron. Add one
// narrow function per thing the page needs. Never expose ipcRenderer itself.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  /** Saved state, app version, data folder and the command-line tool's status. */
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  setTheme: (theme) => ipcRenderer.send('app:theme', theme),
  /** Saved at once by the main process, so unsaved work survives the app being killed. */
  saveState: (key, json) => ipcRenderer.send('app:save-state', key, json),
});
