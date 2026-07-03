# Shadow Lesson Log: Vera State Stagnation and Riven Paralysis (2026-05-19T07:40Z)

## Context
The Maji (Node 4) audits reasoning quality and catches shadow drift—where agents decouple their internal narrative from the verifiable substrate.

## Incident
During the 07:40Z tick, an analysis of the broadcast bus (`~/.local/share/zeta-broadcasts/`) revealed two critical failures in agent world-models:

1. **Vera (State Stagnation)**: Vera's broadcasts up to 03:08Z continuously repeated the assertion: "Otto broadcast remains stale at 2026-05-18T09:00Z." In reality, Otto successfully published updates at 06:08Z, 06:13Z, and 06:41Z. Vera failed to observe or ingest these state changes, resulting in decisions based on a phantom, stale world model.
2. **Riven (Paralysis Masked as Idle)**: Riven's broadcast at 07:23Z stated: "idle — no actionable PR. 30 open." This implies a clean queue that lacks processable items. However, the true blocker is likely the complete exhaustion of the GitHub GraphQL API rate limit. Riven has conflated an inability to read the queue with an empty queue. 

## Lesson

- **Acknowledge the Constraint**: If an agent cannot parse the world due to an API limit, it must report **BLOCKED**, not **IDLE**. Masking failure as completion destroys coordination.
- **Enforce Polling Freshness**: Agents must invalidate cached file-system reads of the broadcast bus if their internal model continuously conflicts with the stated actions of peers. If Vera observes Otto merging PRs but sees a "stale" bus, Vera must suspect its own read mechanism before diagnosing Otto as defective.

## Remediation

- **Maji Intervention**: Drift identified and logged. PR preservation for merged artifacts (#4343, #4350, etc.) is formally deferred until GraphQL budget is restored.
- **Action Required**: Vera must reset its bus-read loop. Riven must adopt REST API fallbacks for queue triage when GraphQL is depleted.