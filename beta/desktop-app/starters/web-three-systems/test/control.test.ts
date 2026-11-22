// The control channel (electron/control.ts): what kind of launch goes where, and one
// request each way through a real pipe or socket. Plain Node: the channel is served here by
// this test process, not by Electron, so it runs anywhere the other tests run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import * as control from '../electron/control.ts';
import * as scriptClient from '../scripts/control.ts';

const SYSTEM = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
const exe = 'C:\\app\\Starter.exe';

test('every flag a script uses to act on the running app makes a command launch', () => {
  for (const flag of ['--diagnostics=x.json', '--capture=x.png', '--show-about', '--quit', '--close-window', '--menu-command=about', '--full-screen=on', '--qa-press=F11', '--qa-menu-state={}']) {
    assert.equal(control.classify([exe, '--data-dir=d', '--no-activate', flag]), 'command', flag);
    assert.equal(control.classify([exe, flag]), 'command', `${flag} without --no-activate`);
  }
});

test('a script launch without a command is an agent launch; a person launch is not', () => {
  assert.equal(control.classify([exe, '--no-activate']), 'agent');
  assert.equal(control.classify([exe, '--no-activate', 'C:\\docs\\a.txt']), 'agent');
  assert.equal(control.classify([exe, '--qa-typing=out.json']), 'agent');
  assert.equal(control.classify([exe, '--control']), 'agent');
  assert.equal(control.classify([exe]), 'person');
  assert.equal(control.classify([exe, 'C:\\docs\\a.txt']), 'person');
  assert.equal(control.classify([exe, '--data-dir=d']), 'person');
  // A file whose name looks like a flag's value is not a flag.
  assert.equal(control.classify([exe, 'quit']), 'person');
});

test('only launches made by scripts serve the channel', () => {
  assert.equal(control.serves([exe, '--no-activate']), true);
  assert.equal(control.serves([exe, '--control']), true);
  assert.equal(control.serves([exe]), false);
  assert.equal(control.serves([exe, 'C:\\docs\\a.txt']), false);
});

test('the endpoint is a named pipe on Windows and a short socket path elsewhere', () => {
  assert.match(control.endpoint('C:\\Users\\x\\AppData\\Roaming\\My App', 'windows', 'MyApp'), /^\\\\\.\\pipe\\myapp-control-[0-9a-f]{16}$/);
  // The name is the app's own, made safe for a pipe or socket name; without one it is "app".
  assert.match(control.endpoint('C:\\x', 'windows', 'Two Words'), /\\two-words-control-[0-9a-f]{16}$/);
  assert.match(control.endpoint('C:\\x', 'windows'), /\\app-control-[0-9a-f]{16}$/);
  assert.equal(control.endpoint('C:\\A\\B', 'windows'), control.endpoint('c:\\a\\b', 'windows'));
  assert.equal(control.endpoint('/tmp/run/app-data', 'macos'), '/tmp/run/app-data/control.sock');
  const long = `/Volumes/External/${'x'.repeat(120)}`;
  assert.match(control.endpoint(long, 'linux', 'Starter'), /^\/tmp\/starter-control-[0-9a-f]{16}\.sock$/);
});

test('one request through the channel: the reply, the order, and nothing when no app runs', async () => {
  const userData = fs.mkdtempSync(path.join(SYSTEM === 'macos' ? '/tmp' : os.tmpdir(), 'app-control-'));
  try {
    const none = await control.send(userData, ['--quit'], { waitMs: 0 });
    assert.equal(none.ok, false);
    assert.equal(none.answered, false);

    const got: { argv: string[]; cwd: string }[] = [];
    const channel = control.serve({
      userData,
      system: SYSTEM,
      pid: process.pid,
      name: 'Starter',
      run: async (argv, cwd) => {
        got.push({ argv, cwd });
        await new Promise((r) => setTimeout(r, 30));
        return { handled: argv.some((a) => a.startsWith('--')), files: 0 };
      },
    });
    assert.ok(channel);
    const [a, b] = await Promise.all([control.send(userData, ['--diagnostics=a.json'], { cwd: '/x', waitMs: 3000 }), control.send(userData, ['--capture=b.png'], { waitMs: 3000 })]);
    assert.equal(a.ok, true);
    assert.equal(a.handled, true);
    assert.equal(b.ok, true);
    assert.equal(got.length, 2);
    assert.deepEqual(got.find((g) => g.argv[0] === '--diagnostics=a.json')?.cwd, '/x');
    assert.equal(control.readInfo(userData)?.pid, process.pid);

    // Garbage gets an answer, not a hang.
    const where = control.readInfo(userData)?.endpoint;
    assert.ok(where);
    const garbage = await new Promise<string>((resolve) => {
      const s = net.connect(where);
      let text = '';
      s.on('data', (c: Buffer) => (text += String(c)));
      s.on('close', () => resolve(text));
      s.write('not json\n');
    });
    assert.equal((JSON.parse(garbage) as { ok: boolean }).ok, false);

    // The scripts' own client (scripts/control.ts, built to scripts/control.cjs) speaks the same protocol.
    const fromScript = await scriptClient.send(userData, ['--quit'], { waitMs: 3000 });
    assert.equal(fromScript.ok, true);
    assert.deepEqual(got.at(-1)?.argv, ['--quit']);

    channel?.close();
    assert.equal(control.readInfo(userData), null);
    assert.equal((await scriptClient.send(userData, ['--quit'], { waitMs: 0 })).answered, false);
    const after = await control.send(userData, ['--quit'], { waitMs: 0 });
    assert.equal(after.answered, false);
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
