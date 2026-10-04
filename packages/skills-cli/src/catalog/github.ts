import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { validateCatalog } from './index.js';
import type { BundledFile, CatalogBundle, CatalogSnapshot } from './types.js';

const CATALOG_REPOSITORY = 'devin-thomas/skills';
const CATALOG_PATH = 'manifest/skills.json';
const MAX_JSON_BYTES = 12 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const MAX_FILES = 300;

interface GitHubCommit {
  sha: string;
  commit: { tree: { sha: string } };
}

interface GitTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

interface GitTree {
  sha: string;
  tree: GitTreeEntry[];
  truncated: boolean;
}

export interface GitHubBundleOptions {
  fetch?: typeof fetch;
  catalogRepository?: string;
  catalogRef?: string;
}

export async function loadGitHubCatalog(options: GitHubBundleOptions = {}): Promise<CatalogSnapshot> {
  const fetcher = options.fetch ?? fetch;
  const repository = options.catalogRepository ?? CATALOG_REPOSITORY;
  const ref = options.catalogRef ?? 'main';
  if (repository !== CATALOG_REPOSITORY) throw new Error(`Unapproved catalog repository: ${repository}`);
  assertApprovedRef(ref, repository);
  const commit = await requestJson<GitHubCommit>(fetcher, `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(ref)}`);
  if (!isCommit(commit)) throw new Error(`GitHub did not return a verified commit for ${repository}@${ref}`);
  const tree = await requestJson<GitTree>(fetcher, `https://api.github.com/repos/${repository}/git/trees/${commit.commit.tree.sha}?recursive=1`);
  if (tree.sha !== commit.commit.tree.sha || !Array.isArray(tree.tree) || tree.truncated) throw new Error(`GitHub returned an incomplete source tree for ${repository}@${commit.sha}`);
  const bytes = await fetchGitBlob(fetcher, repository, commit.sha, tree.tree, CATALOG_PATH);
  const manifest = parseCatalog(bytes);
  validateCatalog(manifest);
  return manifest;
}

export async function loadGitHubBundle(requestedIds: readonly string[], options: GitHubBundleOptions = {}): Promise<CatalogBundle> {
  const fetcher = options.fetch ?? fetch;
  const catalogRepository = options.catalogRepository ?? CATALOG_REPOSITORY;
  if (catalogRepository !== CATALOG_REPOSITORY) throw new Error(`Unapproved catalog repository: ${catalogRepository}`);
  const catalogRef = options.catalogRef ?? 'main';
  assertApprovedRef(catalogRef, catalogRepository);

  const commits = new Map<string, GitHubCommit>();
  const trees = new Map<string, GitTreeEntry[]>();
  const commitsByRepository = new Map<string, GitHubCommit>();
  const resolveCommit = async (repository: string, ref: string): Promise<GitHubCommit> => {
    assertApprovedRepository(repository);
    assertApprovedRef(ref, repository);
    const key = `${repository}@${ref}`;
    const cached = commits.get(key);
    if (cached) return cached;
    const response = await requestJson<GitHubCommit>(fetcher, `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(ref)}`);
    if (!response || !isCommit(response)) throw new Error(`GitHub did not return a verified commit for ${repository}@${ref}`);
    commits.set(key, response);
    commitsByRepository.set(repository, response);
    return response;
  };
  const loadTree = async (repository: string, commit: GitHubCommit): Promise<GitTreeEntry[]> => {
    const key = `${repository}@${commit.sha}`;
    const cached = trees.get(key);
    if (cached) return cached;
    const response = await requestJson<GitTree>(fetcher, `https://api.github.com/repos/${repository}/git/trees/${commit.commit.tree.sha}?recursive=1`);
    if (!response || response.sha !== commit.commit.tree.sha || !Array.isArray(response.tree) || response.truncated) {
      throw new Error(`GitHub returned an incomplete source tree for ${repository}@${commit.sha}`);
    }
    if (response.tree.length > 100_000) throw new Error(`GitHub source tree is too large: ${repository}`);
    trees.set(key, response.tree);
    return response.tree;
  };

  const catalogCommit = await resolveCommit(catalogRepository, catalogRef);
  const catalogTree = await loadTree(catalogRepository, catalogCommit);
  const manifestBytes = await fetchGitBlob(fetcher, catalogRepository, catalogCommit.sha, catalogTree, CATALOG_PATH);
  const manifest = parseCatalog(manifestBytes);
  validateCatalog(manifest);

  const closure = resolveRequestedClosure(manifest, requestedIds.length ? requestedIds : manifest.skills.map((skill) => skill.id));
  const repositories = [...new Set(closure.map((entry) => entry.sourceRepo))];
  const pinned = new Map<string, string>([[catalogRepository, catalogCommit.sha]]);
  for (const repository of repositories) {
    if (pinned.has(repository)) continue;
    const entry = closure.find((candidate) => candidate.sourceRepo === repository)!;
    pinned.set(repository, (await resolveCommit(repository, entry.sourceRef ?? 'main')).sha);
  }

  let totalBytes = manifestBytes.byteLength;
  let totalFiles = 0;
  const skills: CatalogBundle['skills'] = {};
  for (const entry of closure) {
    const repository = entry.sourceRepo;
    const revision = pinned.get(repository)!;
    const sourceCommit = commitsByRepository.get(repository);
    if (!sourceCommit) throw new Error(`Pinned commit metadata is missing for ${repository}`);
    const tree = await loadTree(repository, sourceCommit);
    const skillDirectory = posix.dirname(entry.sourcePath);
    const prefix = `${skillDirectory}/`;
    const matching = tree.filter((item) => item.type === 'blob' && item.path.startsWith(prefix));
    if (!matching.some((item) => item.path === entry.sourcePath)) throw new Error(`Pinned source is missing ${entry.sourcePath} in ${repository}@${revision}`);
    const files: BundledFile[] = [];
    for (const item of matching) {
      if (item.mode !== '100644' && item.mode !== '100755') throw new Error(`Unsupported Git file mode in ${repository}: ${item.path}`);
      const relativePath = item.path.slice(prefix.length);
      assertSafePath(relativePath);
      totalFiles += 1;
      if (totalFiles > MAX_FILES) throw new Error(`GitHub skill closure exceeds the ${MAX_FILES} file limit`);
      if (item.size !== undefined && item.size > MAX_FILE_BYTES) throw new Error(`GitHub skill resource is too large: ${entry.id}/${relativePath}`);
      const bytes = await fetchGitBlob(fetcher, repository, revision, tree, item.path);
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error(`GitHub skill closure exceeds the ${MAX_TOTAL_BYTES} byte limit`);
      files.push({ path: relativePath, contentBase64: toBase64(bytes), sha256: sha256(bytes), executable: item.mode === '100755' });
    }
    skills[entry.id] = { sourceRevision: revision, files };
  }

  const resolvedSourceRevisions = Object.fromEntries(pinned);
  return { schemaVersion: '1.0.0', manifest, skills, resolvedSourceRevisions };
}

function parseCatalog(bytes: Uint8Array): CatalogSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error('GitHub catalog manifest is not valid UTF-8 JSON', { cause: error });
  }
  if (!isCatalogSnapshot(parsed)) throw new Error('GitHub catalog manifest schema is unsupported');
  if (parsed.version !== '1.0.0') throw new Error(`Unsupported catalog manifest version: ${parsed.version}`);
  return parsed;
}

async function fetchGitBlob(fetcher: typeof fetch, repository: string, commit: string, tree: GitTreeEntry[], path: string): Promise<Uint8Array> {
  const item = tree.find((candidate) => candidate.path === path && candidate.type === 'blob');
  if (!item) throw new Error(`Pinned Git tree does not contain ${repository}/${path}`);
  if (item.size !== undefined && item.size > MAX_FILE_BYTES) throw new Error(`GitHub file is too large: ${repository}/${path}`);
  const url = `https://raw.githubusercontent.com/${repository}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`GitHub source read failed (${response.status}) for ${repository}/${path}`);
  const bytes = await readBounded(response, MAX_FILE_BYTES);
  const gitObjectHash = createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(copyBytes(bytes)).digest('hex');
  if (gitObjectHash !== item.sha) throw new Error(`GitHub blob integrity check failed for ${repository}/${path}`);
  return bytes;
}

async function requestJson<T>(fetcher: typeof fetch, url: string): Promise<T> {
  const response = await fetcher(url, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
  const bytes = await readBounded(response, MAX_JSON_BYTES);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as T;
  } catch (error) {
    throw new Error('GitHub API returned invalid JSON', { cause: error });
  }
}

async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) throw new Error(`GitHub response exceeds the ${limit} byte limit`);
  if (!response.body) throw new Error('GitHub response has no body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error(`GitHub response exceeds the ${limit} byte limit`);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function resolveRequestedClosure(manifest: CatalogSnapshot, ids: readonly string[]) {
  const byId = new Map(manifest.skills.map((entry) => [entry.id, entry]));
  const complete: typeof manifest.skills = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): void => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Unknown skill: ${id}`);
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Prerequisite cycle includes skill: ${id}`);
    visiting.add(id);
    for (const prerequisite of entry.prerequisites) if (prerequisite.skillId) visit(prerequisite.skillId);
    visiting.delete(id);
    visited.add(id);
    complete.push(entry);
  };
  for (const id of ids) visit(id);
  return complete;
}

function isCatalogSnapshot(value: unknown): value is CatalogSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CatalogSnapshot>;
  return typeof candidate.version === 'string' && Array.isArray(candidate.categories) && Array.isArray(candidate.skills);
}

function isCommit(value: unknown): value is GitHubCommit {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<GitHubCommit>;
  return typeof candidate.sha === 'string' && /^[0-9a-f]{40}$/.test(candidate.sha)
    && typeof candidate.commit === 'object' && candidate.commit !== null
    && typeof candidate.commit.tree?.sha === 'string' && /^[0-9a-f]{40}$/.test(candidate.commit.tree.sha);
}

function assertApprovedRepository(repository: string): void {
  if (!['devin-thomas/skills', 'devin-thomas/starter-pack', 'devin-thomas/vid-chopper'].includes(repository)) {
    throw new Error(`Unapproved source repository: ${repository}`);
  }
}

function assertApprovedRef(ref: string, repository: string): void {
  if (ref !== 'main') throw new Error(`Unsupported source ref for ${repository}: ${ref}`);
}

function assertSafePath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f]/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error(`Unsafe GitHub skill path: ${path}`);
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(copyBytes(bytes)).digest('hex');
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function toBase64(bytes: Uint8Array): string {
  const copy = copyBytes(bytes);
  return Buffer.from(copy.buffer).toString('base64');
}
