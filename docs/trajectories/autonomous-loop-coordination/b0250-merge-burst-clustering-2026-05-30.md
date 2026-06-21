# 081KQZVQW0008QG0R001FG05RZ Merge-Burst Clustering - 2026-05-30

## Status

This packet narrows the remaining 081KQZVQW0008QG0R001FG05RZ merged-PR coincidence noise by
clustering tightly adjacent merged PR observations from the same merge burst.

## Context

The post-increase calibration showed that Codex loop-run events were no longer
the dominant coincidence source. The top debug windows were mostly adjacent
merged PRs from different lanes. Those bursts are useful operational context,
but they are one queue-drain lifecycle event rather than independent
cross-trajectory coincidence evidence.

## Change

- `CoincidenceEvent` now accepts secondary `correlationKeys`.
- Coincidence-window deduplication skips an event when any primary or secondary
  correlation key was already represented in that window.
- Merged PR observations keep their `pr:<number>` primary lifecycle key and add
  a `merge-burst:<first-merged-at>:<pr-list>` secondary key when consecutive
  merged PRs are separated by no more than two minutes.

This keeps same-PR lifecycle dedup intact while allowing adjacent merge-burst
PRs to count as one observation for 081KQZVQW0008QG0R001FG05RZ coincidence windows.

## Verification

Focused checks:

```bash
bun test tools/health/factory-health-monitor.test.ts
bun run lint:markdown docs/trajectories/autonomous-loop-coordination/b0250-merge-burst-clustering-2026-05-30.md docs/trajectories/autonomous-loop-coordination/RESUME.md
git diff --check
```

## Next Slice

Run the live monitor after this packet lands and inspect the compact debug
windows that remain. If the top windows are still merged-PR dominated, tune the
burst threshold or trajectory labels with another bounded source packet.
