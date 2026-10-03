import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import type { CatalogBundle, SourceChannel } from '../catalog/types.js';
import { readBundledCatalog, resolveSkill, resolveClosure } from '../catalog/index.js';
import { loadGitHubBundle, loadGitHubCatalog } from '../catalog/github.js';
import { installSkills, removeSkills, updateSkills } from '../engine/index.js';
import type { EnginePorts, InstallState, InstallTarget, OperationResult, TransactionJournal } from '../engine/types.js';
import { resolveHostTarget, type HostId, type ResolveHostTargetOptions } from '../hosts/index.js';
import { createSkillsCapabilityRegistry, type SkillsCapabilityContext, type SkillsCapabilityName } from '../agent-native/index.js';
import type { CliInvocation } from './args.js';
import { resultEnvelope, type SkillsResult } from './output.js';

type BundleModule = { readonly catalogBundle: CatalogBundle };
type RuntimeResult = { readonly result: SkillsResult; readonly exitCode: number };

const supportedHosts: readonly HostId[] = ['codex', 'claude', 'cursor', 'antigravity', 'grokbot', 'grokcli'];
const processLocks = new Map<string, Promise<void>>();

export async function runCli(invocation: CliInvocation, bundleModule: BundleModule, cwd = process.cwd(), homeDir = homedir()): Promise<RuntimeResult> {
  let bundle = bundleModule.catalogBundle;
  let catalog = readBundledCatalog(bundle);
  const githubSelected = invocation.options.latest || invocation.options.channel === 'github';
  if (githubSelected && invocation.command === 'list') {
    try { catalog = await loadGitHubCatalog(); }
    catch (error) { return failed(invocation, 'source-failure', error instanceof Error ? error.message : String(error), 4); }
  } else if (githubSelected && invocation.command === 'show') {
    try { bundle = await loadGitHubBundle(invocation.ids); catalog = structuredClone(bundle.manifest); }
    catch (error) { return failed(invocation, 'source-failure', error instanceof Error ? error.message : String(error), 4); }
  }
  const publicNames = ['catalog.list', 'catalog.show'] as const;
  const publicContext: SkillsCapabilityContext = {
    scope: { host: 'catalog', kind: 'project' },
    caller: { kind: 'anonymous' },
    authorization: { authorize: (request) => request.risk === 'read' && request.access.kind === 'public' },
    sourcePolicy: { channel: 'bundled' },
    nativeRegistration: {},
    operations: {
      'catalog.list': () => catalog.skills.map(({ id, title, summary, category }) => ({ id, title, summary, category, installed: 'unknown' })),
      'catalog.show': (input) => {
        const id = readIds(input)[0]!;
        const entry = resolveSkill(catalog, id);
        const content = bundle.skills[id];
        return {
          id: entry.id, title: entry.title, summary: entry.summary, category: entry.category,
          prerequisites: entry.prerequisites.flatMap((edge) => edge.skillId ? [edge.skillId] : []),
          source: { repository: entry.sourceRepo, path: entry.sourcePath, revision: entry.sourceRevision },
          resources: content?.files.map(({ path }) => path) ?? [], attribution: content?.attribution,
        };
      },
    },
  };
  if (invocation.command === 'list') {
    const execution = await createSkillsCapabilityRegistry(publicContext, publicNames).execute('catalog.list', {});
    if (execution.kind === 'failure') return failed(invocation, execution.reason, 'Catalog listing failed.', 1);
    return complete(invocation, { requestedIds: [], resolvedIds: [], outcome: 'complete', data: execution.value });
  }
  if (invocation.command === 'show') {
    const handle = createSkillsCapabilityRegistry(publicContext, publicNames);
    const shown: unknown[] = [];
    for (const id of invocation.ids) {
      const execution = await handle.execute('catalog.show', { id });
      if (execution.kind === 'failure') return failed(invocation, execution.reason, 'Catalog lookup failed.', execution.reason === 'invalid-input' ? 2 : 1);
      shown.push(execution.value);
    }
    return complete(invocation, { requestedIds: invocation.ids, resolvedIds: invocation.ids, outcome: 'complete', data: shown });
  }

  if (invocation.command === 'serve-mcp' || invocation.command === 'help') {
    return failed(invocation, 'invalid-command', 'This command is handled by the package entrypoint.', 2);
  }
  const scope = invocation.options.global ? 'global' : 'project';
  let projectRoot: string;
  let physicalHomeDir: string;
  try {
    projectRoot = await realpath(invocation.options.project ? resolve(invocation.options.project) : scope === 'global' ? resolve(cwd) : projectRootFromGit(cwd));
    physicalHomeDir = await realpath(homeDir);
  } catch (error) {
    return failed(invocation, 'invalid-scope', error instanceof Error ? error.message : String(error), 2);
  }
  const host = await selectHost(invocation.options.host, invocation.options.json, scope, projectRoot, physicalHomeDir);
  if (!host) return failed(invocation, 'host-required', 'Select a host with --host. Supported hosts: codex, claude, cursor, antigravity, grokbot, grokcli.', 2, { candidates: supportedHosts });
  const targetOptions: ResolveHostTargetOptions = {
    scope, projectRoot, homeDir: physicalHomeDir,
    ...(invocation.options.surface ? { surface: invocation.options.surface } : {}),
  };
  let target: InstallTarget;
  try {
    target = resolveHostTarget(host, targetOptions);
  } catch (error) {
    return failed(invocation, error instanceof Error && 'code' in error ? String(error.code) : 'host-target-error', error instanceof Error ? error.message : String(error), 2, { target: { host, scope } });
  }

  const statePath = statePathFor(target, physicalHomeDir);
  const ports = createNodePorts(statePath, target.installDir, target.scope === 'project');
  const stateKey = statePath;
  const bundledBundle = bundle;
  const bundledCatalog = catalog;
  const overrideChannel = invocation.options.latest ? 'github' : invocation.options.channel;
  const channel: SourceChannel | undefined = invocation.command === 'update' ? overrideChannel : overrideChannel ?? 'bundled';
  const currentState = invocation.command === 'add' || invocation.command === 'update' ? await ports.state.load(stateKey) : undefined;
  const sources: Partial<Record<SourceChannel, { snapshot: typeof catalog; bundle: CatalogBundle }>> = {
    bundled: { snapshot: bundledCatalog, bundle: bundledBundle },
  };
  if (invocation.command === 'add' || invocation.command === 'update') {
    const roots = [...new Set([...(currentState?.roots ?? []), ...invocation.ids])];
    const rootChannels = { ...currentState?.rootChannels };
    const selectedRoots = invocation.command === 'update' && !invocation.ids.length ? roots : invocation.ids;
    for (const id of selectedRoots) {
      if (channel) rootChannels[id] = channel;
      else rootChannels[id] ??= 'bundled';
    }
    const githubRoots = roots.filter((id) => rootChannels[id] === 'github');
    if (githubRoots.length) {
      try {
        const githubBundle = await loadGitHubBundle(githubRoots);
        sources.github = { snapshot: structuredClone(githubBundle.manifest), bundle: githubBundle };
      } catch (error) {
        return failed(invocation, 'source-failure', error instanceof Error ? error.message : String(error), 4, { host, scope });
      }
    }
    if (channel === 'github' && sources.github) {
      bundle = sources.github.bundle;
      catalog = sources.github.snapshot;
    }
  }
  try {
    const capByCommand: Record<'add' | 'update' | 'remove' | 'doctor', SkillsCapabilityName> = {
      add: 'installation.add', update: 'installation.update', remove: 'installation.remove', doctor: 'installation.doctor',
    };
    const selected = invocation.options.dryRun ? 'installation.plan' : capByCommand[invocation.command];
    const allowedCapability = selected;
    const capabilityContext: SkillsCapabilityContext = {
      scope: { host, kind: scope, rootPath: target.rootPath },
      caller: { kind: 'authenticated', subject: 'local-cli', scopes: ['skills:read', 'skills:write', 'skills:remove'] },
      authorization: { authorize: (request) => request.identity.name === allowedCapability && request.access.kind === 'protected' },
      sourcePolicy: { ...(channel ? { channel } : { channels: Object.keys(sources) }), bundleSchema: bundle.schemaVersion },
      nativeRegistration: { evidence: 'unverified' },
      operations: {
        'installation.plan': async (input) => {
          const ids = readOptionalIds(input);
          const state = await ports.state.load(stateKey);
          const roots = invocation.command === 'update' ? (ids.length ? ids : [...(state?.roots ?? [])])
            : invocation.command === 'add' ? [...new Set([...(state?.roots ?? []), ...ids])]
              : invocation.command === 'remove' ? (state?.roots ?? []).filter((id) => !ids.includes(id))
                : [...ids];
          const prior = new Set(Object.keys(state?.skills ?? {}));
          const desiredChannels = { ...state?.rootChannels };
          if (invocation.command === 'add' || invocation.command === 'update') {
            for (const id of invocation.command === 'update' && !ids.length ? roots : ids) {
              if (channel) desiredChannels[id] = channel;
              else desiredChannels[id] ??= 'bundled';
            }
          }
          const assignments = new Map<string, SourceChannel>();
          for (const root of roots) {
            const rootChannel = desiredChannels[root] ?? 'bundled';
            const source = sources[rootChannel];
            if (!source) throw new Error(`Missing content source for ${rootChannel} root ${root}`);
            for (const entry of resolveClosure(source.snapshot, [root])) {
              const priorChannel = assignments.get(entry.id);
              if (priorChannel && priorChannel !== rootChannel) throw new Error(`Conflicting content channels for shared skill ${entry.id}: ${priorChannel} and ${rootChannel}`);
              assignments.set(entry.id, rootChannel);
            }
          }
          const closure = [...assignments.keys()];
          const resolvedIds = invocation.command === 'add' && invocation.options.noDependencies
            ? [...new Set([...roots, ...prior])]
            : closure;
          return { requestedIds: ids, resolvedIds, target, ...(channel ? { channel } : {}), changes: [], dryRun: true };
        },
        'installation.inspect': async () => diagnose(catalog, target, stateKey, ports),
        'installation.doctor': async () => diagnose(catalog, target, stateKey, ports),
        'installation.add': (input) => captureOperation(() => installSkills({ requestedIds: readIds(input), snapshot: catalog, bundle, sources, target, stateKey, ...(channel ? { channel } : {}), includeDependencies: !invocation.options.noDependencies }, ports)),
        'installation.update': (input) => captureOperation(() => updateSkills({ requestedIds: readIds(input), snapshot: catalog, bundle, sources, target, stateKey, ...(channel ? { channel } : {}) }, ports)),
        'installation.remove': (input) => captureOperation(() => removeSkills({ requestedIds: readIds(input), snapshot: catalog, bundle, target, stateKey }, ports)),
      },
    };
    const handle = createSkillsCapabilityRegistry(capabilityContext, [selected]);
    const input = { ids: invocation.ids };
    const execution = await handle.execute(selected, input);
    if (execution.kind === 'failure') {
      const code = execution.reason;
      const exit = code === 'unauthorized' ? 3 : code === 'invalid-input' ? 2 : 1;
      return failed(invocation, code, `Operation failed: ${code}.`, exit, { host, scope });
    }
    const operationFailure = readOperationFailure(execution.value);
    if (operationFailure) {
      return failed(invocation, operationFailure.code, operationFailure.message, operationExitCode(operationFailure.code), { host, scope });
    }
    const operation = execution.value as OperationResult & { dryRun?: boolean };
    if (invocation.options.dryRun) {
      return complete(invocation, {
        requestedIds: operation.requestedIds, resolvedIds: operation.resolvedIds, host, scope,
        ...(channel ? { channel } : {}), outcome: 'complete', data: operation, discovery: { status: 'unverified' },
      });
    }
    return complete(invocation, {
      command: invocation.command, requestedIds: operation.requestedIds ?? invocation.ids,
      resolvedIds: operation.resolvedIds ?? [], host, scope, ...(operation.channel ? { channel: operation.channel } : {}),
      outcome: 'healthy' in operation && operation.healthy === false ? 'degraded' : operation.outcome ?? 'complete', data: operation,
      discovery: { status: 'unverified' },
    });
  } catch (error) {
    return failed(invocation, 'operation-failed', error instanceof Error ? error.message : String(error), 1, { host, scope });
  }
}

function projectRootFromGit(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5_000,
    }).trim();
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 128) return cwd;
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return cwd;
    throw error;
  }
}

async function captureOperation(action: () => Promise<OperationResult>): Promise<OperationResult | { failure: { code: string; message: string } }> {
  try { return await action(); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { failure: { code: classifyOperationError(message), message } };
  }
}

function readOperationFailure(value: unknown): { code: string; message: string } | undefined {
  if (typeof value !== 'object' || value === null || !('failure' in value)) return undefined;
  const failure = value.failure;
  if (typeof failure !== 'object' || failure === null || !('code' in failure) || !('message' in failure)) return undefined;
  if (typeof failure.code !== 'string' || typeof failure.message !== 'string') return undefined;
  return { code: failure.code, message: failure.message };
}

function classifyOperationError(message: string): string {
  if (/source|github|catalog|manifest|revision|integrity/i.test(message)) return 'source-failure';
  if (/modified|not owned|unmanaged|existing skill files?|symlink|non-regular|conflicting content channels|lock|manual recovery/i.test(message)) return 'local-conflict';
  if (/registration/i.test(message)) return 'registration-required';
  if (/unknown skill|prerequisite|skill ID is required|no managed roots/i.test(message)) return 'invalid-skill';
  return 'operation-failed';
}

function operationExitCode(code: string): number {
  if (code === 'invalid-skill') return 2;
  if (code === 'source-failure') return 4;
  if (code === 'local-conflict') return 5;
  if (code === 'registration-required') return 6;
  return 1;
}

function readIds(input: unknown): string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new TypeError('Expected an input object');
  const record = input as Record<string, unknown>;
  if (typeof record.id === 'string') return [record.id];
  const value = record.ids;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new TypeError('Expected an ids array');
  return [...value];
}

async function diagnose(catalog: ReturnType<typeof readBundledCatalog>, target: InstallTarget, stateKey: string, ports: EnginePorts) {
  const state = await ports.state.load(stateKey);
  if (!state) return { healthy: true, installed: [], target, discovery: { status: 'unverified' } };
  const problems: string[] = [];
  for (const id of state.roots) {
    try { resolveSkill(catalog, id); }
    catch (error) { problems.push(error instanceof Error ? error.message : String(error)); }
  }
  const required = new Set<string>();
  try { for (const entry of resolveClosure(catalog, state.roots)) required.add(entry.id); }
  catch (error) { problems.push(error instanceof Error ? error.message : String(error)); }
  for (const id of required) if (!state.skills[id]) problems.push(`Required managed skill is missing: ${id}`);
  for (const [id, skill] of Object.entries(state.skills)) {
    for (const [path, receipt] of Object.entries(skill.files)) {
      const bytes = await ports.fs.readFile(path);
      if (!bytes) problems.push(`Missing managed file: ${path}`);
      else if (createHash('sha256').update(bytes).digest('hex') !== receipt.sha256) problems.push(`Modified managed file: ${path}`);
    }
    if (!catalog.skills.some((entry) => entry.id === id)) problems.push(`Unknown installed skill: ${id}`);
  }
  return { healthy: problems.length === 0, installed: Object.keys(state.skills), roots: state.roots, problems, target, discovery: { status: 'unverified' } };
}

async function selectHost(
  explicit: HostId | undefined,
  json: boolean,
  scope: 'project' | 'global',
  projectRoot: string,
  homeDir: string,
): Promise<HostId | undefined> {
  if (explicit) return explicit;
  const selectionRoot = process.env.APPDATA || process.env.XDG_STATE_HOME || join(homeDir, '.local', 'state');
  const targetIdentity = scope === 'global' ? 'global' : projectRoot;
  const key = createHash('sha256').update(`${scope}\0${targetIdentity}`).digest('hex').slice(0, 24);
  const selectionPath = join(selectionRoot, 'uppercut-skills', 'selections', `${key}.json`);
  await assertNoSymlinkComponents(dirname(selectionPath));
  try {
    const saved: unknown = JSON.parse(await readFile(selectionPath, 'utf8'));
    if (typeof saved === 'object' && saved !== null && 'host' in saved && supportedHosts.includes(saved.host as HostId)) return saved.host as HostId;
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  if (json || !process.stdin.isTTY || !process.stdout.isTTY) return undefined;
  process.stdout.write('Choose a host for this target:\n');
  supportedHosts.forEach((candidate, index) => process.stdout.write(`  ${index + 1}. ${candidate}\n`));
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  let answer: string;
  try { answer = await terminal.question('Host [1-6]: '); }
  finally { terminal.close(); }
  const selected = supportedHosts[Number(answer) - 1];
  if (!selected) return undefined;
  await mkdir(dirname(selectionPath), { recursive: true });
  await assertNoSymlinkComponents(dirname(selectionPath));
  await atomicJsonWrite(selectionPath, { host: selected });
  return selected;
}

function readOptionalIds(input: unknown): string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new TypeError('Expected an input object');
  const value = (input as Record<string, unknown>).ids;
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new TypeError('Expected an IDs array');
  return [...value];
}

function complete(invocation: CliInvocation, value: {
  command?: string; requestedIds: readonly string[]; resolvedIds: readonly string[];
  host?: string; scope?: 'project' | 'global'; channel?: 'bundled' | 'github';
  outcome: SkillsResult['outcome']; data?: unknown; discovery?: SkillsResult['discovery'];
}): RuntimeResult {
  const result = resultEnvelope({
    command: value.command ?? invocation.command, outcome: value.outcome,
    requestedIds: value.requestedIds, resolvedIds: value.resolvedIds,
    ...(value.host ? { host: value.host } : {}), ...(value.scope ? { scope: value.scope } : {}),
    ...(value.channel ? { channel: value.channel } : {}),
    ...(value.discovery ? { discovery: value.discovery } : {}),
    ...(value.data === undefined ? {} : { data: value.data }),
  });
  return { result, exitCode: result.outcome === 'complete' || result.outcome === 'unchanged' ? 0 : result.outcome === 'degraded' ? 7 : 1 };
}

function failed(invocation: CliInvocation, code: string, message: string, exitCode: number, extra: { candidates?: readonly string[]; host?: string; scope?: 'project' | 'global'; target?: unknown } = {}): RuntimeResult {
  const result = resultEnvelope({
    command: invocation.command, outcome: 'failed', requestedIds: invocation.ids, resolvedIds: [],
    ...(extra.host ? { host: extra.host } : {}), ...(extra.scope ? { scope: extra.scope } : {}),
    error: { code, message }, warnings: extra.candidates ? [`Candidates: ${extra.candidates.join(', ')}`] : [],
  });
  return { result, exitCode };
}

function statePathFor(target: InstallTarget, homeDir: string): string {
  const physicalTarget = resolve(target.installDir);
  const normalizedTarget = process.platform === 'win32' ? physicalTarget.toLocaleLowerCase('en-US') : physicalTarget;
  const targetKey = createHash('sha256').update(normalizedTarget).digest('hex').slice(0, 32);
  return target.scope === 'project'
    ? join(target.rootPath, '.uppercut-skills', 'targets', targetKey, 'state.json')
    : join(process.env.APPDATA || process.env.XDG_STATE_HOME || join(homeDir, '.local', 'state'), 'uppercut-skills', 'targets', targetKey, 'state.json');
}

function createNodePorts(statePath: string, installDir: string, projectScoped: boolean): EnginePorts {
  const stateRoot = dirname(statePath);
  const allowedRoots = [resolve(installDir), resolve(stateRoot)];
  const rememberedModes = new Map<string, number>();
  const assertSafePath = async (path: string): Promise<string> => {
    const absolute = resolve(path);
    if (!allowedRoots.some((root) => isWithin(root, absolute))) throw new Error(`Filesystem operation is outside managed scope: ${absolute}`);
    await assertNoSymlinkComponents(absolute);
    return absolute;
  };
  const fsPort = {
    async listFiles(directory: string): Promise<readonly string[]> {
      const root = await assertSafePath(directory);
      let rootMetadata;
      try { rootMetadata = await lstat(root); }
      catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
        throw error;
      }
      if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
        throw new Error(`Managed skill directory is not a regular directory: ${root}`);
      }
      const files: string[] = [];
      const walk = async (directoryPath: string): Promise<void> => {
        for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
          const child = await assertSafePath(join(directoryPath, entry.name));
          const metadata = await lstat(child);
          if (metadata.isSymbolicLink()) throw new Error(`Managed skill contains a symlink: ${child}`);
          if (metadata.isDirectory()) await walk(child);
          else if (metadata.isFile()) files.push(child);
          else throw new Error(`Managed skill contains a non-regular entry: ${child}`);
        }
      };
      await walk(root);
      return files;
    },
    async readFile(path: string) {
      const absolute = await assertSafePath(path);
      try {
        const metadata = await lstat(absolute);
        if (metadata.isSymbolicLink()) throw new Error(`Managed path is a symlink: ${absolute}`);
        if (!metadata.isFile()) throw new Error(`Managed path is not a regular file: ${absolute}`);
        rememberedModes.set(absolute, metadata.mode & 0o777);
        return Uint8Array.from(await readFile(absolute));
      }
      catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },
    async writeFile(path: string, bytes: Uint8Array, options?: { executable?: boolean }) {
      const absolute = await assertSafePath(path);
      await mkdir(dirname(absolute), { recursive: true });
      await assertNoSymlinkComponents(dirname(absolute));
      const mode = options?.executable === true ? 0o755 : options?.executable === false ? 0o644 : rememberedModes.get(absolute) ?? 0o644;
      const temporary = join(dirname(absolute), `.${randomUUID()}.tmp`);
      const handle = await open(temporary, 'wx', mode);
      try {
        await handle.writeFile(bytes);
        await handle.close();
        await chmod(temporary, mode);
        await assertSafePath(absolute);
        await rename(temporary, absolute);
      } catch (error) {
        await handle.close().catch(() => undefined);
        await rm(temporary, { force: true });
        throw error;
      }
      rememberedModes.set(absolute, mode);
    },
    async mkdir(path: string) {
      const absolute = await assertSafePath(path);
      await mkdir(absolute, { recursive: true });
      await assertNoSymlinkComponents(absolute);
    },
    async remove(path: string) {
      const absolute = await assertSafePath(path);
      try {
        const metadata = await lstat(absolute);
        if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Refusing to remove non-regular managed path: ${absolute}`);
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
        throw error;
      }
      await rm(absolute, { force: true });
    },
    async assertSafePath(path: string, boundary: string) {
      const absolute = resolve(path);
      const root = resolve(boundary);
      if (!allowedRoots.some((allowed) => isWithin(allowed, root))) throw new Error(`Filesystem boundary is outside managed scope: ${root}`);
      if (!isWithin(root, absolute)) throw new Error(`Filesystem operation escapes its boundary: ${absolute}`);
      await assertNoSymlinkComponents(absolute);
    },
  };
  return {
    fs: fsPort,
    state: {
      async load(key: string): Promise<InstallState | undefined> {
        const bytes = await fsPort.readFile(key);
        if (!bytes) return undefined;
        const parsed: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
        if (!isInstallState(parsed)) throw new Error(`Managed state file is invalid: ${key}`);
        return parsed;
      },
      async save(key: string, state: InstallState) {
        const absolute = await assertSafePath(key);
        await mkdir(dirname(absolute), { recursive: true });
        await assertNoSymlinkComponents(dirname(absolute));
        if (projectScoped) await ensureStateIgnored(statePath);
        await atomicJsonWrite(absolute, state);
      },
    },
    journal: {
      async load(key: string): Promise<TransactionJournal | undefined> {
        const journalPath = await assertSafePath(`${key}.transaction.json`);
        const bytes = await fsPort.readFile(journalPath);
        if (!bytes) return undefined;
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (!isTransactionJournal(parsed, installDir)) throw new Error(`Transaction journal is invalid or out of scope: ${journalPath}`);
        return parsed;
      },
      async save(key: string, journal: TransactionJournal) {
        const journalPath = await assertSafePath(`${key}.transaction.json`);
        if (projectScoped) await ensureStateIgnored(statePath);
        await atomicJsonWrite(journalPath, journal);
      },
      async clear(key: string) {
        const journalPath = await assertSafePath(`${key}.transaction.json`);
        await fsPort.remove(journalPath);
      },
    },
    lock: {
      withLock: <T>(key: string, action: () => Promise<T>) => withProcessLock(`${statePath}:${key}`, () => {
        const lockPath = `${key}.lock`;
        return withFileLock(lockPath, action, () => assertSafePath(lockPath));
      }),
    },
  };
}

async function withProcessLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  const prior = processLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolveLock) => { release = resolveLock; });
  const queued = prior.then(() => next);
  processLocks.set(key, queued);
  await prior;
  try { return await action(); }
  finally {
    release();
    if (processLocks.get(key) === queued) processLocks.delete(key);
  }
}

async function withFileLock<T>(lockPath: string, action: () => Promise<T>, assertSafe: () => Promise<string>): Promise<T> {
  await assertSafe();
  await mkdir(dirname(lockPath), { recursive: true });
  await assertSafe();
  let handle;
  try {
    await assertSafe();
    handle = await open(lockPath, 'wx', 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
  }
  catch (error) {
    if (handle) {
      await handle.close();
      await rm(lockPath, { force: true });
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      if (await reclaimStaleLock(lockPath, assertSafe)) return withFileLock(lockPath, action, assertSafe);
      throw new Error(`Another Uppercut Skills operation holds ${lockPath}; inspect or preserve the lock before retrying.`);
    }
    throw error;
  }
  try { return await action(); }
  finally {
    await handle.close();
    await rm(lockPath, { force: true });
  }
}

async function reclaimStaleLock(lockPath: string, assertSafe: () => Promise<string>): Promise<boolean> {
  let owner: { pid?: unknown; createdAt?: unknown };
  let initialMetadata;
  let initialContent: string;
  try {
    await assertSafe();
    initialMetadata = await lstat(lockPath);
    if (!initialMetadata.isFile() || initialMetadata.isSymbolicLink()) return false;
    initialContent = await readFile(lockPath, 'utf8');
    owner = JSON.parse(initialContent) as { pid?: unknown; createdAt?: unknown };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false;
    return false;
  }
  if (!Number.isSafeInteger(owner.pid) || typeof owner.createdAt !== 'string') return false;
  const createdAt = Date.parse(owner.createdAt);
  if (!Number.isFinite(createdAt) || createdAt > Date.now() + 60_000) return false;
  try { process.kill(owner.pid as number, 0); return false; }
  catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH')) return false;
  }
  const stalePath = `${lockPath}.stale-${randomUUID()}`;
  try {
    await assertSafe();
    await rename(lockPath, stalePath);
    await assertSafe();
    const moved = await lstat(stalePath);
    const movedContent = await readFile(stalePath, 'utf8');
    if (!moved.isFile() || moved.isSymbolicLink() || moved.dev !== initialMetadata.dev || moved.ino !== initialMetadata.ino || movedContent !== initialContent) {
      try {
        const restored = await open(lockPath, 'wx', 0o600);
        try { await restored.writeFile(movedContent); }
        finally { await restored.close(); }
      } catch (restoreError) {
        if (!(restoreError && typeof restoreError === 'object' && 'code' in restoreError && restoreError.code === 'EEXIST')) throw restoreError;
      }
      return false;
    }
    await rm(stalePath);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error.code === 'ENOENT' || error.code === 'EEXIST')) return false;
    throw error;
  }
}

function isInstallState(value: unknown): value is InstallState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<InstallState>;
  return state.version === 1 && Array.isArray(state.roots) && typeof state.rootChannels === 'object' && state.rootChannels !== null && typeof state.skills === 'object' && state.skills !== null;
}

function isTransactionJournal(value: unknown, installDir: string): value is TransactionJournal {
  if (typeof value !== 'object' || value === null) return false;
  const journal = value as Partial<TransactionJournal>;
  if (journal.version !== 1 || !isInstallState(journal.stateBefore) || !Array.isArray(journal.files)) return false;
  return journal.files.every((file) => {
    if (typeof file !== 'object' || file === null || typeof file.path !== 'string' || typeof file.existed !== 'boolean') return false;
    if (!isWithin(resolve(installDir), resolve(file.path))) return false;
    if (!file.existed) return file.bytesBase64 === undefined;
    if (typeof file.bytesBase64 !== 'string' || typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) return false;
    const bytes = Buffer.from(file.bytesBase64, 'base64');
    return bytes.toString('base64') === file.bytesBase64 && createHash('sha256').update(bytes).digest('hex') === file.sha256;
  });
}

async function atomicJsonWrite(path: string, value: unknown): Promise<void> {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2));
    await handle.close();
    await rename(temporary, path);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporary, { force: true });
    throw error;
  }
}

async function ensureStateIgnored(statePath: string): Promise<void> {
  const stateRoot = dirname(dirname(dirname(statePath)));
  const ignorePath = join(stateRoot, '.gitignore');
  await assertNoSymlinkComponents(stateRoot);
  await mkdir(stateRoot, { recursive: true });
  await assertNoSymlinkComponents(stateRoot);
  try {
    const handle = await open(ignorePath, 'wx', 0o644);
    try { await handle.writeFile('*\n!.gitignore\n'); }
    finally { await handle.close(); }
    return;
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
  }
  await assertNoSymlinkComponents(ignorePath);
  const existing = await readFile(ignorePath, 'utf8');
  const patterns = existing.split(/\r?\n/).map((line) => line.trim());
  if (!patterns.includes('*') && !patterns.includes('targets/') && !patterns.includes('/targets/')) {
    throw new Error(`Refusing to write local state because ${ignorePath} does not ignore the targets directory; add a targets/ rule and retry.`);
  }
}

function isWithin(root: string, path: string): boolean {
  const relativePath = relative(root, path);
  return relativePath === '' || (!relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && relativePath !== '..' && !isAbsolute(relativePath));
}

async function assertNoSymlinkComponents(absolutePath: string): Promise<void> {
  const parsed = parse(absolutePath);
  let current = parsed.root;
  for (const part of absolutePath.slice(parsed.root.length).split(/[\\/]+/).filter(Boolean)) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Filesystem path contains a symlink/reparse point: ${current}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('symlink/reparse point')) throw error;
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
  }
}
