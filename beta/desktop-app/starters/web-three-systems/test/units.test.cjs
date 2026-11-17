// The adapter's plain pieces: the line reader, the locator, the status cache,
// the job records and the progress model. No process is started here.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createLineReader } = require('../electron/tool/lines.cjs');
const { locateTool, folderName } = require('../electron/tool/locate.cjs');
const { toolStatus, createCapabilitiesCache } = require('../electron/tool/status.cjs');
const { createJobRecords } = require('../electron/tool/jobs.cjs');
const { createProgressModel, HOLD } = require('../electron/tool/progress.cjs');
const { STAGING_NAME } = require('../electron/tool/contract.cjs');

const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-unit-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('line reader: splits, tolerates CRLF, caps a long line and the total, and keeps draining', () => {
  const lines = [];
  const over = [];
  const reader = createLineReader({ maxLineBytes: 16, maxTotalBytes: 64, onLine: (l) => lines.push(l), onOverflow: (k) => over.push(k) });
  reader.push(Buffer.from('one\r\ntw'));
  reader.push(Buffer.from('o\n' + 'x'.repeat(40) + '\nthree\n'));
  assert.deepEqual(lines, ['one', 'two', 'three']);
  assert.deepEqual(over, ['line']);
  reader.push(Buffer.alloc(100, 0x41));
  assert.deepEqual(over, ['line', 'total']);
  reader.push(Buffer.from('four\n'));
  assert.deepEqual(lines, ['one', 'two', 'three'], 'nothing after the total cap');
});

test('locator: one folder name, packaged never searches PATH, a missing tool is TOOL_NOT_FOUND', (t) => {
  const dir = tmp(t);
  const platform = 'linux';
  const bin = path.join(dir, 'resources', 'bin', folderName(platform, 'x64'));
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'example-tool'), '#!/bin/sh\n', { mode: 0o755 });
  const found = locateTool({ packaged: true, resourcesPath: path.join(dir, 'resources'), platform, arch: 'x64', toolName: 'example-tool', helpers: ['helper'], env: { PATH: process.env.PATH } });
  if (process.platform !== 'win32') {
    assert.equal(found.ok, true);
    assert.equal(found.source, 'packaged');
    assert.deepEqual(found.helpers.helper, { file: null, source: null }, 'a packaged app never looks on PATH');
  }
  const missing = locateTool({ packaged: true, resourcesPath: path.join(dir, 'nowhere'), platform, arch: 'x64', toolName: 'example-tool' });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'TOOL_NOT_FOUND');
  const override = locateTool({ packaged: true, resourcesPath: path.join(dir, 'nowhere'), toolName: 'example-tool', override: { script: __filename, node: process.execPath } });
  assert.equal(override.ok, false, 'the stand-in override is never honoured in a packaged app');
});

test('status: answers map to ready or damaged, and the cache is keyed by the binaries', (t) => {
  const dir = tmp(t);
  assert.equal(toolStatus({ ok: true, capabilities: { tool: 'x', tool_version: '1', events: [1] } }).state, 'ready');
  const damaged = toolStatus({ ok: false, error: { code: 'TOOL_INCOMPATIBLE', message: 'm' } });
  assert.equal(damaged.state, 'damaged');
  assert.equal(damaged.code, 'TOOL_INCOMPATIBLE');
  const binary = path.join(dir, 'example-tool.bin');
  fs.writeFileSync(binary, 'a');
  const located = { ok: true, binary, helpers: {} };
  const cache = createCapabilitiesCache(dir);
  const answer = { ok: true, capabilities: { tool: 'x' } };
  cache.write(located, answer);
  assert.deepEqual(cache.read(located), answer);
  fs.writeFileSync(binary, 'a changed tool');
  assert.equal(cache.read(located), null, 'a changed binary invalidates the answer');
});

test('job records: reconcile removes only a staging folder that matches, directly in its folder', (t) => {
  const dir = tmp(t);
  const out = path.join(dir, 'out');
  fs.mkdirSync(out);
  const good = '.example-0123456789abcdef0123456789abcdef.tmp';
  fs.mkdirSync(path.join(out, good));
  fs.mkdirSync(path.join(out, 'keep-me'));
  const records = createJobRecords(path.join(dir, 'jobs'), STAGING_NAME);
  records.write({ jobId: 'j_a', folder: out, staging: good });
  records.write({ jobId: 'j_b', folder: out, staging: 'keep-me' });
  records.write({ jobId: 'j_c', folder: out, staging: `../${good}` });
  assert.deepEqual(records.reconcile(), { records: 3, removed: 1 });
  assert.deepEqual(fs.readdirSync(out), ['keep-me']);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'jobs')), []);
});

test('progress: unknown total is indeterminate; the fraction never goes back and never reaches 1', () => {
  const model = createProgressModel();
  model.onEvent({ type: 'progress', done: 5, total: null, fraction: null, t_ms: 0 });
  assert.equal(model.snapshot().fraction, null);
  model.onEvent({ type: 'progress', done: 50, total: 100, t_ms: 100 });
  model.onEvent({ type: 'progress', done: 30, total: 100, t_ms: 200 });
  assert.equal(model.snapshot().fraction, 0.5);
  model.onEvent({ type: 'progress', fraction: 1, t_ms: 300 });
  assert.equal(model.snapshot().fraction, HOLD);
});

test('progress: time remaining waits for 3 s and 5%, then changes at most once a second', () => {
  const model = createProgressModel();
  const seen = [];
  for (let t = 0; t <= 8000; t += 250) {
    model.onEvent({ type: 'progress', done: t / 200, total: 100, t_ms: t });
    seen.push([t, model.snapshot().remainingSeconds]);
  }
  assert.ok(seen.filter(([t, r]) => t < 3000 && r !== null).length === 0, 'nothing before 3 s');
  assert.ok(seen.some(([, r]) => r !== null), 'shown once trustworthy');
  const changes = seen.filter(([, r], i) => i > 0 && r !== seen[i - 1][1] && r !== null).map(([t]) => t);
  for (let i = 1; i < changes.length; i++) assert.ok(changes[i] - changes[i - 1] >= 1000, `changed twice within a second: ${changes}`);
});
