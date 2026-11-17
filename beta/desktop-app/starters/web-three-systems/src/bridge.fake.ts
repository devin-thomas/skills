// The stand-in for the desktop shell. It implements DesktopBridge in a plain
// browser so the page, the headless audit and the screenshot script can reach
// every state without Electron or the tool. It is loaded only when
// `window.desktop` is absent (src/desktop.ts), as its own chunk.
//
// The scenario comes from the address's fragment, so every state can be opened
// and photographed directly:
//
//   #fixture=default
//   #fixture=job-failed-OUTPUT_IN_USE&platform=macos
//
// Fixtures (add one per state the app can be in; build 2 had one per primary
// action in its tool's error table):
//
//   default             the tool is ready; a job finishes about 1.2 s after it starts
//   damaged             the tool did not answer at launch
//   job-running         a job starts at once and holds at 40% with time remaining
//   job-unknown-total   a job runs with no known total (indeterminate)
//   job-done            a job finishes almost at once
//   job-cancelled       a job is stopped from outside shortly after it starts
//   job-failed-<CODE>   a job fails with this code: OUTPUT_IN_USE (retry can succeed), TOOL_CRASHED,
//                       SOMETHING_NEW (a code this page does not know)
//
// Options, added with `&`:
//
//   platform=windows|macos|linux   what bootstrap() reports (default windows)
//
// For the scripts only: every call is appended to `window.__desktopCalls`, the
// last menu state is `window.__menuState`, and `window.__menuCommand(id)` sends
// a command as the shell's menu would.
import type { Bootstrap, DesktopBridge, JobUpdate, Platform } from './bridge';

declare global {
  interface Window {
    __desktopCalls?: Array<{ name: string; args: unknown[] }>;
    __menuState?: Record<string, boolean>;
    __menuCommand?: (command: string) => void;
  }
}

function options() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const platform = params.get('platform');
  return {
    fixture: params.get('fixture') ?? 'default',
    platform: (platform === 'macos' || platform === 'linux' ? platform : 'windows') as Platform,
  };
}

export function createFakeBridge(storagePrefix: string): DesktopBridge {
  const { fixture, platform } = options();
  const calls: Array<{ name: string; args: unknown[] }> = (window.__desktopCalls = []);
  const record = (name: string, ...args: unknown[]) => calls.push({ name, args });
  const jobListeners = new Set<(u: JobUpdate) => void>();
  const menuListeners = new Set<(c: string) => void>();
  const timers = new Set<number>();
  let jobs = 0;
  let running: string | null = null;

  const emit = (update: JobUpdate) => {
    if (update.state !== 'running') running = null;
    jobListeners.forEach((l) => l(update));
  };
  const later = (ms: number, run: () => void) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      run();
    }, ms);
    timers.add(id);
  };
  const stopTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  };

  window.__menuCommand = (command) => menuListeners.forEach((l) => l(command));

  const saved: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${storagePrefix}.`)) saved[key] = localStorage.getItem(key) ?? '';
    }
  } catch {
    // Storage is unavailable: start empty.
  }

  return {
    async bootstrap(): Promise<Bootstrap> {
      record('bootstrap');
      return {
        stored: saved,
        platform,
        about: null,
        tool:
          fixture === 'damaged'
            ? { state: 'damaged', code: 'TOOL_NOT_FOUND', details: 'TOOL_NOT_FOUND\nNo runnable example-tool was found (stand-in).' }
            : { state: 'ready', code: null, details: 'example-tool 0.1.0 (stand-in)' },
      };
    },
    setTheme(theme) {
      record('setTheme', theme);
    },
    saveState(key, json) {
      record('saveState', key);
      try {
        localStorage.setItem(key, json);
      } catch {
        // The page keeps its work in memory.
      }
    },
    async startJob(request) {
      record('startJob', request);
      if (running) return { jobId: running, refused: 'busy' };
      const jobId = `job-${++jobs}`;
      running = jobId;
      const step = (fraction: number | null, remainingSeconds: number | null, stage = 'working') => emit({ jobId, state: 'running', stage, fraction, remainingSeconds, stalled: false });
      later(0, () => {
        if (fixture === 'damaged') return emit({ jobId, state: 'failed', problem: { code: 'TOOL_NOT_FOUND', details: 'TOOL_NOT_FOUND (stand-in)' } });
        if (fixture.startsWith('job-failed-')) {
          step(0.12, null);
          const code = fixture.slice('job-failed-'.length);
          later(150, () => emit({ jobId, state: 'failed', problem: { code, details: JSON.stringify({ code, message: 'stand-in failure', details: {} }, null, 2) } }));
          return;
        }
        if (fixture === 'job-running') return step(0.4, 75);
        if (fixture === 'job-unknown-total') return step(null, null);
        if (fixture === 'job-done') return emit({ jobId, state: 'done', bytes: 15 });
        if (fixture === 'job-cancelled') {
          step(0.05, null);
          later(200, () => emit({ jobId, state: 'cancelled' }));
          return;
        }
        step(0, null);
        later(400, () => step(0.35, null));
        later(800, () => step(0.8, null));
        later(1100, () => step(0.99, null, 'publishing'));
        later(1200, () => emit({ jobId, state: 'done', bytes: 15 }));
      });
      return { jobId };
    },
    cancelJob(jobId) {
      record('cancelJob', jobId);
      if (running !== jobId) return;
      stopTimers();
      later(120, () => emit({ jobId, state: 'cancelled' }));
    },
    onJob(listener) {
      jobListeners.add(listener);
      return () => jobListeners.delete(listener);
    },
    onMenuCommand(listener) {
      menuListeners.add(listener);
      return () => menuListeners.delete(listener);
    },
    setMenuState(enabled) {
      window.__menuState = enabled;
    },
  };
}
