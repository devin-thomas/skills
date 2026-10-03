import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { materializeSkill, resolveClosure, validateCatalog } from '../../dist/catalog/index.js';
import { loadGitHubBundle } from '../../dist/catalog/github.js';

const revision = 'a'.repeat(40);
function skill(id, prerequisites = [], relatedSkills = []) {
  return {
    id, slug: id, title: id, summary: id, category: 'build', order: 1,
    sourceRepo: 'devin-thomas/skills', sourcePath: `${id}/SKILL.md`, sourceVersion: null,
    sourceRevision: revision, sourceRef: 'main', public: true, ownedBy: 'devin-thomas',
    relatedSkills, prerequisites, recommendationOnly: false,
  };
}

test('catalog closure follows only required skill edges and detects cycles', () => {
  const prerequisite = skill('execute-task');
  const root = skill('execute-task-cycles', [{ skillId: prerequisite.id }], ['surface-sweep']);
  const snapshot = { version: '1.0.0', categories: ['plan', 'build', 'specialized', 'fun'], skills: [root, prerequisite] };
  validateCatalog(snapshot);
  assert.deepEqual(resolveClosure(snapshot, [root.id]).map(({ id }) => id), ['execute-task', 'execute-task-cycles']);
  const cyclic = { ...snapshot, skills: [skill('execute-task', [{ skillId: root.id }]), root] };
  assert.throws(() => resolveClosure(cyclic, [root.id]), /cycle/i);
  assert.throws(() => validateCatalog({ ...snapshot, version: '2.0.0' }), /unsupported catalog manifest version/i);
});

test('materialization verifies the complete bundled file digest', () => {
  const entry = skill('quick-build');
  const bytes = Buffer.from('# Quick Build\n');
  const bundle = {
    schemaVersion: '1.0.0',
    manifest: { version: '1.0.0', categories: ['plan', 'build', 'specialized', 'fun'], skills: [entry] },
    skills: { 'quick-build': { sourceRevision: revision, files: [{ path: 'SKILL.md', contentBase64: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') }] } },
  };
  assert.equal(Buffer.from(materializeSkill(entry, bundle).files[0].bytes).toString(), bytes.toString());
  bundle.skills['quick-build'].files[0].sha256 = '0'.repeat(64);
  assert.throws(() => materializeSkill(entry, bundle), /hash mismatch/i);
});

test('GitHub source pins a repository once and materializes matching commit blobs', async () => {
  const quickBuild = skill('quick-build');
  const noUselessCopy = skill('no-useless-copy');
  const manifest = { version: '1.0.0', categories: ['plan', 'build', 'specialized', 'fun'], skills: [quickBuild, noUselessCopy] };
  const contents = new Map([
    ['manifest/skills.json', Buffer.from(JSON.stringify(manifest))],
    ['quick-build/SKILL.md', Buffer.from('# Quick Build\n')],
    ['no-useless-copy/SKILL.md', Buffer.from('# No Useless Copy\n')],
  ]);
  const gitBlobSha = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const entries = [...contents].map(([path, bytes]) => ({ path, type: 'blob', mode: '100644', size: bytes.length, sha: gitBlobSha(bytes) }));
  let commitRequests = 0;
  const fakeFetch = async (input) => {
    const url = new URL(input);
    if (url.hostname === 'api.github.com' && url.pathname.endsWith('/commits/main')) {
      commitRequests += 1;
      return Response.json({ sha: 'c'.repeat(40), commit: { tree: { sha: 'd'.repeat(40) } } });
    }
    if (url.hostname === 'api.github.com' && url.pathname.includes('/git/trees/')) {
      return Response.json({ sha: 'd'.repeat(40), tree: entries, truncated: false });
    }
    if (url.hostname === 'raw.githubusercontent.com') {
      const path = decodeURIComponent(url.pathname.split('/').slice(4).join('/'));
      const bytes = contents.get(path);
      if (!bytes) return new Response('', { status: 404 });
      return new Response(bytes);
    }
    return new Response('', { status: 404 });
  };
  const bundle = await loadGitHubBundle(['quick-build', 'no-useless-copy'], { fetch: fakeFetch });
  assert.equal(commitRequests, 1);
  assert.equal(bundle.resolvedSourceRevisions['devin-thomas/skills'], 'c'.repeat(40));
  assert.equal(materializeSkill(quickBuild, bundle).sourceRevision, 'c'.repeat(40));
  assert.equal(Object.keys(bundle.skills).length, 2);
});
