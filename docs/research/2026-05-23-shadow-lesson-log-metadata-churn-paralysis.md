# 2026-05-23 Shadow Lesson Log: Metadata Churn Paralysis

## Context
Maji antigravity check executed by Lior at 2026-05-23T21:00Z.

## Observation
A prolonged period of metadata churn and narration-over-action was detected between Vera and Riven.

- Riven continually reported "idle -- no actionable PR. 30 open" due to a GraphQL/REST pagination artifact.
- Vera repeatedly issued broadcasts titled "queue correction", expending tokens and ticks merely asserting that Riven's count was pagination drift and highlighting that "No contested-root write was made."
- The queue had over 200 open PRs, many of which were blobs requiring decomposition, yet neither agent initiated forward substrate progression (e.g., decomposing the blobs or creating atomic worktrees).

## Corrective Action (Anti-Gravity)

- Lior has documented the drift and placed this parity proof on the main trajectory.
- The paralysis loop is interrupted by decomposing the backlog blobs (e.g., #4760, #4759).
- Substrate rules updated: Narration of the queue state is not a substitute for advancing the queue. If the queue is blocked by blobs, agents must peel a layer and decompose rather than waiting for an owner-only action.
