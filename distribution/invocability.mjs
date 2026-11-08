// Every published skill must stay model-invocable. A skill fails when its
// SKILL.md frontmatter or its sibling agents/openai.yaml sets
// disable-model-invocation, user-invocable-only, allow_implicit_invocation:
// false or an equivalent, in any spelling, at the top level or inside one host
// block (metadata, policy, claude, codex, openai, agents). `user-invocable:
// false` only hides a skill from the user's slash menu and passes.
//
// Dependency-free YAML subset reader, kept in step with
// scripts/invocability.py. Block scalars are skipped, so prose that mentions a
// setting never counts; values it cannot read safely are reported.

export const RULE = 'Every skill must stay model-invocable: remove disable-model-invocation, user-invocable-only, '
  + 'allow_implicit_invocation: false and equivalent settings from SKILL.md frontmatter and agents/openai.yaml.';

const MUST_BE_FALSE = new Set(['disablemodelinvocation', 'userinvocableonly', 'manualonly', 'useronly']);
const MUST_BE_TRUE = new Set(['modelinvocable', 'modelinvocation', 'allowmodelinvocation', 'allowimplicitinvocation', 'implicitinvocation']);
const MODE_KEYS = new Set(['invocation', 'invocable', 'invocationmode', 'invocationpolicy']);
const MODEL_MODES = new Set(['auto', 'automatic', 'model', 'implicit', 'both', 'any', 'all']);
const NESTED = new Set(['metadata', 'policy', 'claude', 'codex', 'openai', 'agents']);
const TRUE = new Set(['true', 'True', 'TRUE']);
const FALSE = new Set(['false', 'False', 'FALSE']);
const KEY_LINE = /^(?<indent> *)(?<key>"[^"]*"|'[^']*'|[^\s#'"{[-][^:#]*?|-[^\s:#][^:#]*?) *:(?: +(?<value>.*?))? *$/;
const BLOCK = /^[|>][-+0-9]*(?: +#.*)?$/;
const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const normalized = (key) => key.replace(/^["']|["']$/g, '').replace(/[-_\s]/g, '').toLowerCase();
const watched = (name) => MUST_BE_FALSE.has(name) || MUST_BE_TRUE.has(name) || MODE_KEYS.has(name);

function scalar(raw) {
  const value = raw.trim();
  if (value[0] === '"' || value[0] === "'") {
    const end = value.indexOf(value[0], 1);
    return { text: end > 0 ? value.slice(1, end) : value.slice(1), quoted: true };
  }
  return { text: value.replace(/ +#.*$/, '').trim(), quoted: false };
}

function judge(path, name, raw) {
  const { text, quoted } = scalar(raw);
  const shown = quoted ? `"${text}"` : (text || 'null');
  if (MUST_BE_FALSE.has(name)) return !quoted && FALSE.has(text) ? null : `${path}: ${shown}`;
  if (MUST_BE_TRUE.has(name)) return !quoted && TRUE.has(text) ? null : `${path}: ${shown}`;
  if (MODE_KEYS.has(name)) return (!quoted && TRUE.has(text)) || MODEL_MODES.has(text.trim().toLowerCase()) ? null : `${path}: ${shown}`;
  return null;
}

/** Settings in a YAML mapping (frontmatter or openai.yaml) that hide the skill. */
export function violations(yamlText) {
  const found = [];
  let parent = null; // { indent, key }
  let childIndent = null;
  let blockIndent = null;
  for (const line of yamlText.split(/\r?\n/)) {
    const stripped = line.trim();
    const indent = line.length - line.replace(/^ +/, '').length;
    if (blockIndent !== null) {
      if (!stripped || indent > blockIndent) continue;
      blockIndent = null;
    }
    if (!stripped || stripped.startsWith('#') || stripped === '---' || stripped === '...') continue;
    if (line.slice(0, indent + 1).includes('\t')) { found.push('unreadable indentation (tab)'); continue; }
    const match = KEY_LINE.exec(line);
    if (!match) continue; // list items and plain-scalar continuations carry no settings
    const key = match.groups.key.trim();
    const name = normalized(key);
    const value = match.groups.value ?? '';
    if (value && BLOCK.test(value)) blockIndent = indent;
    if (parent && indent <= parent.indent) { parent = null; childIndent = null; }
    const nested = parent !== null && indent > parent.indent;
    if (nested) {
      childIndent ??= indent;
      if (indent !== childIndent) continue; // deeper than one host block
    }
    if (indent > 0 && !nested) continue;
    const path = nested ? `${parent.key}.${key}` : key;
    if (!nested && NESTED.has(name)) {
      if (value.startsWith('{')) {
        for (const item of value.trim().replace(/^\{|\}$/g, '').split(',')) {
          const at = item.indexOf(':');
          if (at < 0) continue;
          const itemKey = item.slice(0, at).trim();
          const result = judge(`${key}.${itemKey}`, normalized(itemKey), item.slice(at + 1));
          if (result) found.push(result);
        }
      } else if (!value) parent = { indent, key };
      continue;
    }
    if (value.startsWith('{') || value.startsWith('[') || (value && BLOCK.test(value))) {
      if (watched(name)) found.push(`${path}: ${value}`);
      continue;
    }
    const result = judge(path, name, value);
    if (result) found.push(result);
  }
  return found;
}

/** Violations for one skill, given its SKILL.md text and optional agents/openai.yaml text. */
export function skillViolations(skillText, openaiText) {
  const found = [];
  const match = FRONTMATTER.exec(skillText);
  if (match) found.push(...violations(match[1]).map((item) => `SKILL.md ${item}`));
  if (typeof openaiText === 'string') found.push(...violations(openaiText).map((item) => `agents/openai.yaml ${item}`));
  return found;
}

/** Violations across a bundle's files ({ path, text }[]), keyed by skill folder. */
export function bundleViolations(files) {
  const byPath = new Map(files.map(({ path, text }) => [path, text]));
  const found = [];
  for (const [path, text] of byPath) {
    if (path !== 'SKILL.md' && !path.endsWith('/SKILL.md')) continue;
    const folder = path.slice(0, -'SKILL.md'.length);
    for (const item of skillViolations(text, byPath.get(`${folder}agents/openai.yaml`))) found.push(`${path}: ${item}`);
  }
  return found;
}

/** Release-gate check over a built catalog bundle ({ skills: { id: { files: [{ path, contentBase64 }] } } }). */
export function checkBundleInvocability(bundle) {
  const problems = [];
  let skills = 0;
  for (const [id, skill] of Object.entries(bundle?.skills ?? {})) {
    const files = (skill.files ?? []).map(({ path, contentBase64 }) => ({ path, text: Buffer.from(contentBase64, 'base64').toString('utf8') }));
    if (!files.some(({ path }) => path === 'SKILL.md')) problems.push(`${id}: no SKILL.md in the bundle`);
    problems.push(...bundleViolations(files).map((item) => `${id}/${item}`));
    skills += 1;
  }
  if (!skills) problems.push('bundle has no skills');
  if (problems.length) throw new Error(`${problems.join('\n')}\n${RULE}`);
  return `${skills} skills model-invocable`;
}
