// The shell's half of the tool part of src/bridge.ts: find the bundled tool,
// check it, run one job at a time, and report to the page. The only module in
// electron/tool that touches Electron; everything it uses is plain Node and is
// tested with the stand-in tool (test/).
//
// The starter's example job asks the tool to write a small file into the app's
// data folder. Replace it with the app's own calls, one narrow bridge function
// each, every one tested against the stand-in first (premium-bar rule 65).
import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import type { BrowserWindow, IpcMain, IpcMainEvent } from 'electron';
import type { JobUpdate, ToolStatus } from '../../src/bridge.ts';
import { stackOf } from '../errors.ts';
import type { AppConfig, SystemName } from '../platform.ts';
import { createAdapter } from './adapter.ts';
import type { Adapter } from './adapter.ts';
import { STAGING_NAME } from './contract.ts';
import { createJobRecords, newJobId } from './jobs.ts';
import type { JobRecord, JobRecords } from './jobs.ts';
import { locateTool } from './locate.ts';
import { createProgressModel } from './progress.ts';
import { createCapabilitiesCache, toolStatus } from './status.ts';

export { STAGING_NAME };

export interface NativeOptions {
  config: Pick<AppConfig, 'tool'>;
  getWindow: () => BrowserWindow | null;
  system: SystemName;
  projectDir: string;
}

type Handle = (channel: string, work: (...args: unknown[]) => unknown) => void;

export function createNative({ config, getWindow, system, projectDir }: NativeOptions) {
  const binaries: string[] = config.tool.binaries ?? [];
  const helpers = binaries.filter((name) => name !== config.tool.name);
  // Development only: STANDIN_TOOL names the stand-in script, so the shell runs without a built tool.
  const standin = process.env['STANDIN_TOOL'];
  const override = !app.isPackaged && standin ? { script: standin, config: process.env['STANDIN_CONFIG'] } : null;
  const located = locateTool({ packaged: app.isPackaged, resourcesPath: process.resourcesPath, projectDir, toolName: config.tool.name, helpers, override });

  const dataDir = () => app.getPath('userData');
  let records: JobRecords | null = null;
  let adapter: Adapter | null = null;
  let current: ToolStatus = { state: 'checking', code: null, details: null };
  let checked: Promise<ToolStatus> | null = null;
  let job: { jobId: string; abort: AbortController } | null = null;
  let lastReconcile: { records: number; removed: number } | null = null;

  const send = (update: JobUpdate) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('job:update', update);
  };

  /** Check the tool, reconcile what a killed run left behind. Call once, when the app is ready. */
  function start(): void {
    records = createJobRecords(path.join(dataDir(), 'jobs'), STAGING_NAME);
    lastReconcile = records.reconcile();
    const cache = createCapabilitiesCache(dataDir());
    if (!located.ok) {
      current = { state: 'damaged', code: located.code, details: located.details };
      checked = Promise.resolve(current);
      return;
    }
    const ready = createAdapter({ located, cwd: dataDir(), limits: {} });
    adapter = ready;
    const cached = cache.read(located);
    if (cached) current = toolStatus(cached);
    checked = ready.capabilities().then((answer) => {
      cache.write(located, answer);
      current = toolStatus(answer);
      return current;
    });
  }

  /** The tool's status for bootstrap: the cached answer at once if there is one, otherwise the check (at most 10 s). */
  async function status(): Promise<ToolStatus> {
    if (current.state === 'ready' || !checked) return current;
    return checked;
  }

  async function startJob(): Promise<{ jobId: string; refused?: 'busy' }> {
    if (job) return { jobId: job.jobId, refused: 'busy' };
    const ready = await status();
    const jobId = newJobId();
    if (ready.state !== 'ready' || !adapter || !records) {
      setImmediate(() => send({ jobId, state: 'failed', problem: { code: ready.code ?? 'TOOL_NOT_FOUND', details: ready.details ?? '' } }));
      return { jobId };
    }
    const tool = adapter;
    const jobs = records;
    const folder = path.join(dataDir(), 'output');
    fs.mkdirSync(folder, { recursive: true });
    const output = path.join(folder, 'example.txt');
    fs.rmSync(output, { force: true }); // the example overwrites its own file; an app never replaces a person's file unasked
    const record: JobRecord = { jobId, folder, staging: null, startedAt: new Date().toISOString() };
    jobs.write(record); // before the tool starts
    const abort = new AbortController();
    job = { jobId, abort };
    const progress = createProgressModel();
    const push = () => send({ jobId, state: 'running', ...progress.snapshot() });
    setImmediate(() => {
      void (async () => {
        let update: JobUpdate;
        try {
          const outcome = await tool.run(['-o', output], {
            signal: abort.signal,
            onStall: (stalled) => {
              progress.setStalled(stalled);
              push();
            },
            onEvent: (event) => {
              if (event.type === 'stage' && typeof event['staging'] === 'string') jobs.write({ ...record, staging: event['staging'] });
              if (progress.onEvent(event)) push();
            },
          });
          if (outcome.status === 'ok') {
            const written = outcome.result['output'] as { bytes?: unknown } | undefined;
            update = { jobId, state: 'done', bytes: typeof written?.bytes === 'number' ? written.bytes : null };
          } else if (outcome.status === 'cancelled') update = { jobId, state: 'cancelled' };
          else update = { jobId, state: 'failed', problem: { code: outcome.error.code, details: JSON.stringify(outcome.error, null, 2) } };
        } catch (error) {
          update = { jobId, state: 'failed', problem: { code: 'INTERNAL', details: stackOf(error) } };
        }
        jobs.remove(jobId);
        job = null;
        send(update);
      })();
    });
    return { jobId };
  }

  function cancelJob(jobId: unknown): void {
    if (job && job.jobId === jobId) job.abort.abort();
  }

  function registerIpc({ handle, ipcMain, trusted }: { handle: Handle; ipcMain: IpcMain; trusted: (event: IpcMainEvent) => boolean }): void {
    handle('job:start', () => startJob());
    ipcMain.on('job:cancel', (event, jobId: unknown) => {
      if (trusted(event)) cancelJob(jobId);
    });
  }

  /** Quitting with a job running: ask, unless the request came from a launch that asked for no focus. */
  async function confirmQuitDuringJob(win: BrowserWindow | null, { quiet }: { quiet: boolean }): Promise<boolean> {
    if (!job) return true;
    if (quiet) return false;
    const question = {
      type: 'question' as const,
      buttons: ['Keep working', 'Stop and quit'],
      defaultId: 0,
      cancelId: 0,
      message: 'A job is still running.',
      detail: 'Quitting stops it. Nothing it has not finished is kept.',
    };
    const { response } = win && !win.isDestroyed() ? await dialog.showMessageBox(win, question) : await dialog.showMessageBox(question);
    if (response !== 1) return false;
    cancelJob(job.jobId);
    const deadline = Date.now() + 5000;
    while (job && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    return true;
  }

  function diagnostics(): Record<string, unknown> {
    return {
      system,
      tool: located.ok ? { source: located.source, binary: located.binary, helpers: located.helpers } : { source: null, error: located.details },
      status: current,
      job: job ? { jobId: job.jobId } : null,
      reconciled: lastReconcile,
    };
  }

  return {
    start,
    status,
    registerIpc,
    confirmQuitDuringJob,
    diagnostics,
    get jobRunning(): boolean {
      return Boolean(job);
    },
  };
}
