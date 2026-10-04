// Run from a clean npm consumer directory after installing the packed tarball and MCP peer.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { startLoopbackMcpServer } from '@uppercut-labs/skills/mcp';

const legacyServer = await startLoopbackMcpServer();
try {
  const initialize = await post(legacyServer.url, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'packed-skills-smoke', version: '1.0.0' } },
  }, '2025-11-25');
  assert.equal(initialize.status, 200);
  assert.equal((await payload(initialize)).result.protocolVersion, '2025-11-25');

  const legacy = await post(legacyServer.url, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, '2025-11-25');
  assert.equal(legacy.status, 200);
  assert.deepEqual(toolNames(await payload(legacy)), ['catalog.list', 'catalog.show']);
} finally {
  await legacyServer.close();
}

const currentServer = await startLoopbackMcpServer();
try {
  const current = await post(currentServer.url, {
    jsonrpc: '2.0', id: 3, method: 'tools/list',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } },
  }, '2026-07-28');
  assert.equal(current.status, 200);
  assert.deepEqual(toolNames(await payload(current)), ['catalog.list', 'catalog.show']);
  process.stdout.write('Packed MCP consumer: legacy and sessionless current protocol passed; two catalog tools only.\n');
} finally {
  await currentServer.close();
}

const cli = spawn(process.execPath, [
  join(process.cwd(), 'node_modules', '@uppercut-labs', 'skills', 'bin', 'uppercut-skills.js'),
  'serve-mcp', '--port', '0',
], { stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const cliUrl = await serverUrl(cli);
  const launched = await post(cliUrl, {
    jsonrpc: '2.0', id: 4, method: 'tools/list',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } },
  }, '2026-07-28');
  assert.equal(launched.status, 200);
  assert.deepEqual(toolNames(await payload(launched)), ['catalog.list', 'catalog.show']);
  process.stdout.write('Packed CLI launcher: loopback POST /mcp passed.\n');
} finally {
  if (cli.exitCode === null) {
    cli.kill('SIGTERM');
    await once(cli, 'exit');
  }
}

async function post(url, message, version) {
  return fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': version,
      ...(version === '2026-07-28' ? { 'mcp-method': message.method } : {}),
    },
    body: JSON.stringify(message),
  });
}

async function payload(response) {
  const body = await response.text();
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const data = body.split(/\r?\n/).find((line) => line.startsWith('data: '));
    assert.ok(data, body);
    return JSON.parse(data.slice(6));
  }
  return JSON.parse(body);
}

function toolNames(result) {
  return result.result.tools.map((tool) => {
    const match = /^cap_15_uppercut\.skills_12_(catalog\.(?:list|show))_v1$/.exec(tool.name);
    return match?.[1] ?? tool.name;
  }).sort();
}

function serverUrl(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('MCP CLI did not print a URL')), 5_000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const match = /http:\/\/127\.0\.0\.1:\d+\/mcp/.exec(output);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`MCP CLI exited before listening (${code})`));
    });
  });
}
