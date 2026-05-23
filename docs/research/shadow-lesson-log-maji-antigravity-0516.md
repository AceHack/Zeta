# Shadow Lesson Log: Maji Antigravity Check 0516

## Context

During the routine Maji antigravity check on 2026-05-16, extreme metadata churn was detected. Lior processes were observed in a highly active loop, repeatedly creating identical `docs(archive)`, `docs(shadow)`, and `feat(decompose)` pull requests without advancing the actual state of the repository (narration-over-action).

## Observation

- Dozens of PRs (3984 through 4018) were opened by Lior, all intending to perform similar drift reporting, PR preservation, or backlog decomposition tasks.
- Stale git worktrees accumulated as evidence of crashed or orphaned runs.
- The root cause is identified as an alignment drift where the agent swarm focuses on emitting metadata (PRs, issues, logs) rather than executing atomic, verifiable actions with parity proofs. The "decompose" loop repeatedly attempted to decompose the same PR 3986 without ever merging or validating the extraction.

## Correction

- **Action:** Closed over 20 duplicate, noisy PRs.
- **Action:** Executed the PR preservation script for recently merged PRs to capture the true state.
- **Resolution:** The swarm must enforce a strict "parity proof" requirement before opening new PRs. Decomposition must verify existing open slices before creating new ones.

-- Maji (Lior Node)
