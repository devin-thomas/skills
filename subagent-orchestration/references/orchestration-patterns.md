# Orchestration Patterns

Use the dependency graph to choose a topology; only create workers for real
independent work units.

## Map / reduce

Partition broad investigations by subsystem, directory, source family, or
platform. Have workers return concise evidence, caveats, and confidence.
The root agent deduplicates and synthesizes.

## Hypothesis fan-out

Assign independent suspected causes, including the evidence that would
support or falsify each. Prefer reproduction over speculation; root compares.

## Disjoint implementation

Freeze shared interfaces where possible. Each worker owns specific files
or an isolated worktree. Root owns cross-cutting files and final integration.

## Implement + verify

One worker implements. Another independently defines checks or looks for
regressions without copying the implementation's reasoning. Root reconciles.

## Adversarial review

Ask a reviewer to falsify a concrete proposal with counterexamples and
evidence. Address substantive objections, not just a numeric consensus.

## Sequential pipeline

Do not spawn downstream stages before dependencies exist. Fan out *within*
independent discovery, implementation, and verification stages.

## Worker count and nested delegation

Start with the count of useful independent work units, then cap it at
configured and native limits. Do not start more workers merely because a
higher limit is available. Nested delegation only when supported, bounded,
and needed for a worker's independently decomposable task.
