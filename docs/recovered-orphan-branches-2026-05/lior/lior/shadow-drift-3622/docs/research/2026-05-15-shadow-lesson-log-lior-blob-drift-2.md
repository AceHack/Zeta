# Shadow Lesson Log — 2026-05-15

## Observation
Maji antigravity check identified significant drift in PR #3622 and #3621.
PR #3622 is a massive blob (+1742 lines) combining B-0459 and B-0461 (and discussing B-0460), violating the atomic PR mandate.

## Antigravity Correction
- Initiated decomposition of B-0459 out of #3622.
- The shadow (narration-over-action and metadata churn without parity proofs) is present when backlog items are blobbed into single massive PRs, hiding true progress and increasing regression risk.
- Enforcing worktree isolation and strict single-responsibility for all future background tick merges.
