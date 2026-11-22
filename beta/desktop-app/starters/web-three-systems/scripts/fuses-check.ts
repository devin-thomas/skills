// Reads the fuses back from a packaged app and, on the system the app is for, tries each door
// they close. Run after scripts/package.ts:
//
//   node scripts/fuses-check.ts [target]     (default: this machine's target)
//
// 1. The fuse wire in the packaged binary equals scripts/lib/fuses.ts for that system.
// 2. Only on the app's own system, each probe starts the packaged executable as a command launch
//    (--diagnostics with a throwaway --data-dir and no app running there), which the app forwards
//    to a control channel that does not exist and then ends: no window, no focus, no single-
//    instance lock. What each probe tries must not happen:
//      ELECTRON_RUN_AS_NODE=1 with -e <script>   the script runs as Node.js
//      NODE_OPTIONS=--require=<file>             the file runs at startup
//      --inspect=0                               a debugger starts listening
// 3. macOS, where asar integrity is on: a copy of the app with one byte appended to app.asar
//    must refuse to start.
// Writes qa/evidence/fuses-<target>.json; exits 1 on any failure.
import { getCurrentFuseWire, FuseState, FuseV1Options } from '@electron/fuses';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FUSE_NAMES, fusesFor, RUN_AS_NODE_REASON } from './lib/fuses.ts';
import { names, TARGETS } from './lib/names.ts';
import { root } from './lib/root.ts';

const config = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8')) as { productName: string; exeName: string; appId: string; linux?: { name?: string } };
const target = process.argv[2] ?? `${process.platform}-${process.arch}`;
if (!TARGETS.includes(target)) throw new Error(`Unknown target "${target}". Targets: ${TARGETS.join(', ')}.`);
const [platform = '', arch = ''] = target.split('-');
const n = names(config);
const out = join(root, 'out');

const bundles: Record<string, string> = { darwin: join(out, `${config.productName}-darwin-${arch}`, `${config.productName}.app`), win32: join(out, `${config.exeName}-win32-${arch}`, `${config.exeName}.exe`), linux: join(out, `${n.linuxName}-linux-${arch}`, n.linuxName) };
const bundle = bundles[platform] ?? '';
const executable = platform === 'darwin' ? join(bundle, 'Contents', 'MacOS', config.exeName) : bundle;
if (!existsSync(bundle)) throw new Error(`${bundle} is missing. Run "node scripts/package.ts ${target}" first.`);

const failures: string[] = [];
interface Probe {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}
const report: { at: string; target: string; host: string; wire: Record<string, { state: string; want: string }>; probes: Record<string, unknown>; failures?: string[]; passed?: boolean } = {
  at: new Date().toISOString(),
  target,
  host: `${process.platform}-${process.arch}`,
  wire: {},
  probes: {},
};
const probes = report.probes;

// ---- 1. the wire ---------------------------------------------------------------------
const wire = await getCurrentFuseWire(bundle);
const stateName = (state: unknown) => Object.entries(FuseState).find(([, v]) => v === state)?.[0] ?? String(state);
const want: Partial<Record<FuseV1Options, boolean>> = fusesFor(platform);
for (const name of FUSE_NAMES) {
  const key = FuseV1Options[name];
  const state = wire[key];
  const on = state === FuseState.ENABLE;
  report.wire[name] = { state: stateName(state), want: want[key] ? 'ENABLE' : 'DISABLE' };
  if (state !== FuseState.ENABLE && state !== FuseState.DISABLE) failures.push(`fuse ${name} is ${stateName(state)} (not flipped)`);
  else if (on !== want[key]) failures.push(`fuse ${name} is ${on ? 'on' : 'off'}, scripts/lib/fuses.ts wants it ${want[key] ? 'on' : 'off'}`);
}

// ---- 2. the doors, on the app's own system -----------------------------------------------
const scratch = mkdtempSync(join(tmpdir(), 'fuses-check-'));
const commandLaunch = (extraArgs: string[], env: Record<string, string> = {}): Probe => {
  const dataDir = mkdtempSync(join(scratch, 'data-'));
  // "--" ends Node's own options when the binary runs as Node (otherwise Node rejects the app's
  // flags and the probe proves nothing); the app's argument classifier ignores it.
  const r = spawnSync(executable, [...extraArgs, '--', `--data-dir=${dataDir}`, `--diagnostics=${join(dataDir, 'd.json')}`], {
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '', ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { status: r.status, signal: r.signal, stdout: (r.stdout ?? '').slice(0, 600), stderr: (r.stderr ?? '').slice(0, 1200), timedOut: (r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT' };
};
const own = process.platform === platform && process.arch === arch;
if (own) {
  const marker = join(scratch, 'node-options-ran.txt');
  const probe = join(scratch, 'probe.cjs');
  writeFileSync(probe, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran');\n`);

  // RunAsNode: the probe must agree with the wire, whichever way the fuse is set.
  const asNode = commandLaunch(['-e', 'process.stdout.write("RAN_AS_NODE")'], { ELECTRON_RUN_AS_NODE: '1' });
  const ranAsNode = asNode.stdout.includes('RAN_AS_NODE');
  probes['runAsNode'] = { ...asNode, ranAsNode, fuseOn: Boolean(want[FuseV1Options.RunAsNode]), reason: want[FuseV1Options.RunAsNode] ? RUN_AS_NODE_REASON : null };
  if (ranAsNode !== Boolean(want[FuseV1Options.RunAsNode])) failures.push(`ELECTRON_RUN_AS_NODE=1 ${ranAsNode ? 'ran' : 'did not run'} a script as Node.js, but the RunAsNode fuse is meant to be ${want[FuseV1Options.RunAsNode] ? 'on' : 'off'}`);

  const nodeOptions = commandLaunch([], { NODE_OPTIONS: `--require=${probe}` });
  probes['nodeOptions'] = { ...nodeOptions, markerWritten: existsSync(marker) };
  if (existsSync(marker)) failures.push('NODE_OPTIONS=--require ran a file inside the app');

  const inspect = commandLaunch(['--inspect=0']);
  probes['inspect'] = inspect;
  if (/Debugger listening/i.test(inspect.stderr + inspect.stdout)) failures.push('--inspect started a debugger in the main process');

  // The control probe: the same command launch with nothing tried must end on its own, quickly
  // and without a window, or the probes above prove nothing.
  const plain = commandLaunch([]);
  probes['plain'] = plain;
  if (plain.timedOut) failures.push('the packaged app did not end after a command launch with no app running (the probes need it to)');

  if (platform === 'darwin' && want[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]) {
    const copy = join(scratch, `${config.productName}.app`);
    cpSync(bundle, copy, { recursive: true, verbatimSymlinks: true });
    const asar = join(copy, 'Contents', 'Resources', 'app.asar');
    const intact = spawnSync(join(copy, 'Contents', 'MacOS', config.exeName), [`--data-dir=${join(scratch, 'copy-intact')}`, `--diagnostics=${join(scratch, 'copy-intact.json')}`], { encoding: 'utf8', timeout: 30_000 });
    // Change one byte inside a file the app loads at start (dist/electron/main.mjs). Integrity
    // covers the archive's header and the blocks of each file as it is read, not bytes appended
    // after them (an appended byte went undetected in the first run), so the edit must be in a
    // file. The marker is a string the code uses, which bundling keeps (a comment it may drop).
    const bytes = readFileSync(asar);
    const at = bytes.indexOf(Buffer.from('NetworkServiceInProcess2'));
    if (at === -1) throw new Error('could not find dist/electron/main.mjs inside app.asar to change');
    bytes[at] = 'X'.charCodeAt(0); // the marker begins with 'N', so 'X' is a real change
    writeFileSync(asar, bytes);
    const tampered = spawnSync(join(copy, 'Contents', 'MacOS', config.exeName), [`--data-dir=${join(scratch, 'copy-tampered')}`, `--diagnostics=${join(scratch, 'copy-tampered.json')}`], { encoding: 'utf8', timeout: 30_000 });
    const replied = (r: { stdout?: string | null }) => /"answered"/.test(r.stdout ?? '');
    probes['asarIntegrity'] = { intact: { status: intact.status, signal: intact.signal, replied: replied(intact) }, tampered: { status: tampered.status, signal: tampered.signal, replied: replied(tampered), stderr: (tampered.stderr ?? '').slice(-600) } };
    if (!replied(intact)) failures.push('the unchanged copy of the app did not run its command launch, so the tamper probe proves nothing');
    if (replied(tampered)) failures.push('a copy of the app with app.asar changed still ran its code');
  }
} else {
  probes['skipped'] = `the probes run only on ${platform}-${arch}; this is ${process.platform}-${process.arch}`;
}
rmSync(scratch, { recursive: true, force: true });

report.failures = failures;
report.passed = failures.length === 0;
mkdirSync(join(root, 'qa', 'evidence'), { recursive: true });
writeFileSync(join(root, 'qa', 'evidence', `fuses-${target}.json`), JSON.stringify(report, null, 2));
for (const [name, v] of Object.entries(report.wire)) console.log(`${v.state === v.want ? 'ok  ' : 'FAIL'} ${name}: ${v.state}`);
if (probes['skipped']) console.log(probes['skipped']);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`fuses check passed for ${target}${own ? ', with every probe' : ' (wire only)'}`);
