# Working in this skill collection

This repository contains reusable agent instructions, not an application. Use [README.md](README.md) to select a skill for the user's actual task. Merely reading this repository does not invoke every skill or authorize its external actions.

- Read only the selected skill's entry point and references relevant to the current branch.
- Preserve each skill's scope and completion contract. Do not run build, deployment, or account setup workflows while merely reviewing these files.
- Install dependencies explicitly: `surface-sweep-showcase` needs `surface-sweep`; `execute-task-cycles` needs `execute-task`. Resolve installed skills through the host catalog if they are not adjacent.
- Keep public methods separate from personal preferences, machine paths, account identifiers, and credentials. Do not copy local preference files into the public collection.
- Preserve existing public skills. Do not vendor upstream skill bundles just because they are installed locally.
- Keep source attribution and snapshot versions for adapted resources. Starter Pack remains authoritative for curriculum requirements; Quick Build's standalone mode does not certify curriculum completion.
- Before publishing, run `python3 scripts/validate-skills.py`, `node --test tests/pwa-helpers.test.mjs`, and `git diff --check`. Browser probe changes additionally need real-browser verification; syntax checks are insufficient.

No global instructions, specific model, paid connector, or personal account setup is assumed. Respect the active host's tool restrictions and the user's existing authorization.
