import { createServer, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { createMcpHandler } from '@uppercut-labs/agent-native/mcp';
import { catalogBundle } from '../generated/bundle.js';
import type { CatalogBundle } from '../catalog/types.js';
import { readBundledCatalog, resolveSkill } from '../catalog/index.js';
import { createSkillsCapabilityRegistry, type SkillsCapabilityContext } from '../agent-native/index.js';

export type LoopbackMcpOptions = {
  readonly bundle?: CatalogBundle;
  readonly port?: number;
};

export type LoopbackMcpServer = {
  readonly url: string;
  close(): Promise<void>;
};

/** Starts an explicitly requested, local-only, stateless MCP catalog endpoint. */
export async function startLoopbackMcpServer(options: LoopbackMcpOptions = {}): Promise<LoopbackMcpServer> {
  const bundle = options.bundle ?? catalogBundle;
  const catalog = readBundledCatalog(bundle);
  const capabilities = ['catalog.list', 'catalog.show'] as const;
  const context: SkillsCapabilityContext = {
    scope: { host: 'local-mcp-catalog', kind: 'project' },
    caller: { kind: 'anonymous' },
    authorization: { authorize: (request) => request.risk === 'read' && request.access.kind === 'public' },
    sourcePolicy: { mode: 'bundled-only', repository: 'public-catalog' },
    nativeRegistration: {},
    operations: {
      'catalog.list': () => catalog.skills.map(({ id, title, summary, category }) => ({ id, title, summary, category })),
      'catalog.show': (input) => {
        const id = readSkillId(input);
        const entry = resolveSkill(catalog, id);
        const bundled = bundle.skills[id];
        return {
          id: entry.id, title: entry.title, summary: entry.summary, category: entry.category,
          prerequisites: entry.prerequisites.flatMap((item) => item.skillId ? [item.skillId] : []),
          source: { repository: entry.sourceRepo, path: entry.sourcePath, revision: entry.sourceRevision },
          resources: bundled?.files.map((file) => file.path) ?? [],
          attribution: bundled?.attribution,
        };
      },
    },
  };
  const registry = createSkillsCapabilityRegistry(context, capabilities, ['server']).registry;
  const handler = createMcpHandler(registry, { endpoint: '/mcp', maxRequestBytes: 32 * 1024, deadlineMs: 10_000 });
  const server = createServer(async (incoming, outgoing) => {
    try {
      if (incoming.method !== 'POST' || incoming.url?.split('?')[0] !== '/mcp') {
        outgoing.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        outgoing.end(JSON.stringify({ error: { code: 'not_found', message: 'Not found.' } }));
        return;
      }
      if (!isLoopbackHost(incoming.headers.host) || !isLoopbackOrigin(incoming.headers.origin)) {
        outgoing.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
        outgoing.end(JSON.stringify({ error: { code: 'forbidden', message: 'MCP requests must use a loopback Host and Origin.' } }));
        return;
      }
      const request = await toFetchRequest(incoming);
      const response = await handler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      if (outgoing.headersSent) {
        outgoing.destroy(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      const tooLarge = error instanceof RangeError;
      outgoing.writeHead(tooLarge ? 413 : 500, { 'content-type': 'application/json; charset=utf-8' });
      outgoing.end(JSON.stringify({ error: { code: tooLarge ? 'request_too_large' : 'internal_error', message: tooLarge ? 'MCP request exceeds the configured limit.' : 'MCP request failed.' } }));
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.listen(options.port ?? 0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Loopback MCP server did not bind to a TCP port');
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: async () => {
      server.close();
      await once(server, 'close');
    },
  };
}

async function toFetchRequest(incoming: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of incoming) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += part.byteLength;
    if (bytes > 32 * 1024) throw new RangeError('MCP request exceeds 32768 bytes');
    chunks.push(part);
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.set(name, value);
  }
  const host = headers.get('host') ?? '127.0.0.1';
  const method = incoming.method ?? 'POST';
  return new Request(`http://${host}${incoming.url ?? '/mcp'}`, {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' ? {} : { body: Buffer.concat(chunks) }),
  });
}

function readSkillId(input: unknown): string {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new TypeError('Expected an object with a skill ID');
  const record = input as Record<string, unknown>;
  const id = record.id ?? record.skillId;
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('A skill ID is required');
  return id;
}

function isLoopbackHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(`http://${value}`);
    return !url.username && !url.password && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

function isLoopbackOrigin(value: string | undefined): boolean {
  if (value === undefined) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch { return false; }
}
