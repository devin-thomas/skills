// Starts a native tool the way docs/TOOL-CONTRACT.md ("GUI adapter") says and
// owns its lifetime. Nothing here knows what the tool does: it lifts out
// unchanged for any tool that takes "close stdin" as its cancel request.
//
//   - absolute executable, argument array, no shell, no window
//   - stdin stays open as the cancel channel; stdout and stderr are always drained
//   - cancel = close stdin; if the process is still there after `graceMs`, kill:
//     `child.kill()` on Windows (TerminateProcess; the tool's own job object takes
//     its children with it), SIGKILL to the process group elsewhere
//   - the group exists because the tool is started `detached` on macOS and Linux,
//     which makes it a group leader that its children join
//   - ELECTRON_RUN_AS_NODE never reaches the tool
'use strict';

const { spawn } = require('node:child_process');

const STDERR_TAIL = 16 * 1024;
/** After the process has exited, how long to wait for its pipes to end before giving up on them. */
const DRAIN_MS = 500;

/**
 * @typedef {{
 *   spawnError: string | null,
 *   exitCode: number | null,
 *   exitSignal: string | null,
 *   stderrTail: string,
 *   stderrTruncated: boolean,
 *   stopReason: string | null,   // why stdin was closed by us, if it was
 *   escalated: boolean,          // true when the grace period ran out and the process was killed
 *   durationMs: number,
 *   pid: number | null,
 * }} Outcome
 */

/**
 * @param {{
 *   command: string,
 *   args: string[],
 *   cwd: string,
 *   env?: NodeJS.ProcessEnv,
 *   platform?: NodeJS.Platform,
 *   graceMs?: number,
 *   onStdout: (chunk: Buffer) => void,
 * }} spec
 * @returns {{ pid: number | null, done: Promise<Outcome>, stop: (reason: string, graceMs?: number) => void, kill: () => void, sweep: () => void }}
 */
function startTool(spec) {
  const platform = spec.platform ?? process.platform;
  const graceMs = spec.graceMs ?? 3000;
  const started = Date.now();
  const env = { ...(spec.env ?? process.env) };
  delete env.ELECTRON_RUN_AS_NODE;

  /** @type {Outcome} */
  const outcome = { spawnError: null, exitCode: null, exitSignal: null, stderrTail: '', stderrTruncated: false, stopReason: null, escalated: false, durationMs: 0, pid: null };
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  let child;
  try {
    child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: platform !== 'win32',
    });
  } catch (error) {
    outcome.spawnError = String(error?.message ?? error);
    resolveDone(outcome);
    return { pid: null, done, stop() {}, kill() {}, sweep() {} };
  }
  outcome.pid = child.pid ?? null;

  let exited = false;
  let settled = false;
  let graceTimer = null;
  let drainTimer = null;
  /** @type {Buffer[]} */
  let tail = [];
  let tailBytes = 0;

  child.stdin.on('error', () => {}); // the tool may be gone before stdin is closed
  child.stdout.on('data', (chunk) => {
    try {
      spec.onStdout(chunk);
    } catch {
      // A consumer fault must not stop the drain.
    }
  });
  child.stderr.on('data', (chunk) => {
    tail.push(chunk);
    tailBytes += chunk.length;
    while (tail.length > 1 && tailBytes - tail[0].length >= STDERR_TAIL) {
      tailBytes -= tail[0].length;
      tail.shift();
      outcome.stderrTruncated = true;
    }
  });
  child.stdout.on('error', () => {});
  child.stderr.on('error', () => {});

  function killTree() {
    if (exited) return;
    try {
      if (platform === 'win32') child.kill();
      else process.kill(-child.pid, 'SIGKILL');
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone.
      }
    }
  }

  /** Close stdin (the cancel request); kill if the process outlives the grace period. */
  function stop(reason, grace = graceMs) {
    if (settled || exited) return;
    if (outcome.stopReason === null) outcome.stopReason = reason;
    try {
      child.stdin.end();
    } catch {
      // Already closed.
    }
    if (graceTimer) return;
    graceTimer = setTimeout(() => {
      outcome.escalated = true;
      killTree();
    }, grace);
  }

  function kill() {
    if (settled || exited) return;
    if (outcome.stopReason === null) outcome.stopReason = 'killed';
    outcome.escalated = true;
    killTree();
  }

  /**
   * After an exit that was not clean, make sure nothing the tool started is left
   * in its group (macOS and Linux; on Windows the tool's job object does this).
   */
  function sweep() {
    if (platform === 'win32' || !child.pid) return;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // The group is already empty.
    }
  }

  function settle() {
    if (settled) return;
    settled = true;
    clearTimeout(graceTimer);
    clearTimeout(drainTimer);
    child.stdout.destroy();
    child.stderr.destroy();
    child.stdin.destroy();
    const joined = Buffer.concat(tail);
    const kept = joined.length > STDERR_TAIL ? joined.subarray(joined.length - STDERR_TAIL) : joined;
    if (kept.length < joined.length) outcome.stderrTruncated = true;
    outcome.stderrTail = kept.toString('utf8');
    tail = [];
    outcome.durationMs = Date.now() - started;
    resolveDone(outcome);
  }

  child.on('error', (error) => {
    // Either the process never started, or a signal could not be delivered.
    if (child.pid === undefined) {
      outcome.spawnError = String(error?.message ?? error);
      settle();
    }
  });
  child.on('exit', (code, signal) => {
    exited = true;
    outcome.exitCode = code;
    outcome.exitSignal = signal;
    clearTimeout(graceTimer);
    // 'close' waits for the pipes. A stray process holding them must not hold us.
    drainTimer = setTimeout(settle, DRAIN_MS);
  });
  child.on('close', settle);

  return { pid: child.pid ?? null, done, stop, kill, sweep };
}

module.exports = { startTool, STDERR_TAIL };
