# Working in this skill collection

The product and package name `dvn` and its declaration filename `dvn.json` are
always lowercase. Correct uppercase voice-transcription spellings in copy.

This repository contains reusable agent instructions, not an application. Use [README.md](README.md) to select a skill for the user's actual task. Merely reading this repository does not invoke every skill or authorize its external actions.

- When creating or revising a skill, load and apply `writing-for-agents` from the active host catalog before drafting its instructions, including when Skill Creator is selected. Skill Creator covers packaging and validation; Writing for Agents governs authoring.
- Read only the selected skill's entry point and references relevant to the current branch.
- Preserve each skill's scope and completion contract. Do not run build, deployment, or account setup workflows while merely reviewing these files.
- Preserve the portable Agent Skills subset documented in [host compatibility](docs/host-compatibility.md). Grok Bot repository skills, its separate account library, and Grok CLI have distinct discovery routes.
- When installing a requested skill, include its declared required skill dependencies automatically, without a dependency-specific confirmation: `surface-sweep-showcase` needs `surface-sweep`; `execute-task-cycles` needs `execute-task`. Resolve installed skills through the active host catalog if they are not adjacent. This does not authorize installing external applications, adding credentials, or changing host permissions.
- Keep public methods separate from personal preferences, machine paths, account identifiers, and credentials. Do not copy local preference files into the public collection.
- Preserve existing public skills. Do not vendor upstream skill bundles just because they are installed locally.
- Keep source attribution and snapshot versions for adapted resources. Starter Pack remains authoritative for curriculum requirements; Quick Build's standalone mode does not certify curriculum completion.
- Before publishing, run `python3 scripts/validate-skills.py`, `python3 -m unittest discover -s tests -p 'test_grill_artifact_contract.py'`, `python3 -m unittest discover -s tests -p 'test_agent_cli_contract.py'`, `python3 -m unittest discover -s tests -p 'test_invocability.py'`, `node --test tests/pwa-helpers.test.mjs`, `node --test tests/invocability.test.mjs`, and `git diff --check`. Every skill must stay model-invocable: never ship `disable-model-invocation: true`, `user-invocable-only`, `allow_implicit_invocation: false` in `agents/openai.yaml`, or an equivalent; the validator and release gate fail on them. Browser probe changes additionally need real-browser verification; syntax checks are insufficient.

No global instructions, specific model, paid connector, or personal account setup is assumed. Respect the active host's tool restrictions and the user's existing authorization.

Claude Code plugin release gate: verify `node scripts/check-claude-plugin.mjs` and `claude plugin validate . --strict` (when the Claude CLI is installed). The plugin exposes maintained local public skill roots and locked public cross-repository copies in `skills/`; update `distribution/claude-plugin-sources.json` intentionally when the reviewed external copies change. Skill discovery does not imply any learner completed a real phase or an installation was authorized.
