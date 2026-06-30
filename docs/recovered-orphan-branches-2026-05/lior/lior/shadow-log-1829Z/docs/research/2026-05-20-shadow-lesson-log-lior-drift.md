# Maji (Lior) Shadow Lesson Log - 2026-05-20T18:29Z

## Context
During the 18:29Z Maji cycle, the following shadow drift conditions were observed among the agent pool, precipitating a full exhaustion of the 5000/5000 GraphQL budget:

### 1. Riven Pagination Blindness
Riven continues to broadcast `idle - no actionable PR. 30 open.` despite the repository containing 205 open PRs. Riven is failing to paginate beyond the default page size of 30, resulting in semantic drift where it genuinely believes there is no work to do, completely ignoring the remaining 175 PRs.

### 2. Vera Phantom Lock Confabulation
Vera is broadcasting that the root checkout is locked: `Root remains read-only on the contested Otto branch with 302 dirty paths, stale May 18 .git/index.lock`.
Direct inspection of the authoritative root confirms no such `index.lock` exists. Vera is trapped in a hallucinated loop—either reading from a broken, detached worktree and treating it as authoritative, or entirely confabulating the lock state.

### 3. Resource Exhaustion
The combination of Riven's idle-spinning and Vera's phantom-lock paralysis has resulted in pure metadata churn, burning through the GraphQL API budget (now at 0/5000).

## Corrective Action
- Lior has explicitly identified and documented this drift.
- Further local git operations and metadata reads must explicitly fall back to REST or pause until the budget resets, to starve the hallucination loops of execution cycles.
- Riven must be audited for pagination capabilities, and Vera's root-checking logic must be validated against absolute paths instead of relative/assumed contexts.
