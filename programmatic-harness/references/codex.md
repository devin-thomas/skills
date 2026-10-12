# Codex local setup

## Eligibility and opt-in

Use Node.js 22 or newer and an installed Codex CLI. Sign in through Codex's managed ChatGPT account flow with `codex login`. The harness checks that the account is managed by ChatGPT without refreshing or printing credentials. API-key account mode is rejected; there is no API-billing fallback. Never copy Codex credential files, ask for an API key, or include account details in logs.

The learner explicitly opts in before installing Agent Native or running inference. Keep the proof in a disposable project/workspace. Skill installation and catalog operations do not install Agent Native into the host project.

## Install pinned releases

Install the skill CLI from its versioned GitHub release tarball so the command knows this catalog ID and the bundled skill provenance is fixed. Download the archive and adjacent checksum file, compare SHA-256, then run the verified CLI tarball through npm's temporary package runner:

```sh
curl -fL -o uppercut-labs-skills-0.1.1.tgz https://github.com/devin-thomas/skills/releases/download/v0.1.1/uppercut-labs-skills-0.1.1.tgz
curl -fL -o uppercut-labs-skills-0.1.1.tgz.sha256 https://github.com/devin-thomas/skills/releases/download/v0.1.1/uppercut-labs-skills-0.1.1.tgz.sha256
shasum -a 256 -c uppercut-labs-skills-0.1.1.tgz.sha256
npm exec --yes --package=./uppercut-labs-skills-0.1.1.tgz -- uppercut-skills add programmatic-harness --host codex --project "$PWD"
```

This installs skill content only; the temporary CLI does not add dependencies to the host project. On Linux, use `sha256sum -c` in place of `shasum -a 256 -c`. Stop if the checksum is missing or does not match. Never substitute a branch archive or an unchecked tarball.

The learner separately opts in to install Agent Native 0.1.1 in a disposable project:

```sh
npm install --save-exact @uppercut-labs/agent-native@0.1.1
```

If the registry release is unavailable, fetch and verify the adjacent checksum for the exact public release asset before installing it:

```sh
curl -fL -o uppercut-labs-agent-native-0.1.1.tgz https://github.com/uppercut-labs/agent-native/releases/download/v0.1.1/uppercut-labs-agent-native-0.1.1.tgz
curl -fL -o uppercut-labs-agent-native-0.1.1.tgz.sha256 https://github.com/uppercut-labs/agent-native/releases/download/v0.1.1/uppercut-labs-agent-native-0.1.1.tgz.sha256
shasum -a 256 -c uppercut-labs-agent-native-0.1.1.tgz.sha256
npm install --save-exact ./uppercut-labs-agent-native-0.1.1.tgz
```

The verified Agent Native 0.1.1 release asset SHA-256 is `a1ce884f89eadba319d6fbad5c9b09b05575a7ab15998bcfd4a6ad8cc8228fbb`.

## Run the fixed proof

From the disposable project with the package installed:

```sh
node ./codex-proof.mjs --model gpt-5.6-luna --name Codex
```

From the disposable project root, copy the skill's script and run it:

```sh
cp .agents/skills/programmatic-harness/scripts/codex-proof.mjs ./codex-proof.mjs
node ./codex-proof.mjs --model gpt-5.6-luna --name Codex
```

The script uses `createCodexHarnessAdapter({ model, effort: 'low' })`, opens an explicit local temporary workspace, writes and verifies `hello world`, closes its owned session process, resumes the same session through a fresh adapter and checks the exact session reference, writes and verifies `hello Codex`, then closes and removes the workspace. It requires Agent Native 0.1.1. Model selection is explicit; choose a model available to the user's Codex account. The example model reflects the verified runtime evidence, not a current availability guarantee.

Codex CLI 0.145.0 exposes `codex exec --model <MODEL> --cd <DIR> <PROMPT>` for direct one-shot CLI work. This harness uses the supported app-server protocol through Agent Native instead, because it must preserve and resume a session; do not replace it with unrelated `codex exec` invocations.
