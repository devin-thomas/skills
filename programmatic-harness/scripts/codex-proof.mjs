#!/usr/bin/env node
import { mkdtemp, lstat, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PINNED_AGENT_NATIVE_VERSION = '0.1.1';
const MAX_PROOF_BYTES = 128;

try {
  await main();
} catch (error) {
  const category = safeCategory(error);
  process.stderr.write(`${JSON.stringify({
    ok: false,
    provider: 'codex',
    target: 'local',
    status: 'failed',
    category,
    cleanupOk: true,
  })}\n`);
  process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const moduleUrl = resolveAdapterModule(cwd);
  const packageJson = await findPackageJson(fileURLToPath(moduleUrl));
  if (packageJson.name !== '@uppercut-labs/agent-native') throw new Error('agent-native-package-not-found');
  if (packageJson.version !== PINNED_AGENT_NATIVE_VERSION) throw new Error('unsupported-agent-native-version');
  const { createCodexHarnessAdapter } = await import(moduleUrl);
  let adapter = createCodexHarnessAdapter({ model: options.model, effort: 'low' });
  const workspace = await mkdtemp(join(tmpdir(), 'programmatic-harness-codex-'));
  let session;
  let cleanupOk = false;
  let completedTurns = 0;
  let contentChecks = 0;

  try {
    session = await adapter.openSession({ target: 'local', workspace });
    await completeTurn(adapter, session, 'Create proof.txt containing exactly: hello world');
    completedTurns += 1;
    await assertContents(workspace, 'hello world');
    contentChecks += 1;
    await adapter.closeSession({ session });

    adapter = createCodexHarnessAdapter({ model: options.model, effort: 'low' });
    const originalSession = session;
    const resumed = await adapter.resumeSession({ session, target: 'local', workspace });
    session = resumed;
    assertSameSession(originalSession, resumed);
    await completeTurn(adapter, session, `Replace world with ${options.name}.`);
    completedTurns += 1;
    await assertContents(workspace, `hello ${options.name}`);
    contentChecks += 1;
    await adapter.closeSession({ session });
    session = undefined;
    await rm(workspace, { recursive: true, force: false });
    cleanupOk = true;
  } catch (error) {
    const category = safeCategory(error);
    let sessionCleanupOk = true;
    if (session) {
      try {
        await adapter.closeSession({ session });
      } catch {
        sessionCleanupOk = false;
      }
    }
    let workspaceCleanupOk = true;
    try {
      await rm(workspace, { recursive: true, force: true });
    } catch {
      workspaceCleanupOk = false;
    }
    cleanupOk = sessionCleanupOk && workspaceCleanupOk;
    const status = contentChecks === 1 ? 'partial' : 'failed';
    process.stderr.write(`${JSON.stringify({
      ok: false,
      provider: 'codex',
      target: 'local',
      status,
      category,
      completedTurns,
      contentChecks,
      cleanupOk,
    })}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    provider: 'codex',
    target: 'local',
    status: 'passed',
    adapterVersion: packageJson.version,
    model: options.model,
    completedTurns,
    contentChecks,
    cleanupOk,
  })}\n`);
}

async function completeTurn(adapter, session, prompt) {
  let terminal = false;
  for await (const event of adapter.runTurn({ session, prompt })) {
    if (event.type === 'completed') terminal = true;
    else if (event.type === 'failed') throw new Error(`harness-failure:${event.reason}`);
    else if (event.type === 'cancelled') throw new Error('harness-failure:cancelled');
  }
  if (!terminal) throw new Error('harness-failure:missing-terminal-event');
}

async function assertContents(directory, expected) {
  const path = join(directory, 'proof.txt');
  const file = await lstat(path);
  if (!file.isFile() || file.isSymbolicLink() || file.size > MAX_PROOF_BYTES) {
    throw new Error('proof-file-invalid');
  }
  const actual = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n').replace(/\n$/, '');
  if (actual !== expected) throw new Error('proof-mismatch');
}

function assertSameSession(original, resumed) {
  if (original.provider !== resumed.provider || original.target !== resumed.target ||
      original.sessionId !== resumed.sessionId) {
    throw new Error('session-reference-changed');
  }
}

function parseArgs(args) {
  const values = { model: undefined, name: 'Codex' };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--model') values.model = args[++index];
    else if (args[index] === '--name') values.name = args[++index];
    else throw new Error('invalid-proof-arguments');
  }
  if (typeof values.model !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(values.model)) {
    throw new Error('invalid-model');
  }
  if (typeof values.name !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(values.name)) {
    throw new Error('invalid-name');
  }
  return values;
}

function resolveAdapterModule(projectRoot) {
  const specifier = '@uppercut-labs/agent-native/harness/codex';
  const resolved = import.meta.resolve(specifier);
  const expectedRoot = resolve(projectRoot, 'node_modules', '@uppercut-labs', 'agent-native');
  const modulePath = resolve(fileURLToPath(resolved));
  const relativePath = relative(expectedRoot, modulePath);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(relativePath)) {
    throw new Error('copy-proof-script-into-disposable-project');
  }
  return resolved;
}

async function findPackageJson(modulePath) {
  let directory = dirname(modulePath);
  while (directory !== dirname(directory)) {
    try {
      const value = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (value?.name === '@uppercut-labs/agent-native') return value;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        directory = dirname(directory);
        continue;
      }
      throw new Error('agent-native-package-invalid');
    }
    directory = dirname(directory);
  }
  throw new Error('agent-native-package-not-found');
}

function safeCategory(error) {
  const reason = error && typeof error === 'object' && 'reason' in error ? error.reason : undefined;
  const allowed = new Set([
    'unsupported-target', 'unsupported-feature', 'invalid-request', 'authentication-required',
    'provider-unavailable', 'session-not-found', 'session-closed', 'turn-not-found',
    'turn-active', 'timeout', 'provider-failed',
  ]);
  if (typeof reason === 'string' && allowed.has(reason)) return reason;
  const code = error instanceof Error ? error.message : '';
  const known = new Set([
    'cancelled', 'missing-terminal-event', 'proof-file-invalid', 'proof-mismatch',
    'session-reference-changed', 'invalid-proof-arguments', 'invalid-model', 'invalid-name',
    'copy-proof-script-into-disposable-project', 'agent-native-package-not-found',
    'agent-native-package-invalid', 'unsupported-agent-native-version',
  ]);
  const harnessReason = code.startsWith('harness-failure:')
    ? code.slice('harness-failure:'.length)
    : undefined;
  const harnessReasons = new Set([
    'unsupported-target', 'unsupported-feature', 'invalid-request', 'authentication-required',
    'provider-unavailable', 'session-not-found', 'session-closed', 'turn-not-found',
    'turn-active', 'timeout', 'provider-failed', 'cancelled', 'missing-terminal-event',
  ]);
  return harnessReason && harnessReasons.has(harnessReason)
    ? harnessReason
    : known.has(code) ? code : 'proof-failed';
}
