// The verdict on the typing and palette measurements (electron/qa.ts, qa/typing.ts).
//
// @uppercut-labs/electron-qa-measurements reports numbers and does not decide what is good
// enough. The limits that decide are the ones published in the desktop-app skill's
// references/premium-bar.md: rule 41 (every key to paint, 95th percentile 50 ms or less over
// at least 200 keys, never over 100 ms), rule 7 (the palette within 50 ms) and the no-focus
// rule (the window is never focused by a test). Passing them earns "passes the automated bar",
// not the word premium: that is the owner's verdict after real use.
import type { PaletteResult, Stats, TypingResult } from '@uppercut-labs/electron-qa-measurements';

export interface GateInput {
  typing: Record<string, TypingResult>;
  palette: PaletteResult;
  windowFocusedAfterTyping?: boolean;
}

export interface GateCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface GateResult {
  passed: boolean;
  checks: GateCheck[];
  reasons: string[];
  /** Where the limits come from. */
  judgedBy: 'premium-bar.md';
  summary: string;
}

/** The published limits (references/premium-bar.md, rules 7, 27 and 41). */
export const PUBLISHED = { typingMinSamples: 200, typingP95Ms: 50, typingMaxMs: 100, paletteMaxMs: 50 };

function typingCheck(name: string, latency: Stats): GateCheck {
  const { samples, p95, max } = latency;
  if (samples < PUBLISHED.typingMinSamples) return { name: `typing ${name}`, passed: false, reason: `${samples} samples, at least ${PUBLISHED.typingMinSamples} needed` };
  if ((p95 ?? Infinity) > PUBLISHED.typingP95Ms) return { name: `typing ${name}`, passed: false, reason: `p95 ${p95} ms over ${PUBLISHED.typingP95Ms} ms` };
  if ((max ?? Infinity) > PUBLISHED.typingMaxMs) return { name: `typing ${name}`, passed: false, reason: `max ${max} ms over ${PUBLISHED.typingMaxMs} ms` };
  return { name: `typing ${name}`, passed: true };
}

/** The verdict by the published limits. */
export function judgePublished(input: GateInput): Omit<GateResult, 'judgedBy' | 'summary'> {
  const checks = Object.entries(input.typing).map(([name, result]) => typingCheck(name, result.latency));
  const { open } = input.palette;
  checks.push(
    open.samples > 0 && (open.max ?? Infinity) <= PUBLISHED.paletteMaxMs
      ? { name: 'palette', passed: true }
      : { name: 'palette', passed: false, reason: open.samples ? `slowest open ${open.max} ms over ${PUBLISHED.paletteMaxMs} ms` : 'the palette never opened' },
  );
  if (input.windowFocusedAfterTyping !== undefined) checks.push(input.windowFocusedAfterTyping ? { name: 'window never focused', passed: false, reason: 'the window had focus after typing' } : { name: 'window never focused', passed: true });
  if (!Object.keys(input.typing).length) checks.push({ name: 'typing', passed: false, reason: 'no typing run' });
  const reasons = checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.reason ?? 'failed'}`);
  return { passed: reasons.length === 0, checks, reasons };
}

/** The verdict, with a one-line-per-check summary. */
export async function judge(input: GateInput): Promise<GateResult> {
  const result = judgePublished(input);
  const summary = [...result.checks.map((c) => `${c.passed ? 'pass' : 'FAIL'}  ${c.name}${c.reason ? `: ${c.reason}` : ''}`), result.passed ? 'premium bar: passed (published limits)' : 'premium bar: FAILED (published limits)'].join('\n');
  return { ...result, judgedBy: 'premium-bar.md', summary };
}
