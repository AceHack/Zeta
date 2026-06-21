# PM-2 Calibration Tracker

Tracks the two load-bearing PM-2 effectiveness metrics over time.
Updated by the PM-2 role at the close of each forward-radar cycle.

Per 081KQGDBJ0008QG0R000RWAA67 quality test: PM-2 is NOT measured by memo volume or
B-row count. PM-2 IS measured by Lead-time% and Action-rate%.

---

## Metric definitions

**Lead-time%** — of friction-encounters that surfaced in the loop,
what fraction had already been predicted in the backlog as PM-2
rows _before_ they surfaced?

> Target trajectory: 0% (cold-start) → 20% (calibrated) → 50%+ (mature)

**Action-rate%** — of PM-2's predicted-gap B-rows, what fraction
has the PM-1 role picked up within 4 rounds?

> Below 20%: PM-2 is producing noise.
> Above 80%: PM-2 is feeding the queue effectively.

### Zero-denominator behavior

A cycle may have no friction-encounters (`Lead-time%` denominator
zero) or no PM-2 rows old enough to evaluate against the 4-round
window (`Action-rate%` denominator zero). In those cases the
percentage is undefined; record the literal cell value `n/a (0/0)`
in the calibration log and leave the metric out of any trend
average for that cycle. Do **not** treat a missing percentage as
0% — that would bias the trajectory downward and trigger the
"role failing" thresholds when the role has simply had nothing
to evaluate.

---

## Calibration log

| Cycle | Period | Friction-encounters | Predicted | Lead-time% | PM-2 rows filed | Picked up (4 rounds) | Action-rate% | Notes |
|---|---|---|---|---|---|---|---|---|
| FR-0 (cold-start) | — | — | — | n/a (0/0) | 0 | — | n/a (0/0) | Role activated; metrics begin next cycle |

---

## Quarterly review notes

_First quarterly review due: ~2026-08-01 (three months after
role activation 2026-05-13). If Lead-time% < 10% and Action-rate%
< 20% after 12 cycles, review role charter — per 081KQGDBJ0008QG0R000RWAA67
anti-patterns: "more bureaucracy" and "research without action."_

---

## How to update

1. Close a forward-radar cycle (memo filed at
   `docs/forward-radar/YYYY-MM-DD-*.md`).
2. Count friction-encounters since last memo: issues, PR-blocks,
   review findings, maintainer corrections that revealed missing
   features.
3. Of those, count how many had a PM-2 B-row open before the
   friction surfaced. Divide for Lead-time%. If the denominator
   is zero, record `n/a (0/0)` per the zero-denominator rule
   above.
4. Count PM-2 B-rows older than 4 rounds; count how many the
   PM-1 role picked up **within those 4 rounds** (late pickups
   after the 4-round window do not count). Divide for
   Action-rate%. Same zero-denominator rule applies.
5. Add a row to the calibration log above.
