---
pr_number: 845
title: "ops(0-0-0): LFG forward-sync \u2014 post-reset cleanup + Copilot fixes + pr-preservation drain-logs (mirror of AceHack #101)"
author: "AceHack"
state: "MERGED"
created_at: "2026-04-29T14:25:11Z"
merged_at: "2026-04-29T14:27:35Z"
closed_at: "2026-04-29T14:27:35Z"
head_ref: "post-0-0-0-cleanup-2026-04-29"
base_ref: "main"
archived_at: "2026-04-29T14:30:07Z"
archive_tool: "tools/pr-preservation/archive-pr.sh"
---

# PR #845: ops(0-0-0): LFG forward-sync — post-reset cleanup + Copilot fixes + pr-preservation drain-logs (mirror of AceHack #101)

## PR description

## Summary

LFG forward-sync PR for the AceHack-first cleanup that landed at AceHack#101 (merged 2026-04-29T14:19:41Z, squash → `5485772e87d74f3b96cdac4f39063cb0e82d7839`).

This is **step 2 of the canonical double-hop**: AceHack-first (#101 ✓) → LFG forward-sync (this PR) → AceHack absorbs LFG squash-SHA (after this merges).

## Diff vs LFG main (same content as AceHack #101 + LFG-side review fixes + pr-preservation files)

1. **Original cleanup commits** (from AceHack #101): stale-prose fixes in `docs/active-trajectory.md`, protection-config memory file, MEMORY.md index entry, tick shard 1410Z

2. **LFG #844 Codex P2 fix** (commit `f6d6a94`): `gh api --input` syntax corrected to heredoc-stdin pattern

3. **LFG #844 Copilot thread fixes** (this commit):
   - Internal consistency on legacy DELETE response (DELETE returned 204; GET-after-DELETE returned 404 "Branch not protected" — two-step accuracy)
   - "Task #305" → "task #275" (correct in-session TaskList reference) + namespace-disambiguation parenthetical
   - "the only rulesets ruleset" → "the only ruleset" (wording nit)

4. **PR-preservation drain-logs** (Aaron 2026-04-29 directive): `docs/pr-preservation/lfg-844-drain-log.md` + `docs/pr-preservation/acehack-101-drain-log.md` — verbatim threads + responses + outcome classes for both PRs in this double-hop round

## Sequence after this PR merges

1. LFG/main advances to new squash-SHA = `<TBD>`
2. AceHack/main is at `5485772...` (post-#101); LFG/main moves to `<TBD>` (post-this)
3. Force-push acehack/main → LFG/main `<TBD>` (toggle ruleset / push / restore — same pattern as the 0/0/0 hard-reset)
4. AceHack/main = LFG/main = `<TBD>` — 0/0/0 invariant restored

## Authority boundary

Step 3 (force-push to AceHack) is irreversible from the ref-perspective + requires ruleset toggle → **gates on Aaron's authority**. After this PR merges, I prepare the verify-only gate packet for the absorption push, then await Aaron's `EXECUTE`.

Also addresses Copilot review feedback from LFG #844 carried forward.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-04-29T14:28:47Z)

## Pull request overview

Forward-syncs the AceHack-first post-reset cleanup into LFG, preserving operational learnings from the 0/0/0 reset and capturing PR review/drain artifacts as durable history.

**Changes:**
- Adds/updates protection-config operational memory (dual-layer legacy branch protection vs rulesets) and indexes it in `memory/MEMORY.md`.
- Updates `docs/active-trajectory.md` to reflect the now-achieved 0/0/0 state (replacing stale pre-reset “not signoff-eligible” language).
- Adds PR-preservation drain logs for both sides of the double-hop and appends the 14:10Z tick-history shard.

### Reviewed changes

Copilot reviewed 6 out of 6 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md | Documents the dual-layer protection discovery, error-code mapping, and the operational sequence (incl. corrected `gh api --input -` usage). |
| memory/MEMORY.md | Adds an index entry pointing to the new protection-config memory. |
| docs/pr-preservation/lfg-844-drain-log.md | Records LFG-side PR #844 review threads and resolutions for training-signal preservation. |
| docs/pr-preservation/acehack-101-drain-log.md | Records AceHack-side PR #101 outcome (auto-merged/no-review) for the double-hop record. |
| docs/hygiene-history/ticks/2026/04/29/1410Z.md | Adds the 14:10Z tick shard row capturing the reset completion + cleanup PR opening. |
| docs/active-trajectory.md | Updates trajectory text to reflect the completed hard-reset and new next-action lane. |
</details>
