import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'manifest', 'skills.json'), 'utf8'));
const policy = JSON.parse(readFileSync(join(repositoryRoot, 'distribution', 'source-policy.json'), 'utf8'));
const sourceRoots = new Map([[policy.catalogRepository, repositoryRoot]]);

for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index] !== '--source-repo' || !process.argv[index + 1]) {
    throw new Error('Usage: node distribution/build-bundle.mjs --source-repo owner/repo=/absolute/checkout [--source-repo ...]');
  }
  const option = process.argv[++index];
  const delimiter = option.indexOf('=');
  if (delimiter <= 0) throw new Error(`Invalid source repository mapping: ${option}`);
  const identity = option.slice(0, delimiter);
  if (!Object.hasOwn(policy.repositories, identity)) throw new Error(`Unapproved source repository: ${identity}`);
  if (sourceRoots.has(identity)) throw new Error(`Duplicate source repository mapping: ${identity}`);
  sourceRoots.set(identity, realpathSync(resolve(option.slice(delimiter + 1))));
}

const bundle = {
  schemaVersion: '1.0.0',
  manifest,
  skills: {},
};

const seenIds = new Set();
let totalBytes = 0;
for (const entry of manifest.skills) {
  if (seenIds.has(entry.id)) throw new Error(`Duplicate catalog ID: ${entry.id}`);
  seenIds.add(entry.id);
  if (!entry.public || entry.recommendationOnly) throw new Error(`Non-distributable skill: ${entry.id}`);
  const prefixes = policy.repositories[entry.sourceRepo];
  const sourceRoot = sourceRoots.get(entry.sourceRepo);
  if (!prefixes || !sourceRoot) throw new Error(`Missing approved checkout for ${entry.sourceRepo}`);
  if (!isSafePath(entry.sourcePath) || !prefixes.some((prefix) => entry.sourcePath.startsWith(prefix))) {
    throw new Error(`Unapproved source path for ${entry.id}: ${entry.sourcePath}`);
  }
  if (!entry.sourcePath.endsWith('/SKILL.md')) throw new Error(`Unexpected entry point for ${entry.id}`);
  if (!/^[0-9a-f]{40}$/.test(entry.sourceRevision)) throw new Error(`Invalid source revision for ${entry.id}`);
  if (git(sourceRoot, ['cat-file', '-t', entry.sourceRevision]).toString('utf8').trim() !== 'commit') {
    throw new Error(`Source revision is not a commit: ${entry.id}`);
  }

  const skillRoot = entry.sourcePath.slice(0, -'SKILL.md'.length);
  const tree = git(sourceRoot, ['ls-tree', '-r', '-z', entry.sourceRevision, '--', skillRoot]);
  const files = [];
  const foldedPaths = new Set();
  for (const record of tree.toString('utf8').split('\0')) {
    if (!record) continue;
    const match = /^(\d{6}) blob [0-9a-f]{40}\t(.+)$/.exec(record);
    if (!match) throw new Error(`Unsupported tree object in ${entry.id}: ${record}`);
    const [, mode, sourcePath] = match;
    if (mode !== '100644' && mode !== '100755') throw new Error(`Unsupported file mode in ${entry.id}: ${sourcePath}`);
    if (!sourcePath.startsWith(skillRoot)) throw new Error(`Escaping source path in ${entry.id}: ${sourcePath}`);
    const path = sourcePath.slice(skillRoot.length);
    if (!isSafePath(path)) throw new Error(`Unsafe bundled path in ${entry.id}: ${path}`);
    const folded = path.toLocaleLowerCase('en-US');
    if (foldedPaths.has(folded)) throw new Error(`Case-colliding bundled path in ${entry.id}: ${path}`);
    foldedPaths.add(folded);
    const content = git(sourceRoot, ['show', `${entry.sourceRevision}:${sourcePath}`]);
    if (content.length > 2 * 1024 * 1024) throw new Error(`Oversized source file in ${entry.id}: ${path}`);
    totalBytes += content.length;
    if (totalBytes > 20 * 1024 * 1024) throw new Error('Bundled content exceeds the 20 MiB review limit');
    files.push({
      path,
      contentBase64: content.toString('base64'),
      sha256: createHash('sha256').update(content).digest('hex'),
      ...(mode === '100755' ? { executable: true } : {}),
    });
  }
  if (!files.some((file) => file.path === 'SKILL.md')) throw new Error(`Missing SKILL.md at pinned revision for ${entry.id}`);
  if (files.length > 500) throw new Error(`Too many files in ${entry.id}`);
  files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
  bundle.skills[entry.id] = {
    sourceRevision: entry.sourceRevision,
    attribution: `${entry.sourceRepo}@${entry.sourceRevision}`,
    files,
  };
}

const output = join(repositoryRoot, 'packages', 'skills-cli', 'src', 'generated', 'bundle.ts');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `import type { CatalogBundle } from '../catalog/types.js';\n\nexport const catalogBundle: CatalogBundle = ${JSON.stringify(bundle, null, 2)};\n`);
process.stdout.write(`Bundled ${manifest.skills.length} skills, ${totalBytes} source bytes into ${output}\n`);

function git(cwd, args) {
  return execFileSync('git', args, { cwd, maxBuffer: 3 * 1024 * 1024 });
}

function isSafePath(path) {
  if (!path || path.startsWith('/') || path.includes('\\') || /^[a-zA-Z]:/.test(path)) return false;
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..' &&
    !/[<>:"|?*\x00-\x1f]/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
