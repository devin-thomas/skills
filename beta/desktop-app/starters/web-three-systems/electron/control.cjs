// The control channel: how a script talks to the running app without starting a
// second instance of it.
//
// Found in build 2 (the media converter, 2026-11-15) after agent checks took the owner's focus
// twice; the experiment is measure/focus-experiment.mjs.
//
// Why it exists. A second launch of the app's executable reaches the running app
// through Chromium's process singleton. On Windows the second process calls
// AllowSetForegroundWindow(<running app's pid>) before it sends its command line
// (chrome/browser/win/chrome_process_finder.cc, AttemptToNotifyRunningChrome, in
// Chromium 156 as Electron 45.3.2 builds it; Electron's own patch leaves the call
// in). When the second launch was started by a process that holds the right to
// set the foreground (anything Explorer starts, for example), that right passes to
// the running app before any of the app's code runs, and the app's window can then
// come to the front. A person who opens the app again expects exactly that; a check
// asking for --diagnostics does not. So nothing a script sends goes through a second
// instance: it goes through this channel, a named pipe on Windows and a Unix socket
// elsewhere, which grants nothing.
//
// The running app serves the channel when its first launch asked for no focus
// (--no-activate) or for the channel (--control): the launches scripts make. A
// person's launch serves nothing, so no script can drive a window the owner opened.
// Where to connect is written to <data folder>/control.json while the app runs.
//
// Protocol: one request per connection, one line of JSON each way.
//   request  {"v":1,"argv":["--diagnostics=C:\\x.json","--capture=C:\\x.png"],"cwd":"C:\\"}
//   reply    {"v":1,"ok":true,"handled":true,"files":0,"ms":412}
//            {"v":1,"ok":false,"error":"..."}
//
// Plain Node, no Electron: the client half runs in scripts, in the app's own
// executable acting as Node, and in the app before it decides what kind of launch
// it is. It does not ask which system it is on; callers pass `system`.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const VERSION = 1;
const INFO_FILE = 'control.json';
const MAX_REQUEST = 64 * 1024;

// Flags that only mean "do this in the running app". A launch carrying any of them never
// becomes an instance of the app and never reaches the running one through Chromium's
// process singleton: it is sent through this channel or not at all.
const COMMAND_FLAGS = ['diagnostics=', 'capture=', 'show-about', 'quit', 'close-window', 'menu-command=', 'full-screen=', 'qa-press=', 'qa-menu-state='];

const flagName = (a) => (a.startsWith('--') ? a.slice(2) : null);
const isCommandFlag = (a) => {
  const name = flagName(a);
  return name !== null && COMMAND_FLAGS.some((f) => (f.endsWith('=') ? name.startsWith(f) : name === f));
};

/**
 * What kind of launch an argument list is.
 *   command  carries a command flag: send it to the running app through the channel, or report
 *            that nothing answers; never become an instance and never use the process singleton
 *   agent    a script's launch (--no-activate, --control or any --qa-* flag) with no command flag:
 *            if a running app answers on the channel, hand it there (files, show without focus);
 *            otherwise this launch becomes the app
 *   person   anything else: the normal path, including a second launch that brings the window forward
 */
function classify(argv) {
  const args = argv.slice(1);
  if (args.some(isCommandFlag)) return 'command';
  if (args.some((a) => a === '--no-activate' || a === '--control' || a.startsWith('--qa-'))) return 'agent';
  return 'person';
}

/** Whether a first launch serves the channel. */
function serves(argv) {
  return argv.includes('--no-activate') || argv.includes('--control');
}

/** A name for the pipe or socket: the app's own name, lower case, letters, digits and dashes. */
const slug = (name) => String(name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';

/** Where the channel of the app with this data folder listens. `name` is the app's own (main.cjs passes exeName). */
function endpoint(userData, system, name = 'app') {
  name = slug(name);
  const id = crypto.createHash('sha256').update(system === 'windows' ? userData.toLowerCase() : userData).digest('hex').slice(0, 16);
  if (system === 'windows') return `\\\\.\\pipe\\${name}-control-${id}`;
  // A Unix socket path has a limit of 104 bytes on macOS and 108 on Linux.
  const inside = path.posix.join(userData, 'control.sock');
  return Buffer.byteLength(inside) <= 100 ? inside : path.posix.join('/tmp', `${name}-control-${id}.sock`);
}

const infoPath = (userData) => path.join(userData, INFO_FILE);

function readInfo(userData) {
  try {
    const info = JSON.parse(fs.readFileSync(infoPath(userData), 'utf8'));
    return info && info.v === VERSION && typeof info.endpoint === 'string' ? info : null;
  } catch {
    return null;
  }
}

// ---- the server (in the running app) ---------------------------------------------
// Synchronous file calls only: the first asynchronous file call in the main process
// starts libuv's worker threads, which on Windows commit memory that never goes away
// (electron/shell.cjs, writeJson). A listening pipe or socket uses the event loop's own
// completion port or kqueue/epoll, not those threads.

/**
 * Listen on the channel. `run(argv, cwd)` carries out one request and resolves to
 * { handled, files }. `name` names the pipe or socket (endpoint above). Requests are carried out one at a time, in order.
 * Returns { endpoint, close() } or null when the channel could not be opened.
 */
function serve({ userData, system, pid, name, run, onRequest }) {
  const where = endpoint(userData, system, name);
  if (system !== 'windows') {
    // The app holds the single-instance lock for this data folder, so a socket file left here
    // belongs to an app that ended without cleaning up.
    try {
      fs.unlinkSync(where);
    } catch {
      // Nothing there.
    }
  }
  let chain = Promise.resolve();
  const open = new Set();
  const server = net.createServer((socket) => {
    open.add(socket);
    socket.on('close', () => open.delete(socket));
    let buffer = '';
    socket.setEncoding('utf8');
    const reply = (value) => {
      if (!socket.destroyed) socket.end(`${JSON.stringify({ v: VERSION, ...value })}\n`);
    };
    socket.on('error', () => {});
    socket.on('data', (chunk) => {
      buffer += chunk;
      if (buffer.length > MAX_REQUEST) {
        reply({ ok: false, error: 'request too large' });
        return;
      }
      const end = buffer.indexOf('\n');
      if (end === -1) return;
      socket.removeAllListeners('data');
      let request = null;
      try {
        request = JSON.parse(buffer.slice(0, end));
      } catch {
        reply({ ok: false, error: 'not JSON' });
        return;
      }
      const argv = request?.argv;
      if (request?.v !== VERSION || !Array.isArray(argv) || argv.length > 64 || !argv.every((a) => typeof a === 'string')) {
        reply({ ok: false, error: `expected {"v":${VERSION},"argv":[strings]}` });
        return;
      }
      const cwd = typeof request.cwd === 'string' ? request.cwd : process.cwd();
      onRequest?.(argv);
      const started = Date.now();
      chain = chain
        .then(() => run(argv, cwd))
        .then(
          (result) => reply({ ok: true, handled: Boolean(result?.handled), files: result?.files ?? 0, ms: Date.now() - started }),
          (error) => reply({ ok: false, error: String(error?.message ?? error) }),
        );
    });
  });
  server.on('error', () => {});
  try {
    server.listen(where, () => {
      if (system !== 'windows') {
        try {
          fs.chmodSync(where, 0o600);
        } catch {
          // The data folder is the owner's own; the socket inherits its protection.
        }
      }
      try {
        fs.mkdirSync(userData, { recursive: true });
        fs.writeFileSync(`${infoPath(userData)}.tmp`, JSON.stringify({ v: VERSION, endpoint: where, pid }));
        fs.renameSync(`${infoPath(userData)}.tmp`, infoPath(userData));
      } catch {
        // Without the file no script can find the channel; the app itself is unaffected.
      }
    });
  } catch {
    return null;
  }
  return {
    endpoint: where,
    close() {
      try {
        const info = readInfo(userData);
        if (info && info.pid === pid) fs.unlinkSync(infoPath(userData));
      } catch {
        // Already gone.
      }
      for (const socket of open) socket.destroy();
      server.close();
      server.unref();
      if (system !== 'windows') {
        try {
          fs.unlinkSync(where);
        } catch {
          // Already gone.
        }
      }
    },
  };
}

// ---- the client ----------------------------------------------------------------

function once(where, argv, cwd, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let text = '';
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };
    const socket = net.connect(where);
    const timer = setTimeout(() => finish({ ok: false, error: `no reply in ${timeoutMs} ms`, retry: false }), timeoutMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify({ v: VERSION, argv, cwd })}\n`));
    socket.on('data', (chunk) => {
      text += chunk;
      const end = text.indexOf('\n');
      if (end === -1) return;
      try {
        finish({ ...JSON.parse(text.slice(0, end)), retry: false });
      } catch {
        finish({ ok: false, error: 'the reply was not JSON', retry: false });
      }
    });
    // Refused or not there: the app is not (yet) listening.
    socket.on('error', (error) => finish({ ok: false, error: `${error.code ?? error.message}`, retry: true }));
    socket.on('close', () => finish({ ok: false, error: 'closed without a reply', retry: false }));
  });
}

/**
 * Send one request to the app running with this data folder.
 *   waitMs     how long to keep trying while no app answers (0: one try)
 *   timeoutMs  how long one request may take once connected
 * Resolves to the reply, or { ok: false, answered: false, error } when no app answered.
 */
async function send(userData, argv, { cwd = process.cwd(), waitMs = 20_000, timeoutMs = 60_000 } = {}) {
  const until = Date.now() + waitMs;
  let last = 'no control.json in the data folder';
  for (;;) {
    const info = readInfo(userData);
    if (info) {
      const reply = await once(info.endpoint, argv, cwd, timeoutMs);
      if (!reply.retry) {
        delete reply.retry;
        return { ...reply, answered: reply.ok || !/^(ENOENT|ECONNREFUSED|EPIPE)/.test(reply.error ?? '') };
      }
      last = `${reply.error} at ${info.endpoint}`;
    }
    if (Date.now() >= until) return { v: VERSION, ok: false, answered: false, error: `no running app answers for ${userData}: ${last}` };
    await new Promise((r) => setTimeout(r, 200));
  }
}

module.exports = { VERSION, COMMAND_FLAGS, isCommandFlag, classify, serves, endpoint, readInfo, infoPath, serve, send };
