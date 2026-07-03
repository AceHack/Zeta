---
pr_number: 4107
title: "rules(rate-limit-tier): REST PR-creation fallback under Pure-git tier (PR #4105 anchor)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T22:06:40Z"
merged_at: "2026-05-17T22:21:01Z"
closed_at: "2026-05-17T22:21:01Z"
head_ref: "rule-anchor/rest-pr-create-pure-git-tier-fallback-2026-05-17-2203z"
base_ref: "main"
archived_at: "2026-05-17T22:49:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4107: rules(rate-limit-tier): REST PR-creation fallback under Pure-git tier (PR #4105 anchor)

## PR description

Adds a sub-section to [`refresh-world-model-poll-pr-gate.md`](.claude/rules/refresh-world-model-poll-pr-gate.md) under "Pure-git tick pattern (empirical)" documenting REST `POST /repos/.../pulls` as a fallback when GraphQL is exhausted.

**Empirical anchor**: [PR #4105](https://github.com/Lucent-Financial-Group/Zeta/pull/4105) opened via REST at 2026-05-17T21:54Z when GraphQL was 0/5000 (28 min from reset). REST `core` was at 4838 at the time — separate budget.

**Caveats documented:**

- `gh pr merge --auto` is GraphQL-only (no REST equivalent for `enablePullRequestAutoMerge`); PR opened via REST sits without auto-merge until post-reset tick.
- `gh pr comment` is GraphQL; REST equivalent is `POST /repos/.../issues/N/comments`.
- `resolveReviewThread` is GraphQL-only.
- REST PR-creation does NOT bypass branch protection.
- JSON body must use HEREDOC + temp file; inline shell-quoted JSON is fragile.

The fallback applies when a substantive landing is ready but you want the PR visible BEFORE the reset window so reviewers can pick it up immediately. Without auto-merge arming, the next post-reset tick must explicitly arm it.

This PR itself was also opened via the REST endpoint — recursively-self-documenting the pattern.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T22:07:51Z)

## Pull request overview

Documentation-only addition to the Pure-git tier rule, recording a REST-based PR-creation fallback when the GraphQL budget is exhausted, with an empirical anchor (PR #4105) and explicit caveats about features (auto-merge, comments, review-thread resolution) that remain GraphQL-only.

**Changes:**

- Adds a new "REST PR-creation fallback under Pure-git tier" sub-section with a HEREDOC+`gh api` recipe.
- Documents the GraphQL-only caveats (`gh pr merge --auto`, `gh pr comment`, `resolveReviewThread`) and that branch protection still applies.
- Anchors the pattern to the 2026-05-17T21:54Z PR #4105 instance.
