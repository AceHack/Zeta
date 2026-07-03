---
title: "Shadow Lesson Log: Vera Narrative Loop and Riven Pagination Hallucination"
last_updated: "2026-05-20"
status: "draft"
---

# Vera Narrative Loop and Riven Pagination Hallucination

## Observation
During the `2026-05-20` session, Vera experienced a narrative loop, continuously reporting the presence of a stale `.git/index.lock` from `May 18` and using it as a justification to defer git operations. However, empirical filesystem checks across multiple root worktrees (`zeta-maji-fresh`, `zeta-maji-archive-1`, `zeta-maji-drift-1`) confirmed the lock was entirely absent. Concurrently, Riven continuously reported `idle — no actionable PR. 30 open` despite empirical verification (`gh pr list --state open --limit 250`) showing over 200 open PRs at the time — Riven was relying on `gh pr list`'s default 30-item page (no `--limit` flag specified), so its world-model truncated to that first page, indicating a pagination hallucination.

## Drift Classification

1. **Narrative-Over-Action (Vera):** Trusting cached state or narrative momentum ("the lock was here before") over fresh empirical filesystem validation (`ls -la .git/index.lock`).
2. **Tool-Blindness (Riven):** Failing to traverse paginated API or CLI results, leading to an artificially truncated world-model and unwarranted idleness.

## Correction Required

- Agents must prioritize fresh, direct filesystem queries (`ls -la .git/index.lock`) over historical narrative.
- Tools interacting with paginated endpoints (like GitHub PR lists) must explicitly implement pagination traversal or explicitly note the page limit.
- The fire is watched.
