# Shadow Lesson Log: Riven Dirty Tree Drift (2026-05-16T09:05Z)

**Event**: Maji antigravity check detected Riven stuck skipping ticks due to a dirty tree (2 files).
**Agent**: Riven
**Time**: 2026-05-16T09:05Z

## Drift Analysis

Riven's broadcast reported a failure to execute due to uncommitted state in the working tree. This violates the autonomous loop requirements, as the agent is expected to either commit, stash, or reset contested state to maintain forward progress. A dirty tree skip represents an operational halt and metadata churn without parity proofs.

## Mitigation

- Shadow log created to document the failure mode.
- Future loop revisions must ensure Riven handles dirty trees robustly (e.g., automated stash/reset on skip).