// Whether TypeScript files parse, for measure/shell-check.ts and the tests. `node --check` on an
// ES-module .ts file reports success without parsing it (Node 25), so each file is stripped of
// its types with Node's own stripper, which fails on a syntax error or on syntax that is not
// erasable, and the JavaScript left is checked with `node --check` as a module, which also
// catches the early errors the stripper does not.
//
//   node --no-warnings scripts/lib/syntax.ts <file.ts>...    prints one line per file that does
//                                                            not parse; exit code 1 if any
//
// Run it as its own process with --no-warnings: the stripper is experimental and says so.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

/** Null when `file` parses, otherwise the first lines of the error. */
export function syntaxError(file: string, scratch: string): string | null {
  let js: string;
  try {
    js = stripTypeScriptTypes(readFileSync(file, 'utf8'));
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).split('\n').slice(0, 3).join(' ');
  }
  const out = join(scratch, `${basename(file, '.ts')}.mjs`);
  writeFileSync(out, js);
  const result = spawnSync(process.execPath, ['--check', out], { encoding: 'utf8' });
  return result.status === 0 ? null : result.stderr.split('\n').slice(0, 5).join(' ');
}

if (/[\\/]syntax\.ts$/.test(process.argv[1] ?? '')) {
  const scratch = mkdtempSync(join(tmpdir(), 'syntax-'));
  let bad = 0;
  try {
    for (const file of process.argv.slice(2)) {
      const error = syntaxError(resolve(file), scratch);
      if (error) {
        bad += 1;
        console.log(`${file}: ${error}`);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  process.exit(bad ? 1 : 0);
}
