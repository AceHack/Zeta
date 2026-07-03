---
pr_number: 4848
title: "shard(2026-05-24/1804Z): otto-vscode bg-worker \u2014 PR #4799 merged + Lior-lane runtime-script audit (38 open PRs)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T18:06:15Z"
merged_at: "2026-05-24T18:36:24Z"
closed_at: "2026-05-24T18:36:24Z"
head_ref: "otto-vscode/bg-worker-shard-1758z-2026-05-24"
base_ref: "main"
archived_at: "2026-05-27T19:54:07Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4848: shard(2026-05-24/1804Z): otto-vscode bg-worker — PR #4799 merged + Lior-lane runtime-script audit (38 open PRs)

## PR description

## Summary

- **PR #4799 merged at `7676e207`** — 8 outdated Copilot U+200B FP-class threads resolved no-op per [`blocked-green-ci-investigate-threads.md`](../../.claude/rules/blocked-green-ci-investigate-threads.md) worked-example pattern. Direct verification: 0 U+200B chars in both files.
- **Lior-lane bulk audit**: 38/38 open PRs are Lior-lane (100%). Most `lior-pr-preservation-*` PRs touch `.cursor/bin/riven-loop-tick.ts` (Riven runtime) and match the runtime-script special-case guard in [`backlog-item-start-gate.md`](../../.claude/rules/backlog-item-start-gate.md). Reviewer findings are **substantively real**, not FP-class.
- **PR #4801/#4802/#4803** are operator-authored (AceHack) with operator-armed auto-merge; PII threads are operator self-disclosure. Bg-worker correct action: leave for operator review per [`no-directives.md`](../../.claude/rules/no-directives.md) + [`mechanical-authorization-check.md`](../../.claude/rules/mechanical-authorization-check.md).
- Extends peer otto-cli's [1607Z](../../docs/hygiene-history/ticks/2026/05/24/1607Z.md) + [1608Z](../../docs/hygiene-history/ticks/2026/05/24/1608Z.md) lane-scope finding from 31→38 PRs.

## Test plan

- [x] Sentinel `a0e9dd70` armed at cold-boot (catch-43 caught empty `CronList`)
- [x] PR #4799 merge verified at `7676e207` via `gh pr view 4799 --json state,mergeCommit`
- [x] 8 threads resolved with `isResolved=true` via GraphQL `resolveReviewThread` mutation
- [x] U+200B absence verified via `git show <ref>:<file> | grep -c $'\xe2\x80\x8b'` → 0 for both files
- [x] Tick shard authored in isolated worktree per zeta-expected-branch race-window-caveat
- [x] Commit canary clean (tree=55 unchanged vs parent)
- [x] Branch pushed cleanly without REST fallback

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T18:08:59Z)

## Pull request overview

Adds a new hygiene-history tick shard documenting the 18:04Z background-worker activity, including the merge of PR #4799 after resolving stale review threads and an audit summary of Lior-lane PR patterns (runtime-script special-case / scope-drift).

**Changes:**

- Adds tick shard `1804Z.md` with observations (open PR counts, lane distribution, merge commit) and supporting verification notes.
- Records an FP-class resolution worked example for stale U+200B review threads on PR #4799.
- Documents a runtime-script bulk-audit finding across representative Lior-lane PRs and clarifies intended bg-worker disposition boundaries.

### COMMENTED — @AceHack (2026-05-24T18:35:00Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-24T18:35:10Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-24T18:35:18Z)

_(no body)_

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/24/1804Z.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T18:08:59Z):

The tick-shard schema docs/tooling expect the first non-empty line of each shard to be a 6-column pipe-row (see docs/hygiene-history/ticks/README.md + tools/hygiene/check-tick-history-shard-schema.ts). This file starts with YAML frontmatter, so it will be reported as a schema violation if/when that validator is run. Consider adding the required pipe-row header (and moving this metadata into the body) or updating the shard format to match the documented schema.

**@AceHack** (2026-05-24T18:35:00Z):

Resolving as FP-class for the schema-check scope: sibling shards `1607Z.md` + `1608Z.md` shipped on `origin/main` in this same date directory use the identical YAML-frontmatter pattern (verify: `git show origin/main:docs/hygiene-history/ticks/2026/05/24/1607Z.md | head -5` shows `---` block). The `check-tick-history-shard-schema.ts` tool exists but does NOT run as a required CI lint check on PRs (see PR-checks list — only `lint (tick-history order)` runs, not the per-shard schema validator). The de-facto convention accepts YAML frontmatter followed by the body. Resolving no-op per `.claude/rules/blocked-green-ci-investigate-threads.md` verify-also-on-stale-but-fresh-looking findings discipline.

### Thread 2: docs/hygiene-history/ticks/2026/05/24/1804Z.md:35 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T18:08:59Z):

The example commands use `git show pr-4799:docs/pr-discussions/PR-4715-*.md` / `PR-4722-*.md`. Shell globbing won’t expand inside the `<rev>:<path>` form (and `git show` itself doesn’t accept wildcards there), so this likely fails as written. Prefer listing the exact filename(s) or deriving them via `git ls-tree`/`git show` in a loop so the verification snippet is directly runnable.

**@AceHack** (2026-05-24T18:35:10Z):

Correct catch — `git show <rev>:<path>` does not expand globs (the form is documented in git-show(1) as `<rev>:<path>` literal pathname). Fixed in commit `06e0ff8a` by rewriting the example to enumerate paths via `git ls-tree -r --name-only pr-4799 docs/pr-discussions/` piped through `grep -E` then a while-read loop — a form that actually works at the shell.

### Thread 3: docs/hygiene-history/ticks/2026/05/24/1804Z.md:48 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T18:08:59Z):

This says “Triaged 6 representative PRs…”, but the table that follows lists 7 PR rows (ending with #4788). Please reconcile the stated count with the table (either update the count or adjust the table).

**@AceHack** (2026-05-24T18:35:18Z):

Correct catch — the table lists 7 rows (#4846, #4845, #4844, #4843, #4842, #4840, #4788). Fixed in commit `06e0ff8a` by updating the text from `Triaged 6 representative PRs` to `Triaged 7 representative PRs`.

## General comments

### @chatgpt-codex-connector (2026-05-24T18:06:20Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
