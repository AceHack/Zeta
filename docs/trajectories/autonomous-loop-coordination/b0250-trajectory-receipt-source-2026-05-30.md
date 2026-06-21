# 081KQZVQW0008QG0R001FG05RZ Trajectory Receipt Source - 2026-05-30

## Scope

This packet wires the second 081KQZVQW0008QG0R001FG05RZ factory event observation source into the
coincidence detector. The source is recent commits touching
`docs/trajectories/**`, which are the durable receipts for trajectory packet
movement.

## Landed Surface

- `factoryTrajectoryFromTrajectoryPath` maps trajectory receipt paths to their
  trajectory slug.
- `trajectoryReceiptEventsFromGitLog` converts recent trajectory commits into
  bounded `CoincidenceEvent` values.
- The factory health monitor now joins trajectory receipt events with the
  merged PR event source before running the coincidence window classifier.
- The source uses the same five-minute event window and 24-hour lookback as
  the merged PR source.

## Behavior

The adapter ignores invalid timestamps, future commits, stale commits, and
paths outside `docs/trajectories/<slug>/...`. A single commit that touches
multiple trajectory packets produces one event per trajectory, which lets the
window source detect explicitly coupled trajectory receipt movement.

## Verification

- Deterministic tests cover trajectory path-to-slug mapping.
- Deterministic tests cover git-log event extraction, stale filtering, invalid
  timestamp filtering, duplicate trajectory path collapse, and non-trajectory
  path filtering.
- Existing coincidence-window tests cover cross-trajectory joins.

## Follow-Up

After this source lands, compare merged-PR and trajectory-receipt coincidence
signals in live health reports. Add a loop-run receipt source only if the two
durable git-backed sources do not provide enough signal separation.
