---
name: programmatic-harness
description: Set up and prove an explicitly requested local coding-agent harness with a bounded resumable session and nonsecret evidence.
---

# Programmatic Harness

Use this skill only after the learner opts in to controlling a coding-agent session from code. Installing this skill changes no project dependencies and configures no credentials. Declining or stopping leaves the caller's workflow available.

## Codex local route

Codex local is the implemented route in this release. Cursor is deferred until its adapter and native acceptance evidence are available; do not imply that Cursor works. Codex cloud is unsupported here. A separate future cloud adapter would require its own explicit opt-in and proof.

1. Confirm Node.js 22+, an installed Codex CLI, an absolute disposable workspace, and the user's own eligible Codex managed ChatGPT sign-in. If Codex is absent, offer the official Codex installation/login handoff. Do not request an API key or suggest enabling OpenAI Platform billing for this route.
2. Explain that the caller will explicitly install `@uppercut-labs/agent-native` in the disposable proof project. The skill installer does not do this. No credentials are copied, created, or logged.
3. Install a pinned Agent Native release in that disposable project using the npm release if available. Otherwise use the pinned public release asset and verify its adjacent SHA-256 file before installation; see [Codex setup](references/codex.md). Do not install from an unpinned branch or add a dependency to the learner's application by default.
4. Run the packaged `scripts/codex-proof.mjs` only when the learner asks to run the proof. It creates its own temporary workspace, makes two fixed turns, closes and resumes the same opaque session reference, checks exact file contents, and removes the workspace.
5. Report only the fixed evidence fields emitted by the script: adapter version, provider, target, model, turn results, content checks, and cleanup result. Omit session IDs, tokens, account responses, environment values, raw event messages, and provider exceptions.
6. On failure, report the stable failure category and one useful recovery action. Authentication problems go to `codex login`; unavailable CLI goes to the official Codex installation route; an interrupted/incomplete second turn is partial, never passed. Cleanup failures must be visible and must not be reported as successful cleanup.

The adapter uses Codex's managed ChatGPT account path and rejects API-key account mode; it does not provide an API-billed fallback. Model availability and plan eligibility are controlled by Codex. Token usage events are cumulative snapshots; never add them together as a cost estimate.

See [Codex setup](references/codex.md) and [proof and evidence](references/proof-and-evidence.md). Technical lifecycle semantics live in [Agent Native's Codex harness reference](https://github.com/uppercut-labs/agent-native/blob/main/docs/harness-codex.md).
