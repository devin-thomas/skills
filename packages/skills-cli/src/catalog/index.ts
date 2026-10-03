import { createHash } from 'node:crypto';
import type {
  CatalogBundle,
  CatalogEntry,
  CatalogPolicy,
  CatalogSnapshot,
  LatestCatalogSource,
  MaterializedSkill,
} from './types.js';

const DEFAULT_POLICY: Required<CatalogPolicy> = {
  approvedRepositories: new Set([
    'devin-thomas/skills',
    'devin-thomas/starter-pack',
    'devin-thomas/vid-chopper',
  ]),
  approvedPrefixes: {
    'devin-thomas/skills': [
      'execute-task/', 'execute-task-cycles/', 'grill-to-build/', 'long-horizon-dashboard/',
      'no-useless-copy/', 'perfect-playlist/', 'pwa-development/', 'quick-build/', 'style/',
      'surface-sweep/', 'surface-sweep-showcase/', 'task-execution-prompt/',
    ],
    'devin-thomas/starter-pack': ['public/skills/'],
    'devin-thomas/vid-chopper': ['.agents/skills/'],
  },
};

export function readBundledCatalog(bundle: CatalogBundle): CatalogSnapshot {
  if (bundle.schemaVersion !== '1.0.0') throw new Error(`Unsupported bundle schema: ${String(bundle.schemaVersion)}`);
  validateCatalog(bundle.manifest);
  for (const entry of bundle.manifest.skills) {
    if (!bundle.skills[entry.id]) throw new Error(`Bundled content is missing skill: ${entry.id}`);
  }
  return structuredClone(bundle.manifest);
}

export function validateCatalog(snapshot: CatalogSnapshot, policy: CatalogPolicy = {}): void {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.skills)) {
    throw new Error('Invalid catalog manifest');
  }
  if (snapshot.version !== '1.0.0') throw new Error(`Unsupported catalog manifest version: ${snapshot.version}`);
  const expectedCategories = ['plan', 'build', 'specialized', 'fun'];
  if (!Array.isArray(snapshot.categories) || snapshot.categories.length !== expectedCategories.length
    || expectedCategories.some((category) => !snapshot.categories.includes(category)) || snapshot.skills.length === 0) {
    throw new Error('Catalog manifest categories or skill list are invalid');
  }
  const effectivePolicy = {
    approvedRepositories: policy.approvedRepositories ?? DEFAULT_POLICY.approvedRepositories,
    approvedPrefixes: policy.approvedPrefixes ?? DEFAULT_POLICY.approvedPrefixes,
  };
  const byId = new Map<string, CatalogEntry>();
  for (const entry of snapshot.skills) {
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id)) throw new Error(`Invalid skill ID: ${entry.id}`);
    if (byId.has(entry.id)) throw new Error(`Duplicate skill ID: ${entry.id}`);
    if (typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.summary !== 'string' || !entry.summary.trim()) {
      throw new Error(`Skill metadata is incomplete: ${entry.id}`);
    }
    if (!['plan', 'build', 'specialized', 'fun'].includes(entry.category) || !Number.isInteger(entry.order) || entry.order < 1) {
      throw new Error(`Skill catalog placement is invalid: ${entry.id}`);
    }
    if (!entry.public || entry.recommendationOnly) throw new Error(`Skill is not distributable: ${entry.id}`);
    if (!effectivePolicy.approvedRepositories.has(entry.sourceRepo)) throw new Error(`Unapproved source repository: ${entry.sourceRepo}`);
    const prefixes = effectivePolicy.approvedPrefixes[entry.sourceRepo] ?? [];
    if (typeof entry.sourcePath !== 'string' || !entry.sourcePath.endsWith('/SKILL.md') || !prefixes.some((prefix) => entry.sourcePath.startsWith(prefix))) {
      throw new Error(`Unapproved source path for ${entry.id}: ${entry.sourcePath}`);
    }
    if (!isSafeRelativePath(entry.sourcePath)) throw new Error(`Unsafe source path for ${entry.id}`);
    if (!/^[0-9a-f]{40}$/.test(entry.sourceRevision)) throw new Error(`Invalid source revision for ${entry.id}`);
    if (entry.sourceRef !== undefined && entry.sourceRef !== 'main') throw new Error(`Unsupported source ref for ${entry.id}: ${entry.sourceRef}`);
    if (!Array.isArray(entry.prerequisites) || !Array.isArray(entry.relatedSkills) || typeof entry.ownedBy !== 'string' || !entry.ownedBy) {
      throw new Error(`Skill relationship or ownership metadata is invalid: ${entry.id}`);
    }
    byId.set(entry.id, entry);
  }
  for (const entry of snapshot.skills) {
    for (const prerequisite of entry.prerequisites) {
      if (prerequisite.skillId && !byId.has(prerequisite.skillId)) {
        throw new Error(`Missing prerequisite ${prerequisite.skillId} required by ${entry.id}`);
      }
    }
  }
}

export function resolveSkill(snapshot: CatalogSnapshot, id: string): CatalogEntry {
  const entry = snapshot.skills.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown skill: ${id}`);
  return entry;
}

export function resolveClosure(snapshot: CatalogSnapshot, ids: readonly string[]): CatalogEntry[] {
  validateCatalog(snapshot);
  const byId = new Map(snapshot.skills.map((entry) => [entry.id, entry]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: CatalogEntry[] = [];
  const visit = (id: string): void => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Unknown or missing prerequisite skill: ${id}`);
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Prerequisite cycle includes skill: ${id}`);
    visiting.add(id);
    for (const prerequisite of entry.prerequisites) {
      if (prerequisite.skillId) visit(prerequisite.skillId);
    }
    visiting.delete(id);
    visited.add(id);
    result.push(entry);
  };
  for (const id of ids) visit(id);
  return result;
}

export function materializeSkill(entry: CatalogEntry, bundle: CatalogBundle): MaterializedSkill {
  const bundled = bundle.skills[entry.id];
  if (!bundled) throw new Error(`Bundled content is missing skill: ${entry.id}`);
  const expectedRevision = bundle.resolvedSourceRevisions?.[entry.sourceRepo] ?? entry.sourceRevision;
  if (bundled.sourceRevision !== expectedRevision) throw new Error(`Bundle revision mismatch for ${entry.id}`);
  const files = bundled.files.map((file) => {
    if (!isSafeRelativePath(file.path)) throw new Error(`Unsafe bundled path for ${entry.id}: ${file.path}`);
    const decoded = Buffer.from(file.contentBase64, 'base64');
    if (decoded.toString('base64') !== file.contentBase64) throw new Error(`Invalid base64 content for ${entry.id}/${file.path}`);
    const bytes = new Uint8Array(decoded.length);
    bytes.set(decoded);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== file.sha256) throw new Error(`Bundled file hash mismatch: ${entry.id}/${file.path}`);
    return { path: file.path, bytes, sha256: digest, executable: file.executable === true };
  });
  if (!files.some((file) => file.path === 'SKILL.md' || file.path.endsWith('/SKILL.md'))) {
    throw new Error(`Bundled skill has no SKILL.md: ${entry.id}`);
  }
  const paths = new Set<string>();
  for (const file of files) {
    const folded = file.path.toLocaleLowerCase('en-US');
    if (paths.has(folded)) throw new Error(`Case-colliding bundled path: ${entry.id}/${file.path}`);
    paths.add(folded);
  }
  return {
    entry,
    sourceRevision: bundled.sourceRevision,
    ...(bundled.license ? { license: bundled.license } : {}),
    ...(bundled.attribution ? { attribution: bundled.attribution } : {}),
    files,
  };
}

export async function loadLatestCatalog(source: LatestCatalogSource): Promise<CatalogSnapshot> {
  const value = await source.readManifest();
  if (!isCatalogSnapshot(value)) throw new Error('GitHub catalog returned an unsupported manifest');
  validateCatalog(value);
  return structuredClone(value);
}

function isCatalogSnapshot(value: unknown): value is CatalogSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CatalogSnapshot>;
  return typeof candidate.version === 'string' && Array.isArray(candidate.categories) && Array.isArray(candidate.skills);
}

function isSafeRelativePath(path: string): boolean {
  if (!path || path.includes('\\') || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return false;
  const parts = path.split('/');
  return parts.every((part) => part.length > 0 && part !== '.' && part !== '..' && !/[<>:"|?*\x00-\x1f]/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
