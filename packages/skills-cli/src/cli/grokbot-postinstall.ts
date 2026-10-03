import { lstat, readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { materializeSkill, resolveClosure } from '../catalog/index.js';
import type { CatalogBundle, CatalogSnapshot } from '../catalog/types.js';
import { catalogBundle } from '../generated/bundle.js';
import { resolveHostTargetResult } from '../hosts/index.js';
import { parseArgs } from './args.js';
import { runCli } from './node-runtime.js';

export function shouldPopulateGrokBotLibrary(input: {
  readonly npmGlobal: string | undefined;
  readonly lifecycleEvent: string | undefined;
  readonly accountTargetReady: boolean;
}): boolean {
  return input.npmGlobal === 'true' && input.lifecycleEvent === 'postinstall' && input.accountTargetReady;
}

type PostinstallCliResult = {
  readonly exitCode: number;
  readonly result: { readonly data?: unknown; readonly error?: { readonly message: string } };
};

export interface FreshInstallPlan {
  readonly eligibleIds: readonly string[];
  readonly skipped: readonly { id: string; blockedBy: readonly string[] }[];
}

export function planFreshGrokBotLibrary(
  ids: readonly string[], snapshot: CatalogSnapshot, conflictingIds: readonly string[],
): FreshInstallPlan {
  const conflicts = new Set(conflictingIds);
  const eligibleIds: string[] = [];
  const skipped: Array<{ id: string; blockedBy: string[] }> = [];
  for (const id of ids) {
    const blockedBy = resolveClosure(snapshot, [id]).map((entry) => entry.id).filter((candidate) => conflicts.has(candidate));
    if (blockedBy.length) skipped.push({ id, blockedBy });
    else eligibleIds.push(id);
  }
  return { eligibleIds, skipped };
}

/** Read an existing folder without following skill-level symlinks. The engine rechecks before committing. */
export async function findConflictingBundledSkills(bundle: CatalogBundle, installDir: string): Promise<string[]> {
  const conflicts: string[] = [];
  for (const entry of bundle.manifest.skills) {
    const skillDir = join(installDir, entry.id);
    let metadata;
    try { metadata = await lstat(skillDir); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      conflicts.push(entry.id);
      continue;
    }
    const existing = new Map<string, Uint8Array>();
    const collect = async (directory: string): Promise<boolean> => {
      for (const item of await readdir(directory, { withFileTypes: true })) {
        const child = join(directory, item.name);
        const childMetadata = await lstat(child);
        if (childMetadata.isSymbolicLink() || (!childMetadata.isDirectory() && !childMetadata.isFile())) return false;
        if (childMetadata.isDirectory()) {
          if (!await collect(child)) return false;
        } else {
          existing.set(relative(skillDir, child).split(sep).join('/'), await readFile(child));
        }
      }
      return true;
    };
    if (!await collect(skillDir)) {
      conflicts.push(entry.id);
      continue;
    }
    if (!existing.size) continue;
    const planned = materializeSkill(entry, bundle).files;
    if (existing.size !== planned.length || planned.some((file) => {
      const bytes = existing.get(file.path);
      return !bytes || !Buffer.from(bytes).equals(Buffer.from(file.bytes));
    })) conflicts.push(entry.id);
  }
  return conflicts;
}

export async function populateFreshGrokBotLibrary(
  ids: readonly string[],
  run: (args: readonly string[]) => Promise<PostinstallCliResult>,
  prepare: () => Promise<FreshInstallPlan>,
): Promise<string> {
  const common = ['--host', 'grokbot', '--global', '--json'];
  const doctor = await run(['doctor', ...common]);
  if (doctor.exitCode !== 0) throw new Error(`Grok Bot library preflight failed: ${doctor.result.error?.message ?? 'unknown error'}`);
  const data = doctor.result.data;
  if (typeof data !== 'object' || data === null) throw new Error('Grok Bot library preflight returned no installation state');
  const existingRoots = 'roots' in data && Array.isArray(data.roots) ? data.roots : [];
  if (existingRoots.length) {
    return 'Existing managed Grok Bot skills preserved. Run uppercut-skills update --host grokbot --global explicitly to refresh them.';
  }
  const plan = await prepare();
  if (plan.eligibleIds.some((id) => !ids.includes(id))) throw new Error('Grok Bot install plan contains an unknown skill');
  const skipped = plan.skipped.length
    ? ` Skipped ${plan.skipped.map(({ id, blockedBy }) => `${id} (conflict: ${blockedBy.join(', ')})`).join('; ')}; those folders were not changed.`
    : '';
  if (!plan.eligibleIds.length) return `No bundled skills installed.${skipped}`;
  const added = await run(['add', ...plan.eligibleIds, ...common]);
  if (added.exitCode !== 0) throw new Error(`Grok Bot library installation failed: ${added.result.error?.message ?? 'unknown error'}`);
  return `Installed ${plan.eligibleIds.length} bundled Uppercut skills into the Grok Bot account library.${skipped}`;
}

/** npm global installation populates only a fresh, qualified Bot account library. */
export async function runGrokBotPostinstall(): Promise<string> {
  const target = resolveHostTargetResult('grokbot', {
    scope: 'global', projectRoot: process.cwd(), homeDir: homedir(),
  });
  if (target.status !== 'ready' || !shouldPopulateGrokBotLibrary({
    npmGlobal: process.env.npm_config_global,
    lifecycleEvent: process.env.npm_lifecycle_event,
    accountTargetReady: true,
  })) return 'Grok Bot account library untouched (not a qualified global Bot installation).';

  const ids = catalogBundle.manifest.skills.map((skill) => skill.id);
  return populateFreshGrokBotLibrary(
    ids,
    (args) => runCli(parseArgs(args), { catalogBundle }),
    async () => planFreshGrokBotLibrary(ids, catalogBundle.manifest,
      await findConflictingBundledSkills(catalogBundle, target.target.installDir)),
  );
}
