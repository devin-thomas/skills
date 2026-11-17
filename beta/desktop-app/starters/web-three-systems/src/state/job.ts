// The example job and the tool's status, as the page shows them. A store
// outside React (store.ts): an update made in an event handler is applied in
// the same task as the input, so Cancel is acknowledged on the next frame and a
// control never trails its value.
//
// The words are the page's own. The shell sends codes and numbers; the tool's
// text arrives as `details`, which only "Copy details" ever touches (it is
// copied, never shown). Each failure says what happened and that the person's
// work is safe, and its filled button is an action that can succeed for that
// cause; when nothing the person does can help, the filled button copies the
// details for whoever repairs the app. Never a filled "Details" or "OK".
import type { DesktopBridge, JobUpdate, ToolStatus } from '../bridge';
import { createStore, useStore } from './store';

export type FailureAction = 'retry' | 'copy';

export type JobView =
  | { phase: 'idle' }
  | { phase: 'running'; jobId: string; fraction: number | null; remainingSeconds: number | null; stalled: boolean; finishing: boolean }
  | { phase: 'done'; at: number }
  | { phase: 'stopped' }
  | { phase: 'failed'; message: string; action: FailureAction; details: string; again: boolean };

interface State {
  tool: ToolStatus;
  job: JobView;
  lastCode: string | null;
}

const store = createStore<State>({ tool: { state: 'checking', code: null, details: null }, job: { phase: 'idle' }, lastCode: null });
let bridge: DesktopBridge | null = null;

/** What each code means to a person, and the action that can succeed for it. Unknown codes get the last row. */
const FAILURES: Record<string, { message: string; action: FailureAction }> = {
  OUTPUT_IN_USE: { message: 'The file is open in another program. Close it there, then try again. Your note is safe.', action: 'retry' },
  TOOL_CRASHED: { message: 'The example stopped before it finished. Your note is safe.', action: 'retry' },
  TOOL_STALLED: { message: 'The example did not start. Your note is safe.', action: 'retry' },
  TOOL_NOT_FOUND: { message: 'Part of the app is missing, so the example cannot run. Your note is safe.', action: 'copy' },
  TOOL_INCOMPATIBLE: { message: 'Part of the app is out of date, so the example cannot run. Your note is safe.', action: 'copy' },
  TOOL_PROTOCOL: { message: 'The example sent an answer the app does not understand. Your note is safe.', action: 'copy' },
};
const UNKNOWN = { message: 'The example could not finish. Your note is safe.', action: 'copy' as FailureAction };

function failure(code: string, details: string, previous: string | null): JobView {
  const known = FAILURES[code] ?? UNKNOWN;
  const again = previous === code && known.action === 'retry';
  // A second failure of the same kind says so and offers a different step.
  return again
    ? { phase: 'failed', message: `It stopped again. ${known.message}`, action: 'copy', details, again }
    : { phase: 'failed', message: known.message, action: known.action, details, again };
}

function onUpdate(update: JobUpdate) {
  store.set((s) => {
    if (s.job.phase !== 'running' || s.job.jobId !== update.jobId) {
      // Updates for a job the person already stopped are dropped.
      return s;
    }
    switch (update.state) {
      case 'running':
        return { ...s, job: { ...s.job, fraction: update.fraction, remainingSeconds: update.remainingSeconds, stalled: update.stalled, finishing: update.stage === 'publishing' } };
      case 'done':
        return { ...s, job: { phase: 'done', at: Date.now() }, lastCode: null };
      case 'cancelled':
        return { ...s, job: { phase: 'stopped' } };
      case 'failed':
        return { ...s, job: failure(update.problem.code, update.problem.details, s.lastCode), lastCode: update.problem.code };
    }
  });
}

export function startJobs(desktop: DesktopBridge, tool: ToolStatus) {
  bridge = desktop;
  store.set((s) => ({ ...s, tool }));
  desktop.onJob(onUpdate);
}

export async function runExample() {
  const s = store.get();
  if (!bridge || s.job.phase === 'running') return;
  if (s.tool.state === 'damaged') {
    store.set({ ...s, job: failure(s.tool.code ?? 'TOOL_NOT_FOUND', s.tool.details ?? '', s.lastCode) });
    return;
  }
  // Acknowledged at once with a placeholder id; the real id replaces it before any update can arrive.
  const placeholder = `pending-${Date.now()}`;
  store.set({ ...s, job: { phase: 'running', jobId: placeholder, fraction: null, remainingSeconds: null, stalled: false, finishing: false } });
  const { jobId } = await bridge.startJob({ kind: 'example' });
  store.set((now) => (now.job.phase === 'running' && now.job.jobId === placeholder ? { ...now, job: { ...now.job, jobId } } : now));
}

export function cancelExample() {
  const s = store.get();
  if (!bridge || s.job.phase !== 'running') return;
  bridge.cancelJob(s.job.jobId);
  // Acknowledged in the same task as the key or click: the bar leaves the running state now.
  store.set({ ...s, job: { phase: 'stopped' } });
}

export async function copyDetails() {
  const s = store.get();
  const text = s.job.phase === 'failed' ? s.job.details : (s.tool.details ?? '');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // No clipboard: nothing to copy to. The words on screen still say what happened.
  }
}

export const useJob = () => useStore(store, (s) => s.job);
export const useTool = () => useStore(store, (s) => s.tool);
export const jobRunning = () => store.get().job.phase === 'running';
