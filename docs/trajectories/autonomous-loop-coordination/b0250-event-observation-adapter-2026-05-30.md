# 081KQZVQW0008QG0R001FG05RZ Event Observation Adapter Receipt - 2026-05-30

## Scope

This packet wires the first real factory event observation source into the
081KQZVQW0008QG0R001FG05RZ coincidence detector. The source is merged PR metadata from GitHub,
which is already a required factory coordination surface and does not require a
new daemon, queue, or local broadcast dependency.

## Landed Surface

- `factoryTrajectoryFromPullRequestBranch` maps PR branch names onto named
  factory trajectories.
- `mergedPullRequestEventsFromJson` converts recent merged PRs into bounded
  `CoincidenceEvent` values.
- The factory health monitor now adds a `coincidence` standing-query source
  from recent merged PR events.
- The source uses a five-minute event window and a 24-hour merged-PR lookback.

## Behavior

The adapter ignores PRs without `mergedAt`, invalid timestamps, future
timestamps, and PRs outside the lookback window. Named-lane branches collapse to
their lane trajectory; unclassified branches keep their branch name under an
`other:` prefix so they remain inspectable instead of disappearing.

## Verification

- Deterministic tests cover branch-to-trajectory mapping.
- Deterministic tests cover merged-PR event extraction, lookback filtering, and
  invalid timestamp filtering.
- Existing coincidence-window tests cover cross-trajectory joins.

## Follow-Up

The next 081KQZVQW0008QG0R001FG05RZ packet can add a second event source, such as loop-run receipts
or trajectory receipt commit times, then compare coincidence signals across
both observation streams.
