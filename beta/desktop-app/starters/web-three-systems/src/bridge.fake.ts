// The stand-in for the desktop shell. It implements DesktopBridge in a plain
// browser so the page, the headless audit and the screenshot script can reach
// every state without Electron or the tool. It is loaded only when
// `window.desktop` is absent (src/desktop.ts), as its own chunk.
//
// The parts every stand-in needs (call log, menu hook, storage, timers, address options) come
// from @uppercut-labs/electron-bridge-test-double; this file holds the app's fixtures.
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
//   default             the tool is ready; a job finishes about 1.5 s after it starts, its last
//                       stage (saving) shown for 400 ms (premium-bar rule 9: at least 300)
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
import { createBridgeHarness, instrument, parseHashParams } from '@uppercut-labs/electron-bridge-test-double';
import type { Bootstrap, DesktopBridge, JobUpdate } from './bridge';

export function createFakeBridge(storagePrefix: string): DesktopBridge {
  const h = createBridgeHarness({ storagePrefix });
  const fixture = parseHashParams().get('fixture') ?? 'default';
  const platform = h.option('platform', ['windows', 'macos', 'linux'] as const, 'windows');
  const jobUpdates = h.channel<JobUpdate>('job');
  const saved = h.storage.load();
  let jobs = 0;
  let running: string | null = null;

  const emit = (update: JobUpdate) => {
    if (update.state !== 'running') running = null;
    jobUpdates.emit(update);
  };
  const later = (ms: number, run: () => void) => void h.scheduler.after(ms, run);

  const bridge: DesktopBridge = {
    async bootstrap(): Promise<Bootstrap> {
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
    setTheme() {},
    saveState(key, json) {
      h.storage.save(key, json);
    },
    async startJob() {
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
        later(1500, () => emit({ jobId, state: 'done', bytes: 15 }));
      });
      return { jobId };
    },
    cancelJob(jobId) {
      if (running !== jobId) return;
      h.scheduler.cancelAll();
      later(120, () => emit({ jobId, state: 'cancelled' }));
    },
    onJob: (listener) => jobUpdates.add(listener),
    onMenuCommand: (listener) => h.menuCommands.add(listener),
    setMenuState: (enabled) => h.menu.setMenuState(enabled),
  };
  // Every call is logged first; saveState logs only its key, as the document can be large.
  return instrument(bridge, h.log, { saveState: (args) => [args[0]] });
}
