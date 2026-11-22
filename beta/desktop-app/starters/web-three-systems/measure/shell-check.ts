// Checks the shell's rules without starting the app. Run with: pnpm shell:check
// scripts/lib/launch.ts runs it (after building the main process) before every launch, so a
// failure here means no window opens. The rules read the main process's TypeScript sources in
// electron/ by file name and pattern, and the bundle built from them in dist/electron/.
//
//   1. Only electron/platform.ts asks which system this is (premium-bar rule 82).
//   2. The macOS menu carries every command in shortcuts.json with the same keys,
//      and nothing that is not there.
//   3. No key the shell takes for itself is a key the page's table uses, on any system.
//   4. Traffic lights are centred for the bar heights the system itself uses and for this app's.
//   5. Focus: every call in the main process that can show, raise, activate or focus a window,
//      or open a dialog (which takes focus), is one of the reviewed places below, each of which
//      honours --no-activate. A new one fails this check until it is reviewed and listed.
//   6. Every main-process source parses (scripts/lib/syntax.ts), and so does each built file in
//      dist/electron/, whose first statement is the no-dialog handler (electron/no-dialog.ts):
//      Electron answers a file that does not load with a modal error box, which takes focus.
//   7. Scripts start the app only through scripts/lib/launch.ts (absolute paths, the build and
//      this check first, --no-activate, a throwaway data folder, a time limit).
//      measure/shell-evidence.ts keeps its own launch under the same rules; measure/run.py is
//      Windows-only (PresentMon).
//   8. No script reaches the running app through a second instance (see the rule below).
//   9. The network service runs in the main process only while the page makes no network request.
//  10. The packaged app leaves out the development-only test instrumentation.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from '../scripts/lib/root.ts';

const read = (file: string) => readFileSync(join(root, file), 'utf8');
const problems: string[] = [];
const ok = (condition: unknown, message: string): void => {
  if (!condition) problems.push(message);
};

const mainFiles = [
  ...readdirSync(join(root, 'electron')).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts')),
  ...readdirSync(join(root, 'electron', 'tool'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((f) => `tool/${f}`),
];
ok(mainFiles.includes('main.ts') && mainFiles.includes('platform.ts') && mainFiles.length >= 15, `could not list the main-process sources (found ${mainFiles.length})`);

// 6 first: a file that does not parse makes the rest meaningless. `node --check` alone passes a
// broken ES-module .ts file, so scripts/lib/syntax.ts strips the types first.
{
  const result = spawnSync(process.execPath, ['--no-warnings', join(root, 'scripts', 'lib', 'syntax.ts'), ...mainFiles.map((f) => join(root, 'electron', f))], { encoding: 'utf8' });
  for (const line of result.stdout.split('\n').filter(Boolean)) ok(false, `${line} (does not parse)`);
  ok(result.status === 0 || result.stdout.trim(), `could not check that the main-process sources parse: ${result.stderr.split('\n')[0]}`);
}
// The built files, when there are any (scripts/lib/launch.ts builds them before it runs this).
const BUILT = ['main.mjs', 'preload.cjs', 'qa.mjs'];
const built = BUILT.filter((f) => existsSync(join(root, 'dist', 'electron', f)));
for (const file of built) {
  const result = spawnSync(process.execPath, ['--check', join(root, 'dist', 'electron', file)], { encoding: 'utf8' });
  ok(result.status === 0, `dist/electron/${file} does not parse: ${result.stderr.split('\n').slice(0, 5).join(' ')}`);
}
if (built.includes('main.mjs')) {
  // In an ES module every import is evaluated before the importing file's own code, so the
  // handler is only first if electron/no-dialog.ts is main.ts's first import: in the bundle,
  // its statement comes before any other module's code.
  const lines = read('dist/electron/main.mjs').split('\n');
  const handler = lines.findIndex((line) => /process\.on\(\s*["']uncaughtException["']/.test(line));
  const firstCode = lines.findIndex((line) => /^(const|let|var|function|async function|class|if|for|while|try|\w+(\.\w+)*\()/.test(line) && !/^var __/.test(line) && !/uncaughtException/.test(line));
  ok(handler !== -1 && (firstCode === -1 || handler < firstCode), `dist/electron/main.mjs does not install the no-dialog handler before other code (handler at line ${handler + 1}, other code at line ${firstCode + 1}); electron/no-dialog.ts must be main.ts's first import`);
}

// 1. One place asks about the system. The adapter's plain-Node modules (electron/tool/*.ts
// other than index.ts) take the system as an argument so the tests can play any system;
// their default is the one exception. index.ts, which touches Electron, is held to the rule.
for (const file of [...mainFiles.filter((f) => !f.startsWith('tool/')), 'tool/index.ts']) {
  if (file === 'platform.ts') continue;
  const hits = read(join('electron', file))
    .split('\n')
    .filter((line) => /process\.platform|os\.platform\(\)|os\.type\(\)/.test(line) && !/^\s*\/\//.test(line));
  ok(hits.length === 0, `electron/${file} asks which system this is (${hits.length} place${hits.length === 1 ? '' : 's'}); only platform.ts may`);
}

// 5. Focus. Each entry: a file, a piece of the line, and why it never takes focus under --no-activate.
const FOCUS_ALLOWED = [
  { file: 'window.ts', line: 'platform.show(win, app, inactive)', why: 'the first show: showInactive when the launch asked for no focus' },
  { file: 'shell.ts', line: 'platform.show(win, app, true)', why: 'a control request, or a second launch with --no-activate: showInactive, which also brings back a minimized window without activating it' },
  { file: 'shell.ts', line: 'if (win.isMinimized()) win.restore();', why: 'showWindow, only on the branch for a launch that did not ask for no focus' },
  { file: 'shell.ts', line: 'win.show();', why: 'showWindow, only on the branch for a launch that did not ask for no focus' },
  { file: 'shell.ts', line: 'win.focus();', why: 'showWindow, only on the branch for a launch that did not ask for no focus' },
  { file: 'shell.ts', line: '&& !quiet()) win.restore()', why: 'macOS open-file: restores a window put in the Dock only when the last launch did not ask for no focus' },
  { file: 'shell.ts', line: 'platform.show(win, app, quiet())', why: "macOS activate: follows the last launch's request" },
  { file: 'tool/index.ts', line: 'dialog.showMessageBox(', why: 'the quit question while a job runs; confirmQuitDuringJob answers a quiet request without it' },
];
const FOCUS_CALL = /\.(show|focus|restore|maximize|moveTop|showInactive|blurWebView|setAlwaysOnTop)\(|show(Open|Save)Dialog|showMessageBox|showErrorBox|app\.focus\(|activateIgnoringOtherApps/;
for (const file of mainFiles) {
  read(join('electron', file))
    .split('\n')
    .forEach((text, i) => {
      if (/^\s*(\/\/|\*)/.test(text) || !FOCUS_CALL.test(text)) return;
      const allowed = FOCUS_ALLOWED.find((a) => a.file === file && text.includes(a.line));
      ok(allowed, `electron/${file}:${i + 1} can take focus and is not a reviewed place: ${text.trim()} (see FOCUS_ALLOWED in measure/shell-check.ts)`);
    });
}

// 2. The menu against the shortcut table.
interface Chord {
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}
interface MenuEntry {
  command?: string;
  accelerator?: string;
  submenu?: MenuEntry[];
}
const table = (JSON.parse(read('shortcuts.json')) as { commands: Record<string, Chord | null> }).commands;
const ids = Object.keys(table);
const menu = (await import(pathToFileURL(join(root, 'electron', 'menu.ts')).href)) as typeof import('../electron/menu.ts');
const inMenu = new Map<string, (string | null)[]>();
const walk = (entries: MenuEntry[]) => {
  for (const entry of entries) {
    if (entry.submenu) walk(entry.submenu);
    if (entry.command) {
      const seen = inMenu.get(entry.command) ?? [];
      seen.push(entry.accelerator ?? null);
      inMenu.set(entry.command, seen);
    }
  }
};
walk(menu.template('App'));
for (const id of ids) ok(inMenu.has(id), `command "${id}" is in shortcuts.json but not in the macOS menu`);
for (const id of inMenu.keys()) ok(ids.includes(id), `the macOS menu has "${id}", which is not a command in shortcuts.json`);
for (const entry of menu.dockTemplate()) ok(entry.command !== undefined && ids.includes(entry.command), `the Dock menu has "${entry.command}", which is not a command in shortcuts.json`);
for (const [id, accelerators] of inMenu) {
  for (const a of accelerators) ok(a === (menu.KEYS[id] ?? null), `the macOS menu shows ${a} for "${id}" but the table gives ${menu.KEYS[id] ?? 'none'}`);
}

// 3. Keys the shell takes for itself against every key the page's table uses.
const normal = (keys: string) =>
  keys
    .split('+')
    .map((p) => (p.length === 1 ? p.toUpperCase() : p))
    .sort()
    .join('+');
const pageKeys = new Set<string>();
for (const chord of Object.values(table)) {
  if (!chord) continue;
  const key = chord.key.length === 1 ? chord.key.toUpperCase() : chord.key;
  pageKeys.add(normal([...(chord.mod ? ['Control'] : []), ...(chord.shift ? ['Shift'] : []), ...(chord.alt ? ['Alt'] : []), key].join('+')));
  pageKeys.add(normal([...(chord.mod ? ['Command'] : []), ...(chord.shift ? ['Shift'] : []), ...(chord.alt ? ['Alt'] : []), key].join('+')));
}
// The facts for all three systems, read from the source: this script runs on one of them.
const shellKeys = [...read('electron/platform.ts').matchAll(/keys: '([^']+)', does: '([^']+)'/g)].map((m) => ({ keys: m[1] ?? '', does: m[2] ?? '' }));
ok(shellKeys.length >= 6, 'could not read the shell keys from electron/platform.ts');
for (const { keys, does } of shellKeys) ok(!pageKeys.has(normal(keys.replace('Option', 'Alt'))), `the shell takes ${keys} (${does}), which the page's shortcut table also uses`);
for (const keys of ['Command+Q', 'Command+W', 'Command+M', 'Command+H', 'Command+X', 'Command+C', 'Command+V', 'Command+A', 'Command+Z', 'Command+Shift+Z']) {
  ok(!pageKeys.has(normal(keys)), `the macOS menu's system roles take ${keys}, which the page's shortcut table also uses`);
}

// 4. Traffic lights.
const platform = (await import(pathToFileURL(join(root, 'electron', 'platform.ts')).href)) as typeof import('../electron/platform.ts');
const config = JSON.parse(read('app.config.json')) as { titleBarHeight: number; macTitleBarHeight?: number };
for (const [bar, want] of [
  [32, { x: 9, y: 9 }],
  [40, { x: 12, y: 13 }],
  [52, { x: 19, y: 19 }],
] as const) {
  const got = platform.trafficLights(bar);
  ok(got.x === want.x && got.y === want.y, `traffic lights for a ${bar} pt bar are at (${got.x}, ${got.y}), the system's are at (${want.x}, ${want.y})`);
}
for (const bar of new Set([config.titleBarHeight, config.macTitleBarHeight ?? config.titleBarHeight])) {
  const got = platform.trafficLights(bar);
  ok(Math.abs(got.y + 7 - bar / 2) <= 0.5, `traffic lights are not centred in this app's ${bar} pt bar: top at ${got.y}`);
}

// 7. Launches go through scripts/lib/launch.ts.
const LAUNCH_OWNERS = new Set(['scripts/lib/launch.ts', 'measure/shell-evidence.ts', 'measure/shell-check.ts']);
for (const dir of ['qa', 'measure', 'scripts']) {
  for (const file of readdirSync(join(root, dir)).filter((f) => /\.(mjs|cjs|js|ts)$/.test(f))) {
    const rel = `${dir}/${file}`;
    if (LAUNCH_OWNERS.has(rel)) continue;
    const text = read(rel);
    ok(!/require\(['"]electron['"]\)|from\s*['"]electron['"]|['"]electron['"],\s*['"]dist['"]|electron\.exe/.test(text), `${rel} starts Electron itself; use launchDev from scripts/lib/launch.ts`);
  }
}

// 8. No script reaches the running app through a second instance. A second instance is let in
// by Chromium's process singleton, which on Windows hands the running app the right to take the
// foreground before any of the app's code runs (electron/control.ts). So: (a) in main.ts the
// single-instance lock is asked for only inside start(), and a command launch never calls
// start(); (b) every flag that acts on the running app is a command flag in control.ts;
// (c) no script starts the app's executable with a command flag on the same line: commands go
// through the control channel (ask() in scripts/lib/launch.ts, control.send, scripts/control.ts
// and the scripts/control.cjs built from it, scripts/control.ps1).
let scriptCount = 0;
{
  const control = (await import(pathToFileURL(join(root, 'electron', 'control.ts')).href)) as typeof import('../electron/control.ts');
  const code = read('electron/main.ts')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  const locks = [...code.matchAll(/requestSingleInstanceLock\(/g)].length;
  const startAt = code.indexOf('function start(');
  const startBody = startAt === -1 ? '' : code.slice(startAt, code.indexOf('\n}\n', startAt));
  ok(locks === 1 && startBody.includes('requestSingleInstanceLock('), `electron/main.ts must ask for the single-instance lock exactly once, inside start() (found ${locks})`);
  const commandBranch = code.match(/if \(launchKind === 'command'\) \{([^}]*)\}/);
  ok(commandBranch && !/start\(\)/.test(commandBranch[1] ?? '') && /forward\(/.test(commandBranch[1] ?? ''), 'electron/main.ts: a command launch must be forwarded through the channel and must never call start()');
  const firstUse = code.indexOf("launchKind === 'command'");
  ok(firstUse !== -1 && code.indexOf('start();', firstUse) > firstUse, 'electron/main.ts: start() is called only after the command branch');
  // (b) The flags the shell acts on, read from the source, are all command flags.
  const acted = new Set<string>();
  for (const file of ['electron/main.ts', 'electron/shell.ts']) {
    for (const m of read(file).matchAll(/\b(?:arg|has)\('([a-z-]+)', argv\)/g)) if (m[1]) acted.add(m[1]);
  }
  ok(acted.size >= 8, `could not read the flags the shell acts on (found ${acted.size})`);
  for (const name of acted) {
    if (name === 'no-activate') continue;
    ok(control.isCommandFlag(`--${name}`) || control.isCommandFlag(`--${name}=x`), `--${name} acts on the running app but is not a command flag in electron/control.ts`);
  }
  // (c) Scripts, in every folder that holds them.
  const scriptFiles: string[] = [];
  const walkDir = (dir: string) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!['out', 'evidence', 'data', 'node_modules'].includes(entry.name)) walkDir(rel);
      } else if (/\.(mjs|cjs|js|ts|ps1|sh)$/.test(entry.name)) scriptFiles.push(rel);
    }
  };
  for (const dir of ['measure', 'qa', 'scripts', 'test']) walkDir(dir);
  scriptCount = scriptFiles.length;
  const startsApp = /spawn(Sync)?\((electron|electronBinary\(\))|execFile(Sync)?\(electron|Start-Process -FilePath \$exe|"\$electron"|"\$BIN" "\$@"/;
  const commandLiteral = new RegExp(`--(${control.COMMAND_FLAGS.map((f) => f.replace('=', '')).join('|')})\\b`);
  for (const file of scriptFiles) {
    if (file === 'measure/focus-experiment.ts') continue; // --via exe starts the executable with commands on purpose, to prove it forwards them
    read(file)
      .split('\n')
      .forEach((text, i) => {
        if (startsApp.test(text) && commandLiteral.test(text)) ok(false, `${file}:${i + 1} starts the app's executable with a command: send it through the control channel instead: ${text.trim()}`);
      });
  }
  ok(scriptFiles.length > 20 && scriptFiles.includes('scripts/lib/launch.ts'), 'could not list the scripts');
}

// 9. The network service in the main process (NETWORK_SERVICE_IN_PROCESS in main.ts) is only for
// a page that makes no network request: the page's Content-Security-Policy must say connect-src 'none'.
{
  const mainSource = read('electron/main.ts');
  const inProcess = /const NETWORK_SERVICE_IN_PROCESS = true;/.test(mainSource);
  const csp = mainSource.match(/'Content-Security-Policy',\s*"([^"]+)"/)?.[1] ?? '';
  ok(csp, 'could not read the Content-Security-Policy from electron/main.ts');
  if (inProcess) ok(/connect-src 'none'/.test(csp), "electron/main.ts runs the network service in the main process, but the page's Content-Security-Policy allows network requests: set NETWORK_SERVICE_IN_PROCESS to false or keep connect-src 'none'");
}

// 10. The test instrumentation (electron/qa.ts, built to dist/electron/qa.mjs) is development-only:
// the main bundle never imports it by name, and packaging leaves it out.
{
  const packaging = read('scripts/package.ts');
  ok(/DEVELOPMENT_ONLY = \[[^\]]*'\/dist\/electron\/qa\.mjs'/.test(packaging) && /if \(DEVELOPMENT_ONLY\.includes\(file\)\) return true;/.test(packaging), 'scripts/package.ts must leave dist/electron/qa.mjs out of the package');
  const mainSource = read('electron/main.ts');
  // And the bundle holds none of it: a string only electron/qa.ts has.
  if (built.includes('main.mjs')) ok(!read('dist/electron/main.mjs').includes('must survive the process being terminated'), 'dist/electron/main.mjs contains the test instrumentation (electron/qa.ts); load it by a computed path');
  ok(!/import\s*\(\s*['"][^'"]*qa(\.ts|\.mjs)?['"]\s*\)|(from|import)\s*['"][^'"]*\/qa(\.ts|\.mjs)?['"]/.test(mainSource.replace(/typeof import\('\.\/qa\.ts'\)/g, '')), "electron/main.ts imports qa by name, which bundles it into the app; load dist/electron/qa.mjs by a computed path");
  ok(/if \(!app\.isPackaged && process\.argv\.some\(\(a\) => a\.startsWith\('--qa-'\)\)\)/.test(mainSource), 'electron/main.ts must load the test instrumentation only in an unpackaged app with a --qa-* flag');
}

if (problems.length) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}
console.log(
  `shell check passed: ${ids.length} commands in the macOS menu with the table's keys, ${shellKeys.length} shell keys clear of the page's keys, ${mainFiles.length} main-process sources and ${built.length} built files parse, the no-dialog handler comes first in the bundle, and the main process takes focus only in the ${FOCUS_ALLOWED.length} reviewed places, launches go through scripts/lib/launch.ts, none of ${scriptCount} scripts reaches the app through a second instance, the network service runs in the main process only with connect-src 'none', and packaging leaves out the test instrumentation`,
);
