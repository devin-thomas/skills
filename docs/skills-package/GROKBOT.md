# Grok Bot account library

## Two distinct destinations

Grok Bot repository work discovers `.agents/skills/<id>/SKILL.md` with sibling resources, according to the
user's direct Bot report. Its chat-wide library is on the Bot execution computer at
`/home/box/agent-data/workflows/<id>/SKILL.md`, with `scripts/`, `references/`, and `assets/` beside the entrypoint.
This account path comes from a second direct Bot report supplied by the user, not a public API or native acceptance
run. Grok CLI remains a separate host with `.grok/skills` routes. [H11, H12 in SOURCES.md]

## Install on the Bot computer

The Bot must run the package on its own execution computer as the `box` user. For example:

```sh
npm install -g @uppercut-labs/skills
uppercut-skills doctor --host grokbot --global
```

On a fresh, qualified Bot runtime, the global npm postinstall copies all bundled curated skills and their support
files. An ordinary local install or an install on another machine leaves the library untouched. If a managed Bot
installation already exists, postinstall preserves it and prints an explicit update command, retaining saved source
channels and local edits. Unowned destination files or changed managed files cause the transaction to fail.
`update` and `remove` use the same receipts. `--global` does not copy from the user's computer to the Bot computer.
The lifecycle refuses root writes rather than silently installing files with the wrong owner.

Some npm configurations block package install scripts. If npm reports that this package's postinstall was blocked,
run `uppercut-skills add <id> --host grokbot --global` explicitly on the Bot computer, or approve the package's
postinstall through that npm installation's normal policy and rerun it. A successful npm package install alone does
not prove the skills were copied; use `uppercut-skills doctor --host grokbot --global` and inspect the Bot skill selector.

The explicit CLI route remains available for selected skills, for example
`uppercut-skills add execute-task-cycles --host grokbot --global`.

The adapter accepts account scope only on Linux when the process runs as a non-root user with home `/home/box`, the
existing library resolves to `/home/box/agent-data/workflows` without a symlink, and that directory belongs to the
process user. Outside that context it returns `unsupported-account-scope` before writing. This is a conservative
path check, not cryptographic proof of Bot identity. An existing directory is required; the package will not create
a guessed account library on another computer.

Project scope continues to use `.agents/skills/<id>/` in the selected repository. Do not use `.grok/skills`,
`.claude/skills`, `.cursor/skills`, or Node's global module directory as the Bot account library.

## Acceptance

On a real Grok Bot session, verify `add`, visibility in the Bot's skill selector, invocation by name, access to a
sibling support file, dependency loading, `update`, and managed `remove`. Record the Bot version, execution user,
selected scope, and evidence without putting private account data in this repository. Unit tests prove path gating
and installer behavior; they do not prove that Bot discovers a copied skill in its native library.
