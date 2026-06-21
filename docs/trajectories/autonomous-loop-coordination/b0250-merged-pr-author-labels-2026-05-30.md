# 081KQZVQW0008QG0R001FG05RZ Merged PR Author Labels - 2026-05-30

## Status

This packet narrows the 081KQZVQW0008QG0R001FG05RZ merged-PR event source by applying agent
author labels to PR branches that do not carry an explicit lane prefix.

## Context

After the merge-burst clustering packet landed, the live factory health monitor
still reported 16 coincidence windows. The top debug line included verbose
`other:backlog/...` trajectory labels even though the corresponding merge
commit trailers identified Otto-authored work.

Those unknown branch prefixes are not independent trajectories. They are
missing labels for a known agent lane.

## Change

- The merged-PR GitHub query now fetches `mergeCommit` metadata instead of
  full PR commit lists, keeping the source bounded.
- For PR branches already classified by prefix, the branch label remains
  authoritative.
- For unknown PR branches only, the monitor reads the local merge commit
  message and falls back to `Co-Authored-By` / author labels for Codex, Otto,
  Lior, Alexa/Kiro, and Riven.
- Ambiguous unknown branches with more than one known author lane stay under
  their `other:<branch>` label.

## Live Check

After the initial patch, the live monitor reported 15 coincidence windows. A
review follow-up then restricted author detection to trailer-style lines and
removed the unused PR-commit author path. With that stricter parser, the live
monitor reported 16 coincidence windows, but the top windows are now labeled as
Codex/Otto adjacency rather than verbose `other:backlog/...` branch labels, and
the merged-PR source stayed queryable.

## Verification

Focused checks:

```bash
bun test tools/health/factory-health-monitor.test.ts
bun run typecheck
bun tools/health/factory-health-monitor.ts --json
git diff --check
```

## Next Slice

The remaining top windows are real Codex/Otto adjacency. The next 081KQZVQW0008QG0R001FG05RZ slice
should inspect whether the five-minute window is too wide for queue-drain
bursts, or whether a stronger source set is needed before escalating the
coincidence signal.
