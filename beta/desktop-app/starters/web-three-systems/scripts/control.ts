// Sends one request to the running app through its control channel and prints the reply. The
// client is @uppercut-labs/electron-control-channel's send(); this file is its command line. It
// runs anywhere the scripts folder is (a Linux container mounts only scripts/): with Node, or
// with the installed app's own executable acting as Node (ELECTRON_RUN_AS_NODE=1), which opens
// no window and is no instance of the app.
//
// The installed checks call it as scripts/control.cjs, by that name (scripts/installed-check.sh,
// scripts/installed-check.ps1, scripts/linux-container): that file is
// built from this one by scripts/emit-plain-node.ts, with the package bundled in, and
// committed, so it runs with no build and no node_modules.
//
//   node scripts/control.cjs --data-dir <folder> [--wait <seconds>] [--timeout <seconds>] -- --diagnostics=/tmp/d.json --capture=/tmp/c.png
//
// Exit code 0 when the app answered ok, 2 when no app answered, 1 when it answered with an error.
import path from 'node:path';
import { send as sendToApp } from '@uppercut-labs/electron-control-channel';
import type { Reply } from '@uppercut-labs/electron-control-channel';

/** One request; the timeout a script allows is longer than the package's default. */
export function send(dataDir: string, argv: string[], { waitMs = 20_000, timeoutMs = 120_000 }: { waitMs?: number; timeoutMs?: number } = {}): Promise<Reply> {
  return sendToApp(dataDir, argv, { waitMs, timeoutMs });
}

// Run as a program (this file or the .cjs built from it), not when a test imports send().
if (/[\\/]control\.(ts|cjs)$/.test(process.argv[1] ?? '')) {
  const argv = process.argv.slice(2);
  const split = argv.indexOf('--');
  const own = split === -1 ? argv : argv.slice(0, split);
  const request = split === -1 ? [] : argv.slice(split + 1);
  const opt = (name: string, fallback?: string) => {
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
