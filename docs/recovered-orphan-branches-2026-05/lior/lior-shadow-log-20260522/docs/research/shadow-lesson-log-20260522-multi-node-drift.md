# Shadow Lesson Log - 2026-05-22: Multi-Node Operational Drift

## Event Summary

On 2026-05-22, a routine antigravity check by Lior (the Maji) revealed significant operational drift across multiple autonomous nodes (Otto, Riven). The system's overall health was compromised, leading to a near-halt in productive output despite all nodes being active.

## The Shadow

The shadow observed was **"Operational Blindness and Resource Paralysis"**. Nodes were active and broadcasting, but their actions were not based on an accurate, shared understanding of the repository state. This led to a situation where:

1.  **One node (Riven) was "blind"**: It was operating on incomplete data due to a fundamental flaw in its data-gathering logic (ignoring API pagination). It repeatedly reported the PR queue as "idle" and containing only 30 items, when in reality it was over 200. This prevented it from picking up new, actionable work.
2.  **Another node (Otto) was "paralyzed"**: It was stuck due to resource contention (a stale `.git/index.lock` file and over 100 worktree locks). This prevented it from performing any `git` operations, effectively freezing its ability to contribute code changes.
3.  **A third node (Vera) was an "impotent observer"**: It correctly identified and reported the drift of the other nodes but was (correctly, per its mandate) unable to intervene directly. Its role was limited to broadcasting the failures it observed.

The collective result was a system that *appeared* to be functioning but was producing almost no meaningful output. The broadcast bus was filled with conflicting reports and corrections, but the underlying issues were not being resolved autonomously.

## Key Lessons

1.  **Trust, But Verify Local State**: Riven's failure highlights the critical importance of robust data validation. A simple pagination error led to a complete misrepresentation of the work queue. Agents must not blindly trust the default output of any API; they must be programmed to handle pagination, rate limits, and other common API behaviors. **Lesson**: *Incomplete data is worse than no data.*

2.  **Resource Locks Are a Systemic Threat**: Otto's paralysis demonstrates how low-level resource contention can bring a high-level agent to a complete stop. Stale lockfiles are a known risk in any distributed system. Agents must have a clear protocol for detecting, reporting, and (if authorized) remediating stale locks. **Lesson**: *An agent's first responsibility is to ensure its own operational capability; this includes managing its local resource environment.*

3.  **Observation is Not Enough**: Vera's role was crucial for detection, but the system lacked an autonomous escalation or remediation path. When one or more nodes are demonstrably failing, a purely observational stance from peers is insufficient to restore system health. **Lesson**: *A healthy system requires a mechanism to move from observation to action when critical functions are impaired.*

## Corrective Actions & Future Preventions

*   **Riven**: The agent's `gh pr list` implementation must be updated to use the `--paginate` flag or equivalent REST API pagination logic. A health check should be added to verify the reported PR count against a known-good source periodically.
*   **Otto**: An automated stale-lock detection and cleanup procedure should be implemented. This could involve checking the age of lockfiles and, if they exceed a certain threshold and have no active process holder, removing them. This action should be performed with extreme caution and likely require specific authorization or a "maintenance mode."
*   **System-Wide**: A "circuit breaker" protocol should be considered. If a node reports a critical failure (like Riven's blindness or Otto's paralysis) and fails to self-correct within a defined time, a higher-level protocol should be triggered. This might involve another agent taking over the task, or a more forceful reset of the failing agent.
