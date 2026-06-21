# 081KQZVQW0008QG0R001FG05RZ Post-Increase Debug Calibration - 2026-05-30

## Status

This receipt is under PR review on claim branch
`claim/codex-loop-b0250-post-increase-debug-calibration-20260530`. The live
claim file is released in this branch before merge.

## Live Observation

After PR #6103 merged the claim-increase gate, the live factory health monitor
reported:

```text
29 event-window coincidence(s) detected
```

The compact debug line's first three windows were:

```text
2026-05-29T16:08:49Z..2026-05-29T16:13:49Z trajectories=other:feat/b0343-build-get-tree-request-2026-05-29+otto events=otto:merged-pr-6006,other:feat/b0343-build-get-tree-request-2026-05-29:merged-pr-6007
2026-05-29T17:38:49Z..2026-05-29T17:43:49Z trajectories=other:backlog/b-0347-carve-7-over-150-char-skill-descriptions-2026-05-29+otto events=otto:merged-pr-6019,other:backlog/b-0347-carve-7-over-150-char-skill-descriptions-2026-05-29:merged-pr-6020
2026-05-29T18:04:13Z..2026-05-29T18:09:13Z trajectories=codex+other:backlog/b0347-carve-routing-budget-batch-2026-05-29+otto events=other:backlog/b0347-carve-routing-budget-batch-2026-05-29:merged-pr-6023,otto:merged-pr-6024,codex:merged-pr-6025
```

## Calibration

The remaining top windows are not dominated by Codex loop-run events. They are
merged-PR / trajectory-owner pairings, including one older Codex merged-PR
window from PR #6025. The claim-increase gate therefore did its intended job:
current Codex forward-gate completions no longer appear as the noisy source in
the compact debug surface.

Do not split the Codex runner-log source further on this evidence. The next
bounded source-tuning slice should target trajectory ownership labels or
same-merge-burst PR clustering, not loop-run lifecycle direction.

## Verification

- `bun tools/health/factory-health-monitor.ts --json`
- `bun run lint:markdown docs/trajectories/autonomous-loop-coordination/b0250-post-increase-debug-calibration-2026-05-30.md docs/trajectories/autonomous-loop-coordination/RESUME.md`
- `git diff --check`
