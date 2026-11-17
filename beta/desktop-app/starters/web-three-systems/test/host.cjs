// A small host for the adapter, standing in for the app's main process in the
// test that ends it abruptly (premium-bar rule 57). It writes a job record the
// way electron/tool/index.cjs does, starts one job with the stand-in, prints
// every event as a JSON line, and never ends the tool itself: the test kills
// this process and looks at what is left.
//
//   node host.cjs <sandbox folder>
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createAdapter } = require('../electron/tool/adapter.cjs');
const { createJobRecords, newJobId } = require('../electron/tool/jobs.cjs');
const { STAGING_NAME } = require('../electron/tool/contract.cjs');
const { sandboxAt } = require('./helpers.cjs');

const [dir] = process.argv.slice(2);
const box = sandboxAt(dir, JSON.parse(fs.readFileSync(path.join(dir, 'standin.json'), 'utf8')));
fs.mkdirSync(box.dataDir, { recursive: true });
const folder = path.join(dir, 'out');
fs.mkdirSync(folder, { recursive: true });
const records = createJobRecords(path.join(box.dataDir, 'jobs'), STAGING_NAME);
const jobId = newJobId();
const record = { jobId, folder, staging: null };
records.write(record);

const adapter = createAdapter({ located: box.located, cwd: box.dataDir });
adapter
  .run(['-o', path.join(folder, 'example.txt')], {
    onEvent: (event) => {
      if (event.type === 'stage' && event.staging) records.write({ ...record, staging: event.staging });
      process.stdout.write(`${JSON.stringify(event)}\n`);
    },
  })
  .then((outcome) => {
    records.remove(jobId);
    process.stdout.write(`${JSON.stringify({ type: 'host-outcome', outcome })}\n`);
  });
