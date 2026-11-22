// The kit packages are the only way to get the code they cover. Every app is copied from this
// starter, and a copy pasted back in drifts: a fix made in one copy never reaches the others.
// This test fails when a hand-rolled copy of kit-covered code appears in the project, and its
// message names the package to use instead. If a package lacks something the app needs, extend
// the package; do not copy its code here.
//
// Each rule reads the project's own files (never node_modules or built output) and looks for
// the marks the hand-rolled copies had. Each rule is also run against a planted copy, so a
// rule that stops matching fails here too.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.join(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', 'out', 'staging', '.git', 'evidence', 'data', 'shots']);

/** Project files under `dir` with one of `endings`, as paths relative to the project. */
function files(dir: string, endings: string[]): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(child);
      } else if (endings.some((e) => entry.name.endsWith(e))) out.push(child);
    }
  };
  walk(dir);
  return out;
}

/** The text without comments, so a rule matches code and not a sentence that names the code. */
const code = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|#)/.test(line))
    .join('\n');

interface Rule {
  /** What the copy is. */
  what: string;
  /** The package that replaces it. */
  use: string;
  /** Where to look: folders and file endings. */
  where: { dirs: string[]; endings: string[] };
  /** A file the rule leaves alone: the one place the package is wired in. */
  allow?: (file: string) => boolean;
  /** Whether this file's code is a hand-rolled copy. */
  copied: (text: string, file: string) => boolean;
  /** A copy that the rule must catch. */
  planted: string;
}

const RULES: Rule[] = [
  {
    what: 'a local child-process runner (spawn with piped stdio, a stderr tail, a grace period, a process-tree kill)',
    use: '@uppercut-labs/electron-child-process-runner (startProcess)',
    where: { dirs: ['electron', 'scripts', 'src'], endings: ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'] },
    copied: (text) => !/@uppercut-labs\/electron-child-process-runner/.test(text) && (/taskkill/.test(text) || /process\.kill\(\s*-/.test(text) || /stderrTail/.test(text) || /stdio:\s*\[\s*'pipe',\s*'pipe',\s*'pipe'\s*\]/.test(text)),
    planted: "const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });\nprocess.kill(-child.pid, 'SIGKILL');",
  },
  {
    what: 'a hand-rolled bounded line reader for the tool\'s output',
    use: '@uppercut-labs/electron-child-process-runner (createLineReader)',
    where: { dirs: ['electron', 'scripts', 'src'], endings: ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'] },
    copied: (text) => /maxLineBytes/.test(text) && /indexOf\(\s*(NEWLINE|0x0a|10)\b/.test(text),
    planted: 'const NEWLINE = 0x0a;\nfunction push(chunk) { const at = chunk.indexOf(NEWLINE, from); if (held > maxLineBytes) skip(); }',
  },
  {
    what: 'a hand-rolled control channel (a pipe or socket server, control.json, a client that connects to it)',
    use: '@uppercut-labs/electron-control-channel (classify, serve, send)',
    where: { dirs: ['electron', 'scripts', 'measure', 'qa'], endings: ['.ts', '.mts', '.cts', '.js', '.mjs'] },
    copied: (text) => /net\.createServer\(|net\.connect\(|createConnection\(/.test(text) && /control\.json|\\\\\.\\\\pipe|control\.sock/.test(text),
    planted: "const server = net.createServer(onRequest);\nfs.writeFileSync(path.join(userData, 'control.json'), JSON.stringify({ v: 1, endpoint }));",
  },
  {
    what: 'a hand-rolled private-memory reading inside the app (footprint, smaps_rollup, getAppMetrics sums)',
    use: '@uppercut-labs/electron-private-memory (measureMemory)',
    where: { dirs: ['electron'], endings: ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'] },
    copied: (text) => /smaps_rollup|\/usr\/bin\/footprint|memory\.privateBytes/.test(text),
    planted: "const out = await run('/usr/bin/footprint', ['-f', 'bytes', '--noCategories', '--pid', String(pid)]);",
  },
  {
    what: 'a hand-rolled command menu (application or Dock menu built from the command table, accelerator routing)',
    use: '@uppercut-labs/electron-command-menu (createCommandMenu, toAccelerator)',
    where: { dirs: ['electron'], endings: ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'] },
    copied: (text) => /setApplicationMenu\(|dock\.setMenu\(|triggeredByAccelerator/.test(text),
    planted: "Menu.setApplicationMenu(Menu.buildFromTemplate(withClicks(template('App'))));",
  },
  {
    what: 'hand-rolled QA measurements (key injection into the page, a latency probe, launch marks)',
    use: '@uppercut-labs/electron-qa-measurements (measureTyping, measureCommandPalette, measureLaunchMarks, typeAndRecord)',
    where: { dirs: ['electron', 'qa', 'measure', 'scripts'], endings: ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'] },
    copied: (text) => /type:\s*'char'/.test(text) || /durationThreshold/.test(text) || /first-contentful-paint/.test(text),
    planted: "contents.sendInputEvent({ type: 'char', keyCode: ch });",
  },
  {
    what: 'a hand-rolled fake preload bridge (call log, menu hook, fixture storage)',
    use: '@uppercut-labs/electron-bridge-test-double (createBridgeHarness, instrument)',
    where: { dirs: ['src'], endings: ['.ts', '.tsx', '.js', '.mjs'] },
    copied: (text) => /window\.__desktopCalls\s*=|window\.__menuCommand\s*=|window\.__menuState\s*=/.test(text),
    planted: 'window.__desktopCalls = [];\nwindow.__menuCommand = (command) => listeners.forEach((l) => l(command));',
  },
  {
    what: 'a hand-rolled icon maker (ICO or ICNS containers written by the project)',
    use: '@uppercut-labs/app-icon-generator (generate)',
    where: { dirs: ['scripts', 'tools', 'build'], endings: ['.ts', '.mts', '.js', '.mjs', '.cjs', '.py'] },
    copied: (text) => /['"](icp4|icp5|icp6|ic07|ic08|ic09|ic10|ic11|ic12|ic13|ic14)['"]/.test(text) || /writeUInt16LE\(\s*1,\s*2\s*\)/.test(text),
    planted: "const ICNS = [['icp4', 16], ['ic07', 128]];",
  },
  {
    what: 'direct PresentMon calls or a hand-rolled PresentMon CSV summary in measure/',
    use: 'uppercut-presentmon-measure (build_presentmon_command, find_capture_csv, parse_presentmon_csv, summarize_frames)',
    where: { dirs: ['measure'], endings: ['.py', '.ts', '.js', '.mjs', '.ps1'] },
    // Pending: measure/run.py and analyze.py still call PresentMon and read its CSV themselves,
    // because the package does not yet read msBetweenDisplayChange or start a delayed capture on
    // a chosen process. Remove this allowance when it does and run.py moves onto it; until then
    // the rule keeps any other file in measure/ from starting another copy.
    allow: (file) => file === 'measure/run.py' || file === 'measure/analyze.py',
    copied: (text) => /--process_id|--process_name|--output_file|--timed\b/.test(text) || (/msBetweenPresents|msBetweenDisplayChange/.test(text) && /DictReader|\.split\(','\)/.test(text)) || (/PresentMon/i.test(text) && /subprocess|spawn\(|Start-Process/.test(text) && !/uppercut_presentmon_measure/.test(text)),
    planted: 'subprocess.Popen([PRESENTMON, "--process_id", str(gpu), "--output_file", out, "--timed", "7"])',
  },
  {
    what: 'a hand-rolled window screenshot in measure/ (CopyFromScreen)',
    use: 'uppercut-windows-window-capture (find_window, capture_window)',
    where: { dirs: ['measure'], endings: ['.py', '.ps1', '.ts', '.js'] },
    copied: (text) => /CopyFromScreen/.test(text),
    allow: (file) => file === 'measure/foreground-sampler.ps1',
    planted: '$g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)',
  },
];

for (const rule of RULES) {
  test(`kit-covered code stays in its package: ${rule.what}`, () => {
    assert.equal(rule.copied(code(rule.planted), 'planted'), true, `the rule no longer catches a planted copy of ${rule.what}`);
    const found: string[] = [];
    for (const dir of rule.where.dirs) {
      for (const file of files(dir, rule.where.endings)) {
        if (rule.allow?.(file)) continue;
        if (rule.copied(code(fs.readFileSync(path.join(root, file), 'utf8')), file)) found.push(file);
      }
    }
    assert.deepEqual(found, [], `${found.join(', ')}: ${rule.what}. Use ${rule.use} instead. If the package lacks something this app needs, extend the package rather than copy its code; new shared code goes through the kit-extractor.`);
  });
}
