import {
  bindCapability,
  createCapabilityRegistry,
  defineCapability,
  type AuthorizationPort,
  type CapabilityDefinition,
  type CapabilityIdentity,
  type CapabilityRegistry,
  type ExecutionCaller,
  type RuntimeTarget,
  executeCapability,
} from '@uppercut-labs/agent-native';

export type SkillsCapabilityName =
  | 'catalog.list'
  | 'catalog.show'
  | 'installation.plan'
  | 'installation.inspect'
  | 'installation.doctor'
  | 'installation.add'
  | 'installation.update'
  | 'installation.remove';

export type SkillsCapabilityContext = {
  readonly scope: { readonly host: string; readonly kind: 'project' | 'global'; readonly rootPath?: string };
  readonly caller: ExecutionCaller;
  readonly authorization: AuthorizationPort;
  readonly sourcePolicy: Readonly<Record<string, unknown>>;
  readonly nativeRegistration: Readonly<Record<string, unknown>>;
  readonly operations: Readonly<Partial<Record<SkillsCapabilityName, (input: unknown, context: SkillsCapabilityContext) => unknown | Promise<unknown>>>>;
};

export type SkillsRegistryHandle = {
  readonly registry: CapabilityRegistry;
  execute(name: SkillsCapabilityName, input: unknown): ReturnType<typeof executeCapability>;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const jsonSchema = {
  parse(input: unknown): JsonValue {
    const visit = (value: unknown, seen: Set<object>): JsonValue => {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value !== 'object') throw new TypeError('Capability output must be JSON-compatible');
      if (seen.has(value)) throw new TypeError('Capability output cannot contain cycles');
      seen.add(value);
      if (Array.isArray(value)) {
        const result = value.map((item) => visit(item, seen));
        seen.delete(value);
        return result;
      }
      const result: Record<string, JsonValue> = {};
      for (const [key, item] of Object.entries(value)) result[key] = visit(item, seen);
      seen.delete(value);
      return result;
    };
    return visit(input, new Set());
  },
  toJSONSchema: () => ({}),
};

const inputSchema = {
  parse(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new TypeError('Capability input must be an object');
    return input as Record<string, unknown>;
  },
  toJSONSchema: () => ({ type: 'object', additionalProperties: true }),
};

const names: readonly SkillsCapabilityName[] = [
  'catalog.list', 'catalog.show', 'installation.plan', 'installation.inspect',
  'installation.doctor', 'installation.add', 'installation.update', 'installation.remove',
];

function identity(name: SkillsCapabilityName): CapabilityIdentity {
  return { namespace: 'uppercut.skills', name, majorVersion: 1 };
}

function definition(name: SkillsCapabilityName): CapabilityDefinition<Record<string, unknown>, JsonValue> {
  const isCatalog = name.startsWith('catalog.');
  const access = isCatalog
    ? { kind: 'public' as const }
    : { kind: 'protected' as const, scopes: [name.endsWith('.remove') ? 'skills:remove' : name.endsWith('.add') || name.endsWith('.update') ? 'skills:write' : 'skills:read'] };
  return defineCapability({
    identity: identity(name),
    description: `Uppercut Skills ${name.replace('.', ' ')}`,
    input: inputSchemaFor(name),
    output: jsonSchema,
    risk: name.endsWith('.remove') ? 'destructive' : name.endsWith('.add') || name.endsWith('.update') ? 'write' : 'read',
    access,
    ...((name === 'catalog.list' || name === 'catalog.show') ? {
      surfaces: { http: { method: 'GET' as const, path: name === 'catalog.list' ? '/catalog' : '/catalog/show' } },
    } : {}),
  });
}

function inputSchemaFor(name: SkillsCapabilityName) {
  return {
    parse(input: unknown): Record<string, unknown> {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new TypeError('Capability input must be an object');
      const value = input as Record<string, unknown>;
      if (name === 'catalog.show') {
        if (typeof value.id !== 'string' || !value.id.trim()) throw new TypeError('A skill ID is required');
      } else if (name === 'installation.add' || name === 'installation.remove') {
        if (!Array.isArray(value.ids) || !value.ids.length || !value.ids.every((id) => typeof id === 'string' && id.trim())) {
          throw new TypeError('A non-empty IDs array is required');
        }
      } else if (name === 'installation.plan' && value.ids !== undefined) {
        if (!Array.isArray(value.ids) || !value.ids.every((id) => typeof id === 'string' && id.trim())) throw new TypeError('IDs must be an array of skill IDs');
      } else if (name === 'installation.update' && value.ids !== undefined) {
        if (!Array.isArray(value.ids) || !value.ids.every((id) => typeof id === 'string' && id.trim())) throw new TypeError('IDs must be an array of skill IDs');
      }
      return value;
    },
    toJSONSchema: () => name === 'catalog.show'
      ? { type: 'object', properties: { id: { type: 'string', minLength: 1 } }, required: ['id'], additionalProperties: false }
      : name === 'installation.add' || name === 'installation.remove'
        ? { type: 'object', properties: { ids: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 } }, required: ['ids'], additionalProperties: false }
        : name === 'installation.update' || name === 'installation.plan'
          ? { type: 'object', properties: { ids: { type: 'array', items: { type: 'string', minLength: 1 } } }, additionalProperties: false }
          : { type: 'object', additionalProperties: false },
  };
}

/** Builds a scoped, explicit Agent Native registry without selecting paths or touching disk. */
export function createSkillsCapabilityRegistry(
  context: SkillsCapabilityContext,
  selectedNames: readonly SkillsCapabilityName[] = names,
  targets: readonly RuntimeTarget[] = ['local'],
): SkillsRegistryHandle {
  const definitions = selectedNames.map(definition);
  const bindings = definitions.map((capability) => bindCapability(capability, {
    id: `uppercut-skills-${capability.identity.name.replaceAll('.', '-')}-v1`,
    targets,
    execute: (input) => {
      const handler = context.operations[capability.identity.name as SkillsCapabilityName];
      if (!handler) throw new Error(`No operation handler is configured for ${capability.identity.name}`);
      return handler(input, context);
    },
  }));
  const registry = createCapabilityRegistry(definitions, bindings);
  return {
    registry,
    execute(name, input) {
      return executeCapability(registry, {
        identity: identity(name), runtime: 'local', input,
        caller: context.caller, authorization: context.authorization,
      });
    },
  };
}
