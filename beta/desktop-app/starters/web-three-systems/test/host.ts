// A small host for the adapter, standing in for the app's main process in the
// test that ends it abruptly (premium-bar rule 57). It writes a job record the
// way electron/tool/index.ts does, starts one job with the stand-in, prints
// every event as a JSON line, and never ends the tool itself: the test kills
// this process and looks at what is left.
//
//   node host.ts <sandbox folder>
import fs from 'node:fs';
import path from 'node:path';
import { createAdapter } from '../electron/tool/adapter.ts';
import { STAGING_NAME } from '../electron/tool/contract.ts';
import { createJobRecords, newJobId } from '../electron/tool/jobs.ts';
import { sandboxAt } from './helpers.ts';

const [dir] = process.argv.slice(2);
if (!dir) throw new Error('usage: node host.ts <sandbox folder>');
const box = sandboxAt(dir, JSON.parse(fs.readFileSync(path.join(dir, 'standin.json'), 'utf8')) as Record<string, unknown>);
fs.mkdirSync(box.dataDir, { recursive: true });
const folder = path.join(dir, 'out');
fs.mkdirSync(folder, { recursive: true });
const records = createJobRecords(path.join(box.dataDir, 'jobs'), STAGING_NAME);
const jobId = newJobId();
const record = { jobId, folder, staging: null, startedAt: new Date().toISOString() };
records.write(record);

const adapter = createAdapter({ located: box.located, cwd: box.dataDir });
void adapter
  .run(['-o', path.join(folder, 'example.txt')], {
    onEvent: (event) => {
      if (event.type === 'stage' && typeof event['staging'] === 'string') records.write({ ...record, staging: event['staging'] });
      process.stdout.write(`${JSON.stringify(event)}\n`);
    },
  })
  .then((outcome) => {
    records.remove(jobId);
    process.stdout.write(`${JSON.stringify({ type: 'host-outcome', outcome })}\n`);
  });
