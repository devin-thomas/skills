import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = process.cwd();
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check through npm run smoke so npm_execpath is available');

const scratch = mkdtempSync(join(tmpdir(), 'uppercut-skills-smoke-'));
const consumer = join(scratch, 'consumer');
const project = join(scratch, 'project');
mkdirSync(consumer);
mkdirSync(project);

try {
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', scratch], packageRoot));
  const artifact = Array.isArray(packed) ? packed[0] : packed['@uppercut-labs/skills'];
  assert.ok(artifact && Array.isArray(artifact.files), 'npm pack did not return the expected package metadata');
  assert.ok(artifact.files.every(({ path }) => ['LICENSE', 'NOTICE.md', 'README.md', 'package.json'].includes(path) || path.startsWith('bin/') || path.startsWith('dist/')));
  const tarball = join(scratch, artifact.filename);
  npm(['install', '--prefix', consumer, '--no-audit', '--no-fund', tarball], packageRoot);

  const bin = join(consumer, 'node_modules', '@uppercut-labs', 'skills', 'bin', 'uppercut-skills.js');
  const postinstall = join(consumer, 'node_modules', '@uppercut-labs', 'skills', 'bin', 'grokbot-postinstall.js');
  const outsideBot = execFileSync(process.execPath, [postinstall], {
    cwd: consumer, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, npm_config_global: 'true', npm_lifecycle_event: 'postinstall' },
  });
  assert.match(outsideBot, /account library untouched/);
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [bin, ...args, '--json'], {
    cwd: consumer, encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
  }));
  const listed = run('list');
  assert.equal(listed.outcome, 'complete');
  assert.equal(listed.data.length, 15);

  const added = run('add', 'execute-task-cycles', '--host', 'codex', '--project', project);
  assert.equal(added.outcome, 'complete');
  assert.deepEqual(added.resolvedIds, ['execute-task', 'execute-task-cycles']);
  assert.ok(existsSync(join(project, '.agents', 'skills', 'execute-task', 'SKILL.md')));
  assert.ok(existsSync(join(project, '.agents', 'skills', 'execute-task-cycles', 'SKILL.md')));

  const neighbor = join(project, '.agents', 'skills', 'neighbor', 'SKILL.md');
  mkdirSync(dirname(neighbor), { recursive: true });
  writeFileSync(neighbor, 'neighbor\n');
  assert.equal(run('doctor', '--host', 'codex', '--project', project).data.healthy, true);
  assert.equal(run('update', 'execute-task-cycles', '--host', 'codex', '--project', project).outcome, 'unchanged');
  assert.equal(run('remove', 'execute-task-cycles', '--host', 'codex', '--project', project).outcome, 'complete');
  assert.equal(readFileSync(neighbor, 'utf8'), 'neighbor\n');
  assert.equal(existsSync(join(project, '.agents', 'skills', 'execute-task', 'SKILL.md')), false);

  npm(['install', '--prefix', consumer, '--no-audit', '--no-fund', '@modelcontextprotocol/server@2.3.0'], packageRoot);
  copyFileSync(join(repositoryRoot, 'distribution', 'smoke-mcp-consumer.mjs'), join(consumer, 'smoke-mcp-consumer.mjs'));
  execFileSync(process.execPath, [join(consumer, 'smoke-mcp-consumer.mjs')], {
    cwd: consumer, encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
  });
  process.stdout.write(`Packed consumer passed: ${artifact.filename}, ${artifact.integrity}, ${artifact.files.length} files.\n`);
} finally {
  const tempRoot = realpathSync(tmpdir());
  const target = realpathSync(scratch);
  if (!target.startsWith(tempRoot + sep) || !basename(target).startsWith('uppercut-skills-smoke-')) {
    throw new Error(`Refusing to clean unexpected temporary path: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
}

function npm(args, cwd) {
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 3 * 1024 * 1024,
  });
}
