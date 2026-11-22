// Proves each check of premium-bar rules 104 to 111 fails when its rule is broken. For every
// planted break it copies the project to a throwaway folder (node_modules linked, not copied),
// makes one edit, runs the check that is meant to catch it and requires a non-zero exit with
// the expected message in the output. A planted break the check lets through fails this run.
//
//   node qa/planted-breaks.ts                  every break that applies to this system
//   node qa/planted-breaks.ts 106 108          only those rules
//   node qa/planted-breaks.ts --list           what is planted, per rule
//
// An edit whose text is not found in the source also fails the run, so a refactor cannot leave
// a break that no longer breaks anything. The real shell is started only by qa/crash-test.ts
// and scripts/fuses-check.ts, which launch it as every script does (no focus, a throwaway data
// folder, a time limit). Writes qa/evidence/planted-breaks.json.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { root } from './lib.ts';

interface Edit {
  file: string;
  /** Text that must be in the file once; the break replaces it. */
  from: string;
  to: string;
}
type Step =
  | { edit: Edit; only?: NodeJS.Platform | undefined }
  | { undo: string }
  | { run: string[]; env?: Record<string, string>; fails: RegExp }
  | { run: string[]; env?: Record<string, string>; passes: true };

interface Planted {
  rule: number;
  name: string;
  check: string;
  /** Systems where the break applies (default: all). */
  on?: NodeJS.Platform[];
  steps: Step[];
}

const node = (script: string, ...rest: string[]): string[] => [process.execPath, join('.', script), ...rest];
const shellCheck = node('measure/shell-check.ts');
const crash = node('qa/crash-test.ts');
const viteBuild = [process.execPath, join('node_modules', 'vite', 'bin', 'vite.js'), 'build'];
const unit = (file: string): string[] => [process.execPath, '--test', join('test', file)];

/** The maximized trial's guard: on Windows the guard is what keeps a no-focus launch from activating; elsewhere maximizing is what the saved state asks for. */
const MAXIMIZE_GUARD = "const maximizeAfterReveal = place.maximized && !(inactive && facts.system === 'windows');";

const PLANTED: Planted[] = [
  {
    rule: 104,
    name: 'the shell does not reload a crashed renderer',
    check: 'pnpm qa:crash',
    steps: [{ edit: { file: 'electron/window.ts', from: '    renderer.reloads += 1;\n    void win.loadURL(`${origin}/index.html#theme=${record.theme}`);\n', to: '    renderer.reloads += 1;\n' } }, { run: crash, fails: /FAIL recover/ }],
  },
  {
    rule: 104,
    name: 'the shell reloads a crash loop for ever',
    check: 'pnpm qa:crash',
    steps: [{ edit: { file: 'electron/window.ts', from: 'const CRASH_LIMIT = 3;', to: 'const CRASH_LIMIT = 1000;' } }, { run: crash, fails: /FAIL loop/ }],
  },
  {
    rule: 105,
    name: 'a window saved on a display that is gone opens at the saved place',
    check: 'pnpm test, pnpm qa:crash',
    steps: [
      { edit: { file: 'electron/bounds.ts', from: "const home = homeDisplay(at, displays);\n  if (!home) return centred(primary, kept, 'the saved position is on no connected display: saved size, centred on the primary display');", to: 'const home = homeDisplay(at, displays) ?? primary;' } },
      { run: unit('bounds.test.ts'), fails: /unplugged|sliver/ },
      { run: crash, fails: /FAIL lost/ },
    ],
  },
  {
    rule: 105,
    name: 'a window saved maximized does not open maximized (on Windows: opens maximized with no focus asked)',
    check: 'pnpm qa:crash',
    steps: [
      { edit: { file: 'electron/window.ts', from: MAXIMIZE_GUARD, to: 'const maximizeAfterReveal = place.maximized;' }, only: 'win32' },
      { edit: { file: 'electron/window.ts', from: MAXIMIZE_GUARD, to: 'const maximizeAfterReveal = false;' }, only: 'darwin' },
      { edit: { file: 'electron/window.ts', from: MAXIMIZE_GUARD, to: 'const maximizeAfterReveal = false;' }, only: 'linux' },
      { run: crash, fails: /FAIL maximized/ },
    ],
  },
  {
    rule: 106,
    name: 'a window turns the sandbox off',
    check: 'pnpm shell:check',
    steps: [{ edit: { file: 'electron/window.ts', from: '      sandbox: true,', to: '      sandbox: false,' } }, { run: shellCheck, fails: /must set sandbox: true/ }],
  },
  {
    rule: 106,
    name: 'the boundary is not installed before the first window',
    check: 'pnpm shell:check',
    steps: [{ edit: { file: 'electron/main.ts', from: '    guard = boundary.install({ app, session, origin: ORIGIN, openExternal: (url) => void shell.openExternal(url) });\n', to: '' } }, { run: shellCheck, fails: /must call boundary\.install/ }],
  },
  {
    rule: 106,
    name: 'the page policy allows eval',
    check: 'pnpm shell:check',
    steps: [{ edit: { file: 'electron/main.ts', from: "script-src 'self' 'unsafe-inline';", to: "script-src 'self' 'unsafe-inline' 'unsafe-eval';" } }, { run: shellCheck, fails: /allows eval or a wildcard/ }],
  },
  {
    rule: 106,
    name: 'the boundary grants the camera to the page',
    check: 'pnpm test, pnpm qa:crash',
    steps: [
      { edit: { file: 'electron/boundary.ts', from: "export const ALLOWED: Record<string, string> = {\n", to: "export const ALLOWED: Record<string, string> = {\n  camera: 'planted: the page may use the camera',\n" } },
      { run: unit('boundary.test.ts'), fails: /exactly one permission|camera/ },
      { run: crash, fails: /camera|boundary allows/ },
    ],
  },
  {
    rule: 107,
    name: 'an IPC listener acts without checking its sender',
    check: 'pnpm shell:check',
    steps: [{ edit: { file: 'electron/main.ts', from: '    if (trusted(event)) writeSavedState(key, json);', to: '    writeSavedState(key, json);' } }, { run: shellCheck, fails: /does not call trusted\(event\)/ }],
  },
  {
    rule: 108,
    name: 'packaging leaves --inspect switched on',
    check: 'pnpm shell:check',
    steps: [{ edit: { file: 'scripts/lib/fuses.ts', from: '[FuseV1Options.EnableNodeCliInspectArguments]: false', to: '[FuseV1Options.EnableNodeCliInspectArguments]: true' } }, { run: shellCheck, fails: /EnableNodeCliInspectArguments to false/ }],
  },
  {
    rule: 108,
    name: 'a package built with NODE_OPTIONS and --inspect left on',
    check: 'pnpm fuses:check',
    // Needs a staged tool for this system's target (node scripts/stage.ts tool <target> <file>).
    on: ['darwin', 'linux', 'win32'],
    steps: [
      { edit: { file: 'scripts/lib/fuses.ts', from: '[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false', to: '[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: true' } },
      { edit: { file: 'scripts/lib/fuses.ts', from: '[FuseV1Options.EnableNodeCliInspectArguments]: false', to: '[FuseV1Options.EnableNodeCliInspectArguments]: true' } },
      { run: node('scripts/package.ts'), passes: true },
      { undo: 'scripts/lib/fuses.ts' },
      { run: node('scripts/fuses-check.ts'), fails: /NODE_OPTIONS=--require ran a file|--inspect started a debugger|fuse EnableNode/ },
    ],
  },
  {
    rule: 109,
    name: 'the focus ring is a box shadow, which forced colours remove',
    check: 'pnpm qa:audit',
    // The audit serves the built page, so the break is built first.
    steps: [
      { edit: { file: 'src/styles/app.css', from: '    outline: var(--focus-width) solid var(--accent);\n    outline-offset: var(--focus-offset);', to: '    outline: none;\n    box-shadow: 0 0 0 var(--focus-width) var(--accent);' } },
      { run: viteBuild, passes: true },
      { run: node('qa/audit.ts'), fails: /no visible focus change under forced colours/ },
    ],
  },
  {
    rule: 110,
    name: 'a colour literal in the stylesheet',
    check: 'pnpm qa:audit',
    steps: [
      { edit: { file: 'src/styles/app.css', from: '    outline: var(--focus-width) solid var(--accent);\n    outline-offset: var(--focus-offset);', to: '    outline: var(--focus-width) solid #ff00aa;\n    outline-offset: var(--focus-offset);' } },
      { run: node('qa/audit.ts'), fails: /a colour literal outside the token layer/ },
    ],
  },
  {
    rule: 111,
    name: "the dark surface moves by one of the design's smallest steps (0.024 lightness)",
    check: 'pnpm qa:visual',
    // Baselines are this system's own: run `node qa/visual.ts --update` first, as an app does.
    steps: [
      { edit: { file: 'tokens/design-tokens.json', from: '"surface": "oklch(0.218 0.003 95)"', to: '"surface": "oklch(0.242 0.003 95)"' } },
      { run: node('tokens/build.ts'), passes: true },
      { run: viteBuild, passes: true },
      { run: node('qa/visual.ts'), fails: /pixels changed/ },
      { run: node('qa/visual.ts'), env: { VISUAL_THRESHOLD: '0.1' }, passes: true },
    ],
  },
];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const p of PLANTED) console.log(`${p.rule}  ${p.check.padEnd(26)} ${p.name}${p.on ? ` (${p.on.join(', ')} only)` : ''}`);
  process.exit(0);
}
const wanted = new Set(args.filter((a) => /^\d+$/.test(a)).map(Number));
const SKIP = new Set(['node_modules', 'out', '.git']);
const SKIP_PATHS = ['qa/evidence', 'qa/data', 'qa/visual', 'qa/shots', 'qa/audit.json'];

function copyProject(to: string): void {
  cpSync(root, to, {
    recursive: true,
    filter: (src) => {
      const rel = relative(root, src).split('\\').join('/');
      return !SKIP.has(rel.split('/')[0] ?? '') && !SKIP_PATHS.includes(rel);
    },
  });
  symlinkSync(join(root, 'node_modules'), join(to, 'node_modules'), 'junction');
}

interface Outcome {
  rule: number;
  name: string;
  check: string;
  result: 'caught' | 'MISSED' | 'skipped';
  detail: string;
}
const outcomes: Outcome[] = [];

for (const planted of PLANTED) {
  if (wanted.size && !wanted.has(planted.rule)) continue;
  const base = { rule: planted.rule, name: planted.name, check: planted.check };
  if (planted.on && !planted.on.includes(process.platform)) {
    outcomes.push({ ...base, result: 'skipped', detail: `applies to ${planted.on.join(', ')}; this is ${process.platform}` });
    continue;
  }
  const dir = mkdtempSync(join(process.env['PLANT_DIR'] ?? tmpdir(), `planted-${planted.rule}-`));
  const clean = (): void => {
    // Remove the node_modules link first: a recursive delete must never follow it into the real one.
    try {
      rmdirSync(join(dir, 'node_modules'));
    } catch {
      try {
        rmSync(join(dir, 'node_modules'), { force: true });
      } catch {
        // Left for the recursive delete below, which removes a link without following it.
      }
    }
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch (error) {
      console.error(`could not remove ${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  try {
    copyProject(dir);
    let detail = '';
    let missed = '';
    for (const step of planted.steps) {
      if ('edit' in step) {
        if (step.only && step.only !== process.platform) continue;
        const file = join(dir, step.edit.file);
        const text = readFileSync(file, 'utf8');
        // A Windows checkout can have CRLF line ends: edit in the file's own.
        const eol = text.includes('\r\n') ? '\r\n' : '\n';
        const from = step.edit.from.replaceAll('\n', eol);
        if (text.split(from).length !== 2) throw new Error(`${step.edit.file} no longer contains the text this break replaces exactly once; update qa/planted-breaks.ts`);
        writeFileSync(file, text.replace(from, () => step.edit.to.replaceAll('\n', eol)));
      } else if ('undo' in step) {
        writeFileSync(join(dir, step.undo), readFileSync(join(root, step.undo)));
      } else {
        const [program, ...rest] = step.run;
        const ran = spawnSync(program ?? process.execPath, rest, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...step.env }, timeout: 900_000, maxBuffer: 64 * 1024 * 1024 });
        const output = `${ran.stdout ?? ''}\n${ran.stderr ?? ''}`;
        const label = rest.map((a) => a.split(/[\\/]/).slice(-2).join('/')).join(' ');
        if ('passes' in step) {
          if (ran.status !== 0) throw new Error(`${label} was expected to pass and failed:\n${output.trim().split('\n').slice(-12).join('\n')}`);
          detail += `${label} passed; `;
        } else if (ran.status === 0) {
          missed += `${label} PASSED with the break in place; `;
        } else if (!step.fails.test(output)) {
          missed += `${label} failed, but not with ${String(step.fails)}: ${output.trim().split('\n').slice(-6).join(' | ')}; `;
        } else {
          const line = output.split('\n').find((l) => step.fails.test(l)) ?? '';
          detail += `${label} failed: ${line.trim().slice(0, 150)}; `;
        }
      }
    }
    outcomes.push({ ...base, result: missed ? 'MISSED' : 'caught', detail: (missed || detail).trim() });
  } catch (error) {
    outcomes.push({ ...base, result: 'MISSED', detail: error instanceof Error ? error.message : String(error) });
  } finally {
    clean();
  }
  const last = outcomes[outcomes.length - 1];
  console.log(`${last?.result === 'caught' ? 'caught ' : last?.result === 'skipped' ? 'skipped' : 'MISSED '} rule ${planted.rule}: ${planted.name} (${planted.check})`);
}

mkdirSync(join(root, 'qa', 'evidence'), { recursive: true });
const missed = outcomes.filter((o) => o.result === 'MISSED');
writeFileSync(join(root, 'qa', 'evidence', 'planted-breaks.json'), JSON.stringify({ at: new Date().toISOString(), system: `${process.platform}-${process.arch}`, outcomes, passed: missed.length === 0 }, null, 2));
if (missed.length) {
  for (const o of missed) console.error(`rule ${o.rule}: ${o.name}\n  ${o.detail}`);
  process.exit(1);
}
console.log(`every planted break was caught (${outcomes.filter((o) => o.result === 'caught').length}, skipped ${outcomes.filter((o) => o.result === 'skipped').length})`);
