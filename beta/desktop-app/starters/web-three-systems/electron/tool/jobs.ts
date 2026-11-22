// The job record: written before the tool starts, updated with the staging
// folder's name when the tool reports it, removed at the terminal event. A
// record found at the next launch names what a killed run left behind.
//
// Why it exists (build 2, test/host-kill.test.ts): when the app is killed,
// what happens to its tool differs per system. On Windows the tool dies at once
// with the app (libuv keeps its direct children in a kill-on-close job object),
// so it never removes its own staging folder. On macOS and Linux the tool sees
// its stdin close, stops and cleans up by itself. The record covers the one case
// the tool cannot: its own hard kill.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface JobRecord {
  jobId: string;
  folder: string;
  staging: string | null;
  startedAt: string;
}

/**
 * @param dir          the folder for records (in the app's data folder)
 * @param stagingName  what a staging folder the tool makes is called; nothing else is ever removed
 */
export function createJobRecords(dir: string, stagingName: RegExp) {
  const fileOf = (jobId: string) => path.join(dir, `${jobId}.json`);

  function write(record: JobRecord): void {
    fs.mkdirSync(dir, { recursive: true });
    const file = fileOf(record.jobId);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(record));
    fs.renameSync(`${file}.tmp`, file);
  }

  function remove(jobId: string): void {
    fs.rmSync(fileOf(jobId), { force: true });
  }

  /** Remove a staging folder, but only one whose name matches and that sits directly in `folder`. */
  function removeStaging(folder: unknown, name: unknown): boolean {
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
  function reconcile(current: string | null = null): { records: number; removed: number } {
    const report = { records: 0, removed: 0 };
    let names: string[] = [];
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
        const record = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Record<'folder' | 'staging', unknown>>;
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

export type JobRecords = ReturnType<typeof createJobRecords>;

export const newJobId = (): string => `j_${crypto.randomBytes(9).toString('hex')}`;
