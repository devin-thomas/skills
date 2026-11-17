// Windows: idle memory of the development app, per process, with or without extra switches.
// Build 2 found its one kept change with this script: the network service in the main process
// (electron/main.cjs, NETWORK_SERVICE_IN_PROCESS), 306.8 MB over 4 processes to 238.0 MB over 3.
//
// Starts the app through scripts/lib/launch.mjs, unfocused (--no-activate) with an empty, throwaway
// data folder, the window at --bounds if given, muted; leaves it alone for --idle seconds without
// asking it anything (asking changes
// the figure); then reads private bytes of every process in its tree from outside, with each
// process's kind from its command line; then asks it to quit through the control channel. A
// foreground sampler (measure/foreground-sampler.ps1) runs the whole time and the run fails if
// the app's window ever comes to the front.
//
//   node measure/memory-experiment.mjs --work <folder> --label <name> [--idle 300]
//        [--bounds x,y,width,height] [--env NAME=value] [--out <file.jsonl>] [-- <extra switches for the app>]
//
// One run changes one thing from the baseline. A switch is kept only if it lowers the idle
// figure, changes nothing a person notices, and every check still passes (the skill's
// references/measurement.md has build 2's runs, including the ones that did not help).
//
// Appends one JSON line per run to --out (default measure/out/memory/windows.jsonl).
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { electronBinary, launchDev, root } from '../scripts/lib/launch.mjs';
const argv = process.argv.slice(2);
const split = argv.indexOf('--');
const own = split === -1 ? argv : argv.slice(0, split);
const extra = split === -1 ? [] : argv.slice(split + 1);
const opt = (name, fallback) => {
  const i = own.indexOf(`--${name}`);
  return i === -1 ? fallback : own[i + 1];
};
if (process.platform !== 'win32') throw new Error('Windows only; on macOS and Linux use measure/shell-evidence.mjs --idle 300, which reads the tree with scripts/memory-tree.*');
const work = resolve(opt('work') ?? (() => { throw new Error('--work <folder> is required'); })());
const label = opt('label', extra.join(' ') || 'baseline');
const idle = Number(opt('idle', '300'));
const bounds = opt('bounds', null)?.split(',').map(Number) ?? null;
const outFile = resolve(opt('out', join(root, 'measure', 'out', 'memory', 'windows.jsonl')));
const electron = electronBinary();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dataDir = join(work, 'data');

rmSync(work, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
mkdirSync(dirname(outFile), { recursive: true });
if (bounds) writeFileSync(join(dataDir, 'window.json'), JSON.stringify({ bounds: { x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3] } }));

const fgLog = join(work, 'foreground.jsonl');
const stopFile = join(work, 'stop-sampler');
spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'measure', 'foreground-sampler.ps1'), '-Out', fgLog, '-StopFile', stopFile, '-Seconds', String(idle + 180)], { stdio: 'ignore', windowsHide: true });
for (let i = 0; i < 50 && !existsSync(fgLog); i++) await sleep(100);
const stolen = () =>
  existsSync(fgLog)
    ? readFileSync(fgLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((s) => s.path && s.path.toLowerCase() === electron.toLowerCase())
    : [];

const reveal = join(work, 'reveal.json');
// --env NAME=value (repeatable): set in the app's environment for this run.
const envExtra = Object.fromEntries(own.flatMap((a, i) => (a === '--env' ? [own[i + 1].split(/=(.*)/s).slice(0, 2)] : [])));
// launchDev runs the shell check first, passes --no-activate and the data folder, and quits the
// app through its control channel (then by its exact id) when the time limit passes.
const app = launchDev({ args: ['--mute-audio', `--reveal-record=${reveal}`, ...extra], dataDir, timeoutMs: (idle + 150) * 1000, env: envExtra });
let exited = null;
void app.exited.then((e) => (exited = e));
const started = Date.now();

async function quit() {
  if (exited) return;
  await app.stop();
  if (exited?.signal || (await app.exited).signal) console.error(`the app (${app.pid}, started by this run) did not end when asked; ended by its id`);
}

/** Private bytes and kind of every process under `rootPid`, read from outside. */
function measureTree(rootPid) {
  const ps = `
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, CommandLine, ThreadCount
$ids = [System.Collections.Generic.List[int]]::new(); $ids.Add(${rootPid})
for ($i = 0; $i -lt $ids.Count; $i++) { $all | Where-Object { $_.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$_.ProcessId) } | ForEach-Object { $ids.Add([int]$_.ProcessId) } }
@($ids | ForEach-Object { $id = $_; $p = Get-Process -Id $id -ErrorAction SilentlyContinue; $c = $all | Where-Object { $_.ProcessId -eq $id }
  if ($p) { [pscustomobject]@{ pid = $id; privateMB = [math]::Round($p.PrivateMemorySize64 / 1MB, 1); workingSetMB = [math]::Round($p.WorkingSet64 / 1MB, 1); threads = $c.ThreadCount; commandLine = $c.CommandLine } } }) | ConvertTo-Json -Depth 3 -Compress`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const rows = [].concat(JSON.parse(r.stdout));
  return rows.map((p) => {
    const cl = p.commandLine ?? '';
    const type = /--type=([a-z-]+)/.exec(cl)?.[1] ?? 'browser (main)';
    const sub = /--utility-sub-type=([\w.]+)/.exec(cl)?.[1];
    return { pid: p.pid, kind: sub ? `${type} ${sub}` : type, privateMB: p.privateMB, workingSetMB: p.workingSetMB, threads: p.threads };
  });
}

for (let i = 0; i < 200 && !existsSync(reveal) && !exited; i++) await sleep(100);
const shown = existsSync(reveal) ? JSON.parse(readFileSync(reveal, 'utf8')) : null;
if (!shown) {
  console.error('the app did not show its window', exited);
  await quit();
  process.exit(1);
}
console.log(`${label}: shown (${shown.reveal.call}); idle ${idle} s`);
while (Date.now() - started < idle * 1000) {
  await sleep(1000);
  if (stolen().length) break;
}
const detail = stolen().length ? [] : measureTree(shown.pid);
const total = Math.round(detail.reduce((s, p) => s + p.privateMB, 0) * 10) / 10;
await quit();
writeFileSync(stopFile, '');
await sleep(300);
const took = stolen();
const row = { at: new Date().toISOString(), label, switches: extra, env: envExtra, idleSeconds: idle, processes: detail.length, privateMB: total, detail, foregroundTaken: took.length, quit: exited };
appendFileSync(outFile, `${JSON.stringify(row)}\n`);
console.log(`${label}: ${total} MB over ${detail.length} processes`);
for (const p of detail) console.log(`  ${String(p.privateMB).padStart(7)} MB  ${p.kind}  (threads ${p.threads})`);
if (took.length) console.log(`FAILED: the app took the foreground ${took.length} time(s)`);
rmSync(work, { recursive: true, force: true });
process.exit(took.length ? 1 : 0);
