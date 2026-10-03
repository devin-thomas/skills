export type SourceChannel = 'bundled' | 'github';

export interface SkillPrerequisite {
  skillId?: string;
  platform?: string;
  application?: string;
  reason?: string;
}

export interface CatalogEntry {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: 'plan' | 'build' | 'specialized' | 'fun';
  order: number;
  sourceRepo: string;
  sourcePath: string;
  sourceVersion?: string | null;
  sourceRevision: string;
  sourceRef?: string;
  public: boolean;
  ownedBy: string;
  relatedSkills: string[];
  prerequisites: SkillPrerequisite[];
  recommendationOnly: boolean;
}

export interface CatalogSnapshot {
  $schema?: string;
  version: string;
  categories: string[];
  skills: CatalogEntry[];
}

export interface BundledFile {
  path: string;
  contentBase64: string;
  sha256: string;
  executable?: boolean;
}

export interface BundledSkill {
  sourceRevision: string;
  license?: string;
  attribution?: string;
  files: BundledFile[];
}

export interface CatalogBundle {
  schemaVersion: '1.0.0';
  manifest: CatalogSnapshot;
  skills: Record<string, BundledSkill>;
  resolvedSourceRevisions?: Record<string, string>;
}

export interface MaterializedFile {
  path: string;
  bytes: Uint8Array;
  sha256: string;
  executable: boolean;
}

export interface MaterializedSkill {
  entry: CatalogEntry;
  sourceRevision: string;
  license?: string;
  attribution?: string;
  files: MaterializedFile[];
}

export interface CatalogPolicy {
  approvedRepositories?: ReadonlySet<string>;
  approvedPrefixes?: Readonly<Record<string, readonly string[]>>;
}

export interface LatestCatalogSource {
  readManifest(): Promise<unknown>;
}
