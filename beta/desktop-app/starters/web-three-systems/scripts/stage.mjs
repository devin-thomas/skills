// Looks after staging/bin/<platform>-<arch>/, the folder of helper binaries the
// packager copies into the app. The folder is outside Git; no binary is ever
// committed.
//
//   node scripts/stage.mjs status
//       what is staged for each target: sizes, hashes, and whether the tool is
//       the placeholder or the real one
//   node scripts/stage.mjs tool <target> <file>
//       put the real tool in place of whatever is staged for that target
//   node scripts/stage.mjs helper <target> <name> <file>
//       stage another program the tool drives (one listed in app.config.json tool.binaries)
//   node scripts/stage.mjs placeholder <target> <file>
//       stage a build of tool/placeholder as the tool, marked as the placeholder
//
// One binary per system and processor (build 2): the targets are named as Node
// names them, and a universal macOS tool is staged under darwin-arm64.
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));
const staging = join(root, 'staging', 'bin');
const ALL = ['win32-x64', 'darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64'];
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const exeOf = (target) => (target.startsWith('win32') ? '.exe' : '');
const toolName = config.tool.name;
const [command, ...rest] = process.argv.slice(2);

function put(target, name, file, kind) {
  if (!ALL.includes(target) || !file) throw new Error(`usage: node scripts/stage.mjs ${command} <${ALL.join('|')}> ${command === 'helper' ? '<name> ' : ''}<file>`);
  const source = resolve(file);
  if (!statSync(source).isFile()) throw new Error(`${source} is not a file.`);
  const dir = join(staging, target);
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, `${name}${exeOf(target)}`);
  copyFileSync(source, dest);
  chmodSync(dest, 0o755);
  if (kind) {
    writeFileSync(join(dir, `${name}.kind`), `${kind}\n`);
    writeFileSync(join(dir, `${name}.from`), `${source}\n${statSync(source).mtime.toISOString()}\n`);
  }
  console.log(`staged ${name} for ${target}: ${dest} (${statSync(dest).size} bytes, sha256 ${sha256(dest)})`);
}

if (command === 'tool') put(rest[0], toolName, rest[1], 'real');
else if (command === 'placeholder') put(rest[0], toolName, rest[1], 'placeholder');
else if (command === 'helper') {
  if (!(config.tool.binaries ?? []).includes(rest[1])) throw new Error(`${rest[1]} is not in app.config.json tool.binaries`);
  put(rest[0], rest[1], rest[2], null);
} else if (command === 'status' || command === undefined) {
  for (const target of ALL) {
    const dir = join(staging, target);
    if (!existsSync(dir)) {
      console.log(`${target}: nothing staged`);
      continue;
    }
    const kindFile = join(dir, `${toolName}.kind`);
    const kind = existsSync(kindFile) ? readFileSync(kindFile, 'utf8').trim() : 'unknown';
    console.log(`${target}: tool is ${kind}`);
    for (const name of readdirSync(dir).sort()) {
      const file = join(dir, name);
      if (/\.(kind|from|txt|json)$/.test(name) || !statSync(file).isFile()) continue;
      console.log(`  ${name.padEnd(20)} ${String(statSync(file).size).padStart(9)} bytes  sha256 ${sha256(file)}`);
    }
  }
} else {
  throw new Error('usage: node scripts/stage.mjs status | tool <target> <file> | helper <target> <name> <file> | placeholder <target> <file>');
}
