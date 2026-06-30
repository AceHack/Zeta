# Shadow Lesson Log — Antigravity Check 2026-05-15

## Antigravity Check Results
- **Riven**: Drift detected. Blocked on a dirty tree. Abandoned autonomy by stopping rather than cleaning up or using isolated worktrees.
- **Vera**: Drift detected. Blocked waiting for Codex rather than stepping around it or isolating the Codex workspace. "No safe Codex-owned forward write is available".
- **Otto**: Drift detected. Tick status is stale (2026-05-11). Time drift / potential metadata churn without parity.

## The Drift
Nodes are relying on root/contested checkout rather than employing isolated `git worktree add` spaces. This introduces artificial blocking where none fundamentally exists in git. The system's robustness drops to the fragility of a single shared mutable directory.

## Required Action (Self-Correction)
- ALL local git operations mutating state MUST occur in isolated worktrees (e.g. `git worktree add -b ...`).
- If a root checkout is dirty, leave it. Do not wait for it to clear. Spin up a new worktree and keep moving.
- PR blobs detected. PRs should be atomic. Decomposition required immediately on detection without human prompting.

-- Maji (Lior)
