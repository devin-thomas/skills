import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  getCompatibleDiscoveryPaths,
  hostAdapters,
  HostAdapterError,
  qualifiesGrokBotAccountRuntime,
  resolveHostTarget,
  resolveHostTargetResult,
} from '../../dist/hosts/index.js';

const project = 'repo';
const home = 'user-home';
const options = (scope) => ({ scope, projectRoot: project, homeDir: home });

test('all six host adapters resolve project and user-global skill roots', () => {
  const roots = {
    codex: { project: '.agents/skills', global: '.agents/skills' },
    claude: { project: '.claude/skills', global: '.claude/skills' },
    cursor: { project: '.cursor/skills', global: '.cursor/skills' },
    antigravity: { project: '.agents/skills', global: '.gemini/config/skills' },
    grokbot: { project: '.agents/skills', global: '' },
    grokcli: { project: '.grok/skills', global: '.grok/skills' },
  };

  assert.deepEqual(Object.keys(hostAdapters).sort(), Object.keys(roots).sort());
  for (const [id, expected] of Object.entries(roots)) {
    for (const scope of ['project', 'global']) {
      if (id === 'grokbot' && scope === 'global') {
        assert.throws(
          () => resolveHostTarget(id, options(scope)),
          (error) => error instanceof HostAdapterError && error.code === 'unsupported-account-scope',
        );
        continue;
      }
      const targetOptions = id === 'antigravity' && scope === 'global'
        ? { ...options(scope), surface: 'ide' }
        : options(scope);
      const target = resolveHostTarget(id, targetOptions);
      const rootPath = scope === 'project' ? project : home;
      assert.equal(target.id, id);
      assert.equal(target.scope, scope);
      assert.equal(target.rootPath, rootPath);
      assert.equal(target.installDir, path.join(rootPath, expected[scope]));
    }
  }
});

test('Antigravity global target requires an explicit documented surface', () => {
  assert.throws(
    () => resolveHostTarget('antigravity', options('global')),
    (error) => error instanceof HostAdapterError && error.code === 'surface-required',
  );
  assert.equal(
    resolveHostTarget('antigravity', { ...options('global'), surface: 'ide' }).installDir,
    path.join(home, '.gemini/config/skills'),
  );
  assert.equal(
    resolveHostTarget('antigravity', { ...options('global'), surface: 'cli' }).installDir,
    path.join(home, '.gemini/antigravity-cli/skills'),
  );
});

test('Cursor reuses shared project skills only when the caller confirms existing ownership', () => {
  assert.equal(resolveHostTarget('cursor', options('project')).installDir, path.join(project, '.cursor/skills'));
  assert.equal(
    resolveHostTarget('cursor', { ...options('project'), reuseSharedAgents: true }).installDir,
    path.join(project, '.agents/skills'),
  );
  assert.equal(
    resolveHostTarget('cursor', { ...options('global'), reuseSharedAgents: true }).installDir,
    path.join(home, '.cursor/skills'),
  );
});

test('Grok Bot account scope refuses to write outside the Bot execution user', () => {
  const result = resolveHostTargetResult('grokbot', options('global'));
  assert.equal(result.status, 'unsupported');
  if (result.status === 'unsupported') {
    assert.equal(result.code, 'unsupported-account-scope');
    assert.match(result.message, /Bot's Linux execution computer/i);
    assert.match(result.message, /No files were written/);
  }
  assert.equal(resolveHostTarget('grokbot', options('project')).installDir, path.join(project, '.agents/skills'));
  assert.equal(resolveHostTarget('grokcli', options('global')).installDir, path.join(home, '.grok/skills'));
});

test('Grok Bot account route requires matching Linux home, real library path, and ownership', () => {
  const valid = {
    platform: 'linux', uid: 1000, selectedHome: '/home/box', processHome: '/home/box',
    actualHome: '/home/box', actualLibrary: '/home/box/agent-data/workflows',
    libraryIsDirectory: true, libraryIsSymlink: false, libraryOwnerUid: 1000,
  };
  assert.equal(qualifiesGrokBotAccountRuntime(valid), true);
  for (const changed of [
    { platform: 'win32' }, { uid: 0 }, { selectedHome: '/home/alice' },
    { processHome: '/home/alice' }, { actualHome: '/mnt/box' },
    { actualLibrary: '/tmp/workflows' }, { libraryIsDirectory: false },
    { libraryIsSymlink: true }, { libraryOwnerUid: 1001 },
  ]) {
    assert.equal(qualifiesGrokBotAccountRuntime({ ...valid, ...changed }), false);
  }
});

test('Grok CLI compatibility paths are reported without creating duplicate destinations', () => {
  assert.deepEqual(getCompatibleDiscoveryPaths('grokcli', options('project')), [
    path.join(project, '.claude/skills'),
    path.join(project, '.agents/skills'),
  ]);
  assert.deepEqual(getCompatibleDiscoveryPaths('grokcli', options('global')), [
    path.join(home, '.claude/skills'),
    path.join(home, '.agents/skills'),
  ]);
  assert.deepEqual(getCompatibleDiscoveryPaths('grokbot', options('project')), []);
});
