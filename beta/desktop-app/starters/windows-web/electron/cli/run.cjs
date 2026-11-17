// Finds an installed npm-global CLI and runs it as a bounded child process.
//
// An npm global is a `<name>.cmd` shim that runs `node <shim folder>\node_modules\...\cli.js`.
// A .cmd file can only be started through a shell, so the shim is never executed. It is read
// to find the script, and node.exe is started directly with an argument array.
//
// The system node.exe is used rather than Electron's own Node (ELECTRON_RUN_AS_NODE):
// it is the runtime the CLI was installed and verified under, its version does not
// change when the app's Electron version does, and the app keeps working if the
// RunAsNode fuse is ever turned off for the packaged build.
//
// Which CLI: app.config.json `cli.shim` (for example "mytool.cmd") and `cli.scriptFallback`
// (the script's path relative to the shim folder, used when the shim cannot be parsed).
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function pathDirs(env) {
  const raw = env.PATH ?? env.Path ?? '';
  const dirs = raw.split(path.delimiter).map((d) => d.trim().replace(/^"|"$/g, '')).filter(Boolean);
  // npm's global folder, in case PATH was trimmed by whatever launched the app.
  if (env.APPDATA) dirs.push(path.join(env.APPDATA, 'npm'));
  return [...new Set(dirs)];
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {{shim: string, scriptFallback?: string}} spec
 * @returns {{ok: true, node: string, cliJs: string, shim: string} | {ok: false, detail: string}}
 */
function locateCli(spec, env = process.env) {
  const SHIM = spec?.shim ?? '';
  if (!SHIM) return { ok: false, detail: 'No command-line tool is configured for this app.' };
  const dirs = pathDirs(env);
  const shimDir = dirs.find((dir) => isFile(path.join(dir, SHIM)));
  if (!shimDir) {
    return { ok: false, detail: `No ${SHIM} was found on PATH or in the npm global folder.` };
  }
  const shim = path.join(shimDir, SHIM);

  // The shim names its script as "%dp0%\node_modules\...\cli.js".
  let cliJs = spec.scriptFallback ? path.join(shimDir, spec.scriptFallback) : '';
  try {
    const text = fs.readFileSync(shim, 'utf8');
    const match = /"%(?:~dp0|dp0%)\\([^"]+\.js)"/i.exec(text);
    if (match) cliJs = path.join(shimDir, match[1]);
  } catch {
    // Fall back to the conventional location.
  }
  if (!isFile(cliJs)) {
    return { ok: false, detail: `${shim} points at ${cliJs}, which does not exist.` };
  }

  // Same rule as the shim: a node.exe beside it wins, otherwise the first on PATH.
  const beside = path.join(shimDir, 'node.exe');
  const node = isFile(beside) ? beside : dirs.map((dir) => path.join(dir, 'node.exe')).find(isFile);
  if (!node) {
    return { ok: false, detail: `The command-line tool is installed at ${cliJs}, but no node.exe was found on PATH to run it.` };
  }
  return { ok: true, node, cliJs, shim };
}

/**
 * Runs `node cli.js ...args`. Never uses a shell. stdout and stderr are always
 * drained; at most `maxBytes` of each is kept. The child is killed on timeout
 * or when `signal` aborts.
 *
 * @param {{node: string, cliJs: string}} cli
 * @param {string[]} args
 * @param {{timeoutMs: number, maxBytes?: number, signal?: AbortSignal, cwd?: string, env?: NodeJS.ProcessEnv}} options
 */
function runCli(cli, args, options) {
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  return new Promise((resolve) => {
    const result = {
      code: /** @type {number | null} */ (null),
      stdout: '',
      stderr: '',
      timedOut: false,
      cancelled: false,
      truncated: false,
      spawnError: /** @type {string | null} */ (null),
      durationMs: 0,
    };
    const started = Date.now();
    if (options.signal?.aborted) {
      result.cancelled = true;
      resolve(result);
      return;
    }

    const env = { ...(options.env ?? process.env) };
    delete env.ELECTRON_RUN_AS_NODE;

    let child;
    try {
      child = spawn(cli.node, [cli.cliJs, ...args], {
        cwd: options.cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      result.spawnError = String(error?.message ?? error);
      resolve(result);
      return;
    }

    const chunks = { stdout: [], stderr: [] };
    const sizes = { stdout: 0, stderr: 0 };
    const collect = (name) => (chunk) => {
      const room = maxBytes - sizes[name];
      if (room <= 0) {
        result.truncated = true;
        return; // keep draining, keep nothing
      }
      const piece = chunk.length > room ? chunk.subarray(0, room) : chunk;
      if (piece.length < chunk.length) result.truncated = true;
      chunks[name].push(piece);
      sizes[name] += piece.length;
    };
    child.stdout.on('data', collect('stdout'));
    child.stderr.on('data', collect('stderr'));

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      result.stdout = Buffer.concat(chunks.stdout).toString('utf8');
      result.stderr = Buffer.concat(chunks.stderr).toString('utf8');
      result.durationMs = Date.now() - started;
      resolve(result);
    };
    const timer = setTimeout(() => {
      result.timedOut = true;
      child.kill();
    }, options.timeoutMs);
    const onAbort = () => {
      result.cancelled = true;
      child.kill();
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    child.on('error', (error) => {
      result.spawnError = String(error?.message ?? error);
      finish();
    });
    child.on('close', (code) => {
      result.code = code;
      finish();
    });
  });
}

module.exports = { locateCli, runCli };
