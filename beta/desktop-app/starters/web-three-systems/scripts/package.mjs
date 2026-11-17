// Packages the app for one target with @electron/packager.
//
//   node scripts/package.mjs [target]      pnpm package:win | package:mac | package:linux-arm64 | package:linux-x64
//
//   win32-x64      out/<exeName>-win32-x64/<exeName>.exe                  (run on Windows)
//   darwin-arm64   out/<productName>-darwin-arm64/<productName>.app, signed,
//                  and out/<name>-<version>-darwin-arm64.zip              (run on macOS)
//   linux-arm64    out/<name>-linux-arm64/, then a .deb and a .tar.gz     (run on macOS or Linux; the
//   linux-x64      out/<name>-linux-x64/,   then a .deb and a .tar.gz      .deb is built in a container)
//
// Names come from app.config.json. Only what the app runs is included:
// package.json, app.config.json, electron/ (without the test instrumentation),
// the built page in dist/ and the window icon. No node_modules: the main
// process has no runtime dependencies. If the app gains one, bundle the main
// process rather than shipping node_modules.
//
// Beside app.asar, outside the archive so they can be started:
//   resources/bin/<platform>-<arch>/<each name in app.config.json tool.binaries>[.exe] and manifest.json
//   resources/THIRD-PARTY-NOTICES.txt
// (Contents/Resources/... on macOS). The helpers come from staging/bin/<target>/,
// which scripts/stage.mjs fills. See the desktop-app skill's references/packaging.md.
import { packager } from '@electron/packager';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { names, TARGETS } from './lib/names.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));
const target = process.argv[2] ?? `${process.platform}-${process.arch}`;
if (!TARGETS.includes(target)) throw new Error(`Unknown target "${target}". Targets: ${TARGETS.join(', ')}.`);
const [platform, arch] = target.split('-');
const n = names(config);
const exe = platform === 'win32' ? '.exe' : '';
const out = join(root, 'out');

// An app that bundles third-party programs rebuilds its notices file here, every time, so it
// can never be stale in a package (build 2: scripts/notices.mjs). The starter ships a stub.

// ---- what must exist first -----------------------------------------------------
const icon = { win32: 'build/icon.ico', darwin: 'build/icon.icns', linux: 'build/icon.png' }[platform];
for (const needed of ['dist/index.html', icon, 'third-party/THIRD-PARTY-NOTICES.txt']) {
  if (!existsSync(join(root, needed))) throw new Error(`${needed} is missing. Run "pnpm build" and "pnpm icon" first.`);
}
const staged = join(root, 'staging', 'bin', target);
const toolName = config.tool.name;
const helpers = (config.tool.binaries ?? [toolName]).map((name) => `${name}${exe}`);
for (const name of helpers) {
  if (!existsSync(join(staged, name))) {
    throw new Error(`staging/bin/${target}/${name} is missing. Stage it with "node scripts/stage.mjs tool ${target} <file>", or build the placeholder (tool/placeholder/README.md).`);
  }
}

// ---- helpers and notices, laid out as the packaged app will hold them -------------
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const extra = join(out, '.extra', target);
rmSync(extra, { recursive: true, force: true });
const binDir = join(extra, 'bin', target);
mkdirSync(binDir, { recursive: true });
const kindFile = join(staged, `${toolName}.kind`);
const toolKind = existsSync(kindFile) ? readFileSync(kindFile, 'utf8').trim() : 'unknown';
const buildNote = existsSync(join(staged, 'BUILD.txt')) ? readFileSync(join(staged, 'BUILD.txt'), 'utf8') : '';
const files = helpers.map((name) => {
  copyFileSync(join(staged, name), join(binDir, name));
  chmodSync(join(binDir, name), 0o755);
  return { name, bytes: statSync(join(binDir, name)).size, sha256: sha256(join(binDir, name)), ...(name.startsWith(toolName) ? { kind: toolKind } : {}) };
});
const manifest = {
  target,
  app: { productName: config.productName, appId: config.appId, version: pkg.version },
  build: buildNote ? buildNote.split(/\r?\n/).slice(0, 20) : null,
  files,
  // Hashes are taken before signing. On macOS signing rewrites each file, so the
  // installed check compares sizes and signatures there instead.
  hashedBeforeSigning: platform === 'darwin',
};
writeFileSync(join(binDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
if (toolKind !== 'real') console.log(`note: staging/bin/${target}/${toolName} is ${toolKind === 'placeholder' ? 'the placeholder' : 'of unknown origin'}; swap in the real tool with "node scripts/stage.mjs tool ${target} <file>".`);

// ---- packager --------------------------------------------------------------------
const keep = [/^\/package\.json$/, /^\/app\.config\.json$/, /^\/shortcuts\.json$/, /^\/electron(\/|$)/, /^\/dist(\/|$)/, /^\/build(\/(icon\.ico|icon\.png|icon-256\.png))?$/];
const entitlements = join(root, 'scripts', 'mac');
const options = {
  dir: root,
  out,
  name: platform === 'darwin' ? config.productName : platform === 'linux' ? n.linuxName : config.exeName,
  executableName: platform === 'linux' ? n.linuxName : config.exeName,
  platform,
  arch,
  electronVersion: pkg.devDependencies.electron,
  appVersion: pkg.version,
  overwrite: true,
  asar: true,
  prune: false,
  icon: join(root, icon),
  appCopyright: config.company,
  extraResource: [join(extra, 'bin'), join(root, 'third-party', 'THIRD-PARTY-NOTICES.txt')],
  ignore: (file) => {
    if (file === '') return false;
    if (file === '/electron/qa.cjs') return true;
    return !keep.some((pattern) => pattern.test(file));
  },
};
if (platform === 'win32') {
  options.win32metadata = { CompanyName: config.company, FileDescription: config.productName, ProductName: config.productName, InternalName: config.exeName, OriginalFilename: `${config.exeName}.exe` };
}
if (platform === 'darwin') {
  if (process.platform !== 'darwin') throw new Error('The macOS app must be packaged on macOS: it is signed here, and codesign exists only there.');
  options.appBundleId = config.appId;
  options.appCategoryType = config.mac?.category ?? 'public.app-category.utilities';
  // Signed here, inside the packager, after the helpers are in place: every
  // Mach-O file in the bundle is signed, with the hardened runtime. Without
  // MAC_SIGN_IDENTITY the signature is ad hoc (identity "-"), which runs on this
  // Mac and on any Mac the bundle is copied to without a quarantine mark, and is
  // refused by Gatekeeper everywhere else. The helpers are plain programs and
  // get no entitlement; the app and Electron's own helper apps get the ones in
  // scripts/mac/.
  const identity = process.env.MAC_SIGN_IDENTITY ?? '-';
  const appEntitlements = join(entitlements, identity === '-' ? 'entitlements.app.adhoc.plist' : 'entitlements.app.plist');
  options.osxSign = {
    identity,
    identityValidation: identity !== '-',
    optionsForFile: (file) => ({
      hardenedRuntime: true,
      entitlements: file.includes('/Contents/Resources/bin/') ? join(entitlements, 'entitlements.helper.plist') : appEntitlements,
    }),
  };
}
if (platform === 'linux') {
  // The desktop name is the app's identity on Linux (Wayland app_id, X11 WM_CLASS,
  // portals). It must equal the installed .desktop file's name, so it is written
  // into the packaged package.json here, from the same value the .deb uses.
  options.beforeAsar = [
    async ({ buildPath }) => {
      const file = join(buildPath, 'package.json');
      const packed = JSON.parse(readFileSync(file, 'utf8'));
      packed.desktopName = n.desktopFile;
      writeFileSync(file, `${JSON.stringify(packed, null, 2)}\n`);
    },
  ];
}

const [appDir] = await packager(options);
rmSync(extra, { recursive: true, force: true });
if (readdirSync(join(out, '.extra')).length === 0) rmSync(join(out, '.extra'), { recursive: true, force: true });
console.log(`packaged: ${appDir}`);

// ---- per-system finishing ------------------------------------------------------------
const resources = platform === 'darwin' ? join(appDir, `${config.productName}.app`, 'Contents', 'Resources') : join(appDir, 'resources');
for (const name of helpers) {
  const file = join(resources, 'bin', target, name);
  if (!existsSync(file)) throw new Error(`The packaged app is missing ${file}.`);
  if (platform !== 'win32' && process.platform !== 'win32' && !(statSync(file).mode & 0o111)) throw new Error(`${file} is not executable.`);
}
if (!existsSync(join(resources, 'THIRD-PARTY-NOTICES.txt'))) throw new Error('The packaged app is missing THIRD-PARTY-NOTICES.txt.');

if (platform === 'darwin') {
  const app = join(appDir, `${config.productName}.app`);
  // Rule: the bundle verifies strictly, and every nested program carries the runtime flag.
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
  for (const name of helpers) {
    const info = spawnSync('codesign', ['-dv', join(resources, 'bin', target, name)], { encoding: 'utf8' }).stderr;
    if (!/flags=0x[0-9a-f]+\(.*runtime.*\)/.test(info)) throw new Error(`${name} is not signed with the hardened runtime:\n${info}`);
  }
  // A valid signature is not enough to start: with the hardened runtime, an
  // ad-hoc signed app can load its own Electron Framework only if library
  // validation is off. Verification passes either way, so check it here.
  const granted = spawnSync('codesign', ['-d', '--entitlements', '-', '--xml', app], { encoding: 'utf8' }).stdout;
  const adhoc = /Signature=adhoc/.test(spawnSync('codesign', ['-dv', app], { encoding: 'utf8' }).stderr);
  if (adhoc && !granted.includes('com.apple.security.cs.disable-library-validation')) {
    throw new Error('The app is signed ad hoc with the hardened runtime but without com.apple.security.cs.disable-library-validation; it would stop at launch.');
  }
  const zip = join(out, `${n.fileBase}-${pkg.version}-darwin-${arch}.zip`);
  rmSync(zip, { force: true });
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip], { stdio: 'inherit' });
  console.log(`signed and verified: ${app}\nzip: ${zip} (${statSync(zip).size} bytes)`);
}

if (platform === 'linux') {
  const script = join(root, 'scripts', 'linux', 'make-packages.sh');
  const env = {
    ...process.env,
    APP_DIR_NAME: `${n.linuxName}-linux-${arch}`,
    PRODUCT_NAME: config.productName,
    DESCRIPTION: config.description ?? config.productName,
    COMPANY: config.company ?? '',
    LINUX_NAME: n.linuxName,
    APP_ID: config.appId,
    VERSION: pkg.version,
    ARCH: arch,
    CATEGORIES: config.linux?.categories ?? 'Utility;',
    MIME_TYPES: config.linux?.mimeTypes ?? '',
  };
  const passed = ['APP_DIR_NAME', 'PRODUCT_NAME', 'DESCRIPTION', 'COMPANY', 'LINUX_NAME', 'APP_ID', 'VERSION', 'ARCH', 'CATEGORIES', 'MIME_TYPES'];
  if (process.platform === 'linux' && spawnSync('dpkg-deb', ['--version']).status === 0 && process.getuid?.() === 0) {
    execFileSync('sh', [script, out, join(root, 'build', 'icons'), join(root, 'scripts', 'linux')], { stdio: 'inherit', env });
  } else {
    // dpkg-deb needs root ownership and a setuid bit inside the package, so the
    // tree is assembled inside a container's own filesystem, never on this disk.
    const image = process.env.DEB_BUILD_IMAGE ?? 'debian:bookworm-slim';
    execFileSync(
      'docker',
      ['run', '--rm', '--name', `r2-packaging-deb-${arch}`, ...passed.flatMap((k) => ['-e', `${k}=${env[k]}`]), '-v', `${out}:/out`, '-v', `${join(root, 'build', 'icons')}:/icons:ro`, '-v', `${join(root, 'scripts', 'linux')}:/scripts:ro`, image, 'sh', '/scripts/make-packages.sh', '/out', '/icons', '/scripts'],
      { stdio: 'inherit' },
    );
  }
}

// The names the shell scripts need (install.sh, installed-check.sh), as a file they can source.
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
writeFileSync(
  join(out, 'package.env'),
  [
    `PRODUCT_NAME=${quote(config.productName)}`,
    `EXE_NAME=${quote(config.exeName)}`,
    `LINUX_NAME=${quote(n.linuxName)}`,
    `APP_ID=${quote(config.appId)}`,
    `VERSION=${quote(pkg.version)}`,
    `HELPERS=${quote(helpers.map((h) => h.replace(/\.exe$/, '')).join(' '))}`,
    `BUDGET_MB=${Number(config.memory?.budgetMB ?? 300)}`,
    `CEILING_MB=${Number(config.memory?.ceilingMB ?? 680)}`,
    '',
  ].join('\n'),
);

// Sizes, for the record.
const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? size(join(dir, e.name)) : e.isSymbolicLink() ? 0 : statSync(join(dir, e.name)).size), 0);
console.log(`app folder: ${(size(appDir) / 1048576).toFixed(1)} MB; helpers: ${(files.reduce((s, f) => s + f.bytes, 0) / 1048576).toFixed(1)} MB (${files.map((f) => `${f.name} ${(f.bytes / 1048576).toFixed(2)}`).join(', ')})`);
