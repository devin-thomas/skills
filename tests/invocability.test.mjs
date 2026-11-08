// Every bundled skill must stay model-invocable (distribution/invocability.mjs).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { bundleViolations, checkBundleInvocability, skillViolations, violations } from '../distribution/invocability.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cases = JSON.parse(readFileSync(join(root, 'tests', 'invocability-cases.json'), 'utf8'));
const encode = (text) => Buffer.from(text).toString('base64');
const skill = (name, extra = '') => `---\nname: ${name}\ndescription: Synthetic bundle fixture.\n${extra}---\n\nBody.\n`;

test('hiding settings fail and invocable settings pass', () => {
  for (const text of cases.fail) assert.notDeepEqual(violations(text), [], text);
  for (const text of cases.pass) assert.deepEqual(violations(text), [], text);
  assert.deepEqual(violations('disable-model-invocation: true\npolicy:\n  allow_implicit_invocation: false'),
    ['disable-model-invocation: true', 'policy.allow_implicit_invocation: false']);
});

test('the JavaScript reader agrees with scripts/invocability.py on every case', () => {
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const script = 'import json,sys\nsys.path.insert(0,sys.argv[1])\nfrom invocability import violations\n'
    + 'cases=json.load(open(sys.argv[2],encoding="utf-8"))\nprint(json.dumps([violations(t) for t in cases["fail"]+cases["pass"]]))';
  const result = spawnSync(python, ['-c', script, join(root, 'scripts'), join(root, 'tests', 'invocability-cases.json')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [...cases.fail, ...cases.pass].map((text) => violations(text)));
});

test('skill and bundle checks read frontmatter and the sibling Codex settings', () => {
  assert.deepEqual(skillViolations(skill('a', 'disable-model-invocation: true\n'), 'policy:\n  allow_implicit_invocation: false\n'),
    ['SKILL.md disable-model-invocation: true', 'agents/openai.yaml policy.allow_implicit_invocation: false']);
  assert.deepEqual(skillViolations('No frontmatter.\ndisable-model-invocation: true\n'), []);
  assert.deepEqual(bundleViolations([
    { path: 'SKILL.md', text: skill('a') },
    { path: 'agents/openai.yaml', text: 'policy:\n  allow_implicit_invocation: false\n' },
    { path: 'nested/SKILL.md', text: skill('b', 'user-invocable-only: true\n') },
    { path: 'references/notes.md', text: 'disable-model-invocation: true\n' },
  ]), ['SKILL.md: agents/openai.yaml policy.allow_implicit_invocation: false', 'nested/SKILL.md: SKILL.md user-invocable-only: true']);
});

test('the release-gate check rejects a hidden bundled skill and passes the committed bundle', async () => {
  const hidden = { skills: {
    ok: { files: [{ path: 'SKILL.md', contentBase64: encode(skill('ok', 'user-invocable: false\n')) }] },
    hidden: { files: [{ path: 'SKILL.md', contentBase64: encode(skill('hidden', 'disable-model-invocation: true\n')) }] },
  } };
  assert.throws(() => checkBundleInvocability(hidden), /hidden\/SKILL\.md: SKILL\.md disable-model-invocation: true\nEvery skill must stay model-invocable/);
  assert.throws(() => checkBundleInvocability({ skills: { empty: { files: [] } } }), /empty: no SKILL\.md in the bundle/);
  assert.throws(() => checkBundleInvocability({ skills: {} }), /bundle has no skills/);
  const { catalogBundle } = await import('../packages/skills-cli/src/generated/bundle.ts');
  assert.match(checkBundleInvocability(catalogBundle), /^\d+ skills model-invocable$/);
});
