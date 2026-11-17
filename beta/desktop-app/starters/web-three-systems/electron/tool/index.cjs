// The shell's half of the tool part of src/bridge.ts: find the bundled tool,
// check it, run one job at a time, and report to the page. The only module in
// electron/tool that touches Electron; everything it uses is plain Node and is
// tested with the stand-in tool (test/).
//
// The starter's example job asks the tool to write a small file into the app's
// data folder. Replace it with the app's own calls, one narrow bridge function
// each, every one tested against the stand-in first (premium-bar rule 65).
'use strict';

const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createAdapter } = require('./adapter.cjs');
const { createJobRecords, newJobId } = require('./jobs.cjs');
const { locateTool } = require('./locate.cjs');
const { createProgressModel } = require('./progress.cjs');
const { createCapabilitiesCache, toolStatus } = require('./status.cjs');

const { STAGING_NAME } = require('./contract.cjs');

/**
 * @param {{ config: any, getWindow: () => any, system: 'windows' | 'macos' | 'linux', projectDir: string }} options
 */
function createNative({ config, getWindow, system, projectDir }) {
  const helpers = (config.tool.binaries ?? []).filter((name) => name !== config.tool.name);
  // Development only: STANDIN_TOOL names the stand-in script, so the shell runs without a built tool.
  const override = !app.isPackaged && process.env.STANDIN_TOOL ? { script: process.env.STANDIN_TOOL, config: process.env.STANDIN_CONFIG } : null;
  const located = locateTool({ packaged: app.isPackaged, resourcesPath: process.resourcesPath, projectDir, toolName: config.tool.name, helpers, override });

  const dataDir = () => app.getPath('userData');
  let records = null;
  let cache = null;
  let adapter = null;
  let current = { state: 'checking', code: null, details: null };
  let checked = null;
  /** @type {{ jobId: string, abort: AbortController } | null} */
  let job = null;
  let lastReconcile = null;

  const send = (update) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('job:update', update);
  };

  /** Check the tool, reconcile what a killed run left behind. Call once, when the app is ready. */
  function start() {
    records = createJobRecords(path.join(dataDir(), 'jobs'), STAGING_NAME);
    lastReconcile = records.reconcile();
    cache = createCapabilitiesCache(dataDir());
    if (!located.ok) {
      current = { state: 'damaged', code: located.code, details: located.details };
      checked = Promise.resolve(current);
      return;
    }
    adapter = createAdapter({ located, cwd: dataDir(), limits: {} });
    const cached = cache.read(located);
    if (cached) current = toolStatus(cached);
    checked = adapter.capabilities().then((answer) => {
      cache.write(located, answer);
      current = toolStatus(answer);
      return current;
    });
  }

  /** The tool's status for bootstrap: the cached answer at once if there is one, otherwise the check (at most 10 s). */
  async function status() {
    if (current.state === 'ready' || !checked) return current;
    return checked;
  }

  async function startJob() {
    if (job) return { jobId: job.jobId, refused: 'busy' };
    const ready = await status();
    const jobId = newJobId();
    if (ready.state !== 'ready') {
      setImmediate(() => send({ jobId, state: 'failed', problem: { code: ready.code ?? 'TOOL_NOT_FOUND', details: ready.details ?? '' } }));
      return { jobId };
    }
    const folder = path.join(dataDir(), 'output');
    fs.mkdirSync(folder, { recursive: true });
    const output = path.join(folder, 'example.txt');
    fs.rmSync(output, { force: true }); // the example overwrites its own file; an app never replaces a person's file unasked
    const record = { jobId, folder, staging: null, startedAt: new Date().toISOString() };
    records.write(record); // before the tool starts
    const abort = new AbortController();
    job = { jobId, abort };
    const progress = createProgressModel();
    const push = () => send({ jobId, state: 'running', ...progress.snapshot() });
    setImmediate(async () => {
      let update;
      try {
        const outcome = await adapter.run(['-o', output], {
          signal: abort.signal,
          onStall: (stalled) => {
            progress.setStalled(stalled);
            push();
          },
          onEvent: (event) => {
            if (event.type === 'stage' && typeof event.staging === 'string') records.write({ ...record, staging: event.staging });
            if (progress.onEvent(event)) push();
          },
        });
        if (outcome.status === 'ok') update = { jobId, state: 'done', bytes: outcome.result.output?.bytes ?? null };
        else if (outcome.status === 'cancelled') update = { jobId, state: 'cancelled' };
        else update = { jobId, state: 'failed', problem: { code: outcome.error.code, details: JSON.stringify(outcome.error, null, 2) } };
      } catch (error) {
        update = { jobId, state: 'failed', problem: { code: 'INTERNAL', details: String(error?.stack ?? error) } };
      }
      records.remove(jobId);
      job = null;
      send(update);
    });
    return { jobId };
  }

  function cancelJob(jobId) {
    if (job && job.jobId === jobId) job.abort.abort();
  }

  function registerIpc({ handle, ipcMain, trusted }) {
    handle('job:start', () => startJob());
    ipcMain.on('job:cancel', (event, jobId) => {
      if (trusted(event)) cancelJob(jobId);
    });
  }

  /** Quitting with a job running: ask, unless the request came from a launch that asked for no focus. */
  async function confirmQuitDuringJob(win, { quiet }) {
    if (!job) return true;
    if (quiet) return false;
    const { response } = await dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
      type: 'question',
      buttons: ['Keep working', 'Stop and quit'],
      defaultId: 0,
      cancelId: 0,
      message: 'A job is still running.',
      detail: 'Quitting stops it. Nothing it has not finished is kept.',
    });
    if (response !== 1) return false;
    const { jobId } = job;
    cancelJob(jobId);
    const deadline = Date.now() + 5000;
    while (job && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    return true;
  }

  function diagnostics() {
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
    get jobRunning() {
      return Boolean(job);
    },
  };
}

module.exports = { createNative, STAGING_NAME };
