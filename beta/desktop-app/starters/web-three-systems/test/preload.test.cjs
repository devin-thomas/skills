// The page's bridge has two halves that must list the same functions:
// DesktopBridge in src/bridge.ts and what electron/preload.cjs exposes. The
// stand-in in src/bridge.fake.ts implements the same interface, which the type
// check enforces; this test covers the preload, which TypeScript cannot see.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

test('preload exposes exactly the functions in DesktopBridge', () => {
  const bridge = fs.readFileSync(path.join(root, 'src', 'bridge.ts'), 'utf8');
  const body = bridge.slice(bridge.indexOf('export interface DesktopBridge'));
  const declared = [...body.slice(0, body.indexOf('\n}')).matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]).sort();
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  const exposed = [...preload.matchAll(/^\s{2}(\w+):\s/gm)].map((m) => m[1]).sort();
  assert.ok(declared.length >= 5, `read ${declared.length} functions from src/bridge.ts`);
  assert.deepEqual(exposed, declared);
});

test('every main-process file parses', () => {
  const { spawnSync } = require('node:child_process');
  const dirs = ['electron', path.join('electron', 'tool')];
  for (const dir of dirs) {
    for (const file of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.cjs'))) {
      const result = spawnSync(process.execPath, ['--check', path.join(root, dir, file)], { encoding: 'utf8' });
      assert.equal(result.status, 0, `${dir}/${file}: ${result.stderr}`);
    }
  }
});
