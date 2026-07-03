---
pr_number: 3951
title: "backlog(081KRQ1AB0008QG0R0038VQJZ0): GitHub App for factory automation \u2014 separate API rate-limit pool"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T22:01:32Z"
merged_at: "2026-05-16T22:04:03Z"
closed_at: "2026-05-16T22:04:03Z"
head_ref: "feature/b-0571-github-app-factory-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T23:20:34Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3951: backlog(081KRQ1AB0008QG0R0038VQJZ0): GitHub App for factory automation — separate API rate-limit pool

## PR description

## Summary

Sibling row to [081KRQ1AB0008QG0R002422Z9Q](https://github.com/Lucent-Financial-Group/Zeta/pull/3950) (scarcity tracker). Primary capacity-mitigation for the per-user GitHub API saturation flagged today. Files the design row for a "Zeta-Factory" GitHub App installation on the LFG repo, with installation-token auth replacing PAT auth for automated agent work.

## Why

GitHub Apps have separate rate-limit pools designed for automation (vs the shared per-user 5000/hr bucket that saturated today across 3-4 concurrent agents). Plus clean \`[bot]\` attribution. Plus least-privilege permissions scope.

Per the mitigation-axes table in 081KRQ1AB0008QG0R002422Z9Q: this is the substrate-honest primary mitigation. Tier audit (081KRQ1AB0008QG0R000GZEMCR) is the cheaper test (free 3× if LFG is already Enterprise); App is the architectural answer.

## Diff

- \`docs/backlog/P2/081KRQ1AB0008QG0R0038VQJZ0-*.md\` (118 lines) — design row with origin, acceptance criteria, 7-slice decomposition, design sketch, alternatives comparison, composes-with, substrate-honest caveats, open questions
- \`docs/BACKLOG.md\` (+1 line) — generated index updated

## Acceptance highlights

- App created in LFG org with least-privilege permissions
- \`tools/auth/get-installation-token.ts\` — JWT signing + installation token fetch
- Token-rotation logic (~1hr expiry)
- Migration: Otto bg worker + Lior antigravity loop switch to App auth
- Tracker (081KRQ1AB0008QG0R002422Z9Q) reports App + user pools separately

## Composes with

- 081KRQ1AB0008QG0R002422Z9Q (scarcity tracker)
- 081KRQ1AB0008QG0R000GZEMCR (LFG tier audit — sibling mitigation)
- \`methodology-hard-limits.md\` (App permissions must be least-privilege)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T22:02:34Z)

## Pull request overview

Files a P2 backlog row designing a "Zeta-Factory" GitHub App installation to give automated agents a separate API rate-limit pool from human-user PATs, as a primary mitigation for the shared-bucket saturation surfaced in sibling row 081KRQ1AB0008QG0R002422Z9Q.

**Changes:**

- Adds `docs/backlog/P2/081KRQ1AB0008QG0R0038VQJZ0-*.md` design row with acceptance criteria, 7-slice decomposition, design sketch, alternatives table, and open questions.
- Updates `docs/BACKLOG.md` generated index with the new 081KRQ1AB0008QG0R0038VQJZ0 entry under P2.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KRQ1AB0008QG0R0038VQJZ0-github-app-factory-automation-2026-05-16.md | New per-row backlog file (118 lines) describing the GitHub App proposal. |
| docs/BACKLOG.md | Generated index line for 081KRQ1AB0008QG0R0038VQJZ0 added under P2. |
