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
'use strict';

const SHOW_AFTER_MS = 3000;
const SHOW_AFTER_FRACTION = 0.05;
const CHANGE_EVERY_MS = 1000;
const SMOOTHING = 0.2;
const HOLD = 0.99;

function createProgressModel(options = {}) {
  const showAfterMs = options.showAfterMs ?? SHOW_AFTER_MS;
  const showAfterFraction = options.showAfterFraction ?? SHOW_AFTER_FRACTION;
  let stage = 'starting';
  /** @type {number | null} */
  let fraction = null;
  let workingSince = null;
  /** @type {{ t: number, f: number } | null} */
  let last = null;
  /** @type {number | null} fraction per millisecond, smoothed */
  let rate = null;
  /** @type {number | null} */
  let remaining = null;
  let remainingAt = -Infinity;
  let stalled = false;

  function setRemaining(value, t) {
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

  function onProgress(event) {
    const t = event.t_ms;
    let next = null;
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
    const ready = !stalled && rate !== null && rate > 0 && t - workingSince >= showAfterMs && f >= showAfterFraction;
    setRemaining(ready ? Math.max(1, Math.ceil((HOLD - f) / rate / 1000)) : null, t);
  }

  /** @returns {boolean} whether the snapshot may have changed */
  function onEvent(event) {
    switch (event.type) {
      case 'stage':
        if (event.stage === stage) return false;
        stage = event.stage;
        if (stage === 'publishing') {
          if (fraction !== null) fraction = Math.max(fraction, HOLD);
          setRemaining(null, event.t_ms);
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
  function setStalled(value) {
    stalled = value;
    if (value) setRemaining(null, last ? last.t : 0);
  }

  const snapshot = () => ({ stage, fraction, remainingSeconds: remaining, stalled });

  return { onEvent, setStalled, snapshot };
}

module.exports = { createProgressModel, SHOW_AFTER_MS, SHOW_AFTER_FRACTION, CHANGE_EVERY_MS, HOLD };
