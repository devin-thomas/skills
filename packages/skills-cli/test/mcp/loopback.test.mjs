import assert from 'node:assert/strict';
import test from 'node:test';
import { startLoopbackMcpServer } from '../../dist/mcp/index.js';

async function post(url, message, protocolVersion) {
  return fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...(protocolVersion ? { 'mcp-protocol-version': protocolVersion } : {}),
      ...(protocolVersion === '2026-07-28' ? { 'mcp-method': message.method } : {}),
    },
    body: JSON.stringify(message),
  });
}

async function jsonFrom(response) {
  const body = await response.text();
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const data = body.split(/\r?\n/).find((line) => line.startsWith('data: '));
    assert.ok(data, body);
    return JSON.parse(data.slice(6));
  }
  return JSON.parse(body);
}

test('loopback MCP accepts initialization then exposes only list and show with show id required', async (t) => {
  const server = await startLoopbackMcpServer();
  t.after(() => server.close());

  const initialized = await post(server.url, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'skills-test', version: '1.0.0' } },
  });
  assert.equal(initialized.status, 200);
  assert.equal((await jsonFrom(initialized)).result.protocolVersion, '2025-11-25');

  const listed = await post(server.url, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, '2025-11-25');
  assert.equal(listed.status, 200);
  const tools = (await jsonFrom(listed)).result.tools;
  assert.equal(tools.length, 2);
  const show = tools.find((tool) => tool.name.includes('catalog.show'));
  assert.ok(show);
  assert.deepEqual(show.inputSchema.required, ['id']);
  assert.deepEqual(show.inputSchema.properties.id, { type: 'string', minLength: 1 });
});

test('loopback MCP accepts a sessionless current-version catalog request', async (t) => {
  const server = await startLoopbackMcpServer();
  t.after(() => server.close());

  const response = await post(server.url, {
    jsonrpc: '2.0', id: 3, method: 'tools/list',
    params: { _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
    } },
  }, '2026-07-28');
  assert.equal(response.status, 200, await response.clone().text());
  const payload = await jsonFrom(response);
  assert.equal(payload.result.tools.length, 2);
});

test('loopback MCP rejects non-loopback Host and Origin headers', async (t) => {
  const server = await startLoopbackMcpServer();
  t.after(() => server.close());
  const response = await fetch(server.url, {
    method: 'POST',
    headers: { host: 'example.com', origin: 'http://example.com', 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 403);
});
