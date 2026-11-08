// Local npm release gate for @uppercut-labs/skills. Runs without GitHub Actions.
//
//   node distribution/release-gate.mjs [--out DIR] [--source-repo owner/repo=PATH ...]
//   node distribution/release-gate.mjs --compare RECORD.json --artifact FILE.tgz | --npm VERSION
//
// Gate mode requires a clean checkout, packs exactly one candidate tarball, and
// runs every check against that file. It writes release-record.json and
// RELEASE-RECORD.md beside the tarball and exits nonzero on any failure.
// Compare mode checks a downloaded registry or GitHub artifact against a
// recorded candidate without rebuilding anything.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { platform, release, tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const packageRoot = join(repositoryRoot, 'packages', 'skills-cli');
const PACKAGE_NAME = '@uppercut-labs/skills';
const PACKAGE_FILES = new Set(['LICENSE', 'NOTICE.md', 'README.md', 'package.json']);

const options = parseArguments(process.argv.slice(2));
if (options.compare) {
  process.exitCode = compareArtifact(options) ? 0 : 1;
} else {
  process.exitCode = runGate(options) ? 0 : 1;
}

function runGate({ out, sourceRepos }) {
  const startedAt = new Date().toISOString();
  const outDir = resolve(out ?? join(tmpdir(), `uppercut-skills-release-${startedAt.slice(0, 10)}-${process.pid}`));
  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'uppercut-skills-gate-'));
  const record = {
    schemaVersion: '1.0.0',
    package: PACKAGE_NAME,
    startedAt,
    checkout: {},
    tools: toolVersions(),
    sources: {},
    checks: [],
    artifact: null,
    unverified: [
      'Native host registration and discovery in Codex, Claude Code, Cursor, Antigravity, Grok Bot and Grok CLI (record separately).',
      'Windows and Linux runtime behavior unless this gate was also run on those systems.',
      'Registry and GitHub release bytes until compare mode is run against the published artifacts.',
    ],
    outcome: 'failed',
  };
  const check = (name, fn) => {
    const started = Date.now();
    try {
      const detail = fn();
      record.checks.push({ name, status: 'passed', durationMs: Date.now() - started, ...(detail ? { detail } : {}) });
      log(`PASS ${name}${detail && typeof detail === 'string' ? `: ${detail}` : ''}`);
      return true;
    } catch (error) {
      record.checks.push({ name, status: 'failed', durationMs: Date.now() - started, error: String(error?.message ?? error).slice(0, 4000) });
      log(`FAIL ${name}: ${String(error?.message ?? error).split('\n')[0]}`);
      return false;
    }
  };

  try {
    const manifest = readJson(join(repositoryRoot, 'manifest', 'skills.json'));
    const policy = readJson(join(repositoryRoot, 'distribution', 'source-policy.json'));
    const freezes = readJson(join(repositoryRoot, 'distribution', 'snapshot-freezes.json')).freezes ?? {};
    const packageJson = readJson(join(packageRoot, 'package.json'));

    // Fail closed on a dirty or unidentifiable checkout: the record must name the exact source.
    if (!check('clean candidate checkout', () => {
      const status = git(repositoryRoot, ['status', '--porcelain', '--untracked-files=normal']).trim();
      if (status) throw new Error(`Working tree is not clean:\n${status}`);
      record.checkout = {
        commit: git(repositoryRoot, ['rev-parse', 'HEAD']).trim(),
        branch: git(repositoryRoot, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
        tree: git(repositoryRoot, ['rev-parse', 'HEAD^{tree}']).trim(),
        packageVersion: packageJson.version,
      };
      return `${record.checkout.commit} (${record.checkout.branch}), package ${packageJson.version}`;
    })) return finish();

    // Source checkouts: approved external repositories are cloned fresh unless supplied.
    const roots = new Map([[policy.catalogRepository, repositoryRoot]]);
    if (!check('source checkouts', () => {
      const declared = new Set(Object.keys(policy.repositories));
      for (const entry of manifest.skills) declared.add(entry.sourceRepo);
      for (const identity of declared) {
        if (roots.has(identity)) continue;
        const supplied = sourceRepos.get(identity);
        const path = supplied ?? join(work, 'sources', identity.replace('/', '__'));
        if (!supplied) {
          mkdirSync(dirname(path), { recursive: true });
          run('git', ['clone', '--quiet', '--filter=blob:none', `https://github.com/${identity}.git`, path], { cwd: work, timeout: 300_000 });
        } else {
          run('git', ['fetch', '--quiet', 'origin'], { cwd: path, timeout: 300_000 });
        }
        roots.set(identity, realpathSync(path));
      }
      for (const [identity, path] of roots) {
        const head = identity === policy.catalogRepository ? 'HEAD' : remoteDefault(path);
        record.sources[identity] = { checkout: identity === policy.catalogRepository ? 'candidate' : (sourceRepos.has(identity) ? 'supplied' : 'fresh clone'), compareRef: head, compareCommit: git(path, ['rev-parse', head]).trim() };
      }
      return [...roots.keys()].join(', ');
    })) return finish();

    check('pinned revisions are published commits', () => {
      const problems = [];
      for (const entry of manifest.skills) {
        const root = roots.get(entry.sourceRepo);
        if (!/^[0-9a-f]{40}$/.test(entry.sourceRevision)) { problems.push(`${entry.id}: not a full SHA`); continue; }
        if (spawnSync('git', ['merge-base', '--is-ancestor', entry.sourceRevision, record.sources[entry.sourceRepo].compareRef], { cwd: root }).status !== 0) {
          problems.push(`${entry.id}: ${entry.sourceRevision} is not reachable from ${entry.sourceRepo} ${record.sources[entry.sourceRepo].compareRef}`);
        }
      }
      if (problems.length) throw new Error(problems.join('\n'));
      return `${manifest.skills.length} pins`;
    });

    check('snapshots match maintained source or a recorded freeze', () => {
      const stale = [];
      const frozen = [];
      for (const entry of manifest.skills) {
        const root = roots.get(entry.sourceRepo);
        const skillRoot = entry.sourcePath.slice(0, -'SKILL.md'.length);
        const compare = record.sources[entry.sourceRepo].compareRef;
        const pinnedTree = git(root, ['rev-parse', `${entry.sourceRevision}:${skillRoot}`]).trim();
        const currentTree = git(root, ['rev-parse', `${compare}:${skillRoot}`]).trim();
        if (pinnedTree === currentTree) continue;
        if (freezes[entry.id]?.reason) frozen.push(`${entry.id} (${freezes[entry.id].reason})`);
        else stale.push(`${entry.id}: ${entry.sourceRepo}/${skillRoot} changed after ${entry.sourceRevision.slice(0, 12)}`);
      }
      if (stale.length) throw new Error(`Stale snapshots without a recorded freeze:\n${stale.join('\n')}`);
      return frozen.length ? `frozen: ${frozen.join('; ')}` : 'all current';
    });

    check('bundle regenerates byte-identically', () => {
      const output = join(work, 'bundle.ts');
      const args = [join(repositoryRoot, 'distribution', 'build-bundle.mjs'), '--output', output];
      for (const [identity, path] of roots) if (identity !== policy.catalogRepository) args.push('--source-repo', `${identity}=${path}`);
      run(process.execPath, args, { cwd: repositoryRoot });
      const committed = readFileSync(join(packageRoot, 'src', 'generated', 'bundle.ts'));
      if (!readFileSync(output).equals(committed)) throw new Error('packages/skills-cli/src/generated/bundle.ts differs from a fresh build of manifest/skills.json');
      return sha256(committed);
    });

    check('declarations match pinned sources', () => verifyDeclarations(manifest, roots, record));

    check('NOTICE matches external pins and has no pending grant', () => {
      const notice = readFileSync(join(packageRoot, 'NOTICE.md'), 'utf8');
      if (/PENDING-OWNER/.test(notice)) throw new Error('NOTICE.md still contains a PENDING-OWNER marker; the owner must record the license grant');
      const missing = manifest.skills
        .filter((entry) => entry.sourceRepo !== policy.catalogRepository)
        .filter((entry) => !notice.includes(entry.sourceRevision))
        .map((entry) => `${entry.id}@${entry.sourceRevision}`);
      if (missing.length) throw new Error(`NOTICE.md does not name: ${missing.join(', ')}`);
      if (!/MIT License/.test(readFileSync(join(packageRoot, 'LICENSE'), 'utf8'))) throw new Error('LICENSE is not the MIT license');
      return 'MIT; external snapshot commits listed';
    });

    const python = pythonCommand();
    const sourceChecks = [
      ['skill entry points', python, ['scripts/validate-skills.py']],
      ['manifest tests', python, ['tests/test-manifest.py']],
      ['freshness tests', python, ['tests/test-freshness.py']],
      ['grill artifact contract', python, ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_grill_artifact_contract.py']],
      ['PWA helpers', process.execPath, ['--test', 'tests/pwa-helpers.test.mjs']],
      ['programmatic harness proof helpers', process.execPath, ['--test', 'programmatic-harness/scripts/codex-proof.test.mjs']],
    ];
    for (const [name, command, args] of sourceChecks) {
      check(name, () => summarize(run(command, args, { cwd: repositoryRoot })));
    }
    const lastTag = spawnSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], { cwd: repositoryRoot, encoding: 'utf8' }).stdout.trim();
    if (lastTag) check(`whitespace since ${lastTag}`, () => { run('git', ['diff', '--check', lastTag, 'HEAD'], { cwd: repositoryRoot }); return 'clean'; });

    const npm = npmCommand();
    check('package install, typecheck and tests', () => {
      run(npm[0], [...npm.slice(1), 'ci', '--no-audit', '--no-fund'], { cwd: packageRoot, timeout: 600_000 });
      run(npm[0], [...npm.slice(1), 'run', 'typecheck'], { cwd: packageRoot, timeout: 300_000 });
      return summarize(run(npm[0], [...npm.slice(1), 'test'], { cwd: packageRoot, timeout: 600_000 }));
    });

    let tarball;
    if (!check('pack candidate tarball', () => {
      const packed = JSON.parse(run(npm[0], [...npm.slice(1), 'pack', '--json', '--pack-destination', outDir], { cwd: packageRoot, timeout: 300_000 }));
      const artifact = Array.isArray(packed) ? packed[0] : packed;
      tarball = join(outDir, artifact.filename);
      const bytes = readFileSync(tarball);
      const unexpected = artifact.files.map(({ path }) => path).filter((path) => !PACKAGE_FILES.has(path) && !path.startsWith('bin/') && !path.startsWith('dist/'));
      if (unexpected.length) throw new Error(`Unexpected packed files: ${unexpected.join(', ')}`);
      if (artifact.name !== PACKAGE_NAME || artifact.version !== packageJson.version) throw new Error(`Packed ${artifact.name}@${artifact.version}`);
      record.artifact = {
        file: artifact.filename, bytes: bytes.length, sha256: sha256(bytes), integrity: artifact.integrity,
        shasum: artifact.shasum, files: artifact.files.length, version: artifact.version,
      };
      writeFileSync(`${tarball}.sha256`, `${record.artifact.sha256}  ${artifact.filename}\n`);
      return `${artifact.filename} ${record.artifact.sha256}`;
    })) return finish();

    // Everything below uses the exact tarball; nothing is rebuilt.
    const consumer = join(work, 'consumer');
    const fakeHome = join(work, 'home');
    mkdirSync(consumer, { recursive: true });
    mkdirSync(fakeHome, { recursive: true });
    const isolatedEnv = {
      ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, XDG_CONFIG_HOME: join(fakeHome, '.config'),
      APPDATA: join(fakeHome, 'AppData', 'Roaming'), LOCALAPPDATA: join(fakeHome, 'AppData', 'Local'),
    };
    if (!check('install candidate in clean consumer', () => {
      run(npm[0], [...npm.slice(1), 'install', '--prefix', consumer, '--no-audit', '--no-fund', tarball], { cwd: consumer, env: isolatedEnv, timeout: 300_000 });
      const installed = readJson(join(consumer, 'node_modules', '@uppercut-labs', 'skills', 'package.json'));
      const missing = Object.entries(installed.dependencies ?? {}).filter(([name]) => !existsSync(join(consumer, 'node_modules', ...name.split('/'), 'package.json')));
      if (missing.length) throw new Error(`Missing runtime dependencies: ${missing.map(([name]) => name).join(', ')}`);
      const loose = Object.entries(installed.dependencies ?? {}).filter(([, range]) => !/^\d+\.\d+\.\d+$/.test(range));
      if (loose.length) throw new Error(`Runtime dependencies must be exact versions: ${loose.map(([name, range]) => `${name}@${range}`).join(', ')}`);
      if (readdirSync(fakeHome).length) throw new Error(`Ordinary install wrote to the user home: ${readdirSync(fakeHome).join(', ')}`);
      return `dependencies: ${Object.entries(installed.dependencies ?? {}).map(([name, version]) => `${name}@${version}`).join(', ') || 'none'}`;
    })) return finish();

    const installedRoot = join(consumer, 'node_modules', '@uppercut-labs', 'skills');
    check('bundled skills match manifest and pinned Git bytes', () => verifyInstalledBundle(installedRoot, manifest, roots));
    check('no private files, credentials or owner identifiers', () => scanForPrivateContent(installedRoot));

    const cli = (args, env = isolatedEnv) => spawnSync(process.execPath, [join(installedRoot, 'bin', 'uppercut-skills.js'), ...args, '--json'], {
      cwd: consumer, env, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
    });
    check('offline bundled installs match pinned source', () => {
      // Route any network attempt to a closed local port so a hidden fetch fails loudly.
      const offline = { ...isolatedEnv, HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9', https_proxy: 'http://127.0.0.1:9', http_proxy: 'http://127.0.0.1:9', NO_PROXY: '', no_proxy: '' };
      const project = join(work, 'offline-project');
      mkdirSync(project);
      const ids = ['starter-pack', 'computer-setup', 'style', 'quick-build'];
      const result = cli(['add', ...ids, '--host', 'codex', '--project', project], offline);
      const parsed = JSON.parse(result.stdout);
      if (result.status !== 0 || parsed.outcome !== 'complete') throw new Error(`add failed: ${result.stdout || result.stderr}`);
      const notes = [];
      for (const id of ids) {
        const entry = manifest.skills.find((skill) => skill.id === id);
        const destination = join(project, '.agents', 'skills', id);
        const compared = compareTreeToGit(destination, roots.get(entry.sourceRepo), entry);
        notes.push(`${id}@${entry.sourceRevision.slice(0, 12)}:${compared}`);
      }
      const doctor = JSON.parse(cli(['doctor', '--host', 'codex', '--project', project], offline).stdout);
      if (!doctor.data?.healthy) throw new Error(`doctor reported unhealthy: ${JSON.stringify(doctor).slice(0, 500)}`);
      return notes.join(', ');
    });

    check('host scope fails closed without writes', () => {
      const project = join(work, 'no-host-project');
      mkdirSync(project);
      const before = listTree(fakeHome).concat(listTree(project));
      const result = cli(['add', 'style', '--project', project], { ...isolatedEnv, CI: 'true' });
      const after = listTree(fakeHome).concat(listTree(project));
      if (result.status === 0) throw new Error(`add without --host succeeded: ${result.stdout}`);
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('add without --host wrote files');
      const dry = cli(['add', 'style', '--host', 'claude', '--global', '--dry-run']);
      if (dry.status !== 0) throw new Error(`global dry run failed: ${dry.stdout || dry.stderr}`);
      if (listTree(fakeHome).length !== before.filter((path) => path.startsWith(fakeHome)).length) throw new Error('--dry-run wrote files');
      return 'no host: refused without writes; --global --dry-run: no writes';
    });

    check('packed consumer smoke (CLI, dependencies, MCP read-only boundary)', () => {
      const env = { ...isolatedEnv, npm_execpath: npm.length > 1 ? npm[1] : (process.env.npm_execpath ?? '') };
      if (!env.npm_execpath) throw new Error('npm CLI path not found for smoke-package.mjs');
      return run(process.execPath, [join(repositoryRoot, 'distribution', 'smoke-package.mjs'), '--tarball', tarball], { cwd: packageRoot, env, timeout: 600_000 }).trim().split('\n').pop();
    });

    check('candidate tarball unchanged during checks', () => {
      const now = sha256(readFileSync(tarball));
      if (now !== record.artifact.sha256) throw new Error(`Tarball changed: ${now}`);
      if (git(repositoryRoot, ['rev-parse', 'HEAD']).trim() !== record.checkout.commit) throw new Error('HEAD moved during the gate');
      if (git(repositoryRoot, ['status', '--porcelain']).trim()) throw new Error('Checks modified tracked files');
      return now;
    });
    return finish();
  } catch (error) {
    record.checks.push({ name: 'gate', status: 'failed', error: String(error?.stack ?? error) });
    return finish();
  } finally {
    removeTemp(work, 'uppercut-skills-gate-');
  }

  function finish() {
    record.finishedAt = new Date().toISOString();
    record.outcome = record.checks.length && record.checks.every((entry) => entry.status === 'passed') ? 'accepted' : 'failed';
    writeFileSync(join(outDir, 'release-record.json'), `${JSON.stringify(record, null, 2)}\n`);
    writeFileSync(join(outDir, 'RELEASE-RECORD.md'), markdownRecord(record));
    log(`\n${record.outcome.toUpperCase()}: ${record.checks.filter((entry) => entry.status === 'passed').length}/${record.checks.length} checks. Record: ${join(outDir, 'release-record.json')}`);
    return record.outcome === 'accepted';
  }
}

function compareArtifact({ compare, artifact, npmVersion }) {
  const record = readJson(resolve(compare));
  if (record.outcome !== 'accepted' || !record.artifact?.sha256) {
    log('FAIL compare: the record is not an accepted candidate');
    return false;
  }
  const work = mkdtempSync(join(tmpdir(), 'uppercut-skills-compare-'));
  try {
    let file = artifact && resolve(artifact);
    if (npmVersion) {
      if (npmVersion !== record.artifact.version) throw new Error(`Record is for ${record.artifact.version}, not ${npmVersion}`);
      const npm = npmCommand();
      const packed = JSON.parse(run(npm[0], [...npm.slice(1), 'pack', `${PACKAGE_NAME}@${npmVersion}`, '--json', '--pack-destination', work], { cwd: work, timeout: 300_000 }));
      file = join(work, (Array.isArray(packed) ? packed[0] : packed).filename);
    }
    if (!file) throw new Error('Pass --artifact FILE or --npm VERSION');
    const digest = sha256(readFileSync(file));
    const match = digest === record.artifact.sha256;
    log(`${match ? 'PASS' : 'FAIL'} compare ${npmVersion ? `npm ${PACKAGE_NAME}@${npmVersion}` : file}: ${digest} ${match ? '==' : '!='} ${record.artifact.sha256} (candidate ${record.checkout.commit})`);
    return match;
  } catch (error) {
    log(`FAIL compare: ${error.message}`);
    return false;
  } finally {
    removeTemp(work, 'uppercut-skills-compare-');
  }
}

function verifyDeclarations(manifest, roots, record) {
  const bundled = new Set(manifest.skills.map(({ id }) => id));
  const problems = [];
  const external = new Set();
  let resources = 0;
  for (const entry of manifest.skills) {
    const root = roots.get(entry.sourceRepo);
    const skillRoot = entry.sourcePath.slice(0, -'SKILL.md'.length);
    const declarationPath = ['dvn.json', 'DVN.json'].map((name) => `${skillRoot}${name}`)
      .find((path) => spawnSync('git', ['cat-file', '-e', `${entry.sourceRevision}:${path}`], { cwd: root }).status === 0);
    if (!declarationPath) continue;
    const declaration = JSON.parse(git(root, ['show', `${entry.sourceRevision}:${declarationPath}`]));
    const skillBlob = git(root, ['rev-parse', `${entry.sourceRevision}:${entry.sourcePath}`]).trim();
    if (declaration.skillName !== entry.id) problems.push(`${entry.id}: declaration skillName ${declaration.skillName}`);
    if (declaration.skillBlobSha !== skillBlob) problems.push(`${entry.id}: skillBlobSha ${declaration.skillBlobSha} != ${skillBlob}`);
    for (const resource of declaration.resources ?? []) {
      resources += 1;
      const relativePath = `${resource.root ? `${resource.root}/` : ''}${resource.path}`;
      if (!resource.repository) {
        const actual = spawnSync('git', ['rev-parse', `${entry.sourceRevision}:${skillRoot}${relativePath}`], { cwd: root, encoding: 'utf8' }).stdout.trim();
        if (actual !== resource.gitBlobSha) problems.push(`${entry.id}: local resource ${relativePath} is ${actual || 'missing'}, declared ${resource.gitBlobSha}`);
        continue;
      }
      const repositoryRoot = roots.get(resource.repository);
      if (!repositoryRoot) { problems.push(`${entry.id}: resource repository ${resource.repository} is not an approved source`); continue; }
      if (spawnSync('git', ['cat-file', '-e', `${resource.gitBlobSha}^{blob}`], { cwd: repositoryRoot }).status !== 0) {
        // Partial clones fetch blobs lazily; ask for it explicitly before failing.
        spawnSync('git', ['fetch', '--quiet', 'origin', resource.gitBlobSha], { cwd: repositoryRoot });
      }
      const ref = record.sources[resource.repository]?.compareRef ?? 'HEAD';
      const current = spawnSync('git', ['rev-parse', `${ref}:${relativePath}`], { cwd: repositoryRoot, encoding: 'utf8' }).stdout.trim();
      if (current !== resource.gitBlobSha) problems.push(`${entry.id}: ${resource.repository}/${relativePath} is ${current || 'missing'} on ${ref}, declared ${resource.gitBlobSha}`);
    }
    for (const dependency of declaration.dependencies ?? []) {
      const [namespace, id] = String(dependency.canonicalId).split('/');
      if (namespace === 'private') problems.push(`${entry.id}: public bundle depends on ${dependency.canonicalId}`);
      else if (namespace === 'public') {
        if (!bundled.has(id)) problems.push(`${entry.id}: dependency ${dependency.canonicalId} is not bundled`);
      } else external.add(dependency.canonicalId);
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));
  return `${resources} resources; external stage references: ${[...external].sort().join(', ') || 'none'}`;
}

function verifyInstalledBundle(installedRoot, manifest, roots) {
  // Load the installed bundle in a child process so this script stays synchronous.
  const script = `import(${JSON.stringify(pathToFileURL(join(installedRoot, 'dist', 'generated', 'bundle.js')).href)}).then((m) => process.stdout.write(JSON.stringify(m.catalogBundle)))`;
  const bundle = JSON.parse(run(process.execPath, ['--input-type=module', '-e', script], { cwd: installedRoot, maxBuffer: 64 * 1024 * 1024 }));
  const expected = manifest.skills.map(({ id }) => id).sort();
  const actual = Object.keys(bundle.skills).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Bundled skills ${actual.join(',')} != manifest ${expected.join(',')}`);
  let files = 0;
  for (const entry of manifest.skills) {
    const skill = bundle.skills[entry.id];
    if (skill.sourceRevision !== entry.sourceRevision) throw new Error(`${entry.id}: bundled revision ${skill.sourceRevision}`);
    const root = roots.get(entry.sourceRepo);
    const skillRoot = entry.sourcePath.slice(0, -'SKILL.md'.length);
    const tracked = git(root, ['ls-tree', '-r', '--name-only', entry.sourceRevision, '--', skillRoot]).split('\n').filter(Boolean)
      .map((path) => path.slice(skillRoot.length)).map((path) => (path === 'DVN.json' ? 'dvn.json' : path)).sort();
    const bundledPaths = skill.files.map(({ path }) => path).sort();
    if (JSON.stringify(tracked) !== JSON.stringify(bundledPaths)) throw new Error(`${entry.id}: bundled file list differs from ${entry.sourceRepo}@${entry.sourceRevision}`);
    for (const file of skill.files) {
      const sourcePath = resolveTracked(root, entry.sourceRevision, skillRoot, file.path);
      const bytes = execFileSync('git', ['show', `${entry.sourceRevision}:${sourcePath}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
      const content = Buffer.from(file.contentBase64, 'base64');
      if (!content.equals(bytes) || sha256(content) !== file.sha256) throw new Error(`${entry.id}: ${file.path} differs from ${sourcePath} at the pinned revision`);
      files += 1;
    }
  }
  return `${actual.length} skills, ${files} files byte-identical to pinned Git sources`;
}

function resolveTracked(root, revision, skillRoot, path) {
  if (path !== 'dvn.json') return `${skillRoot}${path}`;
  return spawnSync('git', ['cat-file', '-e', `${revision}:${skillRoot}dvn.json`], { cwd: root }).status === 0 ? `${skillRoot}dvn.json` : `${skillRoot}DVN.json`;
}

function compareTreeToGit(destination, root, entry) {
  const skillRoot = entry.sourcePath.slice(0, -'SKILL.md'.length);
  const tracked = git(root, ['ls-tree', '-r', '--name-only', entry.sourceRevision, '--', skillRoot]).split('\n').filter(Boolean);
  for (const sourcePath of tracked) {
    let path = sourcePath.slice(skillRoot.length);
    if (path === 'DVN.json') path = 'dvn.json';
    const installed = join(destination, ...path.split('/'));
    if (!existsSync(installed)) throw new Error(`${entry.id}: ${path} was not installed`);
    const bytes = execFileSync('git', ['show', `${entry.sourceRevision}:${sourcePath}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
    if (!readFileSync(installed).equals(bytes)) throw new Error(`${entry.id}: installed ${path} differs from pinned source`);
  }
  return `${tracked.length} files`;
}

function scanForPrivateContent(installedRoot) {
  const rules = [
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['GitHub token', /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}/],
    ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
    ['Anthropic/OpenAI key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}/],
    ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
    ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
    ['tailnet host', /\b[a-z0-9-]+\.ts\.net\b/i],
    ['personal email', /\b[A-Za-z0-9._%+-]+@(?:gmail|icloud|outlook|hotmail|yahoo)\.com\b/i],
    ['owner mailbox', /\b(?:devin|gohan|claude)@uppercut-labs\.com\b/i],
    ['home directory', /(?:\/Users\/(?!me\b|you\b|name\b|user\b|username\b|<)[a-z][a-z0-9._-]+\/|[A-Z]:\\\\?Users\\\\?(?!me\b|you\b|name\b|user\b|username\b|<)[A-Za-z][A-Za-z0-9._-]+)/],
    ['private dvn identity', /"canonicalId":\s*"private\//],
  ];
  const disallowedNames = /(^|\/)(\.env(\..*)?|\.npmrc|id_[a-z0-9]+|.*\.pem|.*\.key|credentials(\.json)?|\.git)(\/|$)/i;
  const findings = [];
  let scanned = 0;
  const visit = (label, text) => {
    scanned += 1;
    for (const [name, pattern] of rules) {
      const match = pattern.exec(text);
      if (match) findings.push(`${label}: ${name} (${match[0].slice(0, 40)})`);
    }
  };
  for (const path of listTree(installedRoot)) {
    const rel = relative(installedRoot, path).split(sep).join('/');
    if (rel.startsWith('node_modules/')) continue;
    if (disallowedNames.test(rel)) findings.push(`${rel}: disallowed file name`);
    visit(rel, readFileSync(path, 'utf8'));
  }
  const script = `import(${JSON.stringify(pathToFileURL(join(installedRoot, 'dist', 'generated', 'bundle.js')).href)}).then((m) => process.stdout.write(JSON.stringify(m.catalogBundle)))`;
  const bundle = JSON.parse(run(process.execPath, ['--input-type=module', '-e', script], { cwd: installedRoot, maxBuffer: 64 * 1024 * 1024 }));
  for (const [id, skill] of Object.entries(bundle.skills)) {
    for (const file of skill.files) {
      if (disallowedNames.test(file.path)) findings.push(`${id}/${file.path}: disallowed file name`);
      visit(`${id}/${file.path}`, Buffer.from(file.contentBase64, 'base64').toString('utf8'));
    }
  }
  if (findings.length) throw new Error(findings.join('\n'));
  return `${scanned} package and bundled skill files scanned`;
}

function markdownRecord(record) {
  const lines = [
    `# ${record.package} release gate: ${record.outcome}`,
    '',
    `- Candidate: \`${record.checkout.commit ?? 'unknown'}\` (${record.checkout.branch ?? '?'}), package ${record.checkout.packageVersion ?? '?'}`,
    `- Run: ${record.startedAt} to ${record.finishedAt}`,
    `- Tools: ${Object.entries(record.tools).map(([name, version]) => `${name} ${version}`).join(', ')}`,
  ];
  if (record.artifact) {
    lines.push(`- Artifact: \`${record.artifact.file}\`, ${record.artifact.bytes} bytes, ${record.artifact.files} files`);
    lines.push(`- SHA-256: \`${record.artifact.sha256}\``);
    lines.push(`- Integrity: \`${record.artifact.integrity}\``);
  }
  lines.push('', '## Sources', '');
  for (const [identity, source] of Object.entries(record.sources)) lines.push(`- ${identity}: ${source.checkout}, compared against ${source.compareRef} \`${source.compareCommit}\``);
  lines.push('', '## Checks', '');
  for (const entry of record.checks) {
    const detail = entry.status === 'passed' ? (typeof entry.detail === 'string' ? entry.detail : '') : entry.error.split('\n').slice(0, 6).join('; ');
    lines.push(`- ${entry.status === 'passed' ? 'PASS' : 'FAIL'} ${entry.name}${detail ? `: ${detail}` : ''}`);
  }
  lines.push('', '## Not verified by this gate', '', ...record.unverified.map((item) => `- ${item}`), '');
  lines.push('After publication, run compare mode against the npm registry and the GitHub release asset. Do not rebuild.', '');
  return `${lines.join('\n')}\n`;
}

function parseArguments(argv) {
  const parsed = { sourceRepos: new Map() };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value && flag !== '--help') throw new Error(`Missing value for ${flag}`);
    if (flag === '--out') parsed.out = argv[++index];
    else if (flag === '--compare') parsed.compare = argv[++index];
    else if (flag === '--artifact') parsed.artifact = argv[++index];
    else if (flag === '--npm') parsed.npmVersion = argv[++index];
    else if (flag === '--source-repo') {
      const option = argv[++index];
      const delimiter = option.indexOf('=');
      if (delimiter <= 0) throw new Error(`Invalid --source-repo ${option}`);
      parsed.sourceRepos.set(option.slice(0, delimiter), realpathSync(resolve(option.slice(delimiter + 1))));
    } else {
      process.stdout.write('Usage: node distribution/release-gate.mjs [--out DIR] [--source-repo owner/repo=PATH ...]\n       node distribution/release-gate.mjs --compare release-record.json (--artifact FILE.tgz | --npm VERSION)\n');
      process.exit(flag === '--help' ? 0 : 2);
    }
  }
  return parsed;
}

function toolVersions() {
  const version = (command, args) => {
    const result = spawnSync(command, args, { encoding: 'utf8', shell: platform() === 'win32' });
    return result.status === 0 ? (result.stdout || result.stderr).trim().split('\n')[0] : 'unavailable';
  };
  const npm = npmCommand();
  return {
    os: `${platform()} ${release()}`,
    node: process.version,
    npm: run(npm[0], [...npm.slice(1), '--version'], { cwd: repositoryRoot }).trim(),
    git: version('git', ['--version']),
    python: version(pythonCommand(), ['--version']),
  };
}

function npmCommand() {
  // npm on PATH is a symlink to npm-cli.js on macOS/Linux and an npm.cmd shim beside node_modules on Windows.
  const onPath = (process.env.PATH ?? '').split(platform() === 'win32' ? ';' : ':').filter(Boolean).flatMap((directory) => {
    const shim = join(directory, 'npm');
    const resolved = existsSync(shim) ? realpathSync(shim) : '';
    return [resolved, join(directory, 'node_modules', 'npm', 'bin', 'npm-cli.js')];
  });
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ...onPath,
  ].filter((path) => path && path.endsWith('npm-cli.js') && existsSync(path));
  if (!candidates.length) throw new Error('Cannot locate npm-cli.js next to this Node.js');
  return [process.execPath, candidates[0]];
}

function pythonCommand() {
  for (const candidate of ['python3', 'python']) {
    if (spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0) return candidate;
  }
  throw new Error('Python 3 is required for the source validators');
}

function remoteDefault(path) {
  const head = spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], { cwd: path, encoding: 'utf8' }).stdout.trim();
  return head || 'origin/main';
}

function summarize(output) {
  const lines = output.trim().split('\n').map((line) => line.trim()).filter(Boolean);
  const counts = lines.filter((line) => /^(ℹ (tests|pass|fail)|# (tests|pass|fail)|PASS:|Results:|Ran \d+ tests|OK$)/.test(line));
  return (counts.length ? counts : lines.slice(-1)).join('; ');
}

function run(command, args, { cwd, env = process.env, timeout = 120_000, maxBuffer = 16 * 1024 * 1024 } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout, maxBuffer });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${basename(command)} ${args.join(' ')} exited ${result.status}\n${(result.stdout ?? '').slice(-3000)}\n${(result.stderr ?? '').slice(-3000)}`);
  }
  return result.stdout;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function listTree(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(root);
  return files;
}

function removeTemp(path, prefix) {
  const tempRoot = realpathSync(tmpdir());
  const target = realpathSync(path);
  if (!target.startsWith(tempRoot + sep) || !basename(target).startsWith(prefix)) throw new Error(`Refusing to remove ${target}`);
  rmSync(target, { recursive: true, force: true });
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

