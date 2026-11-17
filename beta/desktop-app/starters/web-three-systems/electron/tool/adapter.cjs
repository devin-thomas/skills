// The adapter's two calls against the tool in docs/TOOL-CONTRACT.md: a short
// capabilities question, and a job that streams events. No Electron in here,
// so the tests drive it with the stand-in tool on every system.
//
// What it guarantees the rest of the shell (premium-bar rules 59, 60, 65):
//   - the tool's stdout is read as a stream of capped lines and every line is
//     checked; a line that is not JSON, a line over the cap, events out of order
//     or a first event that is not `hello` end the job as TOOL_PROTOCOL or
//     TOOL_INCOMPATIBLE, and the pipe is still drained to the end;
//   - exactly one outcome per call: ok, cancelled or failed with a code;
//   - unknown event types and unknown fields are ignored, as the contract asks;
//   - no hello within `helloMs` is TOOL_STALLED; a job with no event for
//     `stallMs` is reported as stalled (onStall) but never killed by the adapter:
//     a slow disk is legitimate, and the person can always cancel.
'use strict';

const { createLineReader } = require('./lines.cjs');
const { startTool } = require('./run.cjs');

const { SCHEMA_EVENTS, SCHEMA_CAPABILITIES, MAJOR } = require('./contract.cjs');
const TERMINAL = new Set(['result', 'error', 'cancelled']);

const DEFAULTS = { helloMs: 5000, capabilitiesMs: 10_000, maxLineBytes: 1024 * 1024, maxTotalBytes: 64 * 1024 * 1024, stallMs: 30_000, graceMs: 3000 };

const majorOf = (version) => {
  const match = /^(\d+)\./.exec(String(version ?? ''));
  return match ? Number(match[1]) : null;
};

/**
 * @param {{ located: { ok: true, command: string, prefixArgs: string[] }, cwd: string, platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv, limits?: Partial<typeof DEFAULTS> }} options
 */
function createAdapter(options) {
  const limits = { ...DEFAULTS, ...(options.limits ?? {}) };
  const { located, cwd } = options;

  function spawn(args, onStdout) {
    return startTool({ command: located.command, args: [...located.prefixArgs, ...args], cwd, env: options.env, platform: options.platform, graceMs: limits.graceMs, onStdout });
  }

  /** One JSON document on stdout, then exit 0. Never longer than `capabilitiesMs`. */
  async function capabilities(extraArgs = []) {
    const chunks = [];
    let bytes = 0;
    const tool = spawn(['--capabilities', ...extraArgs], (chunk) => {
      if (bytes < limits.maxLineBytes) chunks.push(chunk);
      bytes += chunk.length;
    });
    const timer = setTimeout(() => tool.kill(), limits.capabilitiesMs);
    const outcome = await tool.done;
    clearTimeout(timer);
    const fail = (code, message, details = {}) => ({ ok: false, error: { code, message, details: { ...details, exitCode: outcome.exitCode, stderrTail: outcome.stderrTail.slice(-2000) } } });
    if (outcome.spawnError) return fail('TOOL_NOT_FOUND', outcome.spawnError);
    if (outcome.escalated) return fail('TOOL_STALLED', `no capabilities within ${limits.capabilitiesMs} ms`);
    if (bytes > limits.maxLineBytes) return fail('TOOL_PROTOCOL', `capabilities answer over ${limits.maxLineBytes} bytes`);
    let doc;
    try {
      doc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return fail('TOOL_INCOMPATIBLE', 'the capabilities answer is not JSON');
    }
    if (doc?.schema !== SCHEMA_CAPABILITIES || majorOf(doc.schema_version) !== MAJOR) return fail('TOOL_INCOMPATIBLE', `capabilities schema ${doc?.schema} ${doc?.schema_version}`);
    if (!Array.isArray(doc.events) || !doc.events.includes(MAJOR)) return fail('TOOL_INCOMPATIBLE', `the tool does not speak events ${MAJOR}`, { events: doc.events });
    if (outcome.exitCode !== 0) return fail('TOOL_CRASHED', `capabilities exited ${outcome.exitCode}`);
    return { ok: true, capabilities: doc };
  }

  /**
   * One job. Resolves with { status: 'ok', result } | { status: 'cancelled' } | { status: 'failed', error }.
   * @param {string[]} args the job's own arguments (paths absolute, inputs after `--`)
   * @param {{ onEvent?: (event: object) => void, onStall?: (stalled: boolean) => void, signal?: AbortSignal }} hooks
   */
  async function run(args, hooks = {}) {
    let expectSeq = 0;
    let terminal = null;
    let problem = null; // { code, message }
    let helloSeen = false;
    let stallTimer = null;
    let stalled = false;

    /** @type {ReturnType<typeof spawn>} */
    let tool = null;
    let helloTimer = null;

    const fault = (code, message) => {
      if (problem || terminal) return;
      problem = { code, message };
      reader.stop();
      tool?.stop('protocol');
    };
    const watch = () => {
      clearTimeout(stallTimer);
      if (stalled) {
        stalled = false;
        hooks.onStall?.(false);
      }
      stallTimer = setTimeout(() => {
        stalled = true;
        hooks.onStall?.(true);
      }, limits.stallMs);
    };

    const reader = createLineReader({
      maxLineBytes: limits.maxLineBytes,
      maxTotalBytes: limits.maxTotalBytes,
      onOverflow: (kind) => fault('TOOL_PROTOCOL', kind === 'line' ? `a line over ${limits.maxLineBytes} bytes` : `over ${limits.maxTotalBytes} bytes of output`),
      onLine: (line) => {
        if (!line.trim()) return;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          return fault('TOOL_PROTOCOL', `a line that is not JSON: ${line.slice(0, 80)}`);
        }
        if (typeof event !== 'object' || event === null || typeof event.type !== 'string') return fault('TOOL_PROTOCOL', 'an event without a type');
        if (terminal) return fault('TOOL_PROTOCOL', `"${event.type}" after the terminal event`);
        if (event.seq !== expectSeq) return fault('TOOL_PROTOCOL', `seq ${event.seq} where ${expectSeq} was due`);
        expectSeq += 1;
        if (!helloSeen) {
          if (event.type !== 'hello') return fault('TOOL_PROTOCOL', `the first event is "${event.type}", not hello`);
          helloSeen = true;
          clearTimeout(helloTimer);
          if (event.schema !== SCHEMA_EVENTS || majorOf(event.schema_version) !== MAJOR) return fault('TOOL_INCOMPATIBLE', `events schema ${event.schema} ${event.schema_version}`);
        }
        watch();
        if (TERMINAL.has(event.type)) {
          terminal = event;
          clearTimeout(stallTimer);
        }
        try {
          hooks.onEvent?.(event);
        } catch {
          // A consumer fault must not stop the stream.
        }
      },
    });

    tool = spawn(['--events', String(MAJOR), '--stdin-control', ...args], (chunk) => reader.push(chunk));
    helloTimer = setTimeout(() => {
      if (!helloSeen) fault('TOOL_STALLED', `no hello within ${limits.helloMs} ms`);
    }, limits.helloMs);

    const onAbort = () => tool.stop('cancelled');
    if (hooks.signal) {
      if (hooks.signal.aborted) onAbort();
      else hooks.signal.addEventListener('abort', onAbort, { once: true });
    }

    const outcome = await tool.done;
    clearTimeout(helloTimer);
    clearTimeout(stallTimer);
    hooks.signal?.removeEventListener('abort', onAbort);
    reader.end();
    if (outcome.stopReason || outcome.exitCode !== 0) tool.sweep();

    const fail = (code, message, details = {}) => ({ status: 'failed', error: { code, message, details: { ...details, exitCode: outcome.exitCode, exitSignal: outcome.exitSignal, stderrTail: outcome.stderrTail.slice(-2000) } } });
    if (outcome.spawnError) return fail('TOOL_NOT_FOUND', outcome.spawnError);
    if (problem) return fail(problem.code, problem.message);
    if (terminal?.type === 'result') return { status: 'ok', result: terminal };
    if (terminal?.type === 'cancelled') return { status: 'cancelled' };
    if (terminal?.type === 'error') return { status: 'failed', error: { code: String(terminal.code ?? 'UNKNOWN'), message: String(terminal.message ?? ''), details: terminal.details ?? {} } };
    // No terminal event: a cancel we asked for that the tool could not report, or a crash.
    if (outcome.stopReason === 'cancelled') return { status: 'cancelled' };
    return fail('TOOL_CRASHED', 'the tool ended without an outcome');
  }

  return { capabilities, run };
}

module.exports = { createAdapter, SCHEMA_EVENTS, SCHEMA_CAPABILITIES, MAJOR, DEFAULTS };
