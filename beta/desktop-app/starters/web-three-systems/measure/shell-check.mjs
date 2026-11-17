// Checks the shell's rules without starting the app. Run with: pnpm shell:check
// scripts/lib/launch.mjs runs it before every launch, so a failure here means
// no window opens.
//
//   1. Only electron/platform.cjs asks which system this is (premium-bar rule 82).
//   2. The macOS menu carries every command in shortcuts.json with the same keys,
//      and nothing that is not there.
//   3. No key the shell takes for itself is a key the page's table uses, on any system.
//   4. Traffic lights are centred for the bar heights the system itself uses and for this app's.
//   5. Focus: every call in the main process that can show, raise, activate or focus a window,
//      or open a dialog (which takes focus), is one of the reviewed places below, each of which
//      honours --no-activate. A new one fails this check until it is reviewed and listed.
//   6. Every main-process file parses (node --check): Electron answers a file that does not
//      load with a modal error box, which takes focus.
//   7. Scripts start the app only through scripts/lib/launch.mjs (absolute paths, this check
//      first, --no-activate, a throwaway data folder, a time limit). measure/shell-evidence.mjs
//      keeps its own launch under the same rules; measure/run.py is Windows-only (PresentMon).
//   8. No script reaches the running app through a second instance (see the rule below).
//   9. The network service runs in the main process only while the page makes no network request.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (file) => readFileSync(join(root, file), 'utf8');
const problems = [];
const ok = (condition, message) => {
  if (!condition) problems.push(message);
};

const mainFiles = [
  ...readdirSync(join(root, 'electron')).filter((f) => f.endsWith('.cjs')),
  ...readdirSync(join(root, 'electron', 'tool')).filter((f) => f.endsWith('.cjs')).map((f) => `tool/${f}`),
];

// 6 first: a file that does not parse makes the rest meaningless.
for (const file of mainFiles) {
  const result = spawnSync(process.execPath, ['--check', join(root, 'electron', file)], { encoding: 'utf8' });
  ok(result.status === 0, `electron/${file} does not parse: ${result.stderr.split('\n').slice(0, 5).join(' ')}`);
}

// 1. One place asks about the system. The adapter's plain-Node modules (electron/tool/*.cjs
// other than index.cjs) take the system as an argument so the tests can play any system;
// their default is the one exception. index.cjs, which touches Electron, is held to the rule.
for (const file of [...mainFiles.filter((f) => !f.startsWith('tool/')), 'tool/index.cjs']) {
  if (file === 'platform.cjs') continue;
  const hits = read(join('electron', file)).split('\n').filter((line) => /process\.platform|os\.platform\(\)|os\.type\(\)/.test(line) && !/^\s*\/\//.test(line));
  ok(hits.length === 0, `electron/${file} asks which system this is (${hits.length} place${hits.length === 1 ? '' : 's'}); only platform.cjs may`);
}

// 5. Focus. Each entry: a file, a piece of the line, and why it never takes focus under --no-activate.
const FOCUS_ALLOWED = [
  { file: 'window.cjs', line: 'platform.show(win, app, inactive)', why: 'the first show: showInactive when the launch asked for no focus' },
  { file: 'shell.cjs', line: 'platform.show(win, app, true)', why: 'a control request, or a second launch with --no-activate: showInactive, which also brings back a minimized window without activating it' },
  { file: 'shell.cjs', line: 'if (win.isMinimized()) win.restore();', why: 'showWindow, only on the branch for a launch that did not ask for no focus' },
  { file: 'shell.cjs', line: 'win.show();', why: 'showWindow, only on the branch for a launch that did not ask for no focus' },
  { file: 'shell.cjs', line: 'win.focus();', why: 'showWindow, only on the branch for a launch that did not ask for no focus' },
  { file: 'shell.cjs', line: '&& !quiet()) win.restore()', why: 'macOS open-file: restores a window put in the Dock only when the last launch did not ask for no focus' },
  { file: 'shell.cjs', line: 'platform.show(win, app, quiet())', why: "macOS activate: follows the last launch's request" },
  { file: 'tool/index.cjs', line: 'dialog.showMessageBox(', why: 'the quit question while a job runs; confirmQuitDuringJob answers a quiet request without it' },
  { file: 'qa.cjs', line: 'win.webContents.focus()', why: 'development only (--qa-typing): the typing test needs keyboard focus in the page, not the window' },
  { file: 'qa.cjs', line: 'el.focus()', why: 'page script, development only: focus inside the page, not the window' },
];
const FOCUS_CALL = /\.(show|focus|restore|moveTop|showInactive|blurWebView|setAlwaysOnTop)\(|show(Open|Save)Dialog|showMessageBox|showErrorBox|app\.focus\(|activateIgnoringOtherApps/;
for (const file of mainFiles) {
  read(join('electron', file)).split('\n').forEach((text, i) => {
    if (/^\s*(\/\/|\*)/.test(text) || !FOCUS_CALL.test(text)) return;
    const allowed = FOCUS_ALLOWED.find((a) => a.file === file && text.includes(a.line));
    ok(allowed, `electron/${file}:${i + 1} can take focus and is not a reviewed place: ${text.trim()} (see FOCUS_ALLOWED in measure/shell-check.mjs)`);
  });
}

// 2. The menu against the shortcut table.
const table = JSON.parse(read('shortcuts.json')).commands;
const ids = Object.keys(table);
const menu = require(join(root, 'electron', 'menu.cjs'));
const inMenu = new Map();
const walk = (entries) => {
  for (const entry of entries) {
    if (entry.submenu) walk(entry.submenu);
    if (entry.command) {
      if (!inMenu.has(entry.command)) inMenu.set(entry.command, []);
      inMenu.get(entry.command).push(entry.accelerator ?? null);
    }
  }
};
walk(menu.template('App'));
for (const id of ids) ok(inMenu.has(id), `command "${id}" is in shortcuts.json but not in the macOS menu`);
for (const id of inMenu.keys()) ok(ids.includes(id), `the macOS menu has "${id}", which is not a command in shortcuts.json`);
for (const entry of menu.dockTemplate()) ok(ids.includes(entry.command), `the Dock menu has "${entry.command}", which is not a command in shortcuts.json`);
for (const [id, accelerators] of inMenu) {
  for (const a of accelerators) ok(a === (menu.KEYS[id] ?? null), `the macOS menu shows ${a} for "${id}" but the table gives ${menu.KEYS[id] ?? 'none'}`);
}

// 3. Keys the shell takes for itself against every key the page's table uses.
const normal = (keys) => keys.split('+').map((p) => (p.length === 1 ? p.toUpperCase() : p)).sort().join('+');
const pageKeys = new Set();
for (const chord of Object.values(table)) {
  if (!chord) continue;
  const key = chord.key.length === 1 ? chord.key.toUpperCase() : chord.key;
  pageKeys.add(normal([...(chord.mod ? ['Control'] : []), ...(chord.shift ? ['Shift'] : []), ...(chord.alt ? ['Alt'] : []), key].join('+')));
  pageKeys.add(normal([...(chord.mod ? ['Command'] : []), ...(chord.shift ? ['Shift'] : []), ...(chord.alt ? ['Alt'] : []), key].join('+')));
}
// The facts for all three systems, read from the source: this script runs on one of them.
const shellKeys = [...read('electron/platform.cjs').matchAll(/keys: '([^']+)', does: '([^']+)'/g)].map((m) => ({ keys: m[1], does: m[2] }));
ok(shellKeys.length >= 6, 'could not read the shell keys from electron/platform.cjs');
for (const { keys, does } of shellKeys) ok(!pageKeys.has(normal(keys.replace('Option', 'Alt'))), `the shell takes ${keys} (${does}), which the page's shortcut table also uses`);
for (const keys of ['Command+Q', 'Command+W', 'Command+M', 'Command+H', 'Command+X', 'Command+C', 'Command+V', 'Command+A', 'Command+Z', 'Command+Shift+Z']) {
  ok(!pageKeys.has(normal(keys)), `the macOS menu's system roles take ${keys}, which the page's shortcut table also uses`);
}

// 4. Traffic lights.
const platform = require(join(root, 'electron', 'platform.cjs'));
const config = JSON.parse(read('app.config.json'));
for (const [bar, want] of [[32, { x: 9, y: 9 }], [40, { x: 12, y: 13 }], [52, { x: 19, y: 19 }]]) {
  const got = platform.trafficLights(bar);
  ok(got.x === want.x && got.y === want.y, `traffic lights for a ${bar} pt bar are at (${got.x}, ${got.y}), the system's are at (${want.x}, ${want.y})`);
}
for (const bar of new Set([config.titleBarHeight, config.macTitleBarHeight ?? config.titleBarHeight])) {
  const got = platform.trafficLights(bar);
  ok(Math.abs(got.y + 7 - bar / 2) <= 0.5, `traffic lights are not centred in this app's ${bar} pt bar: top at ${got.y}`);
}

// 7. Launches go through scripts/lib/launch.mjs.
const LAUNCH_OWNERS = new Set(['scripts/lib/launch.mjs', 'measure/shell-evidence.mjs', 'measure/shell-check.mjs']);
for (const dir of ['qa', 'measure', 'scripts']) {
  for (const file of readdirSync(join(root, dir)).filter((f) => /\.(mjs|cjs|js)$/.test(f))) {
    const rel = `${dir}/${file}`;
    if (LAUNCH_OWNERS.has(rel)) continue;
    const text = read(rel);
    ok(!/require\(['"]electron['"]\)|['"]electron['"],\s*['"]dist['"]|electron\.exe/.test(text), `${rel} starts Electron itself; use launchDev from scripts/lib/launch.mjs`);
  }
}

// 8. No script reaches the running app through a second instance. A second instance is let in
// by Chromium's process singleton, which on Windows hands the running app the right to take the
// foreground before any of the app's code runs (electron/control.cjs). So: (a) in main.cjs the
// single-instance lock is asked for only inside start(), and a command launch never calls
// start(); (b) every flag that acts on the running app is a command flag in control.cjs;
// (c) no script starts the app's executable with a command flag on the same line: commands go
// through the control channel (ask() in scripts/lib/launch.mjs, control.send, scripts/control.cjs,
// scripts/control.ps1).
let scriptCount = 0;
{
  const control = require(join(root, 'electron', 'control.cjs'));
  const code = read('electron/main.cjs').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
  const locks = [...code.matchAll(/requestSingleInstanceLock\(/g)].length;
  const startBody = code.slice(code.indexOf('function start()'), code.indexOf('\n}\n', code.indexOf('function start()')));
  ok(locks === 1 && startBody.includes('requestSingleInstanceLock('), `electron/main.cjs must ask for the single-instance lock exactly once, inside start() (found ${locks})`);
  const commandBranch = code.match(/if \(launchKind === 'command'\) \{([^}]*)\}/);
  ok(commandBranch && !/start\(\)/.test(commandBranch[1]) && /forward\(/.test(commandBranch[1]), 'electron/main.cjs: a command launch must be forwarded through the channel and must never call start()');
  const firstUse = code.indexOf("launchKind === 'command'");
  ok(firstUse !== -1 && code.indexOf('start();', firstUse) > firstUse, 'electron/main.cjs: start() is called only after the command branch');
  // (b) The flags the shell acts on, read from the source, are all command flags.
  const acted = new Set();
  for (const file of ['electron/main.cjs', 'electron/shell.cjs']) {
    for (const m of read(file).matchAll(/\b(?:arg|has)\('([a-z-]+)', argv\)/g)) acted.add(m[1]);
  }
  ok(acted.size >= 8, `could not read the flags the shell acts on (found ${acted.size})`);
  for (const name of acted) {
    if (name === 'no-activate') continue;
    ok(control.isCommandFlag(`--${name}`) || control.isCommandFlag(`--${name}=x`), `--${name} acts on the running app but is not a command flag in electron/control.cjs`);
  }
  // (c) Scripts, in every folder that holds them.
  const scriptFiles = [];
  const walkDir = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!['out', 'evidence', 'data', 'node_modules'].includes(entry.name)) walkDir(rel);
      } else if (/\.(mjs|cjs|js|ps1|sh)$/.test(entry.name)) scriptFiles.push(rel);
    }
  };
  for (const dir of ['measure', 'qa', 'scripts', 'test']) walkDir(dir);
  scriptCount = scriptFiles.length;
  const startsApp = /spawn(Sync)?\((electron|electronBinary\(\))|execFile(Sync)?\(electron|Start-Process -FilePath \$exe|"\$electron"|"\$BIN" "\$@"/;
  const commandLiteral = new RegExp(`--(${control.COMMAND_FLAGS.map((f) => f.replace('=', '')).join('|')})\\b`);
  for (const file of scriptFiles) {
    if (file === 'measure/focus-experiment.mjs') continue; // --via exe starts the executable with commands on purpose, to prove it forwards them
    read(file).split('\n').forEach((text, i) => {
      if (startsApp.test(text) && commandLiteral.test(text)) ok(false, `${file}:${i + 1} starts the app's executable with a command: send it through the control channel instead: ${text.trim()}`);
    });
  }
  ok(scriptFiles.length > 20, 'could not list the scripts');
}

// 9. The network service in the main process (NETWORK_SERVICE_IN_PROCESS in main.cjs) is only for
// a page that makes no network request: the page's Content-Security-Policy must say connect-src 'none'.
{
  const mainSource = read('electron/main.cjs');
  const inProcess = /const NETWORK_SERVICE_IN_PROCESS = true;/.test(mainSource);
  const csp = mainSource.match(/'Content-Security-Policy',\s*"([^"]+)"/)?.[1] ?? '';
  ok(csp, 'could not read the Content-Security-Policy from electron/main.cjs');
  if (inProcess) ok(/connect-src 'none'/.test(csp), "electron/main.cjs runs the network service in the main process, but the page's Content-Security-Policy allows network requests: set NETWORK_SERVICE_IN_PROCESS to false or keep connect-src 'none'");
}

if (problems.length) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}
console.log(`shell check passed: ${ids.length} commands in the macOS menu with the table's keys, ${shellKeys.length} shell keys clear of the page's keys, ${mainFiles.length} main-process files parse and take focus only in the ${FOCUS_ALLOWED.length} reviewed places, launches go through scripts/lib/launch.mjs, none of ${scriptCount} scripts reaches the app through a second instance, the network service runs in the main process only with connect-src 'none'`);
