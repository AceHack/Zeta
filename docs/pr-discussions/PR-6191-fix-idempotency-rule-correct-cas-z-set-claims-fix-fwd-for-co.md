---
pr_number: 6191
title: "fix(idempotency rule): correct CAS + Z-set claims (fix-fwd for Codex P2 stranded by #6189 auto-merge race)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-31T03:09:39Z"
merged_at: "2026-05-31T03:14:49Z"
closed_at: "2026-05-31T03:14:49Z"
head_ref: "otto-cli/idempotency-cas-zset-corrections-fixfwd-2026-05-30"
base_ref: "main"
archived_at: "2026-05-31T03:34:41Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #6191: fix(idempotency rule): correct CAS + Z-set claims (fix-fwd for Codex P2 stranded by #6189 auto-merge race)

## PR description

## Fix-forward: correct CAS + Z-set claims in the idempotency rule

Two Codex P2 corrections to the idempotency discipline (`#6189`) were pushed **after** that PR's auto-merge had already fired — they got stranded on a re-created branch and never landed (the [auto-merge-race-with-follow-up-commit anti-pattern](../../.claude/rules/blocked-green-ci-investigate-threads.md)). This lands them on merged main. Both are real technical errors, verified:

1. **CAS bodies need not be idempotent.** A failed compare-exchange commits *nothing* — only the winning attempt takes effect; loser-iteration recomputations are discarded. Reframed: CAS makes a read-modify-write **commit exactly once** under contention. Idempotency matters for lock-free only when the retried body has **side effects beyond the CAS word** (I/O, sends).

2. **Z-set retraction ≠ duplicate-guard.** `ZSet.add` *sums* weights, so a duplicate `+1` redelivery becomes `+2`, not a no-op. Reframed as a **correction** mechanism (compensating `−1` after the fact), not a dedup; accumulating-event dedup still needs an idempotency key at ingest.

Docs/rules-only. Composes-with: #6189 (the rule this corrects) · `blocked-green-ci-investigate-threads` (the race that caused the strand).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-31T03:11:01Z)

## Pull request overview

Fix-forward documentation correction to the “Idempotency” always-active discipline rule, clarifying two technical claims around CAS retry loops and Z-set retraction semantics.

**Changes:**

- Clarifies that CAS retry loops don’t require the recomputed transformation to be idempotent unless the retried body has observable side effects beyond the CAS word.
- Clarifies that Z-set retraction is a correction mechanism (weights sum) and does not provide duplicate-guard semantics for accumulating events.

## Review threads

### Thread 1: .claude/rules/dv2-data-split-discipline-activated.md:137 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T03:11:01Z):

The parenthetical lists “allocations the loser keeps” as a CAS-loop side effect. Allocations in losing iterations are typically discarded/GC’d unless they escape (e.g., captured in a global, enqueued, or otherwise made observable), so this phrasing is misleading. Consider rewording to focus on *observable* side effects (logging/metrics/I-O/sends, or allocations/resources that escape the losing iteration).

## General comments

### @AceHack (2026-05-31T03:12:47Z)

Addressed: reworded to **observable** side effects (I/O, sends, metrics, or state made visible before the winning exchange) and noted that transient allocations in losing iterations don't count — they're discarded/GC'd unless they escape. Thanks for the catch.
