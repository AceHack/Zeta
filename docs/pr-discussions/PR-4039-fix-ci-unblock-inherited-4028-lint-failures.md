---
pr_number: 4039
title: "fix(ci): unblock inherited #4028 lint failures"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T04:19:05Z"
merged_at: "2026-05-17T04:23:58Z"
closed_at: "2026-05-17T04:23:58Z"
head_ref: "claim/task-mainline-lint-unblock-4028-20260517"
base_ref: "main"
archived_at: "2026-05-17T07:03:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4039: fix(ci): unblock inherited #4028 lint failures

## PR description

Unblocks inherited CI failures currently visible on #4028, without widening #4028's tally-fix scope.

What changed:

- Fix `docs/hygiene-history/ticks/2026/05/17/0221Z.md` .claude/rules relative links from 5-up to 6-up so they resolve to repo root.
- Update `tools/inventory/amazon-orders-extract.ts` to use a typed runtime-only Playwright import loader and strict `dedup` fallback for `noUncheckedIndexedAccess`.

Verification:

- `/opt/homebrew/bin/bun tools/hygiene/audit-tick-shard-relative-paths.ts --enforce --baseline tools/hygiene/audit-tick-shard-relative-paths.baseline.json`
- `/opt/homebrew/bin/bun install --frozen-lockfile`
- `/opt/homebrew/bin/bun --bun tsc --noEmit -p tsconfig.json`

Related:

- #4028
- Inherited blocker note: https://github.com/Lucent-Financial-Group/Zeta/pull/4028#issuecomment-4468988846

Claim lifecycle:

- Claim and release commits are both on this branch; net diff is only the two CI-unblock files.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T04:20:41Z)

## Pull request overview

This PR unblocks inherited CI failures by correcting tick-shard cross-references and making the Amazon orders extractor compatible with strict TypeScript checks.

**Changes:**

- Fixes `.claude/rules` relative links in a hygiene tick shard.
- Adds a typed runtime-only Playwright loader to avoid static module-resolution failures.
- Narrows unchecked array access in the extractor’s URL dedup logic.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| `tools/inventory/amazon-orders-extract.ts` | Updates Playwright loading and `dedup` fallback for strict TypeScript compatibility. |
| `docs/hygiene-history/ticks/2026/05/17/0221Z.md` | Corrects rule links from the tick shard to repo-root `.claude/rules`. |
