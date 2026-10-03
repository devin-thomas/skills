import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { installSkills, removeSkills } from '../../dist/engine/index.js';

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
