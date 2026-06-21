# 081KQZVQW0008QG0R001FG05RZ Source Narrowing - Same-PR Lifecycle Dedup

Date: 2026-05-30
Claim: `claim/codex-b0250-source-narrowing-20260530`

## Summary

This packet narrows the first noisy 081KQZVQW0008QG0R001FG05RZ live signal by treating events from
the same PR lifecycle as one coincidence-window member.

The first live calibration reported `76 event-window coincidence(s)`. A large
share of that warning came from one PR producing several near-simultaneous
observations: a merged PR event, a trajectory-receipt commit event, and nearby
Codex loop-run completion noise. Counting those lifecycle echoes as independent
cross-trajectory evidence overstated the signal.

## Change

`CoincidenceEvent` now has an optional `correlationKey`.

- Merged PR observations use `pr:<number>`.
- Trajectory receipt observations parse PR numbers from squash/merge subjects
  and use the same `pr:<number>` key.
- Coincidence windows deduplicate members by `correlationKey` before applying
  the minimum-event and cross-trajectory checks.

This is deliberately narrower than the full next-action recommendation. It does
not yet gate Codex loop-run events to claim or PR-publishing completions, and it
does not add the compact debug window surface.

## Verification

Focused checks:

```bash
bun test tools/health/factory-health-monitor.test.ts
bun tools/health/factory-health-monitor.ts --json
```

Observed live monitor output after the change:

```text
coincidence: 69 event-window coincidence(s) detected
```

## Next Slice

Gate Codex loop-run observations to claim or PR-publishing completions before
treating them as coincidence evidence, then add a compact top-window debug
surface so operators can see which correlated sources remain.
