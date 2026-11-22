// From the tool's event stream to the `running` update in src/bridge.ts.
// Pure: no Electron, no process, no clock of its own. Time is the events' own
// `t_ms`, so a recorded stream replays to the same numbers every time.
//
// Fraction (premium-bar rule 66):
//   - null while the total is unknown (the page shows an indeterminate bar);
//   - the tool's own `fraction` when it sends one, otherwise done / total;
//   - never decreasing, and held at 0.99 until the terminal event, which the caller
//     reports as `done` (the model never says 1).
// A tool's last progress block can describe the wrong thing (build 2: FFmpeg's
// closing block reported a validation sink, not the file written), so the tool
// should floor its own counter by bytes written; this model only trusts what
// never goes backwards.
//
// Time remaining (premium-bar rule 67): shown only after SHOW_AFTER_MS of work and
// SHOW_AFTER_FRACTION done, from an exponentially averaged rate (weight 0.2);
// the published value changes at most once a second and never counts up by more
// than one second at a time. Build 2 shortened the delay to 1 s because its jobs
// finish in seconds; set the constants for the app and record why.

export const SHOW_AFTER_MS = 3000;
export const SHOW_AFTER_FRACTION = 0.05;
export const CHANGE_EVERY_MS = 1000;
const SMOOTHING = 0.2;
export const HOLD = 0.99;

/** One event from the tool, as far as the shell reads it. */
export interface ToolEvent {
  type: string;
  seq?: unknown;
  t_ms?: unknown;
  stage?: unknown;
  fraction?: unknown;
  done?: unknown;
  total?: unknown;
  [key: string]: unknown;
}

export interface ProgressSnapshot {
  stage: string;
  fraction: number | null;
  remainingSeconds: number | null;
  stalled: boolean;
}

export function createProgressModel(options: { showAfterMs?: number; showAfterFraction?: number } = {}) {
  const showAfterMs = options.showAfterMs ?? SHOW_AFTER_MS;
  const showAfterFraction = options.showAfterFraction ?? SHOW_AFTER_FRACTION;
  let stage = 'starting';
  let fraction: number | null = null;
  let workingSince: number | null = null;
  let last: { t: number; f: number } | null = null;
  /** fraction per millisecond, smoothed */
  let rate: number | null = null;
  let remaining: number | null = null;
  let remainingAt = -Infinity;
  let stalled = false;

  function setRemaining(value: number | null, t: number): void {
    if (value === remaining) return;
    if (value === null) {
      remaining = null;
      remainingAt = t;
      return;
    }
    if (t - remainingAt < CHANGE_EVERY_MS) return;
    remaining = remaining !== null && value > remaining ? remaining + 1 : value;
    remainingAt = t;
  }

  function onProgress(event: ToolEvent): void {
    const t = Number(event.t_ms);
    let next: number | null = null;
    if (typeof event.fraction === 'number') next = event.fraction;
    else if (typeof event.done === 'number' && typeof event.total === 'number' && event.total > 0) next = event.done / event.total;
    if (next === null) return;
    const f = Math.max(fraction ?? 0, Math.min(Math.max(next, 0), HOLD));
    if (workingSince === null) workingSince = t;
    if (last && t > last.t) {
      const instant = (f - last.f) / (t - last.t);
      rate = rate === null ? instant : rate + SMOOTHING * (instant - rate);
    }
    if (!last || t >= last.t) last = { t, f };
    fraction = f;
    const speed = rate;
    const ready = !stalled && speed !== null && speed > 0 && t - workingSince >= showAfterMs && f >= showAfterFraction;
    setRemaining(ready && speed !== null ? Math.max(1, Math.ceil((HOLD - f) / speed / 1000)) : null, t);
  }

  /** Whether the snapshot may have changed. */
  function onEvent(event: ToolEvent): boolean {
    switch (event.type) {
      case 'stage':
        if (event.stage === stage) return false;
        stage = String(event.stage);
        if (stage === 'publishing') {
          if (fraction !== null) fraction = Math.max(fraction, HOLD);
          setRemaining(null, Number(event.t_ms));
        }
        return true;
      case 'progress':
        onProgress(event);
        return true;
      default:
        return false;
    }
  }

  /** The inactivity watch says the tool has gone quiet (or is back). A quiet tool has no trustworthy time left. */
  function setStalled(value: boolean): void {
    stalled = value;
    if (value) setRemaining(null, last ? last.t : 0);
  }

  const snapshot = (): ProgressSnapshot => ({ stage, fraction, remainingSeconds: remaining, stalled });

  return { onEvent, setStalled, snapshot };
}
