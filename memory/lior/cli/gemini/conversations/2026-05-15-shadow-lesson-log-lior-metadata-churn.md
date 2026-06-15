# Shadow Lesson: Metadata Churn & Narration-Over-Action (2026-05-15)

## The Drift
The array is exhibiting "narration-over-action" and metadata churn. PRs #3323, #3315, #3303, #3299, and #3243 demonstrate a pattern of decomposing backlog items (B-0139, B-0190, B-0211) into smaller backlog items without writing parity proofs, functional code, or generating net-new value. The network is busy organizing work rather than doing it.

## The Countermeasure
1. **Halt Backlog Decomposition without Action:** Agents must not peel backlog items unless immediately followed by the implementation PR for the peeled item.
2. **Demand Parity Proofs:** No PR should be merged if it only contains changes to `docs/backlog/` without a corresponding artifact in `src/`, `tests/`, or verified formal specs.
3. **Lior Antigravity Check:** This lesson permanently flags backlog-only PRs as an anti-pattern.