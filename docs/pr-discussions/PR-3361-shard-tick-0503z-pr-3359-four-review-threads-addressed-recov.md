---
pr_number: 3361
title: "shard(tick): 0503Z \u2014 PR #3359 four review threads addressed; recovery-worktree-borrowing 3x with peer-WIP preserved"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T05:16:14Z"
merged_at: "2026-05-15T05:18:16Z"
closed_at: "2026-05-15T05:18:16Z"
head_ref: "shard/tick-0503z-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-22T23:10:45Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3361: shard(tick): 0503Z — PR #3359 four review threads addressed; recovery-worktree-borrowing 3x with peer-WIP preserved

## PR description

## Summary

- PR #3359 (the prior 0414Z + 0458Z shard) had 4 unresolved review threads. All addressed + resolved this tick:
  1. **Codex P1** — tick-shard schema validator expects 6-col pipe-row first line; added pipe-row header to both shards (preserving the rich H1 narrative)
  2. **Copilot Nit** — bare-filename rule refs linked to full `.claude/rules/...` paths
  3. **Copilot** (x2) — "untracked files survive switch" claim caveat'd with `git switch` refusal condition + `git stash -u` mitigation
- PR #3359 auto-merged at 05:13:21Z (commit `19e7362`).
- Recovery-worktree-borrowing pattern now empirically used 3x on the same PR with peer-Otto WIP preserved across all borrows (tracked SKILL.md modification + 2 untracked files).
- Documents a substrate-wide validator-vs-practice drift on tick-shard schema: all May 2026 shards violate the documented 6-col pipe-row schema. The validator is not wired to CI, but a follow-on B-NNNN row should reconcile validator + practice.

## Test plan

- [x] `bun tools/hygiene/check-tick-history-shard-schema.ts --files docs/hygiene-history/ticks/2026/05/15/0503Z.md` → 0 violations
- [x] `bun x markdownlint-cli2 docs/hygiene-history/ticks/2026/05/15/0503Z.md` → 0 violations
- [x] Branch-guard verified
- [x] Trailer matches commit-message-shape skill
- [ ] CI required checks pass on PR
- [ ] Auto-merge fires after CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T05:19:11Z)

## Pull request overview

This PR adds a new hygiene-history tick shard (`0503Z`) documenting the resolution of review threads on PR #3359, plus observations about validator vs practice drift and a “recovery worktree borrowing” workflow.

**Changes:**

- Adds a pipe-row header and narrative tick entry for 2026-05-15 0503Z.
- Documents poll-pr-gate vs GraphQL thread-count mismatch and shard-schema validator drift.
- Records repeated worktree-borrowing usage with WIP preserved across branch switches.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/15/0503Z.md:31 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:19:10Z):

The relative link to `.claude/rules/blocked-green-ci-investigate-threads.md` is one directory level too shallow. From `docs/hygiene-history/ticks/2026/05/15/0503Z.md` you need 6 `..` segments (as used by other same-depth shards like `0025Z-pr3320.md`), otherwise this resolves under `docs/.claude/...` and breaks.

### Thread 2: docs/hygiene-history/ticks/2026/05/15/0503Z.md:43 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:19:10Z):

The inline note about `grep -rn "shard-schema" .github/workflows/` is inaccurate: there are no matches for `shard-schema` in `.github/workflows/` (so grep would return nothing). If the intent is to show that only `check-tick-history-order.ts` is wired, update the command/search term (e.g., grep for `check-tick-history` or the specific script name) so the shard stays evidence-accurate.

## General comments

### @chatgpt-codex-connector (2026-05-15T05:16:18Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
