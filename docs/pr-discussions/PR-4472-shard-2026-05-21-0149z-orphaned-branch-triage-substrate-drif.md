---
pr_number: 4472
title: "shard(2026-05-21/0149Z): orphaned-branch triage \u2014 substrate-drift discriminator generalizes"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-21T01:56:38Z"
merged_at: "2026-05-21T01:58:14Z"
closed_at: "2026-05-21T01:58:14Z"
head_ref: "shard/tick-0149z-otto-cli-orphaned-branch-mostly-rescued-substrate-drift-discriminator-generalizes-2026-05-21"
base_ref: "main"
archived_at: "2026-05-21T02:02:14Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4472: shard(2026-05-21/0149Z): orphaned-branch triage — substrate-drift discriminator generalizes

## PR description

## Summary

Follow-up to [PR #4461](https://github.com/Lucent-Financial-Group/Zeta/pull/4461) + [PR #4468](https://github.com/Lucent-Financial-Group/Zeta/pull/4468) (0059Z cold-boot + corrections). Verifies the orphaned `otto/2012z-...` branch carry-forward against current `origin/main`.

**Finding**: 4 of 5 orphaned commits' substrate is already rescued via peer agents. HC-8 NCI (`f0abf3ed`) was landed by [PR #4205](https://github.com/Lucent-Financial-Group/Zeta/pull/4205) between 2026-05-18 (orphan creation) and 2026-05-21 (cold-boot). The 0059Z carry-forward overestimated re-landing needs.

**Generalization**: the substrate-drift discriminator from [`.claude/rules/backlog-item-start-gate.md`](https://github.com/Lucent-Financial-Group/Zeta/blob/main/.claude/rules/backlog-item-start-gate.md) step 0 (row-scope) generalizes to **orphaned-branch scope**: before re-landing, run `git diff origin/main..<sha>` per file. 0 lines = fully rescued; 20-50 = partial drift; hundreds = genuine deltas worth cherry-picking.

**DO NOT re-apply `467424ec` Lior prompt fix** — Lior's prompt has evolved repeatedly since 2026-05-18; re-applying the stranded fix would regress 22 lines of newer prompt-engineering work.

## Verify

- 1 file added: `docs/hygiene-history/ticks/2026/05/21/0149Z.md` (83 lines)
- Pre-push gate passed (MD032 / markdownlint / relative-path audit)
- Branch off current `origin/main` (`7dd66fb7`) — no rebase conflict expected

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-21T01:58:19Z)

## Pull request overview

Adds a new hygiene-history tick shard documenting an orphaned-branch triage verification against `origin/main`, and generalizes the existing “substrate-drift discriminator” concept to orphaned-commit triage so future sessions avoid redundant re-landing or regressions.

**Changes:**

- Adds tick 0149Z documenting that most orphaned commits’ substrate is already present on `origin/main` (via other PRs/rescues).
- Introduces an “orphaned-branch triage discriminator” procedure using `git show` + `git diff origin/main..<sha> -- <file>` to classify rescue vs drift vs real deltas.
- Records explicit guidance not to re-apply the stale Lior prompt fix commit due to on-main evolution.
