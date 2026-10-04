import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  findConflictingBundledSkills,
  planFreshGrokBotLibrary,
  populateFreshGrokBotLibrary,
  runGrokBotPostinstall,
  shouldPopulateGrokBotLibrary,
} from '../../dist/cli/grokbot-postinstall.js';
import { parseArgs } from '../../dist/cli/args.js';
import { runCli } from '../../dist/cli/node-runtime.js';
import { catalogBundle } from '../../dist/generated/bundle.js';

const noConflicts = async (ids) => ({ eligibleIds: ids, skipped: [] });

test('postinstall runs only for global npm installation on a qualified Bot runtime', () => {
  const valid = { npmGlobal: 'true', lifecycleEvent: 'postinstall', accountTargetReady: true };
  assert.equal(shouldPopulateGrokBotLibrary(valid), true);
  assert.equal(shouldPopulateGrokBotLibrary({ ...valid, npmGlobal: 'false' }), false);
  assert.equal(shouldPopulateGrokBotLibrary({ ...valid, npmGlobal: undefined }), false);
  assert.equal(shouldPopulateGrokBotLibrary({ ...valid, lifecycleEvent: 'prepack' }), false);
  assert.equal(shouldPopulateGrokBotLibrary({ ...valid, accountTargetReady: false }), false);
});

test('fresh Bot library receives the selected bundled IDs through the guarded CLI', async () => {
  const calls = [];
  const message = await populateFreshGrokBotLibrary(['one', 'two'], async (args) => {
    calls.push(args);
    return { exitCode: 0, result: { data: { installed: [] } } };
  }, () => noConflicts(['one', 'two']));
  assert.match(message, /Installed 2 bundled/);
  assert.deepEqual(calls, [
    ['doctor', '--host', 'grokbot', '--global', '--json'],
    ['add', 'one', 'two', '--host', 'grokbot', '--global', '--json'],
  ]);
});

test('postinstall preserves an existing managed Bot library and saved channels', async () => {
  const calls = [];
  const message = await populateFreshGrokBotLibrary(['one'], async (args) => {
    calls.push(args);
    return { exitCode: 0, result: { data: { roots: ['other'] } } };
  }, () => { throw new Error('preflight should not run for managed roots'); });
  assert.match(message, /update --host grokbot --global/);
  assert.equal(calls.length, 1);
});

test('postinstall surfaces preflight and installation failures', async () => {
  await assert.rejects(
    populateFreshGrokBotLibrary(['one'], async () => ({ exitCode: 1, result: { error: { message: 'modified file' } } }), () => noConflicts(['one'])),
    /preflight failed: modified file/,
  );
  await assert.rejects(
    populateFreshGrokBotLibrary(['one'], async (args) => args[0] === 'doctor'
      ? { exitCode: 0, result: { data: { installed: [] } } }
      : { exitCode: 5, result: { error: { message: 'unowned destination' } } }, () => noConflicts(['one'])),
    /installation failed: unowned destination/,
  );
});

test('fresh Bot install skips a conflicting folder and installs all independent skills in one batch', async (t) => {
  const project = await mkdtemp(join(tmpdir(), 'uppercut-skills-bot-conflict-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const library = join(project, '.agents', 'skills');
  const localSkill = join(library, 'grill-to-build', 'SKILL.md');
  await mkdir(dirname(localSkill), { recursive: true });
  await writeFile(localSkill, 'local version of grill-to-build');

  const ids = catalogBundle.manifest.skills.map(({ id }) => id);
  const conflicts = await findConflictingBundledSkills(catalogBundle, library);
  assert.deepEqual(conflicts, ['grill-to-build']);
  const plan = planFreshGrokBotLibrary(ids, catalogBundle.manifest, conflicts);
  assert.equal(plan.eligibleIds.length, ids.length - 1);
  assert.deepEqual(plan.skipped, [{ id: 'grill-to-build', blockedBy: ['grill-to-build'] }]);

  const result = await runCli(parseArgs([
    'add', ...plan.eligibleIds, '--host', 'codex', '--project', project, '--json',
  ]), { catalogBundle });
  assert.equal(result.exitCode, 0);
  assert.equal(result.result.data.state.roots.length, ids.length - 1);
  assert.equal(result.result.data.state.skills['grill-to-build'], undefined);
  assert.deepEqual(await readFile(localSkill, 'utf8'), 'local version of grill-to-build');
  assert.ok(result.result.data.state.skills['no-useless-copy']);
  const doctor = await runCli(parseArgs(['doctor', '--host', 'codex', '--project', project, '--json']), { catalogBundle });
  assert.equal(doctor.exitCode, 0);
  assert.deepEqual(doctor.result.data.installed, plan.eligibleIds);
});

test('postinstall skips dependency roots blocked by an existing conflict and reports the skip', async () => {
  const ids = ['execute-task', 'execute-task-cycles', 'no-useless-copy'];
  const plan = planFreshGrokBotLibrary(ids, catalogBundle.manifest, ['execute-task']);
  assert.deepEqual(plan.eligibleIds, ['no-useless-copy']);
  assert.deepEqual(plan.skipped, [
    { id: 'execute-task', blockedBy: ['execute-task'] },
    { id: 'execute-task-cycles', blockedBy: ['execute-task'] },
  ]);
  const calls = [];
  const message = await populateFreshGrokBotLibrary(ids, async (args) => {
    calls.push(args);
    return { exitCode: 0, result: { data: { roots: [] } } };
  }, async () => plan);
  assert.deepEqual(calls[1], ['add', 'no-useless-copy', '--host', 'grokbot', '--global', '--json']);
  assert.match(message, /Installed 1 bundled/);
  assert.match(message, /Skipped execute-task/);
  assert.match(message, /execute-task-cycles/);
});

test('preflight recognizes an exact existing folder and rejects extra files', async (t) => {
  const library = await mkdtemp(join(tmpdir(), 'uppercut-skills-bot-preflight-'));
  t.after(() => rm(library, { recursive: true, force: true }));
  const skillDir = join(library, 'no-useless-copy');
  for (const file of catalogBundle.skills['no-useless-copy'].files) {
    const path = join(skillDir, ...file.path.split('/'));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(file.contentBase64, 'base64'));
  }
  assert.deepEqual(await findConflictingBundledSkills(catalogBundle, library), []);
  await writeFile(join(skillDir, 'user-notes.md'), 'keep this');
  assert.deepEqual(await findConflictingBundledSkills(catalogBundle, library), ['no-useless-copy']);
});

test('ordinary runtime invokes no installation from postinstall', async () => {
  assert.match(await runGrokBotPostinstall(), /untouched/);
});
