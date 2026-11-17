// The one way a script starts the development shell and talks to it. Every rule here
// was paid for in build 2, where agent launches took the owner's focus three times:
//
//   1. The Electron binary and the project are absolute paths from this file.
//      A relative path once started the wrong program.
//   2. measure/shell-check.mjs runs first: every main-process file parses, no call
//      that can take focus is outside the reviewed places, and no script reaches the
//      app through a second instance. A syntax error would raise Electron's modal
//      error box, which takes focus.
//   3. --no-activate on every launch. With it, a main-process error goes to stderr
//      and the app ends instead of showing that box (electron/main.cjs), and the app
//      serves its control channel (electron/control.cjs).
//   4. A throwaway --data-dir on every launch, which is also the app's own
//      single-instance lock and where it says where its channel listens, so a test
//      never reaches the owner's running copy.
//   5. A time limit on every launch. When it passes the app is asked to quit through
//      the channel, and the process this script started is ended by its exact id if
//      it has not. Never by name.
//   6. Requests to the running app (--diagnostics, --capture, --quit and the other
//      command flags) go through the control channel: ask() below. Never start the
//      executable again to talk to it: a second instance reaches the running app
//      through Chromium's process singleton, which on Windows grants it the right to
//      take the foreground before any app code runs (found in build 2; the app counts
//      such launches, and lifecycle().secondLaunches must stay 0).
//
// Usage:
//   import { launchDev } from '../scripts/lib/launch.mjs';
//   const app = launchDev({ args: ['--qa-typing=out.json'], dataDir, timeoutMs: 120_000 });
//   await app.ask(['--diagnostics=/abs/d.json']);   // through the control channel
//   await app.stop();                                // --quit through the channel, then by id
//   await app.exited;
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
export const control = require('../../electron/control.cjs');

/** The Electron binary, as an absolute path (the electron package exports it). */
export function electronBinary() {
  const file = require('electron');
  if (typeof file !== 'string' || !isAbsolute(file)) throw new Error('The electron package did not give an absolute path. Run "pnpm electron:install".');
  return file;
}

let checked = false;
/** Rule 2: the shell check passes before any window can open. */
export function checkBeforeLaunch() {
  if (checked) return;
  const result = spawnSync(process.execPath, [join(root, 'measure', 'shell-check.mjs')], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`shell check failed; nothing was launched:\n${result.stderr || result.stdout}`);
  checked = true;
}

/** The arguments every launch carries (rules 1, 3 and 4). */
export function launchArgs(dataDir, args = []) {
  return [root, '--no-activate', `--data-dir=${dataDir}`, ...args];
}

/**
 * Rule 6: one request to the app running with this data folder, through its control channel.
 * Resolves to the app's reply: { ok, handled, files, ms } or { ok: false, answered: false, error }.
 */
export function ask(dataDir, flags, { waitMs = 10_000, timeoutMs = 60_000 } = {}) {
  return control.send(dataDir, flags, { waitMs, timeoutMs });
}

/** The app's own counts of how it was reached (secondLaunches, controlRequests, filesOpened, ...), or null. */
export async function lifecycle(dataDir) {
  const file = join(dataDir, `lifecycle-${process.pid}-${Date.now()}.json`);
  const reply = await ask(dataDir, [`--diagnostics=${file}`]);
  if (!reply.ok || !existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'))?.shell?.lifecycle ?? null;
  } finally {
    rmSync(file, { force: true });
  }
}

/**
 * Start the development shell under the rules above.
 * @param {{ args?: string[], dataDir: string, timeoutMs: number, stdio?: any, env?: Record<string, string | undefined> }} options
 * @returns {{ child: import('node:child_process').ChildProcess, pid: number, exited: Promise<{ code: number | null, signal: string | null, timedOut: boolean }>,
 *   ask: (flags: string[], options?: object) => Promise<any>, lifecycle: () => Promise<any>, stop: () => Promise<void> }}
 */
export function launchDev({ args = [], dataDir, timeoutMs, stdio = 'ignore', env }) {
  if (!dataDir || !isAbsolute(dataDir)) throw new Error('launchDev needs an absolute, throwaway dataDir');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('launchDev needs a time limit');
  checkBeforeLaunch();
  mkdirSync(dataDir, { recursive: true });
  const child = spawn(electronBinary(), launchArgs(dataDir, args), { cwd: root, stdio, windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, ...env } });
  let ended = false;
  let timedOut = false;
  const exited = new Promise((r) =>
    child.once('exit', (code, signal) => {
      ended = true;
      clearTimeout(timer);
      r({ code, signal, timedOut });
    }),
  );
  /** --quit through the channel; then, if the app has not ended in `graceMs`, the exact process this function started. */
  const stop = async (graceMs = 30_000) => {
    if (ended) return;
    await ask(dataDir, ['--quit'], { waitMs: 2000, timeoutMs: 15_000 });
    // Electron 45 took 4 to 11 s on Windows from the app's own exit to the end of its main process (build 2).
    const until = Date.now() + graceMs;
    while (!ended && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
    if (!ended) {
      try {
        process.kill(child.pid);
      } catch {
        // Already gone.
      }
    }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    void stop(15_000);
  }, timeoutMs);
  return {
    child,
    pid: child.pid,
    exited,
    ask: (flags, options) => ask(dataDir, flags, options),
    lifecycle: () => lifecycle(dataDir),
    stop,
  };
}
