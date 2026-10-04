import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { catalogBundle } from '../../dist/generated/bundle.js';
import { parseArgs } from '../../dist/cli/args.js';
import { runCli } from '../../dist/cli/node-runtime.js';

test('catalog list and show are host-free and return the versioned result envelope', async () => {
  const list = await runCli(parseArgs(['list', '--json']), { catalogBundle });
  assert.equal(list.exitCode, 0);
  assert.equal(list.result.schema, 'uppercut.skills.result/v1');
  assert.equal(list.result.data.length, 15);

  const show = await runCli(parseArgs(['show', 'quick-build', '--json']), { catalogBundle });
  assert.equal(show.exitCode, 0);
  assert.equal(show.result.data[0].id, 'quick-build');
  assert.ok(show.result.data[0].resources.includes('SKILL.md'));
});

test('ambiguous non-interactive host selection returns host-required without writes', async () => {
  const result = await runCli(parseArgs(['add', 'quick-build', '--json']), { catalogBundle }, process.cwd(), process.cwd());
  assert.equal(result.exitCode, 2);
  assert.equal(result.result.error.code, 'host-required');
});

test('Grok Bot global install outside its execution user reports unsupported without writes', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'uppercut-skills-not-bot-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const result = await runCli(
    parseArgs(['add', 'execute-task-cycles', '--host', 'grokbot', '--global', '--json']),
    { catalogBundle }, home, home,
  );
  assert.equal(result.exitCode, 2);
  assert.equal(result.result.error.code, 'unsupported-account-scope');
  assert.equal(existsSync(join(home, 'agent-data', 'workflows')), false);
});

test('install conflict returns the safe path guidance and conflict exit code', async (t) => {
  const project = await mkdtemp(join(tmpdir(), 'uppercut-skills-cli-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const destination = join(project, '.agents', 'skills', 'quick-build');
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'SKILL.md'), 'locally owned');

  const result = await runCli(parseArgs(['add', 'quick-build', '--host', 'codex', '--project', project, '--json']), { catalogBundle });
  assert.equal(result.exitCode, 5);
  assert.equal(result.result.error.code, 'local-conflict');
  assert.match(result.result.error.message, /Existing skill files do not exactly match the planned bundle/);
  assert.match(result.result.error.message, /quick-build/);
});

test('CLI adopts an exact existing skill tree and doctor recognizes its receipts', async (t) => {
  const project = await mkdtemp(join(tmpdir(), 'uppercut-skills-adopt-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const skill = catalogBundle.skills['no-useless-copy'];
  const skillDirectory = join(project, '.agents', 'skills', 'no-useless-copy');
  for (const file of skill.files) {
    const destination = join(skillDirectory, ...file.path.split('/'));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(file.contentBase64, 'base64'));
  }

  const options = ['--host', 'codex', '--project', project, '--json'];
  const result = await runCli(parseArgs(['add', 'no-useless-copy', ...options]), { catalogBundle });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(Object.keys(result.result.data.state.skills['no-useless-copy'].files).length, skill.files.length);
  for (const file of skill.files) {
    const destination = join(skillDirectory, ...file.path.split('/'));
    assert.deepEqual(await readFile(destination), Buffer.from(file.contentBase64, 'base64'));
  }
  const doctor = await runCli(parseArgs(['doctor', ...options]), { catalogBundle });
  assert.equal(doctor.exitCode, 0);
  assert.equal(doctor.result.data.healthy, true);
});

test('implicit project install targets the Git root from a nested directory', async (t) => {
  const project = await mkdtemp(join(tmpdir(), 'uppercut-skills-git-root-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const nested = join(project, 'src', 'feature');
  await mkdir(nested, { recursive: true });
  execFileSync('git', ['init', '--initial-branch=main', project], { stdio: 'ignore' });

  const installed = await runCli(parseArgs(['add', 'execute-task', '--host', 'codex', '--json']), { catalogBundle }, nested);
  assert.equal(installed.exitCode, 0);
  assert.ok(existsSync(join(project, '.agents', 'skills', 'execute-task', 'SKILL.md')));
  assert.equal(existsSync(join(nested, '.agents', 'skills', 'execute-task', 'SKILL.md')), false);
});

test('CLI updates saved bundled and GitHub roots together without changing their channels', async (t) => {
  const project = await mkdtemp(join(tmpdir(), 'uppercut-skills-mixed-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const manifest = structuredClone(catalogBundle.manifest);
  const contents = new Map([
    ['manifest/skills.json', Buffer.from(JSON.stringify(manifest))],
    ['execute-task/SKILL.md', Buffer.from('---\nname: execute-task\ndescription: Test skill\n---\n# GitHub Execute Task\n')],
  ]);
  const entries = [...contents].map(([path, bytes]) => ({
    path, type: 'blob', mode: '100644', size: bytes.length,
    sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.hostname === 'api.github.com' && url.pathname.endsWith('/commits/main')) {
      return Response.json({ sha: 'c'.repeat(40), commit: { tree: { sha: 'd'.repeat(40) } } });
    }
    if (url.hostname === 'api.github.com' && url.pathname.includes('/git/trees/')) {
      return Response.json({ sha: 'd'.repeat(40), tree: entries, truncated: false });
    }
    if (url.hostname === 'raw.githubusercontent.com') {
      const path = decodeURIComponent(url.pathname.split('/').slice(4).join('/'));
      const bytes = contents.get(path);
      return bytes ? new Response(bytes) : new Response('', { status: 404 });
    }
    return new Response('', { status: 404 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const options = ['--host', 'codex', '--project', project, '--json'];
  const bundled = await runCli(parseArgs(['add', 'quick-build', ...options]), { catalogBundle });
  assert.equal(bundled.exitCode, 0);
  const github = await runCli(parseArgs(['add', 'execute-task', '--latest', ...options]), { catalogBundle });
  assert.equal(github.exitCode, 0);
  const updated = await runCli(parseArgs(['update', ...options]), { catalogBundle });
  assert.equal(updated.exitCode, 0);
  assert.equal(updated.result.data.state.skills['quick-build'].channel, 'bundled');
  assert.equal(updated.result.data.state.skills['execute-task'].channel, 'github');
  assert.equal(updated.result.data.state.skills['execute-task'].sourceRevision, 'c'.repeat(40));
});
