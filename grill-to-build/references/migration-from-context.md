# Migration to GLOSSARY.md and PROJECT.md

## Why this is breaking

Matt Pocock skills v1.3 (v1.3.1 documentation) changed domain model filenames from `CONTEXT.md` / `CONTEXT-MAP.md` to **`GLOSSARY.md` / `GLOSSARY-MAP.md`**. New upstream skills read only the new names. The glossary must contain terms only, not a project brief.

Upstream: https://www.aihero.dev/skills/skills-changelog-v13-implement-spec-pr-retro-and-glossary-md

Grill's historical `Context.md` was **broader** than Matt's glossary: it stored goals, constraints, accepted behavior, discovery progress, unanswered questions, workflow preferences, and models. A simple filename swap would make an invalid glossary. Grill now uses `GLOSSARY.md` for settled vocabulary and `PROJECT.md` for that broader project understanding. This is a breaking file/schema contract for existing Grill projects and file-name consumers, even though no product intent should change.

## New files

- `GLOSSARY.md`: only canonical domain terms (brief definitions and optionally `_Avoid_` synonyms). Create lazily when a term is settled.
- `GLOSSARY-MAP.md`: optional pointer to multiple bounded per-domain `GLOSSARY.md` files, not a dumping ground.
- `PROJECT.md`: living project brief, constraints, agreed behavior, open questions, question/round count, models and explicit workflow preferences.
- Keep `ADR.md`, `Ideas.md`, `SPEC.md`, and tickets as before; preserve compatible alternative ADR or ticket layouts.

## Migrating an existing repository

1. Inspect all of `GLOSSARY.md`, `GLOSSARY-MAP.md`, `PROJECT.md`, `Context.md`, `CONTEXT.md`, `CONTEXT-MAP.md`, relevant ADRs, SPEC, and references. Identify which old files belong to Grill versus another project convention.
2. For a *pure glossary* from Matt's old skills, do `git mv CONTEXT.md GLOSSARY.md` and, if relevant, `git mv CONTEXT-MAP.md GLOSSARY-MAP.md`. Update paths within the map and rename the pointed-at glossary files too.
3. For a *mixed* Grill `Context.md`, split it: canonical entity/role/status/lifecycle terms go into `GLOSSARY.md`; goals, feature scope, behavior, constraints, decisions-in-force, questions, discovery count, preferences, links, and editable models go into `PROJECT.md`. Keep accepted ADR history intact. Do not add empty placeholder glossaries or reinterpret decisions as mere definitions.
4. If destinations already exist, reconcile them deliberately. Do not overwrite, duplicate the same term in both files, or silently create a fresh glossary beside an unmigrated legacy file.
5. Update README, agent rules, templates, runbooks, external-model links, and automated consumers that refer to old names. Preserve unrelated English uses of "context."
6. Validate that **every substantive heading and unanswered question survived** in the appropriate destination; check map links, round count, glossary definitions and ADR references. Only then retire the old file in one reviewed Git migration. If uncertain, leave the legacy file untouched and report the blocker instead of losing data.

For Windows/case-sensitive cross-platform interoperability, write exactly `GLOSSARY.md`, `GLOSSARY-MAP.md`, and `PROJECT.md`.

## Example

Legacy `Context.md`:

```md
# Context
## Goal
Publish listener playlists without accounts.
## Ubiquitous Language
Published Playlist: an immutable ordered sequence of recording IDs.
## Agreed Rule
Privatization permanently revokes the public link.
## Open Questions
Maximum playlist length?
## Workflow Preferences
Diagram format: Graphviz DOT.
```

New `GLOSSARY.md`:

```md
# Glossary
## Published Playlist
An immutable ordered sequence of canonical recording IDs.
```

New `PROJECT.md`:

```md
# Project
## Goal
Publish listener playlists without accounts.
## Agreed Rule
Privatization permanently revokes the public link.
## Open Questions
Maximum playlist length?
## Workflow Preferences
Diagram format: Graphviz DOT.
```

## Consumer and version notes

Update `task-execution-prompt` and other tools to read `GLOSSARY-MAP.md` / `GLOSSARY.md` for vocabulary and `PROJECT.md` where available for project state. Legacy context names are **migration detection only**, not permanent secondary write targets. Existing projects are not automatically migrated by installing updated skills.

Because `@uppercut-labs/skills@0.1.0` has already been published, communicate this before the next release as a pre-1.0 breaking change (normally `0.2.0`). This branch does not itself publish or merge.
