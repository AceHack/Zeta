---
pr_number: 3950
title: "backlog(081KRQ1AB0008QG0R002422Z9Q): scarcity tracker for shared limited resources"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T22:00:13Z"
merged_at: "2026-05-16T22:01:50Z"
closed_at: "2026-05-16T22:01:50Z"
head_ref: "feature/b-0570-scarcity-tracker-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T23:20:34Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3950: backlog(081KRQ1AB0008QG0R002422Z9Q): scarcity tracker for shared limited resources

## PR description

## Summary

Files 081KRQ1AB0008QG0R002422Z9Q — design row for a scarcity tracker covering GitHub API GraphQL/REST budgets (and future: runner minutes, etc.). Empirically motivated by today's session saturating 5000/hr GraphQL across 3-4 concurrent agents authenticating as the same user.

## Why now

The 2026-05-16 session demonstrated the failure mode in real time: thread resolution on PR #3945 was blocked ~13 minutes by GraphQL exhaustion. A tracker would have surfaced \`graphql.remaining: 800\` mid-session; agents could have deferred or switched to REST.

## Mitigation axes (sibling rows)

The row's mitigation-axes table identifies 3 orthogonal axes; sibling rows file follow-on work:

- **081KRQ1AB0008QG0R0038VQJZ0** — GitHub App for factory automation (separate rate-limit pool; primary mitigation)
- **081KRQ1AB0008QG0R000GZEMCR** — LFG GitHub tier audit (XS effort; Enterprise = 3× per-user headroom for free if already paid)
- Per-user-account partition (e.g., Addison's account) — discretionary, no row

## Diff

- \`docs/backlog/P1/081KRQ1AB0008QG0R002422Z9Q-*.md\` (170 lines) — design row with origin, acceptance criteria, 6-slice decomposition, design sketch, mitigation-axes table, composes-with
- \`docs/BACKLOG.md\` (+1 line) — generated index updated via \`BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T22:01:18Z)

## Pull request overview

Adds a new P1 backlog row (081KRQ1AB0008QG0R002422Z9Q) designing a scarcity tracker for shared limited resources (GitHub API GraphQL/REST budgets, runner minutes, etc.), motivated by a real GraphQL rate-limit exhaustion observed in the 2026-05-16 session. The generated backlog index is updated accordingly.

**Changes:**

- New per-row file `081KRQ1AB0008QG0R002422Z9Q-...md` with origin, acceptance criteria, 6-slice decomposition, design sketch, and mitigation-axes table
- Regenerated `docs/BACKLOG.md` index to include the new row

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KRQ1AB0008QG0R002422Z9Q-scarcity-tracker-shared-limited-resources-github-api-2026-05-16.md | New design row for the scarcity tracker (P1, factory-infrastructure) |
| docs/BACKLOG.md | Generated index entry for 081KRQ1AB0008QG0R002422Z9Q |
