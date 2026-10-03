export type ResultOutcome = 'complete' | 'unchanged' | 'degraded' | 'registration-required' | 'failed';
export type SkillsResult = {
  readonly schema: 'uppercut.skills.result/v1';
  readonly command: string;
  readonly outcome: ResultOutcome;
  readonly requestedIds: readonly string[];
  readonly resolvedIds: readonly string[];
  readonly host?: string;
  readonly scope?: 'project' | 'global';
  readonly channel?: 'bundled' | 'github';
  readonly sourceReceipts?: readonly unknown[];
  readonly changes?: readonly unknown[];
  readonly data?: unknown;
  readonly warnings?: readonly string[];
  readonly error?: { readonly code: string; readonly message: string };
  readonly discovery?: { readonly status: 'verified' | 'unverified' | 'not-applicable'; readonly evidence?: readonly unknown[] };
};

export function resultEnvelope(value: Omit<SkillsResult, 'schema'>): SkillsResult {
  return { schema: 'uppercut.skills.result/v1', ...value };
}

export function formatResult(result: SkillsResult, json: boolean): string {
  if (json) return JSON.stringify(result);
  if (result.error) return result.error.message;
  if (Array.isArray(result.data) && result.command === 'list') {
    return result.data.map((item) => {
      if (typeof item !== 'object' || item === null) return String(item);
      const record = item as Record<string, unknown>;
      return `${String(record.id)}  ${String(record.title)}\n  ${String(record.summary)}`;
    }).join('\n');
  }
  if (Array.isArray(result.data) && result.command === 'show') {
    return result.data.map((item) => {
      if (typeof item !== 'object' || item === null) return String(item);
      const record = item as Record<string, unknown>;
      const resources = Array.isArray(record.resources) ? record.resources.join(', ') : '';
      return `${String(record.title)} (${String(record.id)})\n${String(record.summary)}\nResources: ${resources}`;
    }).join('\n\n');
  }
  if (result.command === 'doctor' && typeof result.data === 'object' && result.data !== null && 'healthy' in result.data) {
    return result.data.healthy ? 'Managed skills are healthy.' : 'Managed skill problems found; run with --json for details.';
  }
  if (result.outcome === 'unchanged') return 'Already up to date.';
  if (result.outcome === 'degraded') return `Installed ${result.resolvedIds.join(', ')} with warnings: ${(result.warnings ?? []).join('; ')}`;
  if (result.outcome === 'registration-required') return `Installed ${result.resolvedIds.join(', ')}; native registration is still required.`;
  if (result.command === 'add') return `Installed ${result.resolvedIds.join(', ')}${result.host ? ` for ${result.host}` : ''}.`;
  if (result.command === 'remove') return `Removed ${result.requestedIds.join(', ')}.`;
  return `${result.command} completed.`;
}
