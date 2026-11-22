// The one way a script starts the development shell and talks to it. Every rule here
// was paid for in build 2, where agent launches took the owner's focus three times:
//
//   1. The Electron binary and the project are absolute paths from this file.
//      A relative path once started the wrong program.
//   2. Before anything starts, the main process is built from its TypeScript sources
//      (scripts/build-electron.ts writes dist/electron/, which Electron runs), and then
//      measure/shell-check.ts passes: every main-process file and the built bundle parse,
//      no call that can take focus is outside the reviewed places, and no script reaches
//      the app through a second instance. A file that does not load would raise
//      Electron's modal error box, which takes focus. A stale bundle cannot be launched:
//      the build runs on every first launch of a script.
//   3. --no-activate on every launch. With it, a main-process error goes to stderr
//      and the app ends instead of showing that box (electron/no-dialog.ts), and the app
//      serves its control channel (electron/control.ts).
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
//   import { launchDev } from '../scripts/lib/launch.ts';
//   const app = launchDev({ args: ['--qa-typing=out.json'], dataDir, timeoutMs: 120_000 });
//   await app.ask(['--diagnostics=/abs/d.json']);   // through the control channel
//   await app.stop();                                // --quit through the channel, then by id
//   await app.exited;
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess, StdioOptions } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import * as control from '../../electron/control.ts';
import type { Reply } from '../../electron/control.ts';
import { root } from './root.ts';

export { root, control };
const require = createRequire(import.meta.url);

/** The Electron binary, as an absolute path (the electron package exports it). */
export function electronBinary(): string {
  const file: unknown = require('electron');
  if (typeof file !== 'string' || !isAbsolute(file)) throw new Error('The electron package did not give an absolute path. Run "pnpm electron:install".');
  return file;
}

let checked = false;
/** Rule 2: the main process is built from its sources and the shell check passes before any window can open. */
export function checkBeforeLaunch(): void {
  if (checked) return;
  const built = spawnSync(process.execPath, [join(root, 'scripts', 'build-electron.ts')], { encoding: 'utf8' });
  if (built.status !== 0) throw new Error(`the main process did not build; nothing was launched:\n${built.stderr || built.stdout}`);
  const result = spawnSync(process.execPath, [join(root, 'measure', 'shell-check.ts')], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`shell check failed; nothing was launched:\n${result.stderr || result.stdout}`);
  if (!existsSync(join(root, 'dist', 'page', 'index.html'))) throw new Error('dist/page/index.html is missing, so the window would be empty; nothing was launched. Run "pnpm build".');
  checked = true;
}

/** The arguments every launch carries (rules 1, 3 and 4). */
export function launchArgs(dataDir: string, args: string[] = []): string[] {
  return [root, '--no-activate', `--data-dir=${dataDir}`, ...args];
}

/**
 * Rule 6: one request to the app running with this data folder, through its control channel.
 * Resolves to the app's reply: { ok, handled, files, ms } or { ok: false, answered: false, error }.
 */
export function ask(dataDir: string, flags: string[], { waitMs = 10_000, timeoutMs = 60_000 }: { waitMs?: number; timeoutMs?: number } = {}): Promise<Reply> {
  return control.send(dataDir, flags, { waitMs, timeoutMs });
}

/** How the app was reached (the shell's lifecycle in --diagnostics). */
export interface Lifecycle {
  secondLaunches: number;
  controlRequests: number;
  activations: number;
  filesOpened: number;
  [key: string]: unknown;
}

/** The app's own counts of how it was reached (secondLaunches, controlRequests, filesOpened, ...), or null. */
export async function lifecycle(dataDir: string): Promise<Lifecycle | null> {
  const file = join(dataDir, `lifecycle-${process.pid}-${Date.now()}.json`);
  const reply = await ask(dataDir, [`--diagnostics=${file}`]);
  if (!reply.ok || !existsSync(file)) return null;
  try {
    const diagnostics = JSON.parse(readFileSync(file, 'utf8')) as { shell?: { lifecycle?: Lifecycle } } | null;
    return diagnostics?.shell?.lifecycle ?? null;
  } finally {
    rmSync(file, { force: true });
  }
}

export interface Exit {
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
}

export interface LaunchedApp {
  child: ChildProcess;
  pid: number | undefined;
  exited: Promise<Exit>;
  ask: (flags: string[], options?: { waitMs?: number; timeoutMs?: number }) => Promise<Reply>;
  lifecycle: () => Promise<Lifecycle | null>;
  stop: (graceMs?: number) => Promise<void>;
}

export interface LaunchOptions {
  args?: string[];
  /** A packaged app's executable to start instead of the development shell. */
  executable?: string | undefined;
  dataDir: string;
  timeoutMs: number;
  stdio?: StdioOptions;
  env?: Record<string, string | undefined>;
}

/** Start the development shell (or a packaged executable) under the rules above. */
export function launchDev({ args = [], dataDir, timeoutMs, stdio = 'ignore', env, executable }: LaunchOptions): LaunchedApp {
  if (!dataDir || !isAbsolute(dataDir)) throw new Error('launchDev needs an absolute, throwaway dataDir');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('launchDev needs a time limit');
  checkBeforeLaunch();
  mkdirSync(dataDir, { recursive: true });
  const child = spawn(executable ?? electronBinary(), executable ? launchArgs(dataDir, args).slice(1) : launchArgs(dataDir, args), { cwd: root, stdio, windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, ...env } });
  let ended = false;
  let timedOut = false;
  let timer: NodeJS.Timeout | undefined;
  const exited = new Promise<Exit>((r) =>
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
    if (!ended && child.pid !== undefined) {
      try {
        process.kill(child.pid);
      } catch {
        // Already gone.
      }
    }
  };
  timer = setTimeout(() => {
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
