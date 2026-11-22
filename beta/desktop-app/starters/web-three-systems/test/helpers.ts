// Shared pieces for the adapter tests: a throwaway folder with a stand-in
// configuration, the stand-in located as the tool, and process checks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { locateTool } from '../electron/tool/locate.ts';
import type { Located } from '../electron/tool/locate.ts';

export const STANDIN = path.join(import.meta.dirname, 'standin-tool.ts');

/** One start of the stand-in, as it logs itself. */
export interface Start {
  pid: number;
  [key: string]: unknown;
}

export interface Sandbox {
  dir: string;
  dataDir: string;
  located: Extract<Located, { ok: true }>;
  starts: () => Start[];
  alive: () => number[];
}

/** A folder for one test, removed afterwards, with the stand-in configured by `config`. */
export function sandbox(t: TestContext, config: Record<string, unknown> = {}): Sandbox {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return sandboxAt(dir, config);
}

/** The same, for a folder that already exists (a host process rebuilds it from the path). */
export function sandboxAt(dir: string, config: Record<string, unknown> = {}): Sandbox {
  const log = path.join(dir, 'starts.ndjson');
  const configFile = path.join(dir, 'standin.json');
  fs.writeFileSync(configFile, JSON.stringify({ log, ...config }));
  const located = locateTool({ packaged: false, toolName: 'example-tool', override: { script: STANDIN, node: process.execPath, config: configFile } });
  if (!located.ok) throw new Error(`the stand-in was not found: ${located.details}`);
  const starts = (): Start[] => {
    try {
      return fs
        .readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Start);
    } catch {
      return [];
    }
  };
  return { dir, dataDir: path.join(dir, 'data'), located, starts, alive: () => starts().map((s) => s.pid).filter(isAlive) };
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export async function waitFor(condition: () => unknown, ms: number, step = 25): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return Boolean(await condition());
}

export const stagingFolders = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^\.example-[0-9a-f]{32}\.tmp$/.test(n)) : []);
