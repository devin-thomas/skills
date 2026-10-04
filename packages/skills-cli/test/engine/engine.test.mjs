import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import test from 'node:test';
import { installSkills, removeSkills, updateSkills } from '../../dist/engine/index.js';

const revision = 'b'.repeat(40);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function skill(id, prerequisites = []) {
  return { id, slug: id, title: id, summary: id, category: 'build', order: 1, sourceRepo: 'devin-thomas/skills', sourcePath: `${id}/SKILL.md`, sourceVersion: null, sourceRevision: revision, sourceRef: 'main', public: true, ownedBy: 'devin-thomas', relatedSkills: [], prerequisites, recommendationOnly: false };
}

function fixture() {
  const base = skill('surface-sweep');
  const root = skill('surface-sweep-showcase', [{ skillId: base.id }]);
  const snapshot = { version: '1.0.0', categories: ['plan', 'build', 'specialized', 'fun'], skills: [base, root] };
  const skills = Object.fromEntries(snapshot.skills.map((entry) => {
    const bytes = Buffer.from(`# ${entry.id}\n`);
    return [entry.id, { sourceRevision: revision, files: [{ path: 'SKILL.md', contentBase64: bytes.toString('base64'), sha256: digest(bytes) }] }];
  }));
  const bundle = { schemaVersion: '1.0.0', manifest: snapshot, skills };
  const files = new Map();
  const states = new Map();
  const journals = new Map();
  const ports = {
    fs: {
      readFile: async (path) => files.get(path),
      listFiles: async (directory) => [...files.keys()].filter((path) => path.startsWith(`${resolve(directory)}${sep}`)),
      assertSafePath: async () => {},
      writeFile: async (path, bytes) => files.set(path, Uint8Array.from(bytes)),
      mkdir: async () => {},
      remove: async (path) => { files.delete(path); },
    },
    state: { load: async (key) => states.get(key), save: async (key, state) => { states.set(key, structuredClone(state)); } },
    lock: { withLock: async (_key, action) => action() },
    journal: {
      load: async (key) => journals.get(key),
      save: async (key, journal) => { journals.set(key, structuredClone(journal)); },
      clear: async (key) => { journals.delete(key); },
    },
  };
  const request = { requestedIds: ['surface-sweep-showcase'], snapshot, bundle, target: { id: 'cursor', scope: 'project', rootPath: '/project', installDir: '/project/.agents/skills' }, stateKey: '/project/.uppercut-skills' };
  return { request, ports, files, states, journals };
}

function seedBundledFiles(request, files, ids = ['surface-sweep', 'surface-sweep-showcase']) {
  for (const id of ids) {
    for (const file of request.bundle.skills[id].files) {
      files.set(join(resolve(request.target.installDir), id, ...file.path.split('/')), Buffer.from(file.contentBase64, 'base64'));
    }
  }
}

test('install adopts a complete byte-identical bundle without rewriting files', async () => {
  const { request, ports, files, states, journals } = fixture();
  seedBundledFiles(request, files);
  let writes = 0;
  const write = ports.fs.writeFile;
  ports.fs.writeFile = async (...args) => { writes += 1; await write(...args); };
  const before = new Map([...files].map(([path, bytes]) => [path, Uint8Array.from(bytes)]));

  const result = await installSkills(request, ports);

  assert.equal(result.outcome, 'complete');
  assert.deepEqual(result.changes.map(({ skillId }) => skillId), ['surface-sweep', 'surface-sweep-showcase']);
  assert.equal(writes, 0);
  assert.deepEqual([...files.keys()], [...before.keys()]);
  for (const [path, bytes] of before) assert.deepEqual(Uint8Array.from(files.get(path)), bytes);
  assert.deepEqual(states.get(request.stateKey), result.state);
  assert.equal(journals.has(request.stateKey), false);
  assert.deepEqual(Object.keys(result.state.skills), ['surface-sweep', 'surface-sweep-showcase']);
});

test('install refuses adoption when an existing skill has different bytes', async () => {
  const { request, ports, files, states, journals } = fixture();
  seedBundledFiles(request, files);
  files.set(join(resolve(request.target.installDir), 'surface-sweep-showcase', 'SKILL.md'), Buffer.from('local edit'));

  await assert.rejects(installSkills(request, ports), /differs from the planned bundle/i);

  assert.equal(states.has(request.stateKey), false);
  assert.equal(journals.has(request.stateKey), false);
});

test('install refuses partial and extra-file skill trees during adoption', async (t) => {
  await t.test('partial bundle', async () => {
    const { request, ports, files, states } = fixture();
    const extraBytes = Buffer.from('extra planned file');
    request.bundle.skills['surface-sweep'].files.push({
      path: 'README.md',
      contentBase64: extraBytes.toString('base64'),
      sha256: digest(extraBytes),
    });
    files.set(join(resolve(request.target.installDir), 'surface-sweep', 'SKILL.md'), Buffer.from('# surface-sweep\n'));

    await assert.rejects(installSkills({ ...request, requestedIds: ['surface-sweep'] }, ports), /do not exactly match/i);
    assert.equal(states.has(request.stateKey), false);
  });

  await t.test('extra unowned file', async () => {
    const { request, ports, files, states } = fixture();
    seedBundledFiles(request, files);
    const notePath = join(resolve(request.target.installDir), 'surface-sweep-showcase', 'NOTES.md');
    files.set(notePath, Buffer.from('keep me'));

    await assert.rejects(installSkills(request, ports), /do not exactly match/i);
    assert.equal(states.has(request.stateKey), false);
    assert.equal(files.get(notePath).toString(), 'keep me');
  });
});

test('install refuses adoption when listing detects a symlinked entry', async () => {
  const { request, ports, files, states } = fixture();
  seedBundledFiles(request, files);
  const listFiles = ports.fs.listFiles;
  ports.fs.listFiles = async (directory) => {
    if (directory.endsWith(`${sep}surface-sweep`)) throw new Error('Managed path is a symlink');
    return listFiles(directory);
  };

  await assert.rejects(installSkills(request, ports), /symlink/i);

  assert.equal(states.has(request.stateKey), false);
});

test('install resolves dependencies, repeats as unchanged, and remove retains promoted roots', async () => {
  const { request, ports, files } = fixture();
  const first = await installSkills(request, ports);
  assert.deepEqual(first.resolvedIds, ['surface-sweep', 'surface-sweep-showcase']);
  assert.equal(files.size, 2);
  assert.equal((await installSkills(request, ports)).outcome, 'unchanged');
  await installSkills({ ...request, requestedIds: ['surface-sweep'] }, ports);
  await removeSkills(request, ports);
  assert.equal(files.size, 1);
});

test('remove preserves modified managed bytes and rejects the operation', async () => {
  const { request, ports, files } = fixture();
  await installSkills(request, ports);
  const path = [...files.keys()][0];
  files.set(path, Buffer.from('user edit'));
  await assert.rejects(removeSkills(request, ports), /modified/i);
  assert.equal(files.get(path).toString(), 'user edit');
});

test('remove uses saved dependency receipts when the selected ID is absent from a stale catalog', async () => {
  const { request, ports, files } = fixture();
  await installSkills(request, ports);
  await installSkills({ ...request, requestedIds: ['surface-sweep'] }, ports);
  const staleRequest = { ...request, snapshot: { ...request.snapshot, skills: [request.snapshot.skills[0]] } };
  await removeSkills(staleRequest, ports);
  assert.equal(files.size, 1);
});

test('a partially written dependency transaction restores every touched destination', async () => {
  const { request, ports, files } = fixture();
  const write = ports.fs.writeFile;
  let writes = 0;
  ports.fs.writeFile = async (path, bytes) => {
    await write(path, bytes);
    writes += 1;
    if (writes === 2) throw new Error('simulated disk failure');
  };
  await assert.rejects(installSkills(request, ports), /simulated disk failure/);
  assert.equal(files.size, 0);
});

test('no-dependencies installs only explicit roots and reports a degraded result', async () => {
  const { request, ports, files } = fixture();
  const result = await installSkills({ ...request, includeDependencies: false }, ports);
  assert.equal(result.outcome, 'degraded');
  assert.deepEqual(result.resolvedIds, ['surface-sweep-showcase']);
  assert.equal(files.size, 1);
});

test('tampered receipts cannot direct removal outside the selected install directory', async () => {
  const { request, ports, files, states } = fixture();
  await installSkills(request, ports);
  const state = states.get(request.stateKey);
  const receipt = state.skills['surface-sweep-showcase'];
  const originalPath = Object.keys(receipt.files)[0];
  const outsidePath = '/outside/keep.txt';
  receipt.files[outsidePath] = receipt.files[originalPath];
  delete receipt.files[originalPath];
  files.set(outsidePath, Buffer.from('user data'));
  await assert.rejects(removeSkills(request, ports), /escapes installation target/i);
  assert.equal(files.get(outsidePath).toString(), 'user data');
});

test('an interrupted transaction journal restores original bytes before the next update', async () => {
  const { request, ports, files, states, journals } = fixture();
  await installSkills(request, ports);
  const path = [...files.keys()][0];
  const original = Uint8Array.from(files.get(path));
  const stateBefore = structuredClone(states.get(request.stateKey));
  const partial = Buffer.from('partially written bytes');
  files.set(path, partial);
  journals.set(request.stateKey, {
    version: 1,
    stateBefore,
    files: [{ path, existed: true, afterExisted: true, bytesBase64: Buffer.from(original).toString('base64'), sha256: digest(original), afterSha256: digest(partial) }],
  });
  const result = await installSkills(request, ports);
  assert.equal(result.outcome, 'unchanged');
  assert.deepEqual(files.get(path), original);
  assert.equal(journals.has(request.stateKey), false);
});

test('recovery preserves bytes that do not match either the before or planned result', async () => {
  const { request, ports, files, states, journals } = fixture();
  await installSkills(request, ports);
  const path = [...files.keys()][0];
  const original = Uint8Array.from(files.get(path));
  const unexpected = Buffer.from('user edit after interruption');
  files.set(path, unexpected);
  journals.set(request.stateKey, {
    version: 1,
    stateBefore: structuredClone(states.get(request.stateKey)),
    files: [{ path, existed: true, afterExisted: true, bytesBase64: Buffer.from(original).toString('base64'), sha256: digest(original), afterSha256: digest(Buffer.from('planned bytes')) }],
  });
  await assert.rejects(installSkills(request, ports), /preserving it for manual recovery/i);
  assert.equal(files.get(path).toString(), unexpected.toString());
  assert.equal(journals.has(request.stateKey), true);
});

function channelSource(revision, label, githubRootDependsOnBundled = false) {
  const entries = [
    skill('surface-sweep'),
    skill('quick-build', githubRootDependsOnBundled ? [{ skillId: 'surface-sweep' }] : []),
  ].map((entry) => ({ ...entry, sourceRevision: revision }));
  const snapshot = { version: '1.0.0', categories: ['plan', 'build', 'specialized', 'fun'], skills: entries };
  const skills = Object.fromEntries(entries.map((entry) => {
    const bytes = Buffer.from(`# ${entry.id} ${label}\n`);
    return [entry.id, { sourceRevision: revision, files: [{ path: 'SKILL.md', contentBase64: bytes.toString('base64'), sha256: digest(bytes) }] }];
  }));
  return { snapshot, bundle: { schemaVersion: '1.0.0', manifest: snapshot, skills } };
}

test('one update refreshes disjoint bundled and GitHub roots from their own sources', async () => {
  const { request, ports, files, states } = fixture();
  const bundledV1 = channelSource('b'.repeat(40), 'bundled-v1');
  const githubV1 = channelSource('c'.repeat(40), 'github-v1');
  const sourcesV1 = { bundled: bundledV1, github: githubV1 };
  await installSkills({ ...request, requestedIds: ['surface-sweep'], ...bundledV1, sources: sourcesV1, channel: 'bundled' }, ports);
  await installSkills({ ...request, requestedIds: ['quick-build'], ...githubV1, sources: sourcesV1, channel: 'github' }, ports);

  const bundledV2 = channelSource('d'.repeat(40), 'bundled-v2');
  const githubV2 = channelSource('e'.repeat(40), 'github-v2');
  const updated = await updateSkills({ ...request, requestedIds: [], ...bundledV2, sources: { bundled: bundledV2, github: githubV2 } }, ports);
  assert.deepEqual(updated.changes.map(({ skillId }) => skillId), ['surface-sweep', 'quick-build']);
  assert.equal(updated.state.rootChannels['surface-sweep'], 'bundled');
  assert.equal(updated.state.rootChannels['quick-build'], 'github');
  assert.equal(updated.state.skills['surface-sweep'].sourceRevision, 'd'.repeat(40));
  assert.equal(updated.state.skills['quick-build'].sourceRevision, 'e'.repeat(40));
  assert.equal(updated.state.skills['surface-sweep'].channel, 'bundled');
  assert.equal(updated.state.skills['quick-build'].channel, 'github');
  const bundledPath = Object.keys(updated.state.skills['surface-sweep'].files)[0];
  const githubPath = Object.keys(updated.state.skills['quick-build'].files)[0];
  assert.equal(Buffer.from(files.get(bundledPath)).toString(), '# surface-sweep bundled-v2\n');
  assert.equal(Buffer.from(files.get(githubPath)).toString(), '# quick-build github-v2\n');
  assert.deepEqual(states.get(request.stateKey), updated.state);
});

test('mixed-channel shared dependency conflict stops before any writes', async () => {
  const { request, ports, files, states, journals } = fixture();
  const bundled = channelSource('b'.repeat(40), 'bundled');
  const github = channelSource('c'.repeat(40), 'github');
  const sources = { bundled, github };
  await installSkills({ ...request, requestedIds: ['surface-sweep'], ...bundled, sources, channel: 'bundled' }, ports);
  await installSkills({ ...request, requestedIds: ['quick-build'], ...github, sources, channel: 'github' }, ports);
  const beforeFiles = new Map([...files].map(([path, bytes]) => [path, Uint8Array.from(bytes)]));
  const beforeState = structuredClone(states.get(request.stateKey));
  const conflictingGithub = channelSource('d'.repeat(40), 'github-next', true);
  await assert.rejects(
    updateSkills({ ...request, requestedIds: [], ...bundled, sources: { bundled, github: conflictingGithub } }, ports),
    /Conflicting content channels for shared skill surface-sweep/,
  );
  assert.deepEqual(files, beforeFiles);
  assert.deepEqual(states.get(request.stateKey), beforeState);
  assert.equal(journals.has(request.stateKey), false);
});
