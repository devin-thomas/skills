// Reads the diagnostics file a running installed app wrote (--diagnostics=<file>)
// and says, in plain lines, what the installed check needs to know. Run by the
// installed check with the installed app's own executable acting as Node, or
// with plain Node:
//
//   node scripts/installed-diagnostics.cjs <diagnostics.json> <install root> [summary file]
//
// It reports where the app runs from, whether it is the packaged build, the
// window's state, and whatever the app says about its tool and helpers. The
// shape of that last part belongs to the app, so it is searched for rather
// than assumed: any object that has a key named tool, toolSource, helpers or
// one of the binaries in app.config.json is printed, and every path in it that
// names one of them must lie inside the install root. When the app reports
// nothing of the kind, the line says so; it is not a failure of the package.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const [file, root, summary] = process.argv.slice(2);
const lines = [];
let failed = false;
const say = (line) => lines.push(line);
const fail = (line) => {
  failed = true;
  lines.push(`FAILED: ${line}`);
};
const norm = (p) => {
  let real = path.resolve(p);
  try {
    real = fs.realpathSync(real);
  } catch {
    // Keep the unresolved path.
  }
  return process.platform === 'win32' || process.platform === 'darwin' ? real.toLowerCase() : real;
};
const inside = (p) => norm(p).startsWith(norm(root) + path.sep);

let d;
try {
  d = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`cannot read ${file}: ${error.message}`);
  process.exit(2);
}

say(`app ${d.app ?? '?'}, Electron ${d.electron ?? '?'}, Chromium ${d.chrome ?? '?'}, process ${d.pid ?? '?'}`);
if (typeof d.exe === 'string') {
  if (inside(d.exe)) say(`running from the installed location: ${d.exe}`);
  else fail(`the running app is ${d.exe}, which is not inside ${root}`);
} else say('running location: not reported by this build');
if (d.packaged === true) say('packaged build: yes');
else if (d.packaged === false) fail('the running app is not a packaged build');
if (d.userData) say(`data folder: ${d.userData}`);
if (d.window) say(`window: visible ${d.window.visible}, focused ${d.window.focused}, ${d.window.bounds ? `${d.window.bounds.width}x${d.window.bounds.height} at ${d.window.bounds.x},${d.window.bounds.y}` : 'bounds not reported'}`);
else say('window: not reported by this build');
// How the check reached the app: only through its control channel. A second launch would have
// gone through Chromium's process singleton, which on Windows can hand the app the foreground.
const life = d.shell?.lifecycle;
if (life && typeof life.secondLaunches === 'number') {
  if (life.secondLaunches === 0) say(`reached through the control channel only: ${life.controlRequests ?? '?'} requests, 0 second launches`);
  else fail(`the app counted ${life.secondLaunches} second launch(es); a check must reach it only through its control channel`);
} else say('second launches: not reported by this build');
const env = d.env ?? d.environment ?? null;
if (env && ('PATH' in env || 'Path' in env)) say(`PATH seen by the app: '${env.PATH ?? env.Path}'`);
else say('PATH seen by the app: not reported by this build');

// Whatever the app says about its tool.
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.config.json'), 'utf8'));
const NAMES = config.tool.binaries ?? [config.tool.name];
const KEYS = new Set(['tool', 'toolSource', 'helpers', ...NAMES]);
const found = [];
(function walk(value, trail) {
  if (!value || typeof value !== 'object' || trail.length > 6) return;
  if (!Array.isArray(value) && Object.keys(value).some((k) => KEYS.has(k) && value[k] !== null && value[k] !== undefined)) {
    found.push([trail.join('.') || '(top level)', Object.fromEntries(Object.entries(value).filter(([k]) => KEYS.has(k)))]);
  }
  for (const [k, v] of Object.entries(value)) if (!KEYS.has(k)) walk(v, [...trail, k]);
})(d, []);
if (found.length === 0) {
  say('the tool and its helpers: not reported by this build');
} else {
  const escape = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const HELPER = new RegExp(`(^|[\\\\/])(${NAMES.map(escape).join('|')})(\\.exe)?$`, 'i');
  for (const [where, block] of found) {
    say(`tool report at ${where}: ${JSON.stringify(block)}`);
    (function paths(value) {
      if (typeof value === 'string') {
        if (path.isAbsolute(value) && HELPER.test(value)) {
          if (inside(value)) say(`  inside the app: ${value}`);
          else fail(`${value} is outside the installed app`);
        }
      } else if (value && typeof value === 'object') for (const v of Object.values(value)) paths(v);
    })(block);
    const sources = JSON.stringify(block).match(/"source":"(path|beside|flag|packaged|development|override)"/g) ?? [];
    if (sources.some((s) => /"(path|development|override)"/.test(s))) fail(`a helper was not taken from the app bundle: ${sources.join(', ')}`);
  }
}
say(failed ? 'diagnostics: FAILED' : 'diagnostics: ok');
const text = `${lines.join('\n')}\n`;
if (summary) fs.writeFileSync(summary, text);
else process.stdout.write(text);
process.exit(failed ? 1 : 0);
