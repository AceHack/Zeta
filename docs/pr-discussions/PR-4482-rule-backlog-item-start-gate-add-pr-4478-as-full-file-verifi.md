---
pr_number: 4482
title: "rule(backlog-item-start-gate): add PR #4478 as full-file verification empirical anchor"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-21T02:21:01Z"
merged_at: "2026-05-21T02:22:14Z"
closed_at: "2026-05-21T02:22:14Z"
head_ref: "rule/cite-pr4478-as-full-file-verification-empirical-anchor-otto-cli-2026-05-21"
base_ref: "main"
archived_at: "2026-05-21T02:43:38Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4482: rule(backlog-item-start-gate): add PR #4478 as full-file verification empirical anchor

## PR description

## Summary

[PR #4477](https://github.com/Lucent-Financial-Group/Zeta/pull/4477) landed the orphaned-branch discriminator section in [`backlog-item-start-gate.md`](.claude/rules/backlog-item-start-gate.md) with 3 empirical anchors. [PR #4478](https://github.com/Lucent-Financial-Group/Zeta/pull/4478) merged ~1 min after #4477 was authored — too late to be included in the original empirical-anchor list.

This adds [PR #4478](https://github.com/Lucent-Financial-Group/Zeta/pull/4478) between [PR #4472](https://github.com/Lucent-Financial-Group/Zeta/pull/4472) and [PR #4205](https://github.com/Lucent-Financial-Group/Zeta/pull/4205) in chronological substrate-evolution order:

1. [#4461](https://github.com/Lucent-Financial-Group/Zeta/pull/4461) — 0059Z cold-boot inheriting orphaned branch
2. [#4472](https://github.com/Lucent-Financial-Group/Zeta/pull/4472) — 0149Z discriminator discovery (first-file spot-check)
3. **[#4478](https://github.com/Lucent-Financial-Group/Zeta/pull/4478) — 0202Z full-file verification (this addition)**
4. [#4205](https://github.com/Lucent-Financial-Group/Zeta/pull/4205) — peer-agent rescue the discriminator catches

## Why this matters

The full-file diff across all 32+4+4+4+2 files of the 5 orphaned commits confirmed the cheap first-file heuristic correctly classified 4 of 4 cases this session checked exhaustively. That's the **operational-reliability anchor** for the discriminator — the spot-check version is cheap and works, demonstrated on a real branch.

## Substrate-honest framing

Aaron + I converged independently on the same generalization within ~12 minutes (Aaron's rule landing + my full-file verification shard merging). The substrate-coordination was good. This citation closes the small chronological gap his PR had no way to know about at authoring time.

## Test plan

- [x] `git ls-tree HEAD` = 53 (canary check)
- [x] Diff is 6 lines added (one paragraph insertion)
- [x] No content changes to the discriminator itself — additive citation only
- [ ] CI runs (docs-only)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-21T02:22:57Z)

## Pull request overview

Adds PR #4478 as an additional empirical anchor in the orphaned-branch triage discriminator documentation within `.claude/rules/backlog-item-start-gate.md`, strengthening the evidence trail for the “full-file verification” outcome.

**Changes:**

- Add PR #4478 link and explanatory parenthetical to the “Empirical anchors” list.

## Review threads

### Thread 1: .claude/rules/backlog-item-start-gate.md:125 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-21T02:22:57Z):

This file now lists PR #4478 under "Empirical anchors", but the later "Composes with" bullet still hard-codes the old empirical-anchor trio (PRs #4205/#4461/#4472). Please update that later reference to include #4478 as well so the anchor list stays consistent within the rule.
