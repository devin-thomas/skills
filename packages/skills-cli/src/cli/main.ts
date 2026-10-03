import { parseArgs, CliUsageError } from './args.js';
import { HELP_TEXT } from './help.js';
import { formatResult } from './output.js';
import { runCli } from './node-runtime.js';

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  try {
    const invocation = parseArgs(argv);
    if (invocation.command === 'help') {
      process.stdout.write(HELP_TEXT);
      return;
    }
    const { catalogBundle } = await import('../generated/bundle.js');
    if (invocation.command === 'serve-mcp') {
      const { startLoopbackMcpServer } = await import('../mcp/index.js');
      const server = await startLoopbackMcpServer({ bundle: catalogBundle, ...(invocation.options.port === undefined ? {} : { port: invocation.options.port }) });
      const message = invocation.options.json
        ? JSON.stringify({ schema: 'uppercut.skills.result/v1', command: 'serve-mcp', outcome: 'complete', requestedIds: [], resolvedIds: [], data: { url: server.url, tools: ['catalog.list', 'catalog.show'] } })
        : `Read-only catalog MCP server listening at ${server.url}`;
      process.stdout.write(`${message}\n`);
      const close = () => { void server.close().then(() => { process.exitCode = 0; }); };
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
      return;
    }
    const { result, exitCode } = await runCli(invocation, { catalogBundle });
    process.stdout.write(`${formatResult(result, invocation.options.json)}\n`);
    process.exitCode = exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof CliUsageError) {
      process.stderr.write(`${message}\nRun uppercut-skills --help for usage.\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
