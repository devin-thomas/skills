export type CliCommand = 'list' | 'show' | 'add' | 'update' | 'remove' | 'doctor' | 'serve-mcp';
export type CliOptions = {
  readonly host?: 'codex' | 'claude' | 'cursor' | 'antigravity' | 'grokbot' | 'grokcli';
  readonly project?: string;
  readonly global: boolean;
  readonly latest: boolean;
  readonly channel?: 'bundled' | 'github';
  readonly json: boolean;
  readonly verbose: boolean;
  readonly dryRun: boolean;
  readonly noDependencies: boolean;
  readonly surface?: 'ide' | 'cli';
  readonly port?: number;
};
export type CliInvocation = {
  readonly command: CliCommand | 'help';
  readonly ids: readonly string[];
  readonly options: CliOptions;
};

const commands = new Set<CliCommand>(['list', 'show', 'add', 'update', 'remove', 'doctor', 'serve-mcp']);

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export function parseArgs(argv: readonly string[]): CliInvocation {
  const positionals: string[] = [];
  const options: {
    host?: NonNullable<CliOptions['host']>;
    project?: string;
    global: boolean;
    latest: boolean;
    channel?: 'bundled' | 'github';
    json: boolean;
    verbose: boolean;
    dryRun: boolean;
    noDependencies: boolean;
    surface?: 'ide' | 'cli';
    port?: number;
  } = {
    global: false,
    latest: false,
    json: false,
    verbose: false,
    dryRun: false,
    noDependencies: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--help' || arg === '-h') return { command: 'help', ids: [], options };
    if (!arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }
    if (arg === '-nd') {
      options.noDependencies = true;
      continue;
    }
    if (arg === '--global') options.global = true;
    else if (arg === '--latest') options.latest = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-dependencies') options.noDependencies = true;
    else if (arg === '--host' || arg === '--project' || arg === '--channel' || arg === '--surface' || arg === '--port') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('-')) throw new CliUsageError(`${arg} requires a value`);
      index += 1;
      if (arg === '--host') {
        if (!['codex', 'claude', 'cursor', 'antigravity', 'grokbot', 'grokcli'].includes(value)) {
          throw new CliUsageError(`Unsupported host "${value}"`);
        }
        options.host = value as NonNullable<CliOptions['host']>;
      }
      else if (arg === '--project') options.project = value;
      else if (arg === '--channel' && (value === 'bundled' || value === 'github')) options.channel = value;
      else if (arg === '--channel') throw new CliUsageError(`Unsupported channel "${value}"; use bundled or github`);
      else if (arg === '--surface' && (value === 'ide' || value === 'cli')) options.surface = value;
      else if (arg === '--surface') throw new CliUsageError(`Unsupported surface "${value}"; use ide or cli`);
      else if (arg === '--port') {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliUsageError('--port must be an integer from 0 to 65535');
        options.port = port;
      }
    } else {
      throw new CliUsageError(`Unknown option "${arg}"`);
    }
  }

  if (options.global && options.project !== undefined) throw new CliUsageError('--project and --global cannot be used together');
  if (options.latest && options.channel === 'bundled') throw new CliUsageError('--latest conflicts with --channel bundled');
  if (options.surface && options.host !== 'antigravity') throw new CliUsageError('--surface applies to --host antigravity only');
  if (options.noDependencies && positionals[0] !== 'add') throw new CliUsageError('--no-dependencies applies to add only');

  const [commandToken, ...ids] = positionals;
  if (commandToken === undefined) return { command: 'help', ids: [], options };
  if (!commands.has(commandToken as CliCommand)) throw new CliUsageError(`Unknown command "${commandToken}"`);
  const command = commandToken as CliCommand;
  if ((command === 'show' || command === 'add' || command === 'remove') && ids.length === 0) {
    throw new CliUsageError(`${command} requires at least one skill ID`);
  }
  if (options.noDependencies && command !== 'add') throw new CliUsageError('--no-dependencies applies to add only');
  if (options.port !== undefined && command !== 'serve-mcp') throw new CliUsageError('--port applies to serve-mcp only');
  return { command, ids, options };
}
