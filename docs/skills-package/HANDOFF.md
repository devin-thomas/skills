# Handoff to the implementing agent

Read PLAN, SPEC, DECISIONS, HOSTS, CHANNELS, AGENT-NATIVE, and the ticket index before implementing.
Use the existing `devin-thomas/skills` repository. Re-read its current AGENTS.md and manifests; compare this pack's
snapshot with the current checkout and preserve any intervening work. Do not repeat the design interview.

## Fixed user decisions

Name `@uppercut-labs/skills`. Automatic host selection with a question only when genuinely unresolved.
Owned catalog only. Required dependencies automatic, no dependency confirmation or mandatory approval preview.
Optional expert `--no-dependencies` / `-nd`. Bundled stable and explicit remembered GitHub/latest content channel.
Codex, Claude Code, Cursor, Antigravity, Grok Bot, and Grok CLI are initial hosts. Use Agent Native where it fits;
the included plan puts the shared capability layer in v1. The original ZIP was planning-only; this repository copy
reconciles it with the earlier draft PR and the user's later Grok host clarification.

## First action

Complete SKP-001 against current repository state, then establish the package baseline and six actual host contracts.
Resolve Grok Bot's project/account routes, Grok CLI discovery, and Antigravity surface routing in SKP-003 before building false assumptions into
installation code. Native host access may require running that ticket on Devin's authorized host; keep the exact evidence
need visible instead of demoting a host or pretending a fixture is proof.

## What exists in this ZIP

A concrete plan, 12 implementation tickets, researched source ledger, an observed-catalog reference snapshot,
non-executable host/source policy seeds, five guarded source replacements, an additive host-compatibility document,
and pack/applicator validation tools. The npm installer itself is not built. Reference data is not a replacement catalog.

## Authority

Local build work can be prepared for review. Preserve native host permissions and the current repository's Git
policy. The unresolved collection license remains a package-publication gate; do not select one silently or publish
to npm before the owner decides and authorizes the release.

## Resume evidence

Record actual checks, tarball digest, native versions, successes, failures, and the exact remaining action in VERIFICATION
and each ticket's Outcome. Keep private receipts, tokens, account IDs, and absolute user paths out of public commits.
Do not label source patches applied until they were actually applied to the user's chosen checkout and checked there.
