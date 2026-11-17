// The job record: written before the tool starts, updated with the staging
// folder's name when the tool reports it, removed at the terminal event. A
// record found at the next launch names what a killed run left behind.
//
// Why it exists (build 2, test/host-kill.test.cjs): when the app is killed,
// what happens to its tool differs per system. On Windows the tool dies at once
// with the app (libuv keeps its direct children in a kill-on-close job object),
// so it never removes its own staging folder. On macOS and Linux the tool sees
// its stdin close, stops and cleans up by itself. The record covers the one case
// the tool cannot: its own hard kill.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {string} dir         the folder for records (in the app's data folder)
 * @param {RegExp} stagingName what a staging folder the tool makes is called; nothing else is ever removed
 */
function createJobRecords(dir, stagingName) {
  const fileOf = (jobId) => path.join(dir, `${jobId}.json`);

  function write(record) {
    fs.mkdirSync(dir, { recursive: true });
    const file = fileOf(record.jobId);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(record));
    fs.renameSync(`${file}.tmp`, file);
  }

  function remove(jobId) {
    fs.rmSync(fileOf(jobId), { force: true });
  }

  /** Remove a staging folder, but only one whose name matches and that sits directly in `folder`. */
  function removeStaging(folder, name) {
    if (typeof folder !== 'string' || typeof name !== 'string' || !stagingName.test(name)) return false;
    const target = path.join(path.resolve(folder), name);
    if (path.dirname(target) !== path.resolve(folder)) return false;
    try {
      if (!fs.lstatSync(target).isDirectory()) return false;
    } catch {
      return false;
    }
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  }

  /** At launch: every record left behind names a staging folder to remove. `current` is a job id of this run, if any. */
  function reconcile(current = null) {
    const report = { records: 0, removed: 0 };
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return report;
    }
    for (const name of names) {
      if (!name.endsWith('.json') || (current && name === `${current}.json`)) continue;
      const file = path.join(dir, name);
      report.records += 1;
      try {
        const record = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (removeStaging(record.folder, record.staging)) report.removed += 1;
      } catch {
        // An unreadable record names nothing to remove.
      }
      fs.rmSync(file, { force: true });
    }
    return report;
  }

  return { write, remove, removeStaging, reconcile };
}

const newJobId = () => `j_${crypto.randomBytes(9).toString('hex')}`;

module.exports = { createJobRecords, newJobId };
