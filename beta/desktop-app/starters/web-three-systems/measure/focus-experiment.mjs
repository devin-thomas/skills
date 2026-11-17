// Windows only: does a script's request to the running app ever bring its window to the front?
//
// Run it, with the owner's say-so that the machine is free, before claiming anything about focus
// on Windows: launches from an agent's own session cannot show the problem, because that session
// holds no right to the foreground. Build 2 (the media converter, 2026-11-15) found the cause with it:
// a visible console (Windows Terminal ignores a shortcut's Minimized setting and -WindowStyle
// Hidden) handed the foreground to an app that was entitled to it, and a second launch entitles the
// running app (Chromium's process singleton calls AllowSetForegroundWindow before any app code).
//
// Recreates what the installed check does, against the development app: the app is started
// unfocused (--no-activate) with a throwaway data folder, and then asked for
// its diagnostics and a picture several times, while a sampler records every change of the
// foreground window (measure/foreground-sampler.ps1). Each start and each request can be made
// from this script's own session, or handed to Explorer the way scripts\run-as-user.ps1 does
// (Explorer gives what it starts the right to set the foreground window, which a process started
// from an agent's session does not have). If the app's window ever becomes the foreground window
// the app is asked to quit at once and the run fails.
//
//   node measure/focus-experiment.mjs --work <folder> [--bounds x,y,width,height]
//        [--first explorer|session] [--route explorer|session] [--host shortcut|headless]
//        [--via control|exe] [--asks 3] [--gap 6] [--idle-before 8] [--limit 240]
//
//   --bounds  where the window opens (written to the data folder's window.json); put it on a
//             display nobody is looking at (on the owner's machine, the CRT)
//   --first   who starts the app (explorer: like the installed check's launch step)
//   --route   who makes each request
//   --host    how Explorer starts PowerShell: shortcut = a minimized shortcut to powershell.exe
//             (build 2's run-as-user.ps1 before the fix: expect a console flash); headless = a
//             shortcut to conhost.exe --headless powershell.exe (scripts\run-as-user.ps1 now)
//   --via     control = the control channel (scripts\control.ps1 from Explorer, the Node client from
//             here); exe = start the app's executable again with the flags, as build 2's checks did
//             before the fix; main.cjs now forwards them through the channel and ends, never
//             becoming a second instance
//
// The app is started through scripts/lib/launch.mjs from this session (--first session), or with
// the same arguments by a PowerShell that Explorer started (--first explorer, the one launch the
// starter makes outside launchDev, because that is the case under test). Either way the shell check
// runs first, --no-activate and a throwaway data folder are passed, there is a time limit, and the
// app is quit through its channel and then ended by its exact id if it has not ended.
//
// Writes <work>/summary.json and <work>/foreground.jsonl, and prints the summary.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkBeforeLaunch, control, electronBinary, launchArgs, launchDev, root } from '../scripts/lib/launch.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
if (process.platform !== 'win32') throw new Error('Windows only');
const work = resolve(opt('work') ?? (() => { throw new Error('--work <folder> is required'); })());
const bounds = opt('bounds', null)?.split(',').map(Number) ?? null;
const first = opt('first', 'explorer');
const route = opt('route', 'explorer');
const host = opt('host', 'headless');
const via = opt('via', 'control');
const asks = Number(opt('asks', '3'));
const gap = Number(opt('gap', '6'));
const idleBefore = Number(opt('idle-before', '8'));
const limitS = Number(opt('limit', '240'));
const electron = electronBinary(); // the absolute path of the development app's executable
const dataDir = join(work, 'data');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = { at: new Date().toISOString(), first, route, host, via, asks, electron, events: [], foreground: [], stolen: [] };
const event = (what, detail) => {
  const e = { t: new Date().toISOString(), what, ...(detail === undefined ? {} : { detail }) };
  summary.events.push(e);
  console.log(`${e.t} ${what}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
};

rmSync(work, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
if (bounds) writeFileSync(join(dataDir, 'window.json'), JSON.stringify({ bounds: { x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3] } }));

// Every main-process file must parse and keep to the focus rules before the app is started.
checkBeforeLaunch();

const fgLog = join(work, 'foreground.jsonl');
const stopFile = join(work, 'stop-sampler');
spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'measure', 'foreground-sampler.ps1'), '-Out', fgLog, '-StopFile', stopFile, '-Seconds', String(limitS + 60)], { stdio: 'ignore', windowsHide: true });
for (let i = 0; i < 50 && !existsSync(fgLog); i++) await sleep(100);

let seen = 0;
const ours = (s) => s.path && s.path.toLowerCase() === electron.toLowerCase();
function readForeground() {
  if (!existsSync(fgLog)) return [];
  const lines = readFileSync(fgLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const fresh = lines.slice(seen);
  seen = lines.length;
  for (const s of fresh) {
    if (s.end) continue;
    summary.foreground.push(s);
    console.log(`${s.t} foreground ${s.pid} ${s.path} '${s.title}'`);
    if (ours(s)) summary.stolen.push(s);
  }
  return fresh;
}

const appArgs = launchArgs(dataDir);
const psQuote = (s) => `'${s.replace(/'/g, "''")}'`;

/** Run a PowerShell script through Explorer, the way scripts\run-as-user.ps1 does, and wait for its done file. */
async function throughExplorer(name, body, waitS = 60) {
  const script = join(work, `${name}.ps1`);
  const done = join(work, `${name}.done`);
  writeFileSync(script, `${body}\nSet-Content -Path ${psQuote(done)} -Value (Get-Date -Format o)\n`);
  const lnk = join(work, `${name}.lnk`);
  const ps = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const psArgs = `-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${script}"`;
  const target = host === 'headless' ? join(process.env.SystemRoot, 'System32', 'conhost.exe') : ps;
  const targetArgs = host === 'headless' ? `--headless "${ps}" ${psArgs}` : psArgs;
  const make = `$s = New-Object -ComObject WScript.Shell; $l = $s.CreateShortcut(${psQuote(lnk)}); $l.TargetPath = ${psQuote(target)}; $l.Arguments = ${psQuote(targetArgs)}; $l.WorkingDirectory = ${psQuote(work)}; $l.WindowStyle = 7; $l.Save()`;
  spawnSync('powershell.exe', ['-NoProfile', '-Command', make], { windowsHide: true });
  event(`handed ${name} to Explorer (${host})`);
  spawn(join(process.env.SystemRoot, 'explorer.exe'), [lnk], { stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < waitS * 10 && !existsSync(done); i++) {
    await sleep(100);
    readForeground();
    if (summary.stolen.length) break;
  }
  event(`${name} ${existsSync(done) ? 'done' : 'not done'}`);
}

let appPid = null;
async function quit(reason) {
  event(`quitting (${reason})`);
  const r = await control.send(dataDir, ['--quit'], { waitMs: 0, timeoutMs: 15_000 });
  event('quit through the control channel', r);
  const asked = Date.now();
  // Electron 45 took 4 to 11 s on Windows from the JavaScript exit to the end of the main process
  // (build 2, the same through a second launch and through the channel).
  for (let i = 0; i < 300 && appPid && alive(appPid); i++) await sleep(100);
  if (appPid && !alive(appPid)) event(`the app ended ${Date.now() - asked} ms after it was asked to quit`);
  if (appPid && alive(appPid)) {
    event(`the app (${appPid}, started by this run) did not end; ended by its id`);
    process.kill(appPid);
  }
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const limit = setTimeout(async () => {
  event('time limit');
  await quit('time limit');
  finish();
}, limitS * 1000);

function finish() {
  clearTimeout(limit);
  writeFileSync(stopFile, '');
  readForeground();
  summary.terminalFlashes = summary.foreground.filter((s) => /WindowsTerminal\.exe$|conhost\.exe$|OpenConsole\.exe$/i.test(s.path ?? '')).length;
  summary.passed = summary.stolen.length === 0;
  writeFileSync(join(work, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`${summary.passed ? 'passed' : 'FAILED'}: the app's window ${summary.passed ? 'never' : `${summary.stolen.length} time(s)`} became the foreground window; console-host windows in front: ${summary.terminalFlashes}; ${work}`);
  process.exit(summary.passed ? 0 : 1);
}

readForeground();
const reveal = join(work, 'reveal.json');
const extra = ['--mute-audio', `--reveal-record=${reveal}`];
const launch = [...appArgs, ...extra];
if (first === 'explorer') {
  await throughExplorer('launch', `Start-Process -FilePath ${psQuote(electron)} -ArgumentList @(${launch.map((a) => psQuote(a.includes(' ') ? `"${a}"` : a)).join(', ')})`);
} else {
  launchDev({ args: extra, dataDir, timeoutMs: limitS * 1000 });
  event('started from this session (scripts/lib/launch.mjs)');
}
for (let i = 0; i < 200 && !existsSync(reveal); i++) await sleep(100);
const shown = existsSync(reveal) ? JSON.parse(readFileSync(reveal, 'utf8')) : null;
appPid = shown?.pid ?? null;
event('shown', shown);
if (!shown) {
  await quit('not shown');
  finish();
}

for (let i = 0; i < idleBefore * 10 && !summary.stolen.length; i++) {
  await sleep(100);
  readForeground();
}
for (let n = 1; n <= asks && !summary.stolen.length; n++) {
  const diag = join(work, `diagnostics-${n}.json`);
  const shot = join(work, `capture-${n}.png`);
  const flags = [`--diagnostics=${diag}`, `--capture=${shot}`];
  if (route === 'explorer') {
    const body =
      via === 'control'
        ? `& ${psQuote(join(root, 'scripts', 'control.ps1'))} -DataDir ${psQuote(dataDir)} -Arguments @(${flags.map(psQuote).join(', ')}) | Set-Content -Path ${psQuote(join(work, `reply-${n}.json`))}`
        : `Start-Process -FilePath ${psQuote(electron)} -ArgumentList @(${[...appArgs, ...flags].map((a) => psQuote(a.includes(' ') ? `"${a}"` : a)).join(', ')}) -Wait`;
    await throughExplorer(`ask-${n}`, body);
  } else if (via === 'control') {
    event(`ask ${n} through the control channel`, await control.send(dataDir, flags, { waitMs: 10_000 }));
  } else {
    spawnSync(electron, [...appArgs, ...flags], { stdio: 'ignore', timeout: 30_000 });
    event(`ask ${n} by starting the executable from this session`);
  }
  const d = existsSync(diag) ? JSON.parse(readFileSync(diag, 'utf8')) : null;
  event(`ask ${n}: diagnostics ${d ? 'written' : 'missing'}`, d ? { focused: d.window?.focused, secondLaunches: d.shell?.lifecycle?.secondLaunches, controlRequests: d.shell?.lifecycle?.controlRequests } : undefined);
  for (let i = 0; i < gap * 10 && !summary.stolen.length; i++) {
    await sleep(100);
    readForeground();
  }
}
if (summary.stolen.length) event('THE APP TOOK THE FOREGROUND', summary.stolen);
await quit(summary.stolen.length ? 'it took the foreground' : 'done');
await sleep(500);
finish();
