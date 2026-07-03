---
pr_number: 3228
title: "chore(b-0519): add Pattern 5/6 contamination defenses to RCA"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T20:32:48Z"
merged_at: "2026-05-14T20:34:05Z"
closed_at: "2026-05-14T20:34:05Z"
head_ref: "otto/b0519-add-new-contamination-defenses-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T20:45:33Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3228: chore(b-0519): add Pattern 5/6 contamination defenses to RCA

## PR description

## Summary

Additive update to [081KRHWGX0008QG0R001HMWM1W RCA](docs/backlog/P3/081KRHWGX0008QG0R001HMWM1W-multi-otto-branch-state-contamination-rca-2026-05-14.md) adding two contamination patterns surfaced today via field-test, plus the new cheap defenses that worked.

## Patterns added

- **Pattern 5** — HEAD detached at `origin/main` between `git push` and `gh pr create` (parallel-Otto check-out of `origin/main` in the same physical worktree).
- **Pattern 6** — HEAD on a different Otto's branch between recovery `checkout` and `gh pr create`.

## New cheap defenses (zero-code; field-tested first-try)

- `git branch --show-current` immediately before `git commit` — primary catch for wrong-branch commits. Validated on ticks 2010Z and 2026Z.
- `gh pr create --head <my-branch>` with explicit head ref — removes dependency on current-branch state, which can be poisoned by parallel-Otto checkouts.

## Caveat on env-var hook

Also noted in the RCA: the `ZETA_EXPECTED_BRANCH` `PreToolUse` hook is defense-in-depth only — env vars don't persist reliably across separate Bash-tool calls (each invocation may spawn a fresh shell). The substrate-honest primary catch is `git branch --show-current` immediately before `git commit`.

## Field-test ticks referenced

- [`docs/hygiene-history/ticks/2026/05/14/2010Z.md`](docs/hygiene-history/ticks/2026/05/14/2010Z.md) — first untangle field-test
- [`docs/hygiene-history/ticks/2026/05/14/2026Z.md`](docs/hygiene-history/ticks/2026/05/14/2026Z.md) — Pattern 5 + Pattern 6 validation

## Test plan

- [x] Pure additive update (57 insertions; no per-row metadata changes)
- [x] markdownlint-cli2 clean
- [x] `git branch --show-current` confirmed before commit + after commit
- [x] `gh pr create --head` explicit ref used
- [ ] CI clears
- [ ] Auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T20:34:01Z)

## Pull request overview

Additive documentation update to the 081KRHWGX0008QG0R001HMWM1W RCA row, appending two newly-observed multi-Otto branch-state contamination patterns and the zero-code defenses that worked in field-test.

**Changes:**

- Adds Pattern 5 (HEAD detached at `origin/main` between `git push` and `gh pr create`) and Pattern 6 (HEAD on another Otto's branch between recovery checkout and `gh pr create`).
- Documents new cheap defenses: `git branch --show-current` immediately before `git commit`, and `gh pr create --head <branch>` with explicit head ref.
- Notes env-var `ZETA_EXPECTED_BRANCH` hook is defense-in-depth only (doesn't persist across Bash-tool calls), and links the 2010Z/2026Z field-test ticks.

## General comments

### @chatgpt-codex-connector (2026-05-14T20:32:53Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
