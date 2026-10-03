import assert from 'node:assert/strict';
import test from 'node:test';
import { CliUsageError, parseArgs } from '../../dist/cli/args.js';

test('parses -nd as a whole-token alias and rejects it outside add', () => {
  const parsed = parseArgs(['add', 'quick-build', '-nd', '--host', 'codex']);
  assert.equal(parsed.options.noDependencies, true);
  assert.throws(() => parseArgs(['-nd', 'list']), CliUsageError);
  assert.throws(() => parseArgs(['add', 'quick-build', '-ndx']), CliUsageError);
});

test('rejects conflicting scope and channel flags before an operation', () => {
  assert.throws(() => parseArgs(['add', 'quick-build', '--project', 'work', '--global']), CliUsageError);
  assert.throws(() => parseArgs(['add', 'quick-build', '--latest', '--channel', 'bundled']), CliUsageError);
});

test('accepts the opt-in loopback MCP command and validates its port', () => {
  assert.equal(parseArgs(['serve-mcp', '--port', '0']).options.port, 0);
  assert.throws(() => parseArgs(['serve-mcp', '--port', '65536']), CliUsageError);
});
