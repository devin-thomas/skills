# Uppercut Skills decisions

## D01 — Product and ownership
Status: accepted by user.
Context: a catalog of portable workflows needs a distribution layer, not another application.
Decision: `@uppercut-labs/skills`; source stays in `devin-thomas/skills`; CLI-first, project-local by default.
Reason: gives Uppercut a coherent package identity without moving canonical skill authoring.
Consequences: add distribution code beneath the existing repository, not a mandatory new repo.
Revisit when: ownership or a genuine independent release boundary changes.

## D02 — Six initial hosts
Status: accepted by user.
Context: the prior two-host proposal omitted tools Devin already uses.
Decision: Codex, Claude Code, Cursor, Antigravity, Grok Bot, and the separate Grok CLI are initial-release requirements.
Reason: portability must cover the actual workflow now.
Consequences: Grok Bot project and account-library routes, Grok CLI routes, and Antigravity surface-specific paths are early qualification work.
Revisit when: the user changes scope; do not defer a host merely to claim release completion.

## D03 — Automatic host choice
Status: accepted by user; resolution order is a derived implementation default.
Context: most users should not have to know directory layouts.
Decision: explicit selection, saved selection, active host, then a unique detected installation; ask only when unresolved.
Reason: avoids both repeated setup and silent wrong-target writes.
Consequences: noninteractive ambiguity returns an actionable error, never a prompt or arbitrary default.
Revisit when: a host provides a stronger documented detection mechanism.

## D04 — Automatic dependencies, no approval step
Status: accepted by user, emphatic.
Context: users should not know which workflows delegate to which required inner skill.
Decision: install the required closure automatically. Do not ask about dependencies and do not require accepting a preview.
Reason: a requested workflow should arrive usable.
Consequences: optional `--no-dependencies` / `-nd` is recorded as degraded; unrelated tools/accounts are not auto-installed.
Revisit when: only the user explicitly changes this behavior.

## D05 — Owned catalog only
Status: accepted by user; current catalog reuse is a derived implementation default.
Context: the repository already contains a 15-entry owned manifest spanning three approved source repositories.
Decision: reuse `manifest/skills.json`; no arbitrary third-party repo/URL installation and no private sources.
Reason: avoids duplicate catalogs and scope inflation.
Consequences: referenced owned product/curriculum entries need full resource and licensing audits, not silent omission.
Revisit when: the user asks for a general-purpose installer.

## D06 — Bundled stable plus remembered GitHub channel
Status: accepted by user; precise channel semantics are derived here.
Context: skill text can change much faster than installer code.
Decision: default to a packaged stable snapshot; `--latest` / `--channel github` resolves allowed source refs to immutable
revisions once, installs that snapshot, and saves the channel. Subsequent update follows it.
Reason: GitHub-channel users get content updates without daily npm CLI releases, while bundled installs remain reproducible.
Consequences: moving refs are never recorded as the installed version; explicit network failure does not silently downgrade.
Revisit when: a separately validated stable content channel is genuinely needed; do not add one speculatively.

## D07 — Use Agent Native without making setup harder
Status: requested by user when feasible; implementation approach derived from current library docs.
Context: Agent Native has shipped and supports local capability contracts, validation, binding, and execution.
Decision: use its published library for the common capability surface; a small friendly CLI normalizes user commands.
Expose a programmatic integration entry point. No MCP/server setup is required for add/update/remove.
Reason: dogfood the shared contracts without imposing generated-runner syntax on beginners.
Consequences: preserve the library's explicit authorization boundary and test the exact published API; no fictional stdio API.
Revisit when: a specific remote consumer needs a separately authorized server deployment.

## D08 — Safe ownership instead of force-overwrite
Status: derived implementation default.
Context: copied skills are often edited locally or also discovered by other hosts.
Decision: hash and track owned files; preflight the complete transaction; block conflicts; journal rollback.
Reason: updates must not destroy a user's modifications or leave half a dependency set installed.
Consequences: no blanket force flag; idempotency and shared-reference tests are required.
Revisit when: evidence supports an explicit merge/recovery workflow.

## D09 — Preserve portable skill content
Status: user authorized necessary repository fixes; exact fixes are supplied in this pack.
Context: task workflows explicitly enumerate only AGENTS.md and CODEX.md; the catalog already has the required edges.
Decision: broaden instruction discovery to the active host's scoped rules, preserve workflow behavior and optional host metadata,
and clarify automatic sibling dependency installation. Do not clone six divergent versions of every skill.
Reason: scope-preserving fixes are smaller than rewriting the collection around one host.
Consequences: changes do not claim any native host has been tested.
Revisit when: a real host test exposes a concrete incompatibility.

## D10 — License and publication authority
Status: MIT selected by Devin on October 3, 2026; public release authorized subject to qualification.
Context: the Starter Pack repository retains a restrictive rights notice, while this package bundles two pinned skill snapshots from it. VidChopper is MIT upstream.
Decision: release the approved `@uppercut-labs/skills` installer and bundled skill snapshots under MIT. Preserve explicit source attribution and pinned revisions in the package notice. Do not relicense the rest of this repository or Starter Pack.
Reason: Devin owns the original material and expressly approved MIT for this package after the two Starter Pack skills were identified.
Consequences: include LICENSE and NOTICE in the npm tarball. Real host acceptance and final artifact checks remain release gates.
Revisit when: the package includes new third-party content or later upstream snapshots with different terms.

## D11 — Grok Bot and Grok CLI are separate surfaces
Status: added from the user's direct Grok Bot explanation after the second ZIP.
Context: the ZIP described only Grok Bot's account library and warned against inventing `.grok/skills` for it.
Decision: Grok Bot repository work uses the observed `.agents/skills` route; its chat-wide private library still
needs native account registration. Grok CLI is a sixth host with documented project/user `.grok/skills` routes.
Reason: a project copy, an account-library install, and a CLI filesystem install have different acceptance evidence.
Consequences: `--host grokbot` routes by selected scope, `--host grokcli` is independent, and both need real-host tests.

## D12 - Read-only loopback MCP mount

Decision: Mount opt-in Streamable HTTP `POST /mcp` on loopback using Agent Native 0.1.0 and peer
`@modelcontextprotocol/server@2.3.0`. Expose only `catalog.list` and `catalog.show`. Test protocol `2025-11-25`
and sessionless `2026-07-28` one-POST clients.

Consequences: Installation and local-state capabilities stay outside this mount. Ordinary CLI installs need no server.
No new Agent Native release or unauthenticated writer is introduced.
Revisit when: vendor documentation or native tests change these contracts.
