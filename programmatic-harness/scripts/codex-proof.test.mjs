import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const proofScript = new URL('./codex-proof.mjs', import.meta.url);

test('fake adapter proves two turns, pinned version and cleanup without provider access', async () => {
  const before = await proofWorkspaces();
  const result = await runProof({ scenario: 'success' });
  const after = await proofWorkspaces();

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    provider: 'codex',
    target: 'local',
    status: 'passed',
    adapterVersion: '0.1.1',
    model: 'fixture-model',
    completedTurns: 2,
    contentChecks: 2,
    cleanupOk: true,
  });
  assert.deepEqual(after, before);
});

test('missing or unexpected adapter version fails with a bounded category', async () => {
  for (const version of [null, '0.1.0']) {
    const result = await runProof({ version });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).category, 'unsupported-agent-native-version');
    assert.equal(result.stderr.includes('stack'), false);
  }
});

test('resume preserves the opaque session ref and reports a partial proof on mismatch', async () => {
  const result = await runProof({ scenario: 'changed-session' });
  const evidence = JSON.parse(result.stderr);
  assert.equal(result.status, 1);
  assert.equal(evidence.status, 'partial');
  assert.equal(evidence.category, 'session-reference-changed');
  assert.equal(evidence.cleanupOk, true);
});

test('second-turn provider failure stays partial and closes temporary resources', async () => {
  const result = await runProof({ scenario: 'partial' });
  const evidence = JSON.parse(result.stderr);
  assert.equal(result.status, 1);
  assert.equal(evidence.status, 'partial');
  assert.equal(evidence.category, 'provider-failed');
  assert.equal(evidence.completedTurns, 1);
  assert.equal(evidence.contentChecks, 1);
  assert.equal(evidence.cleanupOk, true);
});

test('owned-session cleanup failures are visible even when workspace removal succeeds', async () => {
  const result = await runProof({ scenario: 'cleanup-failure' });
  const evidence = JSON.parse(result.stderr);
  assert.equal(result.status, 1);
  assert.equal(evidence.status, 'failed');
  assert.equal(evidence.category, 'proof-failed');
  assert.equal(evidence.cleanupOk, false);
});

test('unsafe names are rejected before opening a provider session', async () => {
  const result = await runProof({ name: 'bad name' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).category, 'invalid-name');
});

async function runProof({ scenario = 'success', version = '0.1.1', name = 'Codex' } = {}) {
  const project = await mkdtemp(join(tmpdir(), 'codex-proof-test-'));
  try {
    const packageRoot = join(project, 'node_modules', '@uppercut-labs', 'agent-native');
    await mkdir(packageRoot, { recursive: true });
    await writeFile(join(project, 'codex-proof.mjs'), await readFile(proofScript));
    await writeFile(join(packageRoot, 'package.json'), JSON.stringify({
      name: '@uppercut-labs/agent-native',
      version,
      type: 'module',
      exports: { './harness/codex': './harness.mjs' },
    }));
    await writeFile(join(packageRoot, 'harness.mjs'), fakeAdapterSource);

    return spawnSync(process.execPath, [
      join(project, 'codex-proof.mjs'), '--model', 'fixture-model', '--name', name,
    ], {
      cwd: project,
      encoding: 'utf8',
      env: { ...process.env, FAKE_HARNESS_SCENARIO: scenario },
      timeout: 10_000,
    });
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

async function proofWorkspaces() {
  return (await readdir(tmpdir())).filter((name) => name.startsWith('programmatic-harness-codex-')).sort();
}

const fakeAdapterSource = `
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
let runs = 0;
let closes = 0;
export function createCodexHarnessAdapter() {
  return {
    async openSession({ workspace }) {
      return { provider: 'codex', sessionId: 'opaque-ref', target: 'local', workspace };
    },
    async resumeSession({ session }) {
      return process.env.FAKE_HARNESS_SCENARIO === 'changed-session'
        ? { ...session, sessionId: 'different-ref' }
        : session;
    },
    async *runTurn({ session, prompt }) {
      runs += 1;
      if (process.env.FAKE_HARNESS_SCENARIO === 'partial' && runs === 2) {
        yield { type: 'failed', reason: 'provider-failed' };
        return;
      }
      const contents = runs === 1 ? 'hello world' : 'hello Codex';
      await writeFile(join(session.workspace, 'proof.txt'), contents);
      yield { type: 'completed' };
    },
    async closeSession() {
      closes += 1;
      if (process.env.FAKE_HARNESS_SCENARIO === 'cleanup-failure' && closes > 1) {
        throw new Error('private provider detail');
      }
    },
  };
}
`;
