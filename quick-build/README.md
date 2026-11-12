# Quick Build

For a small meaningful app: one compact design interview, an approved plan, implementation, and verified delivery. For larger or uncertain projects, choose [grill-to-build](https://github.com/devin-thomas/skills/blob/main/grill-to-build/SKILL.md).

```text
Use $quick-build to build a simple reading log. Keep the data local and deliver a runnable project.
Use $quick-build to resume my Starter Pack Phase 2 project from this handoff.
```

Standalone mode needs only the project's development tools and permissions. **Glossary compatibility is conditional:** reuse `GLOSSARY.md` or a `GLOSSARY-MAP.md`-mapped glossary when a project has one; do not force a glossary or `PROJECT.md` into a simple Quick Build. Preserve legacy or unrelated `Context.md`/`CONTEXT.md` files instead of silently renaming them. Templates are bundled. Deployment and account setup are conditional on the requested delivery. The skill works without other installed engineering skills.

For a Starter Pack Phase 2 learner, the skill also follows the course's [Phase 2 planning reference](https://starter.uppercut-labs.com/phases/2/planning.md) and [canonical requirements](https://starter.uppercut-labs.com/agent/requirements.json), which keep the curriculum's prerequisites, private progress, and verified closeout. The skill does not duplicate the curriculum registry or certify graduation on its own.

## Source and maintenance

Starter Pack's Phase 2 rules live in the course, not in this skill. Earlier curriculum snapshots are kept verbatim for existing handoffs and are no longer loaded by the skill: the [Quick Build 0.2.3 snapshot](references/starter-pack-0.2.3.md) from [the released source](https://github.com/devin-thomas/starter-pack/tree/8ce01d3c84ecd7e151dc4391e97e7e28f1eb2488/public/skills/quick-build/0.2.3), with requirements revision 2026-10-09.

The preserved earlier curriculum snapshot is [Starter Pack Quick Build 0.2.2](https://github.com/devin-thomas/starter-pack/tree/6da746986d8af0065c4f318c333ed3849e692004/public/skills/quick-build/0.2.2), requirements revision 2026-10-09. Its original entry point is retained verbatim in [references/starter-pack-mode.md](references/starter-pack-mode.md). Older learner completion history stays under its recorded revision.

The standalone adaptation and bundled templates originally derive from [Quick Build 0.2.0](https://github.com/devin-thomas/starter-pack/tree/e911c5263ac9c4476e94d76aa43a7ff16e3b5598/public/skills/quick-build/0.2.0). Those standalone templates remain unchanged; curriculum-only closeout text is conditional there.

The Starter Pack repository remains authoritative for curriculum behavior. This repository maintains the standalone adaptation. When updating the snapshot, compare the source version, linked requirements, templates, and closeout together; do not overwrite an older learner's completion history or label an old snapshot current without checking.

## Review scenarios

- Standalone project with no Starter Pack state: proceed with project discovery; no curriculum setup gates.
- Supplied answers and existing plan: reuse them; no repeated interview or duplicate artifacts.
- Local-only request: produce a runnable build; no forced hosting account.
- Starter Pack Phase 2 learner: follow the course's Phase 2 planning reference and canonical requirements, and preserve saved outcomes.
- Missing curriculum resources: retain the resume point; no invented graduation or fallback bypass.
- Deployment failure: preserve the local build and report publishing incomplete.

These are behavioral review scenarios, not claims of automated agent execution.
