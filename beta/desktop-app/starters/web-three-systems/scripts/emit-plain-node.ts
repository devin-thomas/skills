// Builds the three scripts that must run as plain Node with no build step from their
// TypeScript sources, as CommonJS files committed beside them:
//
//   scripts/control.ts               -> scripts/control.cjs
//   scripts/installed-helpers.ts     -> scripts/installed-helpers.cjs
//   scripts/installed-diagnostics.ts -> scripts/installed-diagnostics.cjs
//
// Why .cjs files at all: the installed checks run them by those names with the installed app's
// own executable acting as Node (ELECTRON_RUN_AS_NODE=1), from scripts/installed-check.sh,
// scripts/installed-check.ps1 and scripts/linux-container, often from a checkout that was
// never built. Electron 45's Node
// (24.22) strips types, but only from .ts files, and those callers name .cjs.
//
//   node scripts/emit-plain-node.ts           write the .cjs files
//   node scripts/emit-plain-node.ts --check   fail if a committed .cjs differs from its source
//
// test/plain-node.test.ts runs the check, so a source changed without its .cjs fails the tests.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'rolldown';
import { root } from './lib/root.ts';

export const PLAIN = ['control', 'installed-helpers', 'installed-diagnostics'];
const node = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const lf = (text: string) => text.replace(/\r\n/g, '\n');

async function emit(name: string, dir: string): Promise<string> {
  const file = join(dir, `${name}.cjs`);
  await build({
    input: join(root, 'scripts', `${name}.ts`),
    cwd: root,
    platform: 'node',
    logLevel: 'warn',
    external: (id) => node.has(id),
    output: { file, format: 'cjs', banner: `// Built from scripts/${name}.ts by scripts/emit-plain-node.ts. Do not edit; change the .ts and run it again.` },
  });
  const text = lf(readFileSync(file, 'utf8'));
  if (/import\.meta/.test(text)) throw new Error(`scripts/${name}.cjs uses import.meta, which CommonJS does not have`);
  const required = [...text.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? '');
  const strangers = required.filter((id) => !node.has(id));
  if (strangers.length) throw new Error(`scripts/${name}.cjs requires ${strangers.join(', ')}; it may require only Node's own modules`);
  return text;
}

const check = process.argv.includes('--check');
const scratch = mkdtempSync(join(tmpdir(), 'emit-plain-node-'));
const stale: string[] = [];
try {
  for (const name of PLAIN) {
    const text = await emit(name, scratch);
    const committed = join(root, 'scripts', `${name}.cjs`);
    if (check) {
      let current = '';
      try {
        current = lf(readFileSync(committed, 'utf8'));
      } catch {
        // Missing: stale.
      }
      if (current !== text) stale.push(`scripts/${name}.cjs`);
    } else writeFileSync(committed, text);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
if (stale.length) {
  console.error(`${stale.join(', ')} differ from their TypeScript sources. Run "node scripts/emit-plain-node.ts" and commit the result.`);
  process.exit(1);
}
console.log(check ? `scripts/{${PLAIN.join(',')}}.cjs match their sources` : `wrote scripts/{${PLAIN.join(',')}}.cjs`);
