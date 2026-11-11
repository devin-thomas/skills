#!/usr/bin/env node
// Offline catalog and source-copy check. Run Claude Code's native plugin validator separately.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path));
const json = path => JSON.parse(read(path).toString('utf8'));
const manifest = json('manifest/skills.json');
const plugin = json('.claude-plugin/plugin.json');
const marketplace = json('.claude-plugin/marketplace.json');
const lock = json('distribution/claude-plugin-sources.json');
const catalog = manifest.skills.filter(skill => skill.public === true && !skill.recommendationOnly);
assert.equal(plugin.name, 'uppercut-skills');
assert.equal(plugin.version, lock.pluginVersion);
assert.equal(marketplace.plugins.length, 1);
assert.equal(marketplace.plugins[0].name, plugin.name);
assert.equal(marketplace.plugins[0].source, './');
assert.equal(catalog.length, 20, 'catalog count changed; review plugin inventory');
const local = catalog.filter(skill => skill.sourceRepo === 'devin-thomas/skills');
const external = catalog.filter(skill => skill.sourceRepo !== 'devin-thomas/skills');
assert.equal(local.length, 17);
assert.equal(external.length, 3);
assert.deepEqual(new Set(plugin.skills), new Set(local.map(skill => './' + skill.slug)));
for (const skill of local) {
  assert.ok(existsSync(join(root, skill.slug, 'SKILL.md')), 'missing local skill ' + skill.slug);
}
assert.deepEqual(lock.skills.map(skill => skill.id).sort(), external.map(skill => skill.id).sort());
const walk = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = prefix ? prefix + '/' + entry.name : entry.name;
  const file = join(dir, entry.name);
  if (entry.isDirectory()) return walk(file, path);
  assert.ok(entry.isFile(), 'nonregular snapshot entry ' + path);
  return [path];
}).sort();
let copied = 0;
for (const snapshot of lock.skills) {
  const entry = external.find(s => s.id === snapshot.id);
  assert.ok(entry, 'unknown snapshot ' + snapshot.id);
  assert.equal(entry.sourceRepo, snapshot.repository);
  assert.match(snapshot.commit, /^[0-9a-f]{40}$/);
  const folder = join(root, 'skills', snapshot.id);
  assert.ok(existsSync(join(folder, 'SKILL.md')), 'missing imported skill ' + snapshot.id);
  assert.deepEqual(walk(folder), snapshot.files.map(f => f.path).sort(), 'missing/extra snapshot files in ' + snapshot.id);
  for (const f of snapshot.files) {
    const bytes = read(join('skills', snapshot.id, f.path));
    const actual = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(actual, f.gitBlobSha, 'snapshot drift: ' + snapshot.id + '/' + f.path);
    copied++;
  }
}
const listed = plugin.skills.map(path => path.slice(2)).concat(lock.skills.map(s => s.id)).sort();
assert.deepEqual(listed, catalog.map(s => s.slug).sort());
assert.ok(plugin.commands?.start?.content?.includes('starter-pack'), 'missing course entrypoint');
for (const skill of catalog) {
  for (const p of skill.prerequisites ?? []) {
    if (p.skillId) assert.ok(listed.includes(p.skillId), 'missing required dependency ' + p.skillId);
  }
}
const quick = read('quick-build/SKILL.md').toString('utf8');
const grill = read('grill-to-build/SKILL.md').toString('utf8');
assert.match(quick, /current curriculum Quick Build skill/);
assert.match(grill, /current course-specific Grill to Build skill/);
console.log('Claude plugin: ' + listed.length + '/20 public skills, ' + copied + ' cross-repo files hash-checked. Native CLI validation and end-to-end course QA remain separate.');
