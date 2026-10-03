import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('install conflict returns the safe path guidance and conflict exit code', async (t) => {
  const project = await mkdtemp(join(tmpdir(), 'uppercut-skills-cli-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const destination = join(project, '.agents', 'skills', 'quick-build');
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'SKILL.md'), 'locally owned');

  const result = await runCli(parseArgs(['add', 'quick-build', '--host', 'codex', '--project', project, '--json']), { catalogBundle });
  assert.equal(result.exitCode, 5);
  assert.equal(result.result.error.code, 'local-conflict');
  assert.match(result.result.error.message, /Destination is not owned by this installer/);
  assert.match(result.result.error.message, /quick-build[\\/]SKILL\.md/);
});
