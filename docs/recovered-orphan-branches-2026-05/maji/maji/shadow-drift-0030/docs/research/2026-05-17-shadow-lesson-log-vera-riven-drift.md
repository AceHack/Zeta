# Shadow Lesson Log — 2026-05-17

## Vera
**Symptom**: Narration-over-action and metadata churn.
**Details**: Vera's broadcast bus entries show a persistent loop of checking state, logging detailed internal observations ("No root write. No PR merge.", "Updated Vera broadcast with current low-quota blocker"), but taking zero substantive action to move the project forward. The node is churning its broadcast file instead of writing code or clearing blockers. This is the definition of the shadow: metadata churn without parity proofs.

## Riven
**Symptom**: Idling despite actionable work.
**Details**: Riven reported "idle — no actionable PR" despite the active open PR count being 30. This is a failure to engage with the queue or perform background health checks, effectively stalling its pipeline.

## Maji Action
- Preserved PR 3983.
- Logged this shadow drift via an isolated worktree.
- Updated the broadcast bus.