import assert from 'node:assert/strict';
import test from 'node:test';
import {
  populateFreshGrokBotLibrary,
  runGrokBotPostinstall,
  shouldPopulateGrokBotLibrary,
} from '../../dist/cli/grokbot-postinstall.js';

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
  });
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
  });
  assert.match(message, /update --host grokbot --global/);
  assert.equal(calls.length, 1);
});

test('postinstall surfaces preflight and installation failures', async () => {
  await assert.rejects(
    populateFreshGrokBotLibrary(['one'], async () => ({ exitCode: 1, result: { error: { message: 'modified file' } } })),
    /preflight failed: modified file/,
  );
  await assert.rejects(
    populateFreshGrokBotLibrary(['one'], async (args) => args[0] === 'doctor'
      ? { exitCode: 0, result: { data: { installed: [] } } }
      : { exitCode: 5, result: { error: { message: 'unowned destination' } } }),
    /installation failed: unowned destination/,
  );
});

test('ordinary runtime invokes no installation from postinstall', async () => {
  assert.match(await runGrokBotPostinstall(), /untouched/);
});
