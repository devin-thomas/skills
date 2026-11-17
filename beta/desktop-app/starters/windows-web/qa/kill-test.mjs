// Data safety under a crash. For each trial: start the development shell, let it
// type a known sentence into the main text field through real key events, terminate
// that exact process a set time after the last key, start the app again and
// compare the restored body with what was typed.
//
// Trials killed 300 ms or more after the last key must restore every character.
// The 60 ms trial may lose only the tail typed in the last second.
//
// Usage: node qa/kill-test.mjs   (writes qa/evidence/kill-test.json)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const electron = join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const evidence = join(root, 'qa', 'evidence');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(file, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (existsSync(file)) {
      try {
        return JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        // still being written
      }
    }
    await sleep(20);
  }
  throw new Error(`timed out waiting for ${file}`);
}

async function trial(name, killAfterMs, longChars) {
  const dataDir = join(root, 'qa', 'data', `kill-${name}`);
  const typedFile = join(evidence, `kill-${name}-typed.json`);
  const readFile = join(evidence, `kill-${name}-restored.json`);
  for (const f of [typedFile, readFile]) rmSync(f, { force: true });
  rmSync(dataDir, { recursive: true, force: true });

  const args = ['.', '--no-activate', `--data-dir=${dataDir}`, `--qa-type-then-wait=${typedFile}`, ...(longChars ? [`--qa-long=${longChars}`] : [])];
  const child = spawn(electron, args, { cwd: root, stdio: 'ignore' });
  const typed = await waitFor(typedFile, 60_000);
  if (typed.pid !== child.pid) throw new Error(`the app reported PID ${typed.pid}, but ${child.pid} was started`);

  // Terminate that exact process, by PID, the set time after its last key.
  await sleep(Math.max(0, typed.lastKeyAt + killAfterMs - Date.now()));
  const killedAfterMs = Date.now() - typed.lastKeyAt;
  process.kill(child.pid);
  await new Promise((r) => child.once('exit', r));
  await sleep(1500); // let the helper processes notice and exit

  const again = spawn(electron, ['.', '--no-activate', `--data-dir=${dataDir}`, `--qa-read-body=${readFile}`], { cwd: root, stdio: 'ignore' });
  const restored = await waitFor(readFile, 60_000);
  await new Promise((r) => again.once('exit', r));

  const intact = restored.body === typed.expected;
  const isPrefix = typed.expected.startsWith(restored.body);
  const lost = typed.expected.length - restored.body.length;
  rmSync(dataDir, { recursive: true, force: true });
  for (const f of [typedFile, readFile]) rmSync(f, { force: true });
  return { name, killedAfterMs, startedWithChars: longChars ?? 0, typedChars: typed.typed.length, expectedChars: typed.expected.length, restoredChars: restored.body.length, intact, restoredIsPrefix: isPrefix, charsLost: intact ? 0 : lost };
}

mkdirSync(evidence, { recursive: true });
const results = [];
results.push(await trial('600ms', 600));
results.push(await trial('300ms', 300));
results.push(await trial('300ms-long', 300, 20000));
results.push(await trial('60ms', 60));

const failures = [];
for (const r of results) {
  const mustBeIntact = r.name !== '60ms';
  if (mustBeIntact && !r.intact) failures.push(`${r.name}: restored ${r.restoredChars} of ${r.expectedChars} characters`);
  // 25 ms per key: one second of typing is 40 characters.
  if (!mustBeIntact && (!r.restoredIsPrefix || r.charsLost > 40)) failures.push(`${r.name}: lost ${r.charsLost} characters, more than the last second`);
  console.log(`${r.intact ? 'intact ' : 'partial'} kill at ${String(r.killedAfterMs).padStart(4)} ms after the last key (${r.name}): ${r.restoredChars}/${r.expectedChars} characters restored`);
}
writeFileSync(join(evidence, 'kill-test.json'), JSON.stringify({ at: new Date().toISOString(), results, failures, passed: failures.length === 0 }, null, 2));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('kill test passed');
