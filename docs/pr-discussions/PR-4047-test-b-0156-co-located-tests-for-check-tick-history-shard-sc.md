---
pr_number: 4047
title: "test(081KQGDBJ0008QG0R000A4EZS5): co-located tests for check-tick-history-shard-schema.ts (9 tests)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T08:01:10Z"
merged_at: "2026-05-17T08:04:32Z"
closed_at: "2026-05-17T08:04:32Z"
head_ref: "otto-bg/b0156-schema-test-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T10:19:26Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4047: test(081KQGDBJ0008QG0R000A4EZS5): co-located tests for check-tick-history-shard-schema.ts (9 tests)

## PR description

## Summary

Smallest bounded slice of 081KQGDBJ0008QG0R000A4EZS5 — addresses acceptance criterion 2 ("each
TS sibling has at least one bun test covering its primary entry path") for
the Phase 2 schema port at `tools/hygiene/check-tick-history-shard-schema.ts`.
The `.sh` original was retired in PR #1986; the `.ts` had no co-located test.

## What

- `tools/hygiene/check-tick-history-shard-schema.ts`: export `scanOne` and
  `ScanResult` (2-line change; no behavior change).
- `tools/hygiene/check-tick-history-shard-schema.test.ts`: 9 cases
  - 3 acceptance paths: `HHMMZ.md`, `HHMMZ-<hex>.md`, `HH:MM:SSZ` col1
  - 6 violation paths: bad filename, col1 date/time mismatches,
    insufficient pipes, empty file, col1 format error
- Dynamic-import pattern so `REPO_ROOT` is set to a tmpdir before module
  load; captures + restores prior `REPO_ROOT` to keep env clean across
  the broader `bun test` run.

## Why

The 081KQGDBJ0008QG0R000A4EZS5 row's audit shows all 6 non-install `.sh` files now have
working `.ts` siblings (Phase 5 sweep done), but criterion 2 (test
coverage) was unverified for the 3 hygiene ports. The schema port is
the smallest (~5KB) and has the most testable surface (per-shard
validator returning structured `ScanResult`). This PR ships exactly
one bounded step toward closing 081KQGDBJ0008QG0R000A4EZS5.

## Checks

- `bun test tools/hygiene/check-tick-history-shard-schema.test.ts`:
  **9/9 pass**
- `bun test tools/hygiene/`: **181/181 pass** (no regression — and
  the env-restore in `afterAll` actually unblocked the broader suite
  by avoiding `REPO_ROOT` pollution)
- `bun tools/hygiene/check-tick-history-shard-schema.ts`: production
  CLI runs unchanged; pre-existing repo shard violations preserved

## 081KQGDBJ0008QG0R000A4EZS5 status after this PR

The row's audit baseline (3 remaining `.sh` files) is now stale — the
re-verification command in the row's self-test section shows zero
remaining non-install `.sh` files without `.ts` siblings. After this
PR, two `.ts` ports remain without co-located tests
(`snapshot-github-settings.ts`, `check-github-settings-drift.ts`); both
are candidates for follow-on slices.

## Test plan

- [x] Tests pass standalone
- [x] Tests pass in broader hygiene suite
- [x] Production CLI unaffected
- [x] Pushed claim branch before write work (otto-bg/b0156-schema-test-2026-05-17)
- [x] Isolated worktree (`.claude/worktrees/agile-doodling-iverson`); did not touch root checkout
- [x] Branch guard verified pre-commit
- [x] `git ls-tree HEAD` = 53 entries (no commit-tree corruption)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T08:06:24Z)

## Pull request overview

Adds co-located Bun tests for the tick-history shard schema checker and exports the validator seam needed by those tests.

**Changes:**

- Exports `ScanResult` and `scanOne` from the shard schema checker.
- Adds 9 Bun tests covering valid shards and common schema violations.
- Uses a temporary `REPO_ROOT` fixture to avoid touching the real repository.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| `tools/hygiene/check-tick-history-shard-schema.ts` | Exposes the per-shard scanner and result type for testing. |
| `tools/hygiene/check-tick-history-shard-schema.test.ts` | Adds co-located tests for accepted and rejected shard schema cases. |

## Review threads

### Thread 1: tools/hygiene/check-tick-history-shard-schema.test.ts:47 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T08:06:23Z):

This test suite does not exercise the documented `HHMMSSZ-<hex>.md` filename form even though the validator and shard README list it as one of the accepted schemas. A regression in that branch of the filename parser would still pass this new coverage, so add an acceptance case for the seconds+hash form.

### Thread 2: tools/hygiene/check-tick-history-shard-schema.test.ts:24 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T08:06:24Z):

Importing the module while `REPO_ROOT` points at the temp directory permanently caches the module-level `ROOT` for this test process; after `afterAll` deletes the temp tree, any later import of this checker in the same Bun test process would reuse a stale/deleted root. Prefer a lazy/parameterized root seam for `scanOne` so tests don't have to mutate global env before module load.
