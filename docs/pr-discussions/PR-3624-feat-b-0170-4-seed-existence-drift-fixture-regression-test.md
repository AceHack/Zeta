---
pr_number: 3624
title: "feat(081KQNJ500008QG0R003SCWBDV.4): seed existence-drift fixture + regression test"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T00:01:18Z"
merged_at: "2026-05-16T00:04:09Z"
closed_at: "2026-05-16T00:04:09Z"
head_ref: "otto/b0170-4-existence-drift-fixture-2026-05-15-v2"
base_ref: "main"
archived_at: "2026-05-16T00:14:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3624: feat(081KQNJ500008QG0R003SCWBDV.4): seed existence-drift fixture + regression test

## PR description

## Summary

Smallest safe slice of 081KQNJ500008QG0R003SCWBDV.4 (fixture-tests + eval-set coverage). Extends [PR #3611](https://github.com/Lucent-Financial-Group/Zeta/pull/3611)'s count-drift seed to the existence-drift sub-class — the second of the 5 shipped check-types now has empirical-axis regression coverage.

- New `tools/substrate-claim-checker/fixtures/existence-drift-missing-doc.md` fixture modeling the verify-then-claim memo's body-table instance #8 (PR #1252 — future-domain memo referenced a `docs/` markdown file that didn't actually exist).
- New describe block in `fixtures.test.ts` asserting `check-existence.ts` emits exactly one drift finding at line 24 with severity `"drift"`.
- `fixtures/README.md` index gains the new fixture row.

## Why the fixture path is synthetic

The fixture cites `docs/_fixture_existence_drift_target_b0170_2026_05_15.md` — a clearly synthetic path no human or agent would create accidentally. This tests the empirical detection pattern, not a frozen substrate snapshot — substrate evolution can't break the regression by creating an unrelated file at the historical path.

## Discipline carried forward from PR #3611 review threads

`chatgpt-codex-connector` + `copilot-pull-request-reviewer` flagged a hazard on the count-drift fixture: restating the claim inside the HTML provenance comment let the test pass via the comment match alone, masking regressions in body-claim detection. Same discipline applied here:

- HTML provenance comment intentionally does NOT backtick-quote the exact fixture path
- Test asserts `findings.length === 1` (exact, not `>= 1`)
- Test pins `finding.line === 24` so a regression that stops detecting the body claim can't be masked

## Test plan

- [x] `bun tools/substrate-claim-checker/check-existence.ts <fixture>` — 1 drift finding at line 24, severity `"drift"`, exit 1
- [x] `bun test tools/substrate-claim-checker/fixtures.test.ts` — 2 pass, 12 expect() calls, exit 0
- [x] `bun test tools/substrate-claim-checker/` (full suite) — 114 pass, 0 fail, 256 expect() calls (negative-path stderr lines are intentional error-handling cases per PR #3611 convention)
- [x] Commit-tree integrity per `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` — `tools/substrate-claim-checker/` tree size 13 at both `HEAD~1` and `HEAD`

## Composes with

- 081KQNJ500008QG0R003SCWBDV.4 done-criteria ("fixture-tests + eval-set coverage for all shipped + new check-types") — incremental progress, one sub-class per slice per the `fixtures/README.md` procedure
- 081KQNJ500008QG0R003SCWBDV (parent row, `decomposed`)
- [PR #3611](https://github.com/Lucent-Financial-Group/Zeta/pull/3611) (count-drift seed; same scaffolding extended here)
- `memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md` — body-table instance #8 is the empirical anchor for this fixture

## Claim

`6c253d24-3ed0-4e89-8f3a-563b13f933cc` (otto-cli, 081KQNJ500008QG0R003SCWBDV)

operative-authorization: aaron 2026-05-14: "- **Devil-pole** (edge-runner drive): keep pushing, discover, go hard, never-be-idle"

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T00:02:51Z)

## Pull request overview

Extends the substrate-claim-checker eval-set (started in PR #3611) with the second drift sub-class — existence drift. Adds a synthetic-path fixture, a regression test asserting `check-existence.ts` emits exactly one drift finding at the expected line, and an index row in the fixtures README.

**Changes:**

- New `existence-drift-missing-doc.md` fixture using a clearly synthetic `docs/_fixture_existence_drift_target_b0170_2026_05_15.md` path, with HTML provenance comment that deliberately avoids backtick-quoting the path
- New `describe` block in `fixtures.test.ts` asserting exactly one finding at line 24 with severity `"drift"`
- `fixtures/README.md` index gains a row for the new fixture

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| tools/substrate-claim-checker/fixtures/README.md | Adds index row for the new existence-drift fixture |
| tools/substrate-claim-checker/fixtures/existence-drift-missing-doc.md | New fixture modeling PR #1252 existence-drift instance #8 with synthetic path |
| tools/substrate-claim-checker/fixtures.test.ts | Adds regression test for `check-existence.ts` against the new fixture |
