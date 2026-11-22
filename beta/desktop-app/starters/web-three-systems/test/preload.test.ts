// The page's bridge has two halves that must list the same functions:
// DesktopBridge in src/bridge.ts and what electron/preload.ts exposes. The type check holds
// each half to the interface (preload.ts with `satisfies DesktopBridge`, the stand-in in
// src/bridge.fake.ts by implementing it); this test compares the names, so a function added
// to one half and forgotten in the other fails here too.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const root = path.join(import.meta.dirname, '..');

test('preload exposes exactly the functions in DesktopBridge', () => {
  const bridge = fs.readFileSync(path.join(root, 'src', 'bridge.ts'), 'utf8');
  const body = bridge.slice(bridge.indexOf('export interface DesktopBridge'));
  const declared = [...body.slice(0, body.indexOf('\n}')).matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]).sort();
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.ts'), 'utf8');
  const exposed = [...preload.matchAll(/^\s{2}(\w+):\s/gm)].map((m) => m[1]).sort();
  assert.ok(declared.length >= 5, `read ${declared.length} functions from src/bridge.ts`);
  assert.deepEqual(exposed, declared);
});

// node --check alone passes a broken ES-module .ts file; scripts/lib/syntax.ts strips the types first.
const syntax = (files: string[]) => spawnSync(process.execPath, ['--no-warnings', path.join(root, 'scripts', 'lib', 'syntax.ts'), ...files], { encoding: 'utf8' });

test('every main-process source parses', () => {
  const files = ['electron', path.join('electron', 'tool')].flatMap((dir) =>
    fs
      .readdirSync(path.join(root, dir))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join(root, dir, f)),
  );
  assert.ok(files.length >= 18, `found ${files.length} files`);
  const result = syntax(files);
  assert.equal(result.status, 0, result.stdout || result.stderr);
});

test('the syntax check catches a broken source', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-syntax-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const broken = path.join(dir, 'broken.ts');
  fs.writeFileSync(broken, 'export const a: number = 1;\nconst = ;\n');
  const result = syntax([broken]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /broken\.ts/);
});
