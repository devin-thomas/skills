// The only surface the page can reach. Context isolation and the sandbox are
// on; the page gets these functions and nothing else from Electron. The list is
// exactly `DesktopBridge` in src/bridge.ts: `satisfies` below checks the types, and
// test/preload.test.ts compares the names. Each function is one narrow call;
// ipcRenderer itself is never exposed. The page never sees a file path: files are
// named by opaque ids the main process keeps (a dropped file's location is resolved
// here with webUtils.getPathForFile and sent straight to the main process).
//
// A sandboxed preload must be one CommonJS file that requires nothing but electron, so
// scripts/build-electron.ts bundles this into dist/electron/preload.cjs.
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { DesktopBridge } from '../src/bridge.ts';

/** Subscribes `listener` to one channel from the shell; returns the unsubscribe function. */
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  if (typeof listener !== 'function') return () => {};
  const forward = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, forward);
  return () => {
    ipcRenderer.removeListener(channel, forward);
  };
}

type Result<K extends keyof DesktopBridge> = Awaited<ReturnType<DesktopBridge[K]>>;

contextBridge.exposeInMainWorld('desktop', {
  /** Saved state, the system, the app version and data folder, and the tool's status. */
  bootstrap: () => ipcRenderer.invoke('app:bootstrap') as Promise<Result<'bootstrap'>>,
  setTheme: (theme) => ipcRenderer.send('app:theme', theme),
  /** Saved at once by the main process, so unsaved work survives the app being killed. */
  saveState: (key, json) => ipcRenderer.send('app:save-state', key, json),

  /** Start the example job; resolves with its id as soon as it is recorded. */
  startJob: (request) => ipcRenderer.invoke('job:start', request) as Promise<Result<'startJob'>>,
  cancelJob: (jobId) => ipcRenderer.send('job:cancel', jobId),
  onJob: (listener) => subscribe('job:update', listener),

  /** A command chosen in the menu bar, the Dock menu or sent by a script through the control channel: one command id. */
  onMenuCommand: (listener) => subscribe('app:menu-command', listener),
  /** Which commands can run now, so the shell can dim the matching menu items: one object of id to boolean. */
  setMenuState: (enabled) => ipcRenderer.send('app:menu-state', enabled),
} satisfies DesktopBridge);
