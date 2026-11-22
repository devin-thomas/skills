// Checks the helper programs inside an installed copy of the app, from the
// installed location, with PATH emptied. The installed check on each system
// runs this file with the installed app's own executable acting as Node:
//
//   ELECTRON_RUN_AS_NODE=1 <installed app executable> installed-helpers.cjs --out <file.json>
//
// so the helpers are started by the same signed program that starts them in
// use, by absolute path, with no shell (build 2: a hardened macOS app needs no
// entitlement to start a program inside its own bundle, and this is how that
// was proven). It can also be run with plain Node:
//
//   node scripts/installed-helpers.cjs --resources <resources folder> --out <file.json>
//
// What it records: the files in bin/<platform>-<arch>/ against manifest.json,
// their executable bits, the tool's answer to --capabilities, and the notices
// file. Add each helper's own version call and one real job through the tool
// when the app has them (build 2 rendered a WAV and an MP3 here). It needs no
// display and opens no window. Exit code 1 if a check failed.
//
// The installed checks call it as scripts/installed-helpers.cjs, by that name: that file is built
// from this one by scripts/emit-plain-node.ts and committed, so it runs with no build.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? null) : null;
};
const guess = () => {
  const dir = path.dirname(process.execPath);
  return process.platform === 'darwin' ? path.resolve(dir, '..', 'Resources') : path.join(dir, 'resources');
};
// process.resourcesPath exists only in Electron (the installed app acting as Node).
const electronResources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
const resources = path.resolve(option('--resources') ?? (process.versions['electron'] ? (electronResources ?? guess()) : guess()));
const outFile = option('--out');
const target = `${process.platform}-${process.arch}`;
const binDir = path.join(resources, 'bin', target);
// Nothing from PATH. Windows needs SystemRoot to start any program at all.
const env: NodeJS.ProcessEnv = process.platform === 'win32' ? { SystemRoot: process.env['SystemRoot'] ?? 'C:\\Windows', PATH: '' } : { PATH: '' };

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
const report: { at: string; runBy: string; execPath: string; resources: string; target: string; pathGivenToHelpers: string | undefined; checks: Check[]; tool?: unknown; passed?: boolean } = {
  at: new Date().toISOString(),
  runBy: process.versions['electron'] ? `the installed app as Node (Electron ${process.versions['electron']})` : `node ${process.version}`,
  execPath: process.execPath,
  resources,
  target,
  pathGivenToHelpers: env['PATH'],
  checks: [],
};
let failed = false;
function check(name: string, ok: unknown, detail: unknown = ''): void {
  report.checks.push({ name, ok: Boolean(ok), detail: String(detail) });
  if (!ok) failed = true;
}
const run = (file: string, argv: string[]) => {
  const r = spawnSync(file, argv, { env, cwd: os.tmpdir(), encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, shell: false });
  return { code: r.status, signal: r.signal, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error ? r.error.message : null };
};
const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

interface ManifestFile {
  name: string;
  sha256: string;
  kind?: string;
}
interface Manifest {
  files?: ManifestFile[];
  hashedBeforeSigning?: boolean;
}
let manifest: Manifest | null = null;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(binDir, 'manifest.json'), 'utf8')) as Manifest | null;
  check('manifest.json is inside the app', true, path.join(binDir, 'manifest.json'));
} catch (error) {
  check('manifest.json is inside the app', false, error instanceof Error ? error.message : String(error));
}

for (const entry of manifest?.files ?? []) {
  const file = path.join(binDir, entry.name);
  const there = fs.existsSync(file);
  check(`${entry.name} is installed`, there, file);
  if (!there) continue;
  if (process.platform !== 'win32') check(`${entry.name} is executable`, (fs.statSync(file).mode & 0o111) !== 0);
  // macOS signing rewrites each file after the manifest was written; the signature check covers it there.
  if (!manifest?.hashedBeforeSigning) check(`${entry.name} matches the manifest`, sha256(file) === entry.sha256, entry.sha256);
}

const tool = (manifest?.files ?? []).find((f) => f.kind);
if (tool) {
  const answer = run(path.join(binDir, tool.name), ['--capabilities']);
  let doc: { schema?: unknown } | null = null;
  try {
    doc = JSON.parse(answer.stdout) as { schema?: unknown } | null;
  } catch {
    // reported below
  }
  report.tool = { kind: tool.kind, code: answer.code, error: answer.error, capabilities: doc };
  if (tool.kind === 'placeholder') check('the placeholder tool answers --capabilities with its placeholder schema', doc?.schema === 'example-placeholder', JSON.stringify(doc));
  else check('the tool answers --capabilities from inside the app with PATH emptied', answer.code === 0 && doc && typeof doc.schema === 'string', `${answer.code} ${answer.error ?? ''} ${answer.stderr.slice(0, 200)}`);
}

check('the notices file is inside the app', fs.existsSync(path.join(resources, 'THIRD-PARTY-NOTICES.txt')), path.join(resources, 'THIRD-PARTY-NOTICES.txt'));

report.passed = !failed;
const text = `${report.checks.map((c) => `${c.ok ? 'ok    ' : 'FAILED'} ${c.name}${c.detail ? `: ${c.detail}` : ''}`).join('\n')}\n${failed ? 'helpers: FAILED' : 'helpers: ok'}\n`;
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
process.stdout.write(text);
process.exit(failed ? 1 : 0);
