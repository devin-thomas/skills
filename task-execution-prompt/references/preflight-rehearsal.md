# Read-Only Preflight Rehearsal

Validate the created or revised prompt without beginning its execution pass.

## Safety boundary

Permit only reads of repository files, Git state, documentation, and task-source state. Do not:

- claim or assign a task;
- change tracker or checkbox state;
- add comments or notes;
- edit implementation files;
- stage or commit;
- push, open a pull request, deploy, publish, or start a live implementation service.

If an authoritative read requires authentication that is unavailable, report rehearsal failure rather than substituting guessed state.

## Rehearsal steps

1. Re-read the written prompt as the sole workflow contract.
2. Verify structural invariants:
   - autostart behavior;
   - one bounded pass;
   - fresh-state discovery;
   - no hard-coded current task identifier;
   - mechanical selection;
   - authority order;
   - completion gate;
   - terminal report;
   - final stop instruction.
3. Resolve every referenced repository path and instruction source.
4. Read current task-source state using the prompt's specified source and scope.
5. Compute active/owned tasks, blocker completion, human gates, authoritative critical/security signals, declared order, and stable tie-breakers.
6. Predict exactly one selected task or one valid terminal state.
7. Check that lifecycle, commit, tracker-update, and publication ordering is internally consistent.
8. Check that protected-resource rules and validation commands match repository evidence.
9. Confirm that no write occurred during rehearsal.

## Result

Report:

- Prompt path.
- Predicted task identifier/title or terminal state.
- Selection evidence and tie-breakers.
- Structural invariant results.
- Referenced-path and command checks.
- Confirmation that lifecycle, implementation, Git, and external systems were not mutated.
- Ambiguities or defects requiring revision.

If a defect exists, revise the prompt, show the diff, and rerun this rehearsal. Do not approve a prompt whose current state selects multiple tasks, relies on guessed tracker state, references missing authority, or has an impossible completion order.
