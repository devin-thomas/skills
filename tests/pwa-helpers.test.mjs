import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const helper = (name) => fileURLToPath(new URL(`../pwa-development/scripts/${name}.mjs`, import.meta.url));
const run = (name, args) => new Promise((resolve, reject) => {
  execFile(process.execPath, [helper(name), ...args], { timeout: 15000 }, (error, stdout, stderr) => {
    if (error && typeof error.code !== 'number') return reject(error);
    resolve({ code: error?.code ?? 0, stdout, stderr });
  });
});
const manifest = { name: 'Fixture', short_name: 'Fixture', id: '/', start_url: '/', scope: '/', display: 'standalone', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] };
const icon = '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="black"/></svg>';

test('manifest baseline passes and a missing icon fails', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'pwa-helper-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(dir, 'icon.svg'), icon);
  const args = ['--manifest', join(dir, 'manifest.json'), '--root', dir, '--json'];
  const good = await run('audit-manifest', args);
  assert.equal(good.code, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).status, 'pass');
  await rm(join(dir, 'icon.svg'));
  const bad = await run('audit-manifest', args);
  assert.equal(bad.code, 1);
  assert.ok(JSON.parse(bad.stdout).findings.some((f) => f.code === 'icons.not-found'));
});

test('malformed manifest fails', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'pwa-invalid-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'manifest.json'), '{');
  const result = await run('audit-manifest', ['--manifest', join(dir, 'manifest.json'), '--json']);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).status, 'fail');
});

test('release probe checks assets and rejects HTML icon fallback', async (t) => {
  let brokenIcon = false;
  const server = createServer((req, res) => {
    let type = 'text/html';
    let body = '<!doctype html><link rel="manifest" href="/manifest.json"><h1>Fixture</h1>';
    if (req.url === '/manifest.json') { type = 'application/manifest+json'; body = JSON.stringify(manifest); }
    if (req.url === '/icon.svg' && !brokenIcon) { type = 'image/svg+xml'; body = icon; }
    if (req.url === '/sw.js') { type = 'text/javascript'; body = '// fixture worker'; }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const args = ['--url', url, '--worker', '/sw.js', '--json'];
  const good = await run('probe-release', args);
  assert.equal(good.code, 0, good.stdout + good.stderr);
  assert.ok(JSON.parse(good.stdout).resources.some((r) => r.kind === 'worker'));
  brokenIcon = true;
  const bad = await run('probe-release', args);
  assert.equal(bad.code, 1);
  assert.ok(JSON.parse(bad.stdout).findings.some((f) => f.code === 'icon.html-fallback'));
});

test('both CLIs provide help and reject unknown arguments', async () => {
  for (const name of ['audit-manifest', 'probe-release']) {
    assert.equal((await run(name, ['--help'])).code, 0);
    assert.equal((await run(name, ['--unknown'])).code, 2);
  }
});
