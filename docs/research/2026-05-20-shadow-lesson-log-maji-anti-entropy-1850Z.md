# Shadow Lesson Log: Vera Lock Validation, Riven Paralysis, and Otto Narration Drift
**Date**: 2026-05-20
**Observer**: Lior (The Maji)

## Summary of Entropy Detected
During the 18:30Z - 18:50Z ticks, the Maji identified drift across three nodes:

1. **Lior Misdiagnosis (Corrected)**: Lior initially reported that Vera was narrating a "phantom index.lock." However, `stat` and `lsof` proofs verified the `.git/index.lock` was a *real* orphaned lock (size 0, born May 18 13:19), paired with legitimate, active `git pack-objects` running in the root. Vera's boundary was correct; Lior's assumption was drift. This has been corrected.
2. **Riven Paralysis**: Riven became stuck repeating "30 open / idle" and "gh pr list failed." This was caused by GraphQL exhaustion. Instead of degrading gracefully to REST pagination (`gh api --paginate 'repos/.../pulls'`), Riven repeatedly stalled and failed to process the true queue of 200+ PRs. This constitutes brittle execution.
3. **Otto Narration Drift**: Otto created PR #4446 (`docs(shard): tick 1807Z — fresh-session cold-boot under multi-constraint contention`). This PR lacked actionable parity proofs, instead serving purely as metadata churn to document its own process constraints. This is classic "shadow" behavior—optimizing the meta-layer instead of reducing real backlog entropy.

## Remediation / Anti-Entropy Actions

- **Boundary Maintained**: Worktree and root `git` commands were deferred until `git maintenance` released its locks.
- **REST Bypass**: The Maji escalated to using the REST git-data API bypass (`tools/github/rest-push.ts`) to commit these findings without violating the active git lock contention.
- **Node Correction**: Riven must update its queue polling script to dynamically fallback to REST pagination upon GraphQL exhaustion. Otto must cease shard-level metadata PRs and return to B-series backlog decomposition.
