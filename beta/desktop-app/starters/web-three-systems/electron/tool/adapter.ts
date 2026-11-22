// The adapter's two calls against the tool in docs/TOOL-CONTRACT.md: a short
// capabilities question, and a job that streams events. No Electron in here,
// so the tests drive it with the stand-in tool on every system.
//
// Starting the tool and owning its lifetime is @uppercut-labs/electron-child-process-runner:
// absolute executable, argument array, no shell and no window; stdin kept open as the cancel
// channel and closed to cancel; stdout and stderr always drained, with a bounded stderr tail;
// the process tree killed if it is still there after the grace period (a process group on
// macOS and Linux, taskkill /T on Windows); ELECTRON_RUN_AS_NODE never reaches the tool.
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
import { startProcess } from '@uppercut-labs/electron-child-process-runner';
import type { Outcome, RunningProcess } from '@uppercut-labs/electron-child-process-runner';
import { MAJOR, SCHEMA_CAPABILITIES, SCHEMA_EVENTS } from './contract.ts';
import { createLineReader } from '@uppercut-labs/electron-child-process-runner';
import type { Located } from './locate.ts';
import type { ToolEvent } from './progress.ts';
import type { CapabilitiesAnswer, Capabilities, ToolError } from './status.ts';

export { MAJOR, SCHEMA_CAPABILITIES, SCHEMA_EVENTS };
const TERMINAL = new Set(['result', 'error', 'cancelled']);

export const DEFAULTS = { helloMs: 5000, capabilitiesMs: 10_000, maxLineBytes: 1024 * 1024, maxTotalBytes: 64 * 1024 * 1024, stallMs: 30_000, graceMs: 3000 };
export type Limits = typeof DEFAULTS;

const majorOf = (version: unknown): number | null => {
  const match = /^(\d+)\./.exec(String(version ?? ''));
  return match ? Number(match[1]) : null;
};

export type JobOutcome = { status: 'ok'; result: ToolEvent } | { status: 'cancelled' } | { status: 'failed'; error: ToolError };

export interface JobHooks {
  onEvent?: (event: ToolEvent) => void;
  onStall?: (stalled: boolean) => void;
  signal?: AbortSignal;
}

export interface AdapterOptions {
  located: Extract<Located, { ok: true }>;
  cwd: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  limits?: Partial<Limits>;
}

export function createAdapter(options: AdapterOptions) {
  const limits: Limits = { ...DEFAULTS, ...(options.limits ?? {}) };
  const { located, cwd } = options;

  function spawn(args: string[], onStdout: (chunk: Buffer) => void): RunningProcess {
    return startProcess({
      command: located.command,
      args: [...located.prefixArgs, ...args],
      cwd,
      ...(options.env ? { env: options.env } : {}),
      ...(options.platform ? { platform: options.platform } : {}),
      graceMs: limits.graceMs,
      onStdout,
    });
  }

  const detailsOf = (outcome: Outcome, details: Record<string, unknown>) => ({ ...details, exitCode: outcome.exitCode, stderrTail: outcome.stderrTail.slice(-2000) });

  /** One JSON document on stdout, then exit 0. Never longer than `capabilitiesMs`. */
  async function capabilities(extraArgs: string[] = []): Promise<CapabilitiesAnswer> {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const tool = spawn(['--capabilities', ...extraArgs], (chunk) => {
      if (bytes < limits.maxLineBytes) chunks.push(chunk);
      bytes += chunk.length;
    });
    const timer = setTimeout(() => tool.kill(), limits.capabilitiesMs);
    const outcome = await tool.done;
    clearTimeout(timer);
    const fail = (code: string, message: string, details: Record<string, unknown> = {}): CapabilitiesAnswer => ({ ok: false, error: { code, message, details: detailsOf(outcome, details) } });
    if (outcome.spawnError) return fail('TOOL_NOT_FOUND', outcome.spawnError);
    if (outcome.escalated) return fail('TOOL_STALLED', `no capabilities within ${limits.capabilitiesMs} ms`);
    if (bytes > limits.maxLineBytes) return fail('TOOL_PROTOCOL', `capabilities answer over ${limits.maxLineBytes} bytes`);
    let doc: Capabilities | null;
    try {
      doc = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Capabilities | null;
    } catch {
      return fail('TOOL_INCOMPATIBLE', 'the capabilities answer is not JSON');
    }
    if (doc?.schema !== SCHEMA_CAPABILITIES || majorOf(doc.schema_version) !== MAJOR) return fail('TOOL_INCOMPATIBLE', `capabilities schema ${String(doc?.schema)} ${String(doc?.schema_version)}`);
    if (!Array.isArray(doc.events) || !doc.events.includes(MAJOR)) return fail('TOOL_INCOMPATIBLE', `the tool does not speak events ${MAJOR}`, { events: doc.events });
    if (outcome.exitCode !== 0) return fail('TOOL_CRASHED', `capabilities exited ${outcome.exitCode}`);
    return { ok: true, capabilities: doc };
  }

  /**
   * One job. Resolves with { status: 'ok', result } | { status: 'cancelled' } | { status: 'failed', error }.
   * `args` are the job's own arguments (paths absolute, inputs after `--`).
   */
  async function run(args: string[], hooks: JobHooks = {}): Promise<JobOutcome> {
    let expectSeq = 0;
    let terminal: ToolEvent | null = null;
    let problem: { code: string; message: string } | null = null;
    let helloSeen = false;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let stalled = false;
    let tool: RunningProcess | null = null;
    let helloTimer: ReturnType<typeof setTimeout> | undefined;

    const fault = (code: string, message: string): void => {
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
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          return fault('TOOL_PROTOCOL', `a line that is not JSON: ${line.slice(0, 80)}`);
        }
        if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { type?: unknown }).type !== 'string') return fault('TOOL_PROTOCOL', 'an event without a type');
        const event = parsed as ToolEvent;
        if (terminal) return fault('TOOL_PROTOCOL', `"${event.type}" after the terminal event`);
        if (event.seq !== expectSeq) return fault('TOOL_PROTOCOL', `seq ${String(event.seq)} where ${expectSeq} was due`);
        expectSeq += 1;
        if (!helloSeen) {
          if (event.type !== 'hello') return fault('TOOL_PROTOCOL', `the first event is "${event.type}", not hello`);
          helloSeen = true;
          clearTimeout(helloTimer);
          if (event['schema'] !== SCHEMA_EVENTS || majorOf(event['schema_version']) !== MAJOR) return fault('TOOL_INCOMPATIBLE', `events schema ${String(event['schema'])} ${String(event['schema_version'])}`);
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

    const started = spawn(['--events', String(MAJOR), '--stdin-control', ...args], (chunk) => reader.push(chunk));
    tool = started;
    helloTimer = setTimeout(() => {
      if (!helloSeen) fault('TOOL_STALLED', `no hello within ${limits.helloMs} ms`);
    }, limits.helloMs);

    const onAbort = () => started.stop('cancelled');
    if (hooks.signal) {
      if (hooks.signal.aborted) onAbort();
      else hooks.signal.addEventListener('abort', onAbort, { once: true });
    }

    const outcome = await started.done;
    clearTimeout(helloTimer);
    clearTimeout(stallTimer);
    hooks.signal?.removeEventListener('abort', onAbort);
    reader.end();
    if (outcome.stopReason || outcome.exitCode !== 0) started.sweep();

    const fail = (code: string, message: string, details: Record<string, unknown> = {}): JobOutcome => ({ status: 'failed', error: { code, message, details: { ...detailsOf(outcome, details), exitSignal: outcome.exitSignal } } });
    const found = problem as { code: string; message: string } | null;
    const end = terminal as ToolEvent | null;
    if (outcome.spawnError) return fail('TOOL_NOT_FOUND', outcome.spawnError);
    if (found) return fail(found.code, found.message);
    if (end?.type === 'result') return { status: 'ok', result: end };
    if (end?.type === 'cancelled') return { status: 'cancelled' };
    if (end?.type === 'error') {
      const details = end['details'];
      return { status: 'failed', error: { code: String(end['code'] ?? 'UNKNOWN'), message: String(end['message'] ?? ''), details: details !== null && typeof details === 'object' ? (details as Record<string, unknown>) : {} } };
    }
    // No terminal event: a cancel we asked for that the tool could not report, or a crash.
    if (outcome.stopReason === 'cancelled') return { status: 'cancelled' };
    return fail('TOOL_CRASHED', 'the tool ended without an outcome');
  }

  return { capabilities, run };
}

export type Adapter = ReturnType<typeof createAdapter>;
