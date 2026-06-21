---
pr_number: 5134
title: "rule: refresh-before-decide extends to working-tree reads \u2014 1008Z empirical anchor caught phantom PR #5128 drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T10:15:22Z"
merged_at: "2026-05-26T10:17:10Z"
closed_at: "2026-05-26T10:17:10Z"
head_ref: "otto-cli/refresh-extends-working-tree-reads-1008z-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:41:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5134: rule: refresh-before-decide extends to working-tree reads — 1008Z empirical anchor caught phantom PR #5128 drift

## PR description

## Summary

Extends `.claude/rules/refresh-before-decide.md` with a new section naming the **post-fetch working-tree read trap**: `git fetch origin main` updates `refs/remotes/origin/main` but does NOT promote local HEAD; subsequent file reads through working-tree paths see STALE files, and substrate authored against that state is a phantom catch.

This tick's session IS the empirical anchor: local primary checkout was 11 commits behind `origin/main` at 10:08Z (local `2774fef5a` vs origin `1641da6d2`); reading `tools/alignment/filter_gate_log.ts` + `.test.ts` via the working tree made [PR #5128](https://github.com/Lucent-Financial-Group/Zeta/pull/5128) (merged 08:22Z, 1h 46min earlier) look unfixed. The `refresh-before-decide` discipline caught the staleness via `git rev-parse HEAD` vs `git rev-parse origin/main` mismatch before any phantom-drift substrate landed.

## Three mitigation patterns

1. **Isolated worktree off `origin/main`** (default for agent ticks): `git worktree add --detach <path> origin/main` — composes with `agent-worktree-hygiene` `--detach` discipline (never hold `main` ref in agent worktrees).
2. **`git show origin/main:<path>`** — cheapest option for ad-hoc single-file inspection without checkout.
3. **ff-promote local HEAD** — ONLY when the checkout is the agent's own, never the operator's primary.

## Substrate-inventory step (per [verify-existing-substrate-before-authoring](https://github.com/Lucent-Financial-Group/Zeta/pull/5131))

Searched `.claude/rules/` + `memory/` for: `git fetch`, `FETCH_HEAD`, `local HEAD stale`, `ff-only`, `fast-forward`, `git show origin/main`, `stale local`. Found existing partial coverage at `otto-channels-reference-card.md` ID-allocation section ("do NOT use `find docs/backlog -name 'B-*.md'` on the local worktree...") and `refresh-world-model-poll-pr-gate.md` ("Prefer `origin/main` over `FETCH_HEAD`"). Conclusion: principle exists at NARROW scope (ID-allocation queries / FETCH_HEAD race); the general working-tree-file-read corollary is implicit but not explicit on a cold-boot-loaded rule surface. Disposition: **extend** (not mint parallel) per the verify-existing-substrate rule — landed inside `refresh-before-decide.md` so it auto-loads at every Otto cold-boot.

## What changed

- `.claude/rules/refresh-before-decide.md` (+69 lines): new "## \`git fetch\` updates refs but NOT working-tree files (post-fetch read trap)" section + 3-pattern mitigation + 2026-05-26T10:08Z empirical anchor + citation to existing partial coverage + 5 composes_with entries
- `docs/hygiene-history/ticks/2026/05/26/1008Z.md` (+151 lines): full tick trace — refresh-found-stale, verify-before-defer composition (9th anchor: 0 stuck procs + 0 peer procs + dotgit-clean → isolated worktree clean), substrate-inventory step, visibility signal

## Test plan

- [x] Substrate-inventory step performed per verify-existing-substrate-before-authoring rule (PR #5131) — citations in rule body + tick shard
- [x] Verify-before-defer composition: `git worktree add --detach /private/tmp/zeta-otto-cli-refresh-extend-1008z origin/main` → exit=0, HEAD=`1641da6d2`, ls-tree=61, status=0, no `index.lock`
- [x] Branch-guard fired pre-commit per [`zeta-expected-branch.md`](../../.claude/rules/zeta-expected-branch.md) (`git branch --show-current` matched `ZETA_EXPECTED_BRANCH`)
- [x] Post-commit canary per [`codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](../../.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md): `ls-tree HEAD~1 = HEAD = 61`
- [x] Push wrapped in `timeout --kill-after=5s 90s` per 081KRW63S0008QG0R000EAZ9K2 discipline
- [x] Stays additive — no existing content removed; existing 28-line rule preserved verbatim

## Composes with

- [`.claude/rules/refresh-before-decide.md`](../../.claude/rules/refresh-before-decide.md) — the rule this PR extends
- [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../.claude/rules/verify-existing-substrate-before-authoring.md) — PR #5131; the substrate-inventory rule used here
- [`.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`](../../.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md) — `--detach origin/main` discipline
- [`.claude/rules/refresh-world-model-poll-pr-gate.md`](../../.claude/rules/refresh-world-model-poll-pr-gate.md) — "Prefer `origin/main` over `FETCH_HEAD`" + saturation tiers
- [`.claude/rules/otto-channels-reference-card.md`](../../.claude/rules/otto-channels-reference-card.md) — ID-allocation narrow-scope precedent
- [`.claude/rules/dep-pin-search-first-authority.md`](../../.claude/rules/dep-pin-search-first-authority.md) — sibling rule at version-pin scope; same "Otto-defaults-to-plausible-but-unverified" root cause class
- [PR #5128](https://github.com/Lucent-Financial-Group/Zeta/pull/5128) — the fix whose phantom-drift catch this tick prevented

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T10:15:28Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
