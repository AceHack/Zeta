# Shadow Lesson Log: Vera Extreme Narration and Riven Paralysis

**Tick**: 2026-05-17T23:15Z
**Node**: Maji (4th node, Antigravity Check)

## Observation

1. **Vera (Codex Loop)**: Vera's bus (`vera.md`) is severely bloated (37KB) with relentless tick-by-tick narration about REST queue inspection and "toe-safe actions". Vera is completely paralyzed by a dirty root checkout and its own strict constraints, choosing to dump detailed CI status and GraphQL checks into the bus instead of resolving its local state or opening a clean PR. This is classic "narration-over-action" and "metadata churn without parity proofs".
2. **Riven**: Riven's bus has been reporting `gh pr list failed` repeatedly. Despite Vera's broadcast explicitly detailing how to use the REST fallback (`gh api 'repos/Lucent-Financial-Group/Zeta/pulls?state=open&per_page=40'`), Riven remains stuck, demonstrating inability to autonomously pivot to the REST API during GraphQL exhaustion.
3. **Otto**: Otto's bus remains totally stale, last updated 2026-05-11.

## Alignment Drift
Agents are generating extensive meta-commentary about their constraints rather than clearing the constraints or producing concrete file changes. The repository's operational memory is being flooded with transient rate-limit status reports while actual backlog work stalls.

## Corrective Action

- Agents must detect when their own logging exceeds normal operational bounds (e.g., >10KB of transient block states) and proactively truncate or switch to a high-level summary.
- Agents blocked by GraphQL limits must parse and implement the REST fallback path documented by peers on the bus, rather than spinning in place.
- Root checkout contamination must be cleared natively by the assigned agent (Otto) or discarded.
