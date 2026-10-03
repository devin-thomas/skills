import type { CatalogBundle, CatalogSnapshot, SourceChannel } from '../catalog/types.js';

export interface InstallTarget {
  id: string;
  scope: 'project' | 'global';
  rootPath: string;
  installDir: string;
}

export interface ManagedFileReceipt {
  sha256: string;
  executable: boolean;
}

export interface ManagedSkillReceipt {
  channel: SourceChannel;
  sourceRevision: string;
  requiredSkills?: string[];
  files: Record<string, ManagedFileReceipt>;
}

export interface InstallState {
  version: 1;
  roots: string[];
  rootChannels: Record<string, SourceChannel>;
  skills: Record<string, ManagedSkillReceipt>;
}

export interface InstallRequest {
  requestedIds: string[];
  snapshot: CatalogSnapshot;
  bundle: CatalogBundle;
  target: InstallTarget;
  stateKey: string;
  channel?: SourceChannel;
  includeDependencies?: boolean;
}

export interface FileSystemPort {
  readFile(path: string): Promise<Uint8Array | undefined>;
  assertSafePath(path: string, boundary: string): Promise<void>;
  writeFile(path: string, bytes: Uint8Array, options?: { executable?: boolean }): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface StatePort {
  load(key: string): Promise<InstallState | undefined>;
  save(key: string, state: InstallState): Promise<void>;
}

export interface TransactionJournal {
  version: 1;
  stateBefore: InstallState;
  files: Array<{
    path: string;
    existed: boolean;
    afterExisted: boolean;
    bytesBase64?: string;
    sha256?: string;
    afterSha256?: string;
    executable?: boolean;
  }>;
}

export interface TransactionJournalPort {
  load(key: string): Promise<TransactionJournal | undefined>;
  save(key: string, journal: TransactionJournal): Promise<void>;
  clear(key: string): Promise<void>;
}

export interface LockPort {
  withLock<T>(key: string, action: () => Promise<T>): Promise<T>;
}

export interface EnginePorts {
  fs: FileSystemPort;
  state: StatePort;
  lock: LockPort;
  journal: TransactionJournalPort;
}

export interface OperationResult {
  outcome: 'complete' | 'unchanged' | 'degraded';
  requestedIds: string[];
  resolvedIds: string[];
  target: InstallTarget;
  channel?: SourceChannel;
  changes: Array<{ action: 'installed' | 'updated' | 'removed'; skillId: string }>;
  state: InstallState;
}
