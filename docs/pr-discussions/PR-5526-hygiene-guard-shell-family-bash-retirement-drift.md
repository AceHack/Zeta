---
pr_number: 5526
title: "hygiene: guard shell-family bash-retirement drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T17:39:35Z"
merged_at: "2026-05-27T18:00:46Z"
closed_at: "2026-05-27T18:00:46Z"
head_ref: "claim/codex-loop-bash-retirement-drift-guard-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:20:40Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5526: hygiene: guard shell-family bash-retirement drift

## PR description

## Summary

- extend bash-retirement inventory enumeration from `.sh` only to shell-family globs: `.sh`, `.bash`, `.zsh`, `.ksh`, `.command`
- add a temp-repo test proving shell-family files are enumerated while `tools/lean4/` vendor scripts remain excluded
- update the TypeScript/Bun migration resume to match the widened guard surface

## Checks

- `bun test tools/hygiene/check-bash-retirement-inventory.test.ts`
- `bun tools/hygiene/check-bash-retirement-inventory.ts --enforce`
- `git diff --check`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T17:43:45Z)

## Pull request overview

This PR widens the bash-retirement inventory guard from tracking only `.sh` files to tracking a broader shell-family surface, adds a regression test to ensure enumeration works while Lean vendor scripts stay excluded, and updates the TypeScript/Bun migration trajectory to reflect the new scope.

**Changes:**

- Expand tracked shell inventory from `*.sh` to a shell-family glob set (`*.sh`, `*.bash`, `*.zsh`, `*.ksh`, `*.command`) in the hygiene guard.
- Add a temp-repo unit test proving shell-family enumeration works and `tools/lean4/` remains excluded.
- Update the TypeScript/Bun migration resume text to match the widened guard surface.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| tools/hygiene/check-bash-retirement-inventory.ts | Tracks additional shell-family extensions via git pathspec globs and updates messaging accordingly. |
| tools/hygiene/check-bash-retirement-inventory.test.ts | Adds a temp-repo test exercising the expanded enumeration and Lean exclusion behavior. |
| docs/trajectories/typescript-bun-migration/RESUME.md | Updates trajectory prose to describe shell-family drift instead of `.sh`-only drift. |
| docs/claims/codex-loop-bash-retirement-drift-guard-20260527.md | Adds a live claim file related to this work (needs release handling before merge). |

### COMMENTED — @AceHack (2026-05-27T17:49:24Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T17:49:24Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T17:49:24Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T17:49:24Z)

_(no body)_

## Review threads

### Thread 1: tools/hygiene/check-bash-retirement-inventory.test.ts:26 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T17:43:44Z):

P1: The test helper invokes `spawnSync("git", ...)` without the standard `sonarjs/no-os-command-from-path` suppression/rationale used elsewhere in the repo. Also, `spawnSync` failures set `result.error` (and typically `status === null`), but this helper only checks `status !== 0`, which can throw an unhelpful error with empty stderr; handle `result.error` explicitly (similar to the production `runGit`).

**@AceHack** (2026-05-27T17:49:24Z):

Fixed in 15a5db215: the test helper now carries the explicit git argv/shell-expansion rationale plus the sonarjs suppression, and it handles result.error before status checks. Focused checks passed: bun test tools/hygiene/check-bash-retirement-inventory.test.ts; bun tools/hygiene/check-bash-retirement-inventory.ts --enforce; git diff --check.

### Thread 2: docs/trajectories/typescript-bun-migration/RESUME.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T17:43:44Z):

P1: This paragraph still describes the guard as covering the remaining non-Lean “`.sh` inventory”, but the implementation and the rest of this PR widen the guard to shell-family extensions. Update this sentence to avoid doc/implementation drift.

**@AceHack** (2026-05-27T17:49:24Z):

Fixed in 15a5db215: the resume header now describes the remaining guarded surface as non-Lean shell-family inventory, matching the widened implementation.

### Thread 3: docs/trajectories/typescript-bun-migration/RESUME.md:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T17:43:45Z):

P1: `**Last updated**` is now stale (this file is edited in this PR). Please bump it to the current update date/time so the header metadata remains trustworthy.

**@AceHack** (2026-05-27T17:49:24Z):

Fixed in 15a5db215: bumped Last updated to 2026-05-27T17:48Z for this PR edit.

### Thread 4: docs/claims/codex-loop-bash-retirement-drift-guard-20260527.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T17:43:45Z):

P1: Claim files under `docs/claims/` are meant to be live-only and must be deleted in the same PR that lands the work (release step in the claim protocol). This PR adds a new claim file but does not release it; please delete this file before merge (and if you keep it on a claim branch, ensure the slug matches the required `task-*/backlog-*/issue-*` forms).

**@AceHack** (2026-05-27T17:49:24Z):

Fixed in 15a5db215: deleted the live claim file from docs/claims/ so the PR releases the claim before merge.

## General comments

### @chatgpt-codex-connector (2026-05-27T17:39:40Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
