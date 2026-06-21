---
pr_number: 3678
title: "fix(hygiene): regen docs/BACKLOG.md index \u2014 clear generated-index drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T02:15:29Z"
merged_at: "2026-05-16T02:17:22Z"
closed_at: "2026-05-16T02:17:22Z"
head_ref: "fix/backlog-md-generated-index-regen-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T02:30:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3678: fix(hygiene): regen docs/BACKLOG.md index — clear generated-index drift

## PR description

Mechanical regen via \`BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts\`.

## What

- Re-ran the BACKLOG.md generator from per-row source files
- `bun tools/backlog/generate-index.ts --check` now exit 0 (was exit 2)
- Diff: +16 / -1 — new rows (081KRMEXM0008QG0R002YSPW1X–081KRQ1AB0008QG0R002DQBGZF + a few others) now reflected in the index

## Why

Second of three drift cleanups deferred from [tick 0111Z](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/hygiene-history/ticks/2026/05/16/0111Z.md) — the `check docs/BACKLOG.md generated-index drift` non-required CI check has been firing FAILURE on every PR this session.

After this PR merges, the check will flip fail → pass on subsequent PRs.

## Remaining drift (next-tick candidates)

- `lint (backlog ID uniqueness)` — 081KRHWGX0008QG0R001XFRAHC collision per [081KRMEXM0008QG0R000ARAR7P](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md)
- `lint (tsc tools)` — pending investigation

## Provenance

- Authored via borrow-on-existing pattern on sibling worktree `/private/tmp/zeta-tick-2210z` (Lior still active in `ps -A` — new worktree-add unsafe per [broken-commit canary rule](https://github.com/Lucent-Financial-Group/Zeta/blob/main/.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md))
- Tree integrity verified pre/post commit: 53/53 top-level entries (matches origin/main exactly)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T02:18:28Z)

## Pull request overview

Mechanical regeneration of `docs/BACKLOG.md` from per-row backlog files to clear generated-index drift.

**Changes:**
- Adds recently filed P1/P2/P3 backlog rows to the generated index.
- Updates 081KRHWGX0008QG0R0025PX5SZ from open to closed in the index.
- Leaves the known 081KRHWGX0008QG0R001XFRAHC duplicate-ID drift visible in the regenerated output.

## Review threads

### Thread 1: docs/BACKLOG.md:305 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T02:18:28Z):

This adds a second `081KRHWGX0008QG0R001XFRAHC` entry to the generated index while `docs/BACKLOG.md` still has the existing P2 `081KRHWGX0008QG0R001XFRAHC` entry at line 582. `tools/backlog/README.md:61` requires backlog IDs to be factory-wide unique, and `.github/workflows/gate.yml:767-791` runs the duplicate-ID lint, so merging this regenerated index still leaves readers and CI with an ambiguous `081KRHWGX0008QG0R001XFRAHC` reference.
