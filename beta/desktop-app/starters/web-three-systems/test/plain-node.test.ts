// scripts/control.cjs, installed-helpers.cjs and installed-diagnostics.cjs are committed builds
// of their .ts sources (scripts/emit-plain-node.ts explains why they exist). A source changed
// without its .cjs fails here.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

const root = path.join(import.meta.dirname, '..');

test('the committed plain-Node scripts match their TypeScript sources', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'emit-plain-node.ts'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
