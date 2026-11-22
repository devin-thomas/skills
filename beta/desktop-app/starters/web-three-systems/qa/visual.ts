// Screenshot comparison: every picture qa/shots.ts takes, against the accepted picture of the
// same state, size, scale, theme and system. A change nobody accepted fails the run.
//
//   node qa/visual.ts             compare; exits 1 on any difference, a missing or an extra picture
//   node qa/visual.ts --update    accept the current pictures as the baselines (review them first)
//   node qa/visual.ts --full      the full matrix of shots.ts instead of --quick plus forced colours
//
// Baselines live in qa/baselines/<this machine's system>/ because fonts are drawn differently on
// each system. The starter keeps none (.gitignore); an app removes that line and commits its own.
// Differences are measured with pixelmatch: a pixel counts as changed when its colour distance is
// over THRESHOLD (anti-aliasing excluded), and a picture fails when more than MAX_RATIO of its
// pixels changed. Each failure writes a diff image to qa/visual/diff/ with changed pixels in red.
// Writes qa/evidence/visual.json.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { root } from './lib.ts';

// 0.02, not pixelmatch's default 0.1: the starter's smallest colour step (a 4% to 7% fill) is
// about 0.024 apart, and 0.1 cannot see it (qa/planted-breaks.ts shows it). Anti-aliased pixels are
// excluded, which is what keeps a low threshold from flagging font edges.
// VISUAL_THRESHOLD overrides it only to show what a looser threshold misses.
const THRESHOLD = Number(process.env.VISUAL_THRESHOLD ?? 0.02);
const MAX_RATIO = 0.0005; // 0.05% of a picture: about 480 pixels of a 1120 by 760 window

const args = process.argv.slice(2);
const update = args.includes('--update');
const full = args.includes('--full');
const systemNames: Record<string, string> = { win32: 'windows', darwin: 'macos', linux: 'linux' };
const system = systemNames[process.platform] ?? process.platform;
const baselines = join(root, 'qa', 'baselines', system);
const current = join(root, 'qa', 'visual', 'current');
const diffDir = join(root, 'qa', 'visual', 'diff');

const list = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (d: string): void => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name.endsWith('.png')) out.push(relative(dir, join(d, e.name)).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
};

rmSync(current, { recursive: true, force: true });
rmSync(diffDir, { recursive: true, force: true });
// shots.ts takes its folder relative to the project.
const shot = spawnSync(process.execPath, [join(root, 'qa', 'shots.ts'), relative(root, current), ...(full ? [] : ['--quick'])], { stdio: 'inherit', cwd: root });
if (shot.status !== 0) {
  console.error('qa/shots.ts failed; nothing compared');
  process.exit(1);
}
const now = list(current);

if (update) {
  rmSync(baselines, { recursive: true, force: true });
  mkdirSync(baselines, { recursive: true });
  cpSync(current, baselines, { recursive: true });
  console.log(`${now.length} pictures accepted as the ${system} baselines in ${relative(root, baselines)}`);
  process.exit(0);
}

const accepted = list(baselines);
if (accepted.length === 0) {
  console.error(`no baselines in ${relative(root, baselines)}: review qa/visual/current, then run with --update`);
  process.exit(1);
}
const failures: string[] = [];
const results: { name: string; changed: number; ratio: number }[] = [];
for (const name of accepted.filter((n) => !now.includes(n))) failures.push(`${name}: in the baselines but no longer taken (a state was removed or renamed)`);
for (const name of now.filter((n) => !accepted.includes(n))) failures.push(`${name}: a new picture with no baseline (accept it with --update after review)`);
for (const name of now.filter((n) => accepted.includes(n))) {
  const a = PNG.sync.read(readFileSync(join(baselines, name)));
  const b = PNG.sync.read(readFileSync(join(current, name)));
  if (a.width !== b.width || a.height !== b.height) {
    failures.push(`${name}: size changed from ${a.width}x${a.height} to ${b.width}x${b.height}`);
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: THRESHOLD, includeAA: false });
  const ratio = changed / (a.width * a.height);
  results.push({ name, changed, ratio: Number(ratio.toFixed(6)) });
  if (ratio > MAX_RATIO) {
    const out = join(diffDir, name);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, PNG.sync.write(diff));
    failures.push(`${name}: ${changed} pixels changed (${(ratio * 100).toFixed(3)}%), diff in ${relative(root, out)}`);
  }
}

const report = { at: new Date().toISOString(), system, threshold: THRESHOLD, maxRatio: MAX_RATIO, compared: results.length, largest: [...results].sort((x, y) => y.ratio - x.ratio).slice(0, 5), failures, passed: failures.length === 0 };
mkdirSync(join(root, 'qa', 'evidence'), { recursive: true });
writeFileSync(join(root, 'qa', 'evidence', 'visual.json'), JSON.stringify(report, null, 2));
if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`\nvisual comparison FAILED: ${failures.length} of ${now.length} pictures`);
  process.exit(1);
}
console.log(`visual comparison passed: ${results.length} pictures match the ${system} baselines (largest change ${((report.largest[0]?.ratio ?? 0) * 100).toFixed(3)}%)`);
