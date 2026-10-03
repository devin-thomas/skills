import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { materializeSkill, resolveClosure, resolveSkill, validateCatalog } from '../catalog/index.js';
import type { CatalogEntry, SourceChannel } from '../catalog/types.js';
import type {
  EnginePorts,
  InstallRequest,
  InstallState,
  ManagedFileReceipt,
  TransactionJournal,
  ManagedSkillReceipt,
  OperationResult,
} from './types.js';

const EMPTY_STATE: InstallState = { version: 1, roots: [], rootChannels: {}, skills: {} };
const MAX_JOURNAL_BACKUP_BYTES = 40 * 1024 * 1024;

export async function installSkills(request: InstallRequest, ports: EnginePorts): Promise<OperationResult> {
  if (request.requestedIds.length === 0) throw new Error('At least one skill ID is required');
  return ports.lock.withLock(request.stateKey, async () => {
    validateRequest(request);
    await recoverInterruptedTransaction(request, ports);
    const previous = await loadState(ports, request.stateKey);
  const roots = [...new Set([...previous.roots, ...request.requestedIds])];
    const rootChannels = { ...previous.rootChannels };
    for (const id of request.requestedIds) rootChannels[id] = request.channel ?? rootChannels[id] ?? 'bundled';
    const includeDependencies = request.includeDependencies !== false;
    const addedDependencyIds = includeDependencies ? [] : resolveClosure(request.snapshot, request.requestedIds)
      .filter((entry) => !request.requestedIds.includes(entry.id) && !previous.skills[entry.id])
      .map((entry) => entry.id);
    const result = await applyDesiredRoots(request, ports, previous, roots, rootChannels, request.requestedIds, includeDependencies);
    return includeDependencies || !addedDependencyIds.length ? result : { ...result, outcome: 'degraded' };
  });
}

export async function updateSkills(request: InstallRequest, ports: EnginePorts): Promise<OperationResult> {
  return ports.lock.withLock(request.stateKey, async () => {
    validateRequest(request);
    await recoverInterruptedTransaction(request, ports);
    const previous = await loadState(ports, request.stateKey);
    const selected = request.requestedIds.length ? request.requestedIds : previous.roots;
    if (!selected.length) throw new Error('No managed roots are installed');
    for (const id of selected) if (!previous.roots.includes(id)) throw new Error(`Cannot update unmanaged root: ${id}`);
    const rootChannels = { ...previous.rootChannels };
    for (const id of selected) if (request.channel) rootChannels[id] = request.channel;
    const roots = [...previous.roots];
    return applyDesiredRoots(request, ports, previous, roots, rootChannels, selected);
  });
}

export async function removeSkills(request: InstallRequest, ports: EnginePorts): Promise<OperationResult> {
  if (!request.requestedIds.length) throw new Error('At least one skill ID is required');
  return ports.lock.withLock(request.stateKey, async () => {
    validateRequest(request);
    await recoverInterruptedTransaction(request, ports);
    const previous = await loadState(ports, request.stateKey);
    for (const id of request.requestedIds) if (!previous.roots.includes(id)) throw new Error(`Cannot remove unmanaged root: ${id}`);
    const roots = previous.roots.filter((id) => !request.requestedIds.includes(id));
    const retained = resolveManagedStateClosure(roots, previous.skills);
    const next: InstallState = {
      version: 1,
      roots,
      rootChannels: Object.fromEntries(Object.entries(previous.rootChannels).filter(([id]) => roots.includes(id))),
      skills: Object.fromEntries(Object.entries(previous.skills).filter(([id]) => retained.has(id))),
    };
    const changes = Object.keys(previous.skills).filter((id) => !retained.has(id)).map((skillId) => ({ action: 'removed' as const, skillId }));
    const deletes: string[] = [];
    for (const [id, receipt] of Object.entries(previous.skills)) {
      if (retained.has(id)) continue;
      for (const [path, fileReceipt] of Object.entries(receipt.files)) {
        assertWithinBoundary(path, request.target.installDir);
        await ports.fs.assertSafePath(path, request.target.installDir);
        const bytes = await ports.fs.readFile(path);
        if (bytes === undefined) continue;
        if (hash(bytes) !== fileReceipt.sha256) throw new Error(`Managed file was modified; refusing removal: ${path}`);
        deletes.push(path);
      }
    }
    await commitFilesAndState(deletes.map((path) => ({ path, bytes: undefined })), ports, request.stateKey, previous, next, request.target.installDir);
    return result(request, previous, next, changes, roots);
  });
}

async function applyDesiredRoots(
  request: InstallRequest,
  ports: EnginePorts,
  previous: InstallState,
  roots: string[],
  rootChannels: Record<string, SourceChannel>,
  rootsBeingChanged: string[],
  includeDependencies = true,
): Promise<OperationResult> {
  const closure = includeDependencies
    ? resolveClosure(request.snapshot, roots)
    : uniqueEntries([
      ...resolveClosure(request.snapshot, previous.roots),
      ...roots.filter((id) => !previous.roots.includes(id)).map((id) => resolveSkill(request.snapshot, id)),
      ...Object.keys(previous.skills).map((id) => resolveSkill(request.snapshot, id)),
    ]);
  const desiredIds = new Set(closure.map((entry) => entry.id));
  const channels = resolveChannelAssignments(request, roots, rootChannels);
  const newSkills: Record<string, ManagedSkillReceipt> = {};
  const writes = new Map<string, { bytes: Uint8Array | undefined; executable?: boolean }>();
  const changes: OperationResult['changes'] = [];

  for (const entry of closure) {
    const prior = previous.skills[entry.id];
    const shouldRefresh = rootsBeingChanged.some((root) => root === entry.id || dependsOn(request.snapshot.skills, root, entry.id));
    if (prior && !shouldRefresh && desiredIds.has(entry.id)) {
      newSkills[entry.id] = prior;
      continue;
    }
    const channel = channels.get(entry.id) ?? prior?.channel ?? 'bundled';
    const materialized = materializeSkill(entry, request.bundle);
    const files: Record<string, ManagedFileReceipt> = {};
    let changed = !prior;
    for (const file of materialized.files) {
      const destination = destinationFor(request.target.installDir, entry.id, file.path);
      assertWithinBoundary(destination, request.target.installDir);
      await ports.fs.assertSafePath(destination, request.target.installDir);
      const existing = await ports.fs.readFile(destination);
      const oldReceipt = prior?.files[destination];
      if (existing !== undefined && !oldReceipt) throw new Error(`Destination is not owned by this installer: ${destination}`);
      if (existing !== undefined && oldReceipt && hash(existing) !== oldReceipt.sha256) {
        throw new Error(`Managed file was modified; refusing update: ${destination}`);
      }
      const fileChanged = existing === undefined || hash(existing) !== file.sha256 || oldReceipt?.executable !== file.executable;
      if (fileChanged) writes.set(destination, { bytes: file.bytes, executable: file.executable });
      files[destination] = { sha256: file.sha256, executable: file.executable };
      changed ||= fileChanged;
    }
    if (prior) {
      for (const path of Object.keys(prior.files)) {
        if (files[path]) continue;
        assertWithinBoundary(path, request.target.installDir);
        await ports.fs.assertSafePath(path, request.target.installDir);
        const existing = await ports.fs.readFile(path);
        if (existing === undefined) continue;
        if (hash(existing) !== prior.files[path]!.sha256) throw new Error(`Managed file was modified; refusing update: ${path}`);
        writes.set(path, { bytes: undefined });
        changed = true;
      }
    }
    newSkills[entry.id] = {
      channel,
      sourceRevision: materialized.sourceRevision,
      requiredSkills: entry.prerequisites.flatMap((prerequisite) => prerequisite.skillId ? [prerequisite.skillId] : []),
      files,
    };
    if (changed) changes.push({ action: prior ? 'updated' : 'installed', skillId: entry.id });
  }

  for (const [id, prior] of Object.entries(previous.skills)) {
    if (desiredIds.has(id)) continue;
    for (const [path, receipt] of Object.entries(prior.files)) {
      assertWithinBoundary(path, request.target.installDir);
      await ports.fs.assertSafePath(path, request.target.installDir);
      const bytes = await ports.fs.readFile(path);
      if (bytes === undefined) continue;
      if (hash(bytes) !== receipt.sha256) throw new Error(`Managed file was modified; refusing removal: ${path}`);
      writes.set(path, { bytes: undefined });
    }
    changes.push({ action: 'removed', skillId: id });
  }
  const next: InstallState = { version: 1, roots, rootChannels, skills: newSkills };
  await commitFilesAndState([...writes].map(([path, change]) => ({ path, ...change })), ports, request.stateKey, previous, next, request.target.installDir);
  return result(request, previous, next, changes, closure.map((entry) => entry.id));
}

async function commitFilesAndState(
  changes: Array<{ path: string; bytes: Uint8Array | undefined; executable?: boolean }>,
  ports: EnginePorts,
  stateKey: string,
  previous: InstallState,
  next: InstallState,
  boundary: string,
): Promise<void> {
  const backups = new Map<string, { bytes: Uint8Array | undefined; executable?: boolean }>();
  let backupBytes = 0;
  for (const change of changes) {
    assertWithinBoundary(change.path, boundary);
    await ports.fs.assertSafePath(change.path, boundary);
    const executable = Object.values(previous.skills).map((skill) => skill.files[change.path]?.executable).find((value) => value !== undefined);
    const bytes = await ports.fs.readFile(change.path);
    backupBytes += bytes?.byteLength ?? 0;
    if (backupBytes > MAX_JOURNAL_BACKUP_BYTES) throw new Error(`Transaction backup exceeds the ${MAX_JOURNAL_BACKUP_BYTES} byte limit`);
    backups.set(change.path, { bytes, ...(executable === undefined ? {} : { executable }) });
  }
  const journal: TransactionJournal = {
    version: 1,
    stateBefore: previous,
    files: [...backups].map(([path, backup]) => ({
      path,
      existed: backup.bytes !== undefined,
      afterExisted: changes.find((change) => change.path === path)!.bytes !== undefined,
      ...(backup.bytes === undefined ? {} : { bytesBase64: toBase64(backup.bytes), sha256: hash(backup.bytes) }),
      ...(changes.find((change) => change.path === path)!.bytes === undefined ? {} : { afterSha256: hash(changes.find((change) => change.path === path)!.bytes!) }),
      ...(backup.executable === undefined ? {} : { executable: backup.executable }),
    })),
  };
  await ports.journal.save(stateKey, journal);
  const applied: string[] = [];
  try {
    for (const change of changes) {
      applied.push(change.path);
      await ports.fs.assertSafePath(change.path, boundary);
      if (change.bytes === undefined) await ports.fs.remove(change.path);
      else {
        await ports.fs.mkdir(parentOf(change.path));
        await ports.fs.writeFile(change.path, change.bytes, change.executable === undefined ? undefined : { executable: change.executable });
      }
    }
    await ports.state.save(stateKey, next);
    await ports.journal.clear(stateKey);
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const path of applied.reverse()) {
      try {
        assertWithinBoundary(path, boundary);
        await ports.fs.assertSafePath(path, boundary);
        const backup = backups.get(path)!;
        if (backup.bytes === undefined) await ports.fs.remove(path);
        else await ports.fs.writeFile(path, backup.bytes, backup.executable === undefined ? undefined : { executable: backup.executable });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    try {
      await ports.state.save(stateKey, previous);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (!rollbackErrors.length) {
      try {
        await ports.journal.clear(stateKey);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], 'Installation failed and rollback was incomplete');
    throw error;
  }
}

async function recoverInterruptedTransaction(request: InstallRequest, ports: EnginePorts): Promise<void> {
  const journal = await ports.journal.load(request.stateKey);
  if (journal === undefined) return;
  if (journal.version !== 1 || !Array.isArray(journal.files) || !isInstallState(journal.stateBefore)) {
    throw new Error('Interrupted transaction journal is invalid or unsupported');
  }
  for (const backup of journal.files) {
    if (typeof backup.path !== 'string' || !backup.path || typeof backup.existed !== 'boolean' || typeof backup.afterExisted !== 'boolean') {
      throw new Error('Interrupted transaction journal contains an invalid file record');
    }
    assertWithinBoundary(backup.path, request.target.installDir);
    await ports.fs.assertSafePath(backup.path, request.target.installDir);
    const current = await ports.fs.readFile(backup.path);
    const currentHash = current === undefined ? undefined : hash(current);
    if (backup.afterExisted && (typeof backup.afterSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(backup.afterSha256))) {
      throw new Error(`Interrupted transaction record is incomplete: ${backup.path}`);
    }
    if (backup.existed) {
      if (typeof backup.bytesBase64 !== 'string' || typeof backup.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(backup.sha256)) {
        throw new Error(`Interrupted transaction backup is incomplete: ${backup.path}`);
      }
      const bytes = fromBase64(backup.bytesBase64);
      if (hash(bytes) !== backup.sha256) throw new Error(`Interrupted transaction backup failed integrity verification: ${backup.path}`);
      if (currentHash !== undefined && currentHash !== backup.sha256 && (!backup.afterExisted || currentHash !== backup.afterSha256)) {
        throw new Error(`File changed after interruption; preserving it for manual recovery: ${backup.path}`);
      }
      await ports.fs.mkdir(parentOf(backup.path));
      await ports.fs.writeFile(backup.path, bytes, backup.executable === undefined ? undefined : { executable: backup.executable });
    } else {
      if (currentHash === undefined) continue;
      if (!backup.afterExisted || currentHash !== backup.afterSha256) {
        throw new Error(`File changed after interruption; preserving it for manual recovery: ${backup.path}`);
      }
      await ports.fs.remove(backup.path);
    }
  }
  await ports.state.save(request.stateKey, journal.stateBefore);
  await ports.journal.clear(request.stateKey);
}

async function loadState(ports: EnginePorts, key: string): Promise<InstallState> {
  const state = await ports.state.load(key);
  if (state === undefined) return structuredClone(EMPTY_STATE);
  if (state.version !== 1 || !Array.isArray(state.roots) || !state.skills || !state.rootChannels) {
    throw new Error('Managed installation state is invalid or unsupported');
  }
  return state;
}

function validateRequest(request: InstallRequest): void {
  validateCatalog(request.snapshot);
  if (request.bundle.manifest.version !== request.snapshot.version) throw new Error('Catalog and bundled content snapshots differ');
  if (request.target.scope !== 'project' && request.target.scope !== 'global') throw new Error('Invalid installation scope');
  if (!request.target.installDir || !request.stateKey) throw new Error('Installation target and state key are required');
}

function resolveChannelAssignments(request: InstallRequest, roots: string[], rootChannels: Record<string, SourceChannel>): Map<string, SourceChannel> {
  const channels = new Map<string, SourceChannel>();
  for (const root of roots) {
    const channel = rootChannels[root] ?? request.channel ?? 'bundled';
    for (const entry of resolveClosure(request.snapshot, [root])) {
      const existing = channels.get(entry.id);
      if (existing && existing !== channel) {
        throw new Error(`Conflicting content channels for shared skill ${entry.id}: ${existing} and ${channel}`);
      }
      channels.set(entry.id, channel);
    }
  }
  return channels;
}

function uniqueEntries(entries: CatalogEntry[]): CatalogEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function resolveManagedStateClosure(roots: string[], skills: Record<string, ManagedSkillReceipt>): Set<string> {
  const retained = new Set<string>();
  const visit = (id: string): void => {
    if (retained.has(id)) return;
    const receipt = skills[id];
    if (!receipt) throw new Error(`Managed state is missing an installed root or dependency: ${id}`);
    retained.add(id);
    for (const dependency of receipt.requiredSkills ?? []) if (skills[dependency]) visit(dependency);
  };
  for (const root of roots) visit(root);
  return retained;
}

function destinationFor(installDir: string, skillId: string, filePath: string): string {
  const root = resolve(installDir);
  const destination = resolve(root, skillId, ...filePath.split('/'));
  if (destination !== root && !destination.startsWith(root + sep)) throw new Error(`Installation path escapes target: ${filePath}`);
  return destination;
}

function assertWithinBoundary(path: string, boundary: string): void {
  const root = resolve(boundary);
  const destination = resolve(path);
  if (destination !== root && !destination.startsWith(root + sep)) {
    throw new Error(`Managed file path escapes installation target: ${path}`);
  }
}

function parentOf(path: string): string {
  const normalized = path.replace(/[\\/]$/, '');
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return index <= 0 ? normalized.slice(0, 1) : normalized.slice(0, index);
}

function dependsOn(entries: CatalogEntry[], root: string, target: string): boolean {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === target) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (byId.get(id)?.prerequisites ?? []).some((prerequisite) => prerequisite.skillId && visit(prerequisite.skillId));
  };
  return visit(root);
}

function result(
  request: InstallRequest,
  previous: InstallState,
  state: InstallState,
  changes: OperationResult['changes'],
  resolvedIds: string[],
): OperationResult {
  return {
    outcome: changes.length ? 'complete' : 'unchanged',
    requestedIds: [...request.requestedIds],
    resolvedIds,
    target: request.target,
    ...(request.channel ? { channel: request.channel } : {}),
    changes,
    state,
  };
}

function hash(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return createHash('sha256').update(copy).digest('hex');
}

function isInstallState(value: unknown): value is InstallState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<InstallState>;
  return state.version === 1 && Array.isArray(state.roots) && typeof state.rootChannels === 'object' && state.rootChannels !== null && typeof state.skills === 'object' && state.skills !== null;
}

function toBase64(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return Buffer.from(copy.buffer).toString('base64');
}

function fromBase64(text: string): Uint8Array {
  const decoded = Buffer.from(text, 'base64');
  if (decoded.toString('base64') !== text) throw new Error('Interrupted transaction backup is not valid base64');
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);
  return bytes;
}

export type { EnginePorts, InstallRequest, InstallState, InstallTarget, OperationResult } from './types.js';
