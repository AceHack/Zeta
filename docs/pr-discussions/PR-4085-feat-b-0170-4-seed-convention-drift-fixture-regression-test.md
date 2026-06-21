---
pr_number: 4085
title: "feat(081KQNJ500008QG0R003SCWBDV.4): seed convention-drift fixture + regression test"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T14:01:15Z"
merged_at: "2026-05-17T14:05:10Z"
closed_at: "2026-05-17T14:05:10Z"
head_ref: "feat/b-0170-convention-drift-fixture-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T14:28:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4085: feat(081KQNJ500008QG0R003SCWBDV.4): seed convention-drift fixture + regression test

## PR description

## Summary

5th eval-set fixture for the substrate-claim-checker. Covers the **convention** sub-class of the 7-class verify-then-claim taxonomy via a self-contained fixture pair (current ADR + sibling predecessor ADR support file). Synthetic exemplar; anchor PR #2512 (the PR that shipped `check-convention.ts`).

Continues the 081KQNJ500008QG0R003SCWBDV.4 eval-set thread:

- PR #3611 — count-drift fixture
- PR #3624 — existence-drift fixture
- PR #3696 — path-form-drift fixture
- PR #3749 — cross-surface-drift fixture
- **this PR** — convention-drift fixture

Remaining check-types for 081KQNJ500008QG0R003SCWBDV.4 thread completion: semantic-equivalence-drift, empirical-output-drift, self-recursive-drift (none yet shipped as checkers).

## Files

- `tools/substrate-claim-checker/fixtures/convention-drift-no-reciprocal-marker.md` (new) — current ADR claiming supersession
- `tools/substrate-claim-checker/fixtures/_convention-drift-target-adr.md` (new) — predecessor ADR support file (leading-underscore marks "fixture support, not a top-level fixture")
- `tools/substrate-claim-checker/fixtures/README.md` — fixture-index row added
- `tools/substrate-claim-checker/fixtures.test.ts` — regression test added; pins exact finding count (1), claim line (36), target path, and reason substring (`"not reciprocated"`, `"Superseded by"`)

The fixture pair is self-contained: `check-convention.ts`'s 3-root resolution (fileDir / parentDir / repoRoot) finds the support file via `fileDir` without dragging in any real repo ADR pair.

Per PR #3611 review-thread discipline, the fixture's HTML-comment provenance intentionally avoids restating the literal `Supersedes ADR ...` claim so a regression in body-claim detection cannot be masked by a comment-side match.

## Focused checks

- ` bun test tools/substrate-claim-checker/fixtures.test.ts` → **5 pass / 0 fail / 30 expects**
- ` bun test tools/substrate-claim-checker/` (full suite) → **117 pass / 0 fail / 274 expects** (6 files)
- Direct CLI run: `bun tools/substrate-claim-checker/check-convention.ts tools/substrate-claim-checker/fixtures/convention-drift-no-reciprocal-marker.md` → exits 1 with `1 convention-drift finding(s)` on line 36 with reciprocal-marker reason string
- Tree-count canary: `git ls-tree HEAD` = 53 entries (matches `origin/main`)

## Test plan

- [x] Focused fixture test passes
- [x] Full substrate-claim-checker suite passes
- [x] Direct CLI invocation reports expected finding shape
- [x] No commit-tree corruption (53 root entries vs 53 on main)

## Composes with

- 081KQNJ500008QG0R003SCWBDV (parent backlog row)
- PR #2512 (anchor — check-convention.ts shipped)
- PRs #3611 / #3624 / #3696 / #3749 (sibling 081KQNJ500008QG0R003SCWBDV.4 eval-set fixtures)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T14:03:21Z)

## Pull request overview

Adds the fifth empirical eval-set fixture to `tools/substrate-claim-checker`, covering the **convention drift** checker (ADR supersession reciprocity) and wiring a regression test to ensure the checker continues to flag the missing reciprocal “Superseded by” marker pattern.

**Changes:**
- Added a self-contained convention-drift fixture pair (current ADR + predecessor support ADR) under `tools/substrate-claim-checker/fixtures/`.
- Extended `fixtures.test.ts` with a regression test that pins exact finding shape (count, claim line, target path, reason substrings).
- Updated the fixtures index README to include the new convention-drift fixture row.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| tools/substrate-claim-checker/fixtures/README.md | Adds the convention-drift fixture row to the eval-set index. |
| tools/substrate-claim-checker/fixtures/convention-drift-no-reciprocal-marker.md | New “current ADR” fixture containing a `Supersedes ADR \`...\`` body claim. |
| tools/substrate-claim-checker/fixtures/_convention-drift-target-adr.md | New predecessor ADR support file intentionally missing the reciprocal “Superseded by” marker. |
| tools/substrate-claim-checker/fixtures.test.ts | Adds a convention-drift regression test that asserts exact finding count/line/target/reason substrings. |
