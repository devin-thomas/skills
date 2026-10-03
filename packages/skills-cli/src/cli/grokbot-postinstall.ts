import { homedir } from 'node:os';
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

export async function populateFreshGrokBotLibrary(
  ids: readonly string[],
  run: (args: readonly string[]) => Promise<PostinstallCliResult>,
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
  const added = await run(['add', ...ids, ...common]);
  if (added.exitCode !== 0) throw new Error(`Grok Bot library installation failed: ${added.result.error?.message ?? 'unknown error'}`);
  return `Installed ${ids.length} bundled Uppercut skills into the Grok Bot account library.`;
}

/** npm global installation populates only a fresh, qualified Bot account library. */
export async function runGrokBotPostinstall(): Promise<string> {
  const target = resolveHostTargetResult('grokbot', {
    scope: 'global', projectRoot: process.cwd(), homeDir: homedir(),
  });
  if (!shouldPopulateGrokBotLibrary({
    npmGlobal: process.env.npm_config_global,
    lifecycleEvent: process.env.npm_lifecycle_event,
    accountTargetReady: target.status === 'ready',
  })) return 'Grok Bot account library untouched (not a qualified global Bot installation).';

  const ids = catalogBundle.manifest.skills.map((skill) => skill.id);
  return populateFreshGrokBotLibrary(ids, (args) => runCli(parseArgs(args), { catalogBundle }));
}
