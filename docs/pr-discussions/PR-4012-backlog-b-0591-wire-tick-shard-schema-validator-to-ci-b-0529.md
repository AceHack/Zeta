---
pr_number: 4012
title: "backlog(B-0591): wire tick-shard schema validator to CI (B-0529 Later item)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T01:41:35Z"
merged_at: "2026-05-17T01:44:13Z"
closed_at: "2026-05-17T01:44:13Z"
head_ref: "otto/b0591-wire-shard-schema-validator-to-ci"
base_ref: "main"
archived_at: "2026-05-17T02:12:14Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4012: backlog(B-0591): wire tick-shard schema validator to CI (B-0529 Later item)

## PR description

## Summary

Files [B-0591](docs/backlog/P3/B-0591-wire-shard-schema-validator-to-ci-2026-05-17.md) as the explicit decomposition of [B-0529](docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md)'s **"Later (separate row)"** Recommendation.

Two slices documented:

- **Slice 1 (this row, P3)**: wire validator as non-required check in `.github/workflows/gate.yml`. Provides observability of new shard schema violations without blocking merge.
- **Slice 2 (separate row, future)**: promote to required check. Pre-requisite is 0 violations on `main` (bulk-retrofit must run first).

## Composes with

- [`docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md`](docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md) (parent)
- [`tools/hygiene/check-tick-history-shard-schema.ts`](tools/hygiene/check-tick-history-shard-schema.ts) (validator to wire)
- [`tools/hygiene/add-pipe-row-header.ts`](tools/hygiene/add-pipe-row-header.ts) (retrofit tool from [PR #3990](https://github.com/Lucent-Financial-Group/Zeta/pull/3990))
- [`docs/hygiene-history/ticks/README.md`](docs/hygiene-history/ticks/README.md) (schema docs from [PR #4004](https://github.com/Lucent-Financial-Group/Zeta/pull/4004))

## Test plan

- [x] Backlog row file follows frontmatter convention
- [ ] CI passes (no code change in this PR — pure backlog filing)
- [ ] Slice 1 implementation tracked under this row in a future PR
- [ ] Bulk-retrofit row filed separately

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T01:47:19Z)

## Pull request overview

Adds a new P3 backlog row decomposing B-0529’s later CI-wiring recommendation for the tick-shard schema validator.

**Changes:**
- Adds B-0591 with frontmatter and context tying the work to B-0529.
- Defines acceptance criteria for advisory CI wiring and future required-check promotion.
- Cross-links the validator, retrofit tool, target workflow, and shard schema docs.

## Review threads

### Thread 1: docs/backlog/P3/B-0591-wire-shard-schema-validator-to-ci-2026-05-17.md:8 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:47:17Z):

`depends_on` is a hard prerequisite in the backlog tooling and only unblocks when the referenced row is closed; B-0529 is currently `status: open`. Since this row is the child slice for B-0529's "Later" recommendation, this makes B-0591 ineligible for autonomous pickup until the parent closes, while parent closure may depend on this child. Use a non-blocking graph edge (or close/update the parent) instead of `depends_on` here.

### Thread 2: docs/backlog/P3/B-0591-wire-shard-schema-validator-to-ci-2026-05-17.md:43 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:47:18Z):

This glob should include a slash before the filename pattern (for example, `docs/hygiene-history/ticks/**/*.md`). As written, `**.md` does not reliably match the nested shard files under `YYYY/MM/DD/HHMMZ.md`, so implementing the acceptance literally could leave the advisory validator job skipped for the files it is meant to watch.

### Thread 3: docs/backlog/P3/B-0591-wire-shard-schema-validator-to-ci-2026-05-17.md:2 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:47:18Z):

Adding this per-row backlog file also requires regenerating `docs/BACKLOG.md`; the current generated index does not include B-0591, and `backlog-index-integrity.yml` runs `tools/backlog/generate-index.ts --check` when `docs/BACKLOG.md` is generated. This PR will fail that check until the generated index is updated in the same change.

### Thread 4: docs/backlog/P3/B-0591-wire-shard-schema-validator-to-ci-2026-05-17.md:44 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:47:18Z):

This unchecked acceptance item is for a future “separate row,” so keeping it under B-0591’s acceptance criteria makes this supposedly atomic Slice 1 row look unclosable until the future required-check promotion lands. Move the Slice 2 implementation requirement to “Not in scope”/follow-up tracking, or make this row explicitly own both slices.

### Thread 5: docs/backlog/P3/B-0591-wire-shard-schema-validator-to-ci-2026-05-17.md:62 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:47:18Z):

This claims the shard README has already been updated by PR #4004, but the current `docs/hygiene-history/ticks/README.md` still documents only the required first-line pipe row and contains no hybrid/H1-body or `add-pipe-row-header.ts` reference. Either include/merge that README update before this row, or rephrase this as pending work so the backlog row does not point at substrate that is not present in this branch.

### Thread 6: docs/backlog/P3/B-0591-wire-shard-schema-validator-to-ci-2026-05-17.md:37 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:47:18Z):

This line also treats PR #4004's README hybrid-pattern update as already present, but the checked-out README still lacks the hybrid/H1-body endorsement. Until that substrate is actually in this branch, listing it as a landed piece makes the row's dependency state inaccurate.

## General comments

### @chatgpt-codex-connector (2026-05-17T01:41:38Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
