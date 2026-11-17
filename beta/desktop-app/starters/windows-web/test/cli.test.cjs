// The CLI runner against a stand-in npm global built in a temporary folder.
// Nothing here needs Electron or a real CLI. Add a test file like this for the
// app's own adapter: every call it makes, against a stand-in that can be told
// to fail, hang, print rubbish or print too much.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { locateCli, runCli } = require('../electron/cli/run.cjs');

function standIn() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  const script = path.join(dir, 'node_modules', 'tool', 'cli.js');
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'fake-cli.cjs'), script);
  fs.writeFileSync(path.join(dir, 'tool.cmd'), '@ECHO off\r\n"%_prog%"  "%dp0%\\node_modules\\tool\\cli.js" %*\r\n');
  const env = { PATH: [dir, path.dirname(process.execPath)].join(path.delimiter) };
  return { dir, script, env };
}

test('the shim is read, never run: the script and node.exe are found', () => {
  const { dir, script, env } = standIn();
  const cli = locateCli({ shim: 'tool.cmd' }, env);
  assert.equal(cli.ok, true);
  assert.equal(cli.cliJs, script);
  assert.equal(path.basename(cli.node).toLowerCase().startsWith('node'), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a missing tool is a plain result, not a throw', () => {
  assert.deepEqual(locateCli({ shim: '' }), { ok: false, detail: 'No command-line tool is configured for this app.' });
  const cli = locateCli({ shim: 'absent-tool.cmd' }, { PATH: os.tmpdir() });
  assert.equal(cli.ok, false);
  assert.match(cli.detail, /absent-tool\.cmd/);
});

test('arguments arrive as an array, with no shell in between', async () => {
  const { dir, env } = standIn();
  const cli = locateCli({ shim: 'tool.cmd' }, env);
  const hostile = 'a b & echo injected > "x" | %PATH% $(whoami)';
  const run = await runCli(cli, ['echo', hostile], { timeoutMs: 10_000 });
  assert.equal(run.code, 0);
  assert.deepEqual(JSON.parse(run.stdout), ['echo', hostile]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a hung tool is killed at the time limit', async () => {
  const { dir, env } = standIn();
  const cli = locateCli({ shim: 'tool.cmd' }, env);
  const run = await runCli(cli, ['hang'], { timeoutMs: 400 });
  assert.equal(run.timedOut, true);
  assert.ok(run.durationMs < 5000);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('output is drained and capped', async () => {
  const { dir, env } = standIn();
  const cli = locateCli({ shim: 'tool.cmd' }, env);
  const run = await runCli(cli, ['flood'], { timeoutMs: 10_000, maxBytes: 1024 });
  assert.equal(run.code, 0);
  assert.equal(run.truncated, true);
  assert.equal(run.stdout.length, 1024);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an abort signal cancels the run', async () => {
  const { dir, env } = standIn();
  const cli = locateCli({ shim: 'tool.cmd' }, env);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 150);
  const run = await runCli(cli, ['hang'], { timeoutMs: 10_000, signal: controller.signal });
  assert.equal(run.cancelled, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a failing tool reports its exit code and stderr', async () => {
  const { dir, env } = standIn();
  const cli = locateCli({ shim: 'tool.cmd' }, env);
  const run = await runCli(cli, ['fail'], { timeoutMs: 10_000 });
  assert.equal(run.code, 3);
  assert.match(run.stderr, /it broke/);
  fs.rmSync(dir, { recursive: true, force: true });
});
