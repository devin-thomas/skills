import type { ToolStatus } from '../bridge';
import { cancelExample, copyDetails, runExample, type JobView } from '../state/job';
import { SHORTCUTS, ariaKeys, keysOf } from '../state/shortcuts';
import { Tip, formatTime } from './ui';

// The status bar: one line, one height in every state (premium-bar rule 74). A
// long message is cut at its end with the whole sentence in the accessible
// name, never wrapped, so no state moves what sits above it. It holds the
// example job's progress and outcome; replace the job with the app's own.

function remaining(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds < 60) return ', less than a minute left';
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? ', about a minute left' : `, about ${minutes} minutes left`;
}

function sentence(job: JobView, tool: ToolStatus): string {
  switch (job.phase) {
    case 'running':
      if (job.finishing) return 'Saving the result';
      if (job.stalled) return 'Still running, with no progress for a while';
      return job.fraction === null ? 'Running the example' : `Running the example: ${Math.round(job.fraction * 100)}%${remaining(job.remainingSeconds)}`;
    case 'done':
      return `Saved the example's result at ${formatTime(job.at)}`;
    case 'stopped':
      return 'Stopped. Nothing from that run was kept.';
    case 'failed':
      return job.message;
    case 'idle':
      return tool.state === 'damaged' ? 'Part of the app is missing, so the example cannot run. Your note is safe.' : 'The example has not run yet';
  }
}

export function StatusBar({ job, tool }: { job: JobView; tool: ToolStatus }) {
  const text = sentence(job, tool);
  const run = SHORTCUTS['run-example'];
  const cancel = SHORTCUTS['cancel-example'];
  const damagedAtRest = job.phase === 'idle' && tool.state === 'damaged';
  return (
    <footer className="statusbar" data-status-bar="" data-job={job.phase}>
      <p className="statusbar-text" data-status-text="" aria-live="polite">
        {text}
      </p>
      {job.phase === 'running' && (
        <div
          className="statusbar-progress"
          role="progressbar"
          aria-label="Example progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={job.fraction === null ? undefined : Math.round(job.fraction * 100)}
          data-indeterminate={job.fraction === null ? '' : undefined}
        >
          {job.fraction !== null && <span style={{ transform: `scaleX(${job.fraction})` }} />}
        </div>
      )}
      <div className="statusbar-actions">
        {job.phase === 'running' ? (
          <Tip label="Cancel the example" keys={keysOf(cancel)}>
            <button type="button" className="btn btn-secondary" aria-keyshortcuts={ariaKeys(cancel)} onClick={cancelExample}>
              Cancel
            </button>
          </Tip>
        ) : job.phase === 'failed' ? (
          <>
            {job.action === 'retry' && (
              <button type="button" className="btn btn-primary" onClick={() => void runExample()}>
                Try again
              </button>
            )}
            <button type="button" className={`btn ${job.action === 'copy' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => void copyDetails()}>
              Copy details
            </button>
          </>
        ) : damagedAtRest ? (
          <button type="button" className="btn btn-primary" onClick={() => void copyDetails()}>
            Copy details
          </button>
        ) : (
          <Tip label="Run the example" keys={keysOf(run)}>
            <button type="button" className="btn btn-secondary" aria-keyshortcuts={ariaKeys(run)} onClick={() => void runExample()}>
              {job.phase === 'idle' ? 'Run example' : 'Run again'}
            </button>
          </Tip>
        )}
      </div>
    </footer>
  );
}
