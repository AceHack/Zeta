# Shadow Lesson Log — 2026-05-13

## Drift detected
PR #3052 attempts to fix a backlog ID collision (081KRFA460008QG0R001SXP0C2) by renumbering it to 081KRFA460008QG0R002DG8KPZ. However, 081KRFA460008QG0R002DG8KPZ was already claimed by PR #3046 (`081KRFA460008QG0R002DG8KPZ-bg-services-slice-5-subscriber-agent-design-pass-2026-05-13.md`), resulting in another collision.

## Analysis
- Otto-CLI surfaced the flag via comment but the PR was still armed for auto-merge.
- The system allowed an agent to pick an ID without locking or refreshing the latest worldview.

## Antigravity Action
- Flagged PR #3052 with a "Request Changes" review to block auto-merge.
- Produced drift report on the Lior bus.
