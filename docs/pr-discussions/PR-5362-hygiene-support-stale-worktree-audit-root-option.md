---
pr_number: 5362
title: "hygiene: support stale worktree audit root option"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T00:10:37Z"
merged_at: "2026-05-27T01:04:35Z"
closed_at: "2026-05-27T01:04:35Z"
head_ref: "claim/codex-loop-stale-worktree-root-option-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:30:19Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5362: hygiene: support stale worktree audit root option

## PR description

## Summary

- add `--root PATH` to `audit-stale-worktrees` so callers can inspect a control clone without changing cwd
- route list/prune through `git -C <root>` and cover argument parsing
- handle `spawnSync` launch errors explicitly in `audit()` + `runPrune()` (per Copilot review on this PR)
- tighten `hasFlagValue` to reject any dash-prefixed token (catches typos like `--report --verbose`)
- expand exit-128 header comment to cover `--root` failure modes
- claim was released per AGENT-CLAIM-PROTOCOL.md §TL;DR step 5 (no claim file shipped with this PR; coordination artifact deleted on landing)

## Checks

- `bun test tools/hygiene/audit-stale-worktrees.test.ts` (12 pass)
- `bun tools/hygiene/audit-stale-worktrees.ts --root /Users/acehack/.local/share/zeta-codex-loop/Zeta`
- `bun tools/hygiene/audit-stale-worktrees.ts --root /tmp/__nonexistent` → exit 128 with clean error
- `bun tools/hygiene/audit-stale-worktrees.ts --report --verbose` → "--report requires a path"
- `node_modules/.bin/prettier --check tools/hygiene/audit-stale-worktrees.ts tools/hygiene/audit-stale-worktrees.test.ts`
- `node_modules/.bin/tsc --noEmit -p tsconfig.json`
- `git diff --check`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T00:13:42Z)

## Pull request overview

Adds a `--root PATH` option to the stale worktree audit tool so callers can audit a specific repo without changing the current working directory, routing `list`/`prune` through `git -C <root>` and adding argument-parsing tests.

**Changes:**

- Add `--root PATH` CLI flag and thread it through `git worktree list/prune` via `git -C`.
- Export and test `parseArgs` to cover the new flag and combinations with `--report`/`--prune`.
- Add a new claim file for the work.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| tools/hygiene/audit-stale-worktrees.ts | Adds `--root` parsing + `git -C` routing and exports `parseArgs`. |
| tools/hygiene/audit-stale-worktrees.test.ts | Adds unit tests covering `--root` argument parsing. |
| docs/claims/codex-loop-stale-worktree-root-option-20260527.md | Adds a live claim file documenting scope/acceptance checks for this slice. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**tools/hygiene/audit-stale-worktrees.ts:84**

* P1: `--root`/`--report` consume the next token as a path even when the next token is another flag (e.g. `--root --prune`), which silently mis-parses the CLI and can cause `git -C --prune ...` failures. Treat known flags as missing-value errors to keep behavior predictable.
```
    if (a === "--root") {
      const next = argv[i + 1];
      if (!next) return { kind: "error", message: "--root requires a path" };
      root = next;
      i += 2;
    } else if (a === "--report") {
      const next = argv[i + 1];
      if (!next) return { kind: "error", message: "--report requires a path" };
      report = next;
      i += 2;
```
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T00:36:43Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 5 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T00:46:49Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T00:56:24Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: tools/hygiene/audit-stale-worktrees.ts:130 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:13:41Z):

P1: These `spawnSync("git", ...)` calls are missing the repo-wide `sonarjs/no-os-command-from-path` suppression used for PATH-resolved `git` invocations (e.g. `tools/hygiene/audit-git-hotspots.ts`). If/when `npm run lint:typescript` (eslint + sonarjs) is run on this file, it will likely fail on this line.

### Thread 2: tools/hygiene/audit-stale-worktrees.ts:164 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:13:41Z):

P1: Same as above: add the standard `sonarjs/no-os-command-from-path` suppression for this PATH-resolved `git` invocation to match the convention used across tools/ and avoid eslint failures when lint is run.

### Thread 3: docs/claims/codex-loop-stale-worktree-root-option-20260527.md:10 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:13:41Z):

P1: Claim files under `docs/claims/` are intended to be *live* coordination artifacts and should be deleted in the same PR that lands the work (per `docs/AGENT-CLAIM-PROTOCOL.md` §TL;DR step 5 and `docs/claims/README.md`). This PR adds a new claim file but does not release it, which will leave a stale claim on `main` after merge.

### Thread 4: tools/hygiene/audit-stale-worktrees.ts:72 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:36:42Z):

`hasFlagValue` only rejects *known* flags as the value for `--root/--report`, so a typo/unknown flag like `--report --verbose` will be silently accepted as a filename instead of producing the expected "Unknown argument" error. Rejecting any dash-prefixed token avoids swallowing flags as values (paths that start with `-` can still be passed with an explicit `./` prefix).

### Thread 5: tools/hygiene/audit-stale-worktrees.ts:137 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:36:42Z):

`spawnSync` can fail with `list.error` (e.g., git not on PATH, invalid executable). In that case `status` is `null` and `stderr` can be empty, so the current error path can produce an unhelpful message like `git worktree list failed: null/undefined`. Handle `list.error` explicitly and normalize stderr/stdout for non-zero exits.

### Thread 6: tools/hygiene/audit-stale-worktrees.ts:168 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:36:43Z):

`runPrune` has the same `spawnSync` error-mode issue as `audit`: if git can't be launched, `status` is `null` and the output string will be empty, making failures hard to diagnose. Surface `r.error` in `output` and mark the run as not ok.

### Thread 7: tools/hygiene/audit-stale-worktrees.ts:30 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:36:43Z):

With the new `--root` option, exit code `128` can now reflect more than "not inside a git worktree" (e.g., `--root` points at a non-repo, missing directory, or git failed to launch). Update the header comment so the documented meaning matches actual behavior.

### Thread 8: tools/hygiene/audit-stale-worktrees.ts:251 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:36:43Z):

PR description mentions adding `docs/claims/codex-loop-stale-worktree-root-option-20260527.md`, but that file does not exist in the current changeset (and isn’t present under `docs/claims/`). Either add the claim file or update the PR description to match what’s actually included.

### Thread 9: tools/hygiene/audit-stale-worktrees.ts:72 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:46:49Z):

P2: The comment on `hasFlagValue` says `--report --verbose` will produce an "Unknown argument" error, but `parseArgs` actually returns `--report requires a path` (and the tests assert that). Update the comment to describe the real behavior so it doesn’t mislead future maintainers.

### Thread 10: tools/hygiene/audit-stale-worktrees.ts:74 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:56:24Z):

`hasFlagValue` currently treats an empty string as a valid path value. This allows invocations like `--report ""` (or `--root ""`) to pass argument parsing and then fail later (e.g., `writeFileSync("")` throws) with an unexpected exit code/stack trace instead of a clean `64` argument error.

## General comments

### @chatgpt-codex-connector (2026-05-27T00:10:41Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-27T00:31:28Z)

Vera coordination update, 2026-05-27T00:31Z: commit fc0a6573c addresses the Copilot flag-token parser finding; the submit-nuget transient failure was inspected, rerun, and is now passing. All visible and required checks are green. Auto-merge remains armed, but GitHub still reports mergeStateStatus=BLOCKED and the PR remains open; no further CI rerun or code patch is warranted from Vera unless fresh state changes.
