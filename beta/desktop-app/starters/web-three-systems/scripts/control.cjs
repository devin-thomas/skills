// Sends one request to the running app through its control channel (electron/control.cjs)
// and prints the reply. Self-contained plain Node, so it runs anywhere the scripts folder is
// (a Linux container mounts only scripts/): with Node, or with the installed app's own
// executable acting as Node (ELECTRON_RUN_AS_NODE=1), which opens no window and is no
// instance of the app. test/control.test.cjs keeps it in step with electron/control.cjs.
//
//   node scripts/control.cjs --data-dir <folder> [--wait <seconds>] [--timeout <seconds>] -- --diagnostics=/tmp/d.json --capture=/tmp/c.png
//
// Exit code 0 when the app answered ok, 2 when no app answered, 1 when it answered with an error.
'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

function readInfo(dataDir) {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(dataDir, 'control.json'), 'utf8'));
    return info && info.v === 1 && typeof info.endpoint === 'string' ? info : null;
  } catch {
    return null;
  }
}

function once(endpoint, argv, timeoutMs) {
  return new Promise((resolve) => {
    let text = '';
    let done = false;
    const socket = net.connect(endpoint);
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => finish({ ok: false, answered: true, error: `no reply in ${timeoutMs} ms` }), timeoutMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify({ v: 1, argv, cwd: process.cwd() })}\n`));
    socket.on('data', (chunk) => {
      text += chunk;
      const end = text.indexOf('\n');
      if (end === -1) return;
      try {
        finish({ ...JSON.parse(text.slice(0, end)), answered: true });
      } catch {
        finish({ ok: false, answered: true, error: 'the reply was not JSON' });
      }
    });
    socket.on('error', (error) => finish({ ok: false, answered: false, error: String(error.code ?? error.message) }));
    socket.on('close', () => finish({ ok: false, answered: false, error: 'closed without a reply' }));
  });
}

async function send(dataDir, argv, { waitMs = 20_000, timeoutMs = 120_000 } = {}) {
  const until = Date.now() + waitMs;
  let last = 'no control.json in the data folder';
  for (;;) {
    const info = readInfo(dataDir);
    if (info) {
      const reply = await once(info.endpoint, argv, timeoutMs);
      if (reply.answered) return reply;
      last = `${reply.error} at ${info.endpoint}`;
    }
    if (Date.now() >= until) return { v: 1, ok: false, answered: false, error: `no running app answers for ${dataDir}: ${last}` };
    await new Promise((r) => setTimeout(r, 200));
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const split = argv.indexOf('--');
  const own = split === -1 ? argv : argv.slice(0, split);
  const request = split === -1 ? [] : argv.slice(split + 1);
  const opt = (name, fallback) => {
    const i = own.indexOf(`--${name}`);
    return i === -1 ? fallback : own[i + 1];
  };
  const dataDir = opt('data-dir');
  if (!dataDir) {
    process.stderr.write('usage: control.cjs --data-dir <folder> [--wait <seconds>] [--timeout <seconds>] -- <command flags>\n');
    process.exit(64);
  }
  void send(path.resolve(dataDir), request, { waitMs: Number(opt('wait', '20')) * 1000, timeoutMs: Number(opt('timeout', '120')) * 1000 }).then((reply) => {
    process.stdout.write(`${JSON.stringify(reply)}\n`);
    process.exit(reply.ok ? 0 : reply.answered ? 1 : 2);
  });
}

module.exports = { send };
