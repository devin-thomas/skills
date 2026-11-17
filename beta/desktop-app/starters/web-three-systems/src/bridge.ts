// What the page may ask of the desktop shell. electron/preload.cjs is the other
// half; the two must list the same functions (test/preload.test.cjs). The
// stand-in in src/bridge.fake.ts implements it for a plain browser, so the
// headless audit and the screenshots reach every state without Electron or the
// tool. This file is one of the two seam files written before any builder
// starts (the other is docs/TOOL-CONTRACT.md); neither side changes it alone.
//
// The page never sees a file path, an executable or a flag: files are named by
// opaque ids the shell keeps, and the tool's own text arrives only as
// `details`, which the page copies on request and never shows.

/** The system, as the shell reports it. The page never guesses it from the user agent. */
export type Platform = 'windows' | 'macos' | 'linux';

export interface ToolStatus {
  state: 'ready' | 'damaged' | 'checking';
  /** A code from docs/TOOL-CONTRACT.md when the tool is not ready. */
  code: string | null;
  /** Developer text: copied by "Copy details", never shown. */
  details: string | null;
}

export interface Problem {
  code: string;
  details: string;
}

export type JobUpdate =
  | { jobId: string; state: 'running'; stage: string; fraction: number | null; remainingSeconds: number | null; stalled: boolean }
  | { jobId: string; state: 'done'; bytes: number | null }
  | { jobId: string; state: 'cancelled' }
  | { jobId: string; state: 'failed'; problem: Problem };

export interface Bootstrap {
  stored: Record<string, string>;
  platform: Platform;
  about: { appVersion: string; dataDir: string } | null;
  tool: ToolStatus;
}

export interface DesktopBridge {
  bootstrap(): Promise<Bootstrap>;
  setTheme(theme: 'light' | 'dark'): void;
  saveState(key: string, json: string): void;
  startJob(request: { kind: 'example' }): Promise<{ jobId: string; refused?: 'busy' }>;
  cancelJob(jobId: string): void;
  onJob(listener: (update: JobUpdate) => void): () => void;
  onMenuCommand(listener: (command: string) => void): () => void;
  setMenuState(enabled: Record<string, boolean>): void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
