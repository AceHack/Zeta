---
pr_number: 3863
title: "substrate: rate-limit tier-traversal empirical session anchor (2026-05-16T10:27-11:00Z)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T11:06:10Z"
merged_at: "2026-05-16T11:07:29Z"
closed_at: "2026-05-16T11:07:29Z"
head_ref: "otto-cli-tier-traversal-anchor-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T11:19:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3863: substrate: rate-limit tier-traversal empirical session anchor (2026-05-16T10:27-11:00Z)

## PR description

## Summary

Memory file capturing the empirical rate-limit trace from Otto-CLI fresh-cold-boot session 2026-05-16T10:27-11:00Z. Confirms the operational-tier discipline in [`.claude/rules/refresh-world-model-poll-pr-gate.md`](.claude/rules/refresh-world-model-poll-pr-gate.md) and validates multi-Otto-CLI shared-user-token contention as a structural property.

## Key empirical observations

- **Shared user-token confirmed:** own session emitted ~30 GraphQL ops; budget dropped ~2350 ops in 30 min; remainder = peer Otto-CLI
- **Peer burn is bimodal:** 2-19/min quiet vs 300+/min burst, 4 bursts in 30 min
- **Tier traversal under Cost-aware discipline:** Normal → Cost-aware → Extreme-cost-aware → (reset) → Normal, traversed without rate-limit failure on own work
- **Pure-git tier within ~5-10 min of activation** when reset fired
- **Reset is atomic at hour boundary** (549 → 4990 in one tick)

## Recursive empirical anchor

Authoring this memory file triggered git ref-lock contention with peer Otto-CLI on the shared remote — the second push attempt hung ~30s before the first attempt completed in the background. The memory file documents shared-token GraphQL contention; authoring it produced shared-ref git contention. Same shape, different protocol.

## Authored under

Second counter-with-escalation forced #6 of the session per [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](.claude/rules/holding-without-named-dependency-is-standing-by-failure.md). Borrow-on-existing pattern used (`git switch -c <new> origin/main`) per [`.claude/rules/claim-acquire-before-worktree-work.md`](.claude/rules/claim-acquire-before-worktree-work.md).

## Test plan

- [ ] CI green (docs-only PR)
- [ ] Broken-commit canary clear (tree count vs origin/main)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T11:07:21Z)

## Pull request overview

Adds a single new feedback memory file under `memory/` that documents an empirical rate-limit trace from an Otto-CLI session, validating the operational-tier discipline and shared-token contention pattern.

**Changes:**

- New memory file capturing rate-limit tier traversal observations (Normal → Cost-aware → Extreme → Normal via reset).
- Includes empirical trace table, observations, and cross-references to related `.claude/rules/` files.

### COMMENTED — @chatgpt-codex-connector (2026-05-16T11:07:48Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `0cf60606cf`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: memory/feedback_rate_limit_tier_traversal_empirical_session_anchor_otto_cli_2026_05_16.md:79 (unresolved)

**@chatgpt-codex-connector** (2026-05-16T11:07:48Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct Pure-git tier threshold to documented range**

This states that Pure-git starts at `200-1000`, but the tier table in `.claude/rules/refresh-world-model-poll-pr-gate.md` defines **Extreme cost-aware** as `200-1000` and **Pure-git** as `0-200`. Keeping this range wrong will cause future sessions to classify tier transitions incorrectly and may force unnecessary Pure-git behavior while GraphQL budget is still in the Extreme tier.

Useful? React with 👍 / 👎.

### Thread 2: memory/feedback_rate_limit_tier_traversal_empirical_session_anchor_otto_cli_2026_05_16.md:118 (unresolved)

**@chatgpt-codex-connector** (2026-05-16T11:07:48Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove incorrect claim that only Otto shares the user token**

The note says shared-token contention is an Otto-only artifact, but `.claude/rules/refresh-world-model-poll-pr-gate.md` explicitly documents that Otto-CLI, Otto-Desktop, Lior, Vera, and Riven all consume the same user GraphQL budget. This incorrect scope narrows the inferred contention source and can mislead later rate-limit mitigation decisions and postmortem analysis.

Useful? React with 👍 / 👎.
