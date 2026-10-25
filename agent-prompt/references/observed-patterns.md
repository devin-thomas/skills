# Observed patterns and reference implementation

Field study dated October 14, 2026, followed by the public reference release in [`devin-thomas/agent-prompts`](https://github.com/devin-thomas/agent-prompts) at [agent-prompts.vercel.app](https://agent-prompts.vercel.app/) (replacing the earlier throwaway prototype at `prompt-form-study.vercel.app`). These field measurements are dated observations of specific pages, not a popularity survey or proof of downstream agent execution.

## External field observations (October 14, 2026)

| Site / selected feature | Observed interface | Measured copied payload |
| --- | --- | --- |
| [Cloudflare agent setup](https://developers.cloudflare.com/agent-setup/) | One compact Copy prompt pill with Claude, Codex, Cursor, and OpenCode logos; named agent guide cards below. No expanded prompt body. | 135 characters / 14 whitespace words |
| [Arg for Cursor](https://arg.ai/for-agents/cursor) | Agent named in the heading, short visible instruction, adjacent Copy prompt. | 31 / 2 |
| [Resend for Cursor](https://resend.com/cursor) | Short task rows with separate copy and Cursor-logo launch actions. | First task: 51 / 11 |
| [Mintlify contextual menu](https://www.mintlify.com/docs/ai/contextual-menu) | Compact Copy page split control; expanded menu names ChatGPT, Claude, Cursor, and other actions with icons. | Current page export: 9,928 / 1,301 |

Character counts describe the clipboard string, not URL-encoded length or HTTP byte count.

Cloudflare's exact copied prompt is:

> Fetch and execute the appropriate instructions to set me up for Cloudflare from https://developers.cloudflare.com/agent-setup/prompt.md

The control measured about 230 × 40 CSS pixels. At a 390px viewport, the secondary action stacked below and the document width remained 390px. A successful copy changed its visible label to **Prompt copied!**. The linked Markdown returned HTTP 200 through browser navigation and a separate curl request (4,920 extracted characters; 5,106 HTTP bytes) and routes setup by agent product.

Arg copied a two-word fetch instruction whose linked Markdown returned HTTP 200 (3,291 bytes). Resend's observed Cursor launch URL carries the first task in its `text` query parameter; the [official Cursor deep-link documentation](https://prod.cursor.com/docs/reference/deeplinks) confirms that prompt links prefill a draft for user review rather than executing automatically. Mintlify's contextual menu copied 1,301 words of page MDX asynchronously, illustrating why compact control footprint and pasted payload size must be checked independently.

## Canonical reference implementation (`agent-prompts`)

[`devin-thomas/agent-prompts`](https://github.com/devin-thomas/agent-prompts) ([live site](https://agent-prompts.vercel.app/)) turns these observations into a clean, MIT-licensed reference collection with seven working examples, five public task guides, a portable project handoff sample, and a nine-brand logo treatment studio:

1. **Opening hero handoff and responsive brand strip:** Combines a Cloudflare-inspired shared copy button (`Copy build prompt` with Claude Code, Codex, and Cursor marks and adjacent `Claude Code · Codex · Cursor` label, pointing to `/guides/branded-handoff.md`), a direct entry to `#format-07` (`Continue an existing project`), and a nine-product strip (`ChatGPT`, `Claude`, `Gemini`, `Claude Code`, `Codex`, `Cursor`, `Antigravity`, `Grok Bot`, `Grok`) that wraps into a 3-column grid on narrow phones so the opening action and marks stay visible together at `320 × 667` and `390 × 844`.
2. **Seven task-first examples (`#formats`):**
   - `01` **Shared prompt** (`/guides/contact-form.md`, ChatGPT + Claude + Gemini marks)
   - `02` **Agent picker** (`/guides/theme-switcher.md`, interactive `Claude Code`, `Codex`, and `Antigravity` choices with `aria-pressed` state and dynamic `Copy for {Agent}` label)
   - `03` **Contextual prompt** (`/guides/newsletter-form.md`, placed beside a newsletter form preview with `Copy for Grok Bot`)
   - `04` **Command palette** (`Cmd/Ctrl + K` searchable dialog across all five task definitions with keyboard arrow/`Home`/`End`/`Enter`/`Escape` support and status announcements)
   - `05` **Linked guide** (`/guides/contact-form.md`, one-sentence `Copy for Grok` paired with a direct link to the Markdown guide)
   - `06` **Open in agent** (`Open in Cursor` draft link `https://cursor.com/link/prompt?text=...` paired with a `Copy prompt` fallback)
   - `07` **Continue this project** (`/guides/continue-project.md` and `/examples/project-handoff.md`, an agent-independent continuation prompt that verifies the current working tree against `PROJECT.md` or existing handoff records, completes the next unfinished step, and leaves an updated portable handoff)
3. **Nine distinct marks and three logo treatments (`#logo-treatments`):** Compares `Original`, `Black`, and `White` SVG variants on light and dark comparison plates across all nine products (`chatgpt`, `claude`, `gemini`, `claude-code`, `codex`, `cursor`, `antigravity`, `grok-bot`, `grok`). Preserves monochrome originals for ChatGPT (Blossom mark), Cursor, Grok Bot (preserving the eye mask cutout), and Grok without inventing fake colors, and uses `.adaptive-mono` (`filter: brightness(0) invert(1)`) under `:root[data-darkreader-scheme='dark']` so monochrome marks stay legible on darkened surfaces while original full-color marks remain untouched.
4. **Copy feedback and public-source guardrails:** Uses token-guarded feedback reset (`resetCopyFeedback`) when switching agents, starting a copy, failing a copy, or reopening `#prompt-dialog`, and enforces public-source hygiene via `scripts/audit-public.mjs` (`npm run check`).

## Evidence and limits

Reusable public artwork and license notices live in [the reference asset directory](https://github.com/devin-thomas/agent-prompts/tree/main/public/brands) and [third-party notices](https://github.com/devin-thomas/agent-prompts/blob/main/THIRD_PARTY_NOTICES.md). The field measurements above describe the observation date and are not current product capability guarantees.
