# Uppercut Labs skills — Claude Code plugin

This optional Claude Code plugin follows the [EditBay marketplace approach](https://github.com/devin-thomas/editbay) and exposes every public skill from the [20-entry catalog](../manifest/skills.json). It is a distribution surface, not a new set of Starter Pack requirements.

## Install once

```sh
claude plugin marketplace add devin-thomas/skills
claude plugin install uppercut-skills@uppercut-labs
```

In a Claude Code session check `/plugin`, then invoke `/uppercut-skills:start`. For direct access use `/uppercut-skills:starter-pack`, `/uppercut-skills:computer-setup`, `/uppercut-skills:grill-to-build` or `/uppercut-skills:quick-build`. Installed skills are namespaced `/uppercut-skills:<skill-id>`. Update through Claude Code's plugin management when new plugin versions are published; don't stack another global skills installation to advance a phase.

Seventeen skills are read from their maintained directory roots in this repository using explicit manifest skill paths. Three approved external public snapshots are physically copied under `skills/`: the curriculum Starter Pack companion, Computer Setup and VidChopperCLI. The actual full skill directories include reference files and metadata. The [source lock](../distribution/claude-plugin-sources.json) records every external file's upstream Git blob SHA and source commit. The plugin has its **own version**, independent of npm's historical pins and the separately deployed live Starter Pack service.

## Learner contract

The plugin provides instructions, not a completed course, internet connectivity, a GitHub login, Tailscale, paid services, deployment credentials or computer permissions. Starter Pack remains authoritative: Phase 1 phone outcomes, Phase 2 computer setup and private progress, separately verified remote connection and file transfers, approved planning, a working deployed app and a final verified remote progress save, with optional Phase 3 after completion. Full **course** Grill to Build is the Phase 2 default. Quick Build requires the learner's explicit choice. The general-purpose Grill and Quick Build skills do not replace curriculum requirements; in course mode they defer to current course-specific guidance.

Hosted progress guides, schemas, phase packets and teaching resources remain focused web resources, not silently frozen into this plugin. If unavailable, preserve the learner's state and explain the exact blocker; don't guess requirements or infer graduation. Preserve progress across tool changes without claiming chat memory crosses hosts. Actions still need appropriate host permissions and learner approvals. Reuse healthy tools and existing work rather than repeating onboarding.

## Release acceptance

1. Run `node scripts/check-claude-plugin.mjs` to verify the 20 public skills, external snapshot hashes, and marketplace inventory.
2. On a machine with Claude Code installed run `claude plugin validate . --strict`, then install into a fresh profile and confirm all four key skills resolve natively. Offline manifest checks are not equivalent to native validation.
3. With synthetic nonsecret progress, test new Phase 1 and returning Phase 2 learners; verify no extra skill install, wrong Quick Build routing, repeated answered questions, or false setup/deployment/closeout proof.
4. Verify hosted guide availability and separate target-device behavior before declaring the course experience validated. Installing the plugin never certifies the learner's real app.

This repository has source-specific licenses and rights; copying the course companion into the plugin does not relicense the whole Starter Pack curriculum. Do not copy credentials, private files or global personal settings into this distribution.
