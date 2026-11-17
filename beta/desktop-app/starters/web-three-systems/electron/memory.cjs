// Private memory of the running app, by the definition that is right for the
// system, from inside the app. This is what --diagnostics reports. The scripts
// in scripts/memory-tree.* measure the same thing from outside and print the
// same shape; use those when the app cannot be asked.
//
// Definitions (Chromium's own "private footprint", research report 10):
//   Windows  private bytes
//   macOS    phys_footprint, read with /usr/bin/footprint
//   Linux    anonymous resident memory plus swap (Anonymous + Swap in smaps_rollup)
'use strict';

const { execFile } = require('node:child_process');
const fs = require('node:fs');
const { SYSTEM } = require('./platform.cjs');

const MB = 1024 * 1024;
const round = (bytes) => Math.round((bytes / MB) * 10) / 10;

const run = (file, args) =>
  new Promise((resolve) => {
    execFile(file, args, { timeout: 15_000, maxBuffer: 8 * MB }, (error, stdout) => resolve({ error, stdout: String(stdout) }));
  });

/** The process ids of `root` and everything it started, from a list of [pid, parent] pairs. */
function descendants(root, pairs) {
  const ids = [root];
  for (let i = 0; i < ids.length; i++) for (const [pid, parent] of pairs) if (parent === ids[i] && !ids.includes(pid)) ids.push(pid);
  return ids;
}

async function windows(app) {
  // Electron's own processes. Programs the app starts (its bundled tool) are not in
  // this list: scripts/memory-tree.ps1 walks the whole tree from outside.
  const detail = app.getAppMetrics().map((m) => ({ pid: m.pid, name: m.type, privateMB: round((m.memory.privateBytes ?? 0) * 1024), residentMB: round(m.memory.workingSetSize * 1024) }));
  return { definition: 'private bytes', scope: 'the processes Electron started', detail };
}

async function macos(root) {
  const ps = await run('/bin/ps', ['-axo', 'pid=,ppid=']);
  const pairs = ps.stdout.split('\n').map((line) => line.trim().split(/\s+/).map(Number)).filter((p) => p.length === 2);
  const ids = descendants(root, pairs);
  const out = await run('/usr/bin/footprint', ['-f', 'bytes', '--noCategories', ...ids.flatMap((id) => ['--pid', String(id)])]);
  const detail = [...out.stdout.matchAll(/^(.+) \[(\d+)\]: .*Footprint: (\d+) B/gm)].map((m) => ({ pid: Number(m[2]), name: m[1].trim(), privateMB: round(Number(m[3])) }));
  const summary = out.stdout.match(/^Summary Footprint: (\d+) B/m);
  return { definition: 'phys_footprint', scope: 'the process tree', detail, totalBytes: summary ? Number(summary[1]) : null, error: detail.length ? null : String(out.error ?? 'footprint printed nothing') };
}

async function linux(root) {
  const pairs = [];
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${entry}/stat`, 'utf8');
      pairs.push([Number(entry), Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])]);
    } catch {
      // The process ended while we were reading.
    }
  }
  const detail = [];
  for (const pid of descendants(root, pairs)) {
    try {
      const rollup = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      const kb = (key) => Number((rollup.match(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm')) ?? [0, 0])[1]);
      const name = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
      detail.push({ pid, name, privateMB: round((kb('Anonymous') + kb('Swap')) * 1024), residentMB: round(kb('Rss') * 1024) });
    } catch (error) {
      detail.push({ pid, name: null, privateMB: 0, unreadable: error.code ?? String(error) });
    }
  }
  return { definition: 'anonymous resident memory plus swap', scope: 'the process tree', detail };
}

/** Sum over the running app, compared with the budget and ceiling in app.config.json. */
async function measure(app, config) {
  const root = process.pid;
  const part = SYSTEM === 'windows' ? await windows(app) : SYSTEM === 'macos' ? await macos(root) : await linux(root);
  const total = part.totalBytes != null ? round(part.totalBytes) : Math.round(part.detail.reduce((sum, p) => sum + p.privateMB, 0) * 10) / 10;
  const { budgetMB, ceilingMB } = config.memory;
  return {
    at: new Date().toISOString(),
    system: SYSTEM,
    definition: part.definition,
    scope: part.scope,
    root,
    processes: part.detail.length,
    privateMB: total,
    budgetMB,
    ceilingMB,
    withinBudget: total <= budgetMB,
    underCeiling: total <= ceilingMB,
    detail: part.detail,
    ...(part.error ? { error: part.error } : {}),
  };
}

module.exports = { measure };
