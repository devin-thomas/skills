// Premium-bar rule 57: ending the app's main process at any moment during a job
// leaves no tool process alive 2 s later, and what the tool could not clean up
// is removed at the next launch. test/host.cjs plays the main process; Electron
// is not needed for this, only a process that owns the tool and then dies.
//
// The systems differ, and the assertions say how (seen in build 2 on all three):
//   Windows        the tool dies with the app at once (libuv keeps its direct children in a
//                  kill-on-close job object), so it never gets to remove its staging folder.
//                  The job record the app wrote finds the folder at the next launch.
//   macOS, Linux   nothing ends the tool except the tool: it sees its stdin close, stops,
//                  removes its staging folder and exits. The record is still there at the
//                  next launch and names nothing that needs removing.
// Kill the tool in a test; do not reason about it. Build 2's research expected a closed
// pipe to end the tool's own child, and on every system it did not.
'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createJobRecords } = require('../electron/tool/jobs.cjs');
const { STAGING_NAME } = require('../electron/tool/contract.cjs');
const { sandbox, isAlive, stagingFolders, waitFor } = require('./helpers.cjs');

test('app killed while the tool is working: the tool is gone within 2 s and the next launch leaves nothing behind', async (t) => {
  const box = sandbox(t, { run: 'run-slow' });
  const host = spawn(process.execPath, [path.join(__dirname, 'host.cjs'), box.dir], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '';
  host.stderr.on('data', (c) => (stderr += c));
  let pending = '';
  const lines = [];
  host.stdout.on('data', (chunk) => {
    pending += chunk;
    let at;
    while ((at = pending.indexOf('\n')) !== -1) {
      lines.push(JSON.parse(pending.slice(0, at)));
      pending = pending.slice(at + 1);
    }
  });
  const working = await waitFor(() => lines.some((l) => l.type === 'progress' && l.done >= 10), 15_000);
  assert.equal(working, true, `the job never got going: ${stderr}`);
  host.kill('SIGKILL'); // Windows: TerminateProcess. Either way the host gets no chance to tidy up.
  const killedAt = Date.now();
  await new Promise((r) => host.on('exit', r));
  assert.equal(isAlive(host.pid), false);

  const gone = await waitFor(() => box.alive().length === 0, 2000);
  assert.equal(gone, true, `tool processes alive 2 s after the app was killed: ${box.alive().join(', ')}`);
  const took = Date.now() - killedAt;

  const outDir = path.join(box.dir, 'out');
  const left = stagingFolders(outDir);
  if (process.platform === 'win32') assert.equal(left.length, 1, 'on Windows the tool dies at once and leaves its staging folder');
  else assert.deepEqual(left, [], `on ${process.platform} the tool removes its own staging folder (took ${took} ms)`);

  // The next launch.
  const records = createJobRecords(path.join(box.dataDir, 'jobs'), STAGING_NAME);
  const report = records.reconcile();
  assert.deepEqual(report, { records: 1, removed: process.platform === 'win32' ? 1 : 0 });
  assert.deepEqual(stagingFolders(outDir), [], 'after the next launch: no staging folder');
  assert.equal(fs.existsSync(path.join(outDir, 'example.txt')), false, 'and no partial file');
  assert.deepEqual(fs.readdirSync(path.join(box.dataDir, 'jobs')), []);
});
