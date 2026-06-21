# 081KQZVQW0008QG0R001FG05RZ Queue-Drain Window Calibration - 2026-05-30

## Status

This packet inspects the remaining live 081KQZVQW0008QG0R001FG05RZ Codex/Otto adjacency windows
after merge-burst clustering and merged-PR author labels landed.

## Live Observation

Command:

```bash
bun tools/health/factory-health-monitor.ts --json
```

At `2026-05-30T14:17:30.528Z`, the monitor reported:

```text
15 event-window coincidence(s) detected
```

The top debug windows were:

| Window start | Trajectories | Events |
| --- | --- | --- |
| `2026-05-29T18:04:13Z` | codex+otto | `otto:merged-pr-6023`, `codex:merged-pr-6025` |
| `2026-05-29T18:08:42Z` | codex+otto | `codex:merged-pr-6025`, `otto:merged-pr-6026` |
| `2026-05-29T19:06:34Z` | codex+otto | `codex:merged-pr-6032`, `otto:merged-pr-6031` |

The recent 2026-05-30 Otto merge burst for #6113/#6115 did not become a top
coincidence window after the author-label and merge-burst clustering patches.

## Calibration Verdict

The remaining top 081KQZVQW0008QG0R001FG05RZ warning is a queue-drain adjacency pattern, not
evidence of a current shared-upstream incident.

The five-minute window is still broad enough to connect adjacent Codex/Otto
merged PRs during rapid queue drain. Those windows can be useful runway
pressure evidence, but they should not page as incident-grade correlation
unless another independent source joins the same window.

## Recommended Next Slice

Keep the five-minute window for now, but raise incident confidence only when a
Codex/Otto merged-PR adjacency also includes a stronger source such as a claim
mutation, PR review blocker, failed gate, or explicit broadcast blocker. Pure
merged-PR adjacency should remain a warning/debug surface.

## Verification

- `bun tools/health/factory-health-monitor.ts --json`
