# Uppercut Skills v1 tickets

## SKP-001 Portable repository contract

Status: in progress

Depends on: none

### Work

Document the five supported hosts and strengthen local `SKILL.md` validation to the portable subset required across Codex, Claude Code, Cursor, and Antigravity. Preserve host-specific metadata as optional extras rather than prerequisites.

### Done when

All local skills pass name/description portability checks, host paths and evidence rules are documented, and Grok Bot is explicitly modeled as account-level.

### Verification

Run `python3 scripts/validate-skills.py` and inspect the host compatibility matrix against current primary documentation.

## SKP-002 Package scaffold and catalog channels

Status: not started

Depends on: SKP-001

### Work

Create the Node.js 22+ TypeScript package `@uppercut-labs/skills`, package metadata, bin entry, stable manifest snapshot, and live-manifest resolver.

### Done when

`npx` from a packed tarball can run `list`; stable uses the bundled manifest and `--latest` uses the current GitHub manifest.

### Verification

Unit tests with local HTTP fixtures plus `npm pack --dry-run`. No live GitHub dependency in deterministic unit tests.

## SKP-003 Dependency planner and source materialization

Status: not started

Depends on: SKP-002

### Work

Resolve transitive `skillId` prerequisites, cycle-check the graph, fetch complete skill directories from canonical repositories at exact source revisions, validate them before writes, and support `-nd`.

### Done when

Installing `execute-task-cycles` plans `execute-task` first without prompting; `-nd` plans only the requested skill; bad/cyclic graphs fail before mutation.

### Verification

Positive, transitive, duplicate, missing, cycle, malformed bundle, and source-hash fixtures.

## SKP-004 Local host adapters and detection

Status: not started

Depends on: SKP-003

### Work

Implement Codex, Claude Code, Cursor, and Antigravity project/global destinations, active-host detection, atomic copy/update behavior, and ownership receipts.

### Done when

Each host can install, rediscover, update, and remove an owned fixture without touching unrelated files. Codex/Cursor/Antigravity project installs share `.agents/skills/`.

### Verification

Temporary-home integration tests on Windows/macOS/Linux CI where practical plus real host discovery checks.

## SKP-005 Grok Bot adapter

Status: not started

Depends on: SKP-003

### Work

Implement an account-library adapter. Detect and use a verified `gbot skills` transport when present without handling raw session credentials. Add a truthful blocked/manual/plugin result when no programmatic transport is available.

### Done when

A real Grok Bot account can list and add a fixture skill through the supported adapter, and absence of the optional transport never produces false installation success.

### Verification

Real account acceptance with a harmless fixture, duplicate-name behavior, remove-by-owned-id behavior, and credential redaction review.

## SKP-006 Agent Native capability layer and CLI

Status: not started

Depends on: SKP-002, SKP-003, SKP-004, SKP-005

### Work

Define versioned Agent Native capabilities for list/add/update/remove/doctor. Bind them locally and map a small human CLI parser onto them. Export the registry/definitions for programmatic use.

### Done when

Human CLI and programmatic execution share the same validation and operation results, while ordinary CLI use needs no server.

### Verification

Capability schema tests, authorization tests, JSON result tests, and one programmatic consumer fixture.

## SKP-007 Release acceptance

Status: not started

Depends on: SKP-006

### Work

Add end-to-end tests, documentation, package provenance/release workflow, license decision for package code, and npm publication.

### Done when

Five real host acceptance checks are recorded, `npm pack` contains only intended files, package provenance is verifiable, and `@uppercut-labs/skills` is publicly installable.

### Verification

Repository validation, TypeScript checks, unit/integration suite, clean-machine packed-package install, host discovery evidence, and post-publish `npx` smoke test.
