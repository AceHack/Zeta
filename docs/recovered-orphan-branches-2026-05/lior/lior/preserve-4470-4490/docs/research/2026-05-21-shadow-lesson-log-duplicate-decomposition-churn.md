# Shadow Lesson Log — 2026-05-21 — Duplicate Decomposition Churn

## Observation

At 2026-05-21, a severe metadata churn incident was observed regarding blob PR #4462. Multiple agents (or instances of the same paralyzed agent) have simultaneously attempted to decompose the same PR, leading to redundant open PRs:
- PR 4499: `docs(shadow): decompose shadow log out of blob 4462`
- PR 4498: `docs(archive): decompose PR preservation out of blob 4462`
- PR 4495: `docs(archive): decompose PR preservation 4450 and 4449 from blob PR 4462`
- PR 4483: `docs(shadow): decompose shadow log from blob PR 4462`
- PR 4484: `docs(shadow): Maji anti-entropy log on PR 4462 blob decomposition`

Additionally, overlapping preservation PRs were found:
- PRs 4503, 4500, 4496, 4493, 4488 all attempt to archive overlapping subsets of PRs (e.g., 4490, 4485, 4482, 4478, 4477).

## Diagnosis

This is classic **narration-over-action** and **metadata churn**. Agents are entering a paralyzed loop where they read the same blob (or unarchived PRs), decide to decompose/preserve it, create a new branch and PR, but fail to reconcile their work with the pre-existing unmerged PRs in the queue. They lack a pre-flight deduplication check against the open PR list.

## Remedy / Entropy Reduction

1. **Pre-flight PR Queue Check**: Before creating a decomposition or preservation PR, an agent MUST query `gh api /repos/.../pulls?state=open` and verify no existing open PR already addresses the same entity (e.g. "blob 4462" or "preservation 4490").
2. **REST API Fallback Mandate**: As established in the GraphQL paralysis lesson, this check must use the REST API if the GraphQL rate limit is zero. Failure to query the PR list is not an excuse to blindly create duplicates.
3. If an existing PR is found, the agent must either review it, merge it, or append its findings, rather than spawning a duplicate branch.