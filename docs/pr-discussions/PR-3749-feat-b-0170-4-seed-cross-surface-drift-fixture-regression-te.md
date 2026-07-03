---
pr_number: 3749
title: "feat(081KQNJ500008QG0R003SCWBDV.4): seed cross-surface-drift fixture + regression test"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T05:00:50Z"
merged_at: "2026-05-16T05:03:17Z"
closed_at: "2026-05-16T05:03:17Z"
head_ref: "otto/b0170-4-cross-surface-fixture-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T05:20:54Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3749: feat(081KQNJ500008QG0R003SCWBDV.4): seed cross-surface-drift fixture + regression test

## PR description

## Summary

Fourth eval-set fixture for substrate-claim-checker (081KQNJ500008QG0R003SCWBDV.4 — fixture-tests + eval-set coverage). Reproduces verify-then-claim memo **instance #19** — YAML frontmatter `description:` claimed "9 drift instances" while the body table already held 15 rows; `check-cross-surface`'s any-table semantics fire when zero body tables match the claim.

This slice extends the eval-set from 3 → 4 fixtures, covering the only shipped check (`check-cross-surface.ts`) that lacked a regression fixture. Pure additive — no checker code changes.

## Changes

- `tools/substrate-claim-checker/fixtures/cross-surface-drift-9-vs-15.md` — new fixture (frontmatter claim "9 drift instances" vs 15-row body table)
- `tools/substrate-claim-checker/fixtures.test.ts` — new `describe()` block for cross-surface drift; pins finding count (1), `field` ("description"), `claimedCount` (9), `claimIsMinimum` (false), `actualCounts` ([15]), and the claim contains "drift instances"
- `tools/substrate-claim-checker/fixtures/README.md` — fixture index row added

PR #3611 discipline preserved: the fixture's HTML provenance comment intentionally avoids restating the `<number> <noun>` pair (mirrors the count / existence / path-form fixtures for uniformity, even though check-cross-surface only scans frontmatter).

## Focused-check outcome

- `bun test tools/substrate-claim-checker/fixtures.test.ts` — 4/4 pass (1 new + 3 existing)
- `bun test tools/substrate-claim-checker/` — 116/116 pass across 6 files (the two `error:` lines in stderr are deliberate negative-path tests for the existence checker)
- CLI smoke test: `bun tools/substrate-claim-checker/check-cross-surface.ts tools/substrate-claim-checker/fixtures/cross-surface-drift-9-vs-15.md` → exit 1 with `cross-surface count drift — frontmatter.description claims "9 drift instances" (expected == 9); body tables have [15] rows`

## Composes with

- 081KQNJ500008QG0R003SCWBDV parent row (substrate-claim-checker TS tool mechanization)
- 081KQNJ500008QG0R003SCWBDV.4 sibling slices: PR #3611 (count-drift fixture), PR #3624 (existence-drift fixture), PR #3696 (path-form-drift fixture)
- `tools/substrate-claim-checker/check-cross-surface.ts` (v0.8 — the checker this fixture regresses against)
- verify-then-claim memo instance #19 (the empirical anchor)

## Test plan

- [x] `bun test tools/substrate-claim-checker/fixtures.test.ts` (focused)
- [x] `bun test tools/substrate-claim-checker/` (full module sweep, 116/116)
- [x] CLI exit code + finding shape verified against fixture
- [x] Tree-corruption canary: `git ls-tree HEAD` matches `HEAD~1` (53 root entries preserved)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T05:01:49Z)

## Pull request overview

Adds the fourth eval-set fixture for `substrate-claim-checker`, covering the cross-surface count-drift sub-class (frontmatter `description:` claim vs body-table rows). Purely additive — no checker code touched.

**Changes:**

- New fixture `cross-surface-drift-9-vs-15.md` with frontmatter claiming "9 drift instances" and a 15-row body table.
- New `describe()` block in `fixtures.test.ts` pinning exact finding count, field, claimed count, claim shape, and actual counts.
- Index row appended to `fixtures/README.md`.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| tools/substrate-claim-checker/fixtures/cross-surface-drift-9-vs-15.md | New fixture reproducing instance #19 (frontmatter vs body-table count drift). |
| tools/substrate-claim-checker/fixtures.test.ts | Regression test pinning the single expected cross-surface drift finding. |
| tools/substrate-claim-checker/fixtures/README.md | Index row added for the new fixture. |
