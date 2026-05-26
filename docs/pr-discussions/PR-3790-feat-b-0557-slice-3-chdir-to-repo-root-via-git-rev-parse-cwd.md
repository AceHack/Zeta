---
pr_number: 3790
title: "feat(B-0557 slice 3): chdir to repo root via git rev-parse (cwd-independent)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T06:59:28Z"
merged_at: "2026-05-16T07:22:33Z"
closed_at: "2026-05-16T07:22:34Z"
head_ref: "feat/b0557-slice-3-cwd-independent-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T08:10:18Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3790: feat(B-0557 slice 3): chdir to repo root via git rev-parse (cwd-independent)

## PR description

## Summary

- Adds `process.chdir(detectRepoRoot())` at the start of `main()` in the audit tool.
- `detectRepoRoot()` invokes `git rev-parse --show-toplevel` and falls back to `process.cwd()` if git is unavailable or the tool runs outside a repo.
- Per Copilot P1 on PR #3758 ([B-0557](docs/backlog/P3/B-0557-audit-backlog-status-drift-quality-improvements-2026-05-16.md) slice 3).

## Test plan

- [x] 16/16 existing tests pass (no regression)
- [x] Smoke from `/tmp` returns honest `[]` (correctly handles outside-repo case)
- [ ] Smoke from a subdir of the repo (e.g., `cd docs && bun ../tools/...`) — should now produce same 33+ candidate output as from root (would be regression-test material in follow-up)

## Known limitation (follow-up candidate)

If invoked from outside any git repo, `git rev-parse` errors and the fallback `process.cwd()` doesn't locate the Zeta repo. A future iteration could use `import.meta.dir` to derive repo root from the tool's own file location (making truly cwd-independent — works from any cwd including non-repo dirs).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T07:01:51Z)

## Pull request overview

This PR makes the backlog status-drift audit tool work from repository subdirectories by detecting the Git repo root and changing the process cwd before relative path checks run.

**Changes:**
- Adds `detectRepoRoot()` using `git rev-parse --show-toplevel` with a cwd fallback.
- Calls `process.chdir(detectRepoRoot())` at the start of `main()`.
- Preserves existing argument parsing and reporting behavior after cwd normalization.

### COMMENTED — @chatgpt-codex-connector (2026-05-16T07:22:48Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `12374afb00`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: tools/hygiene/audit-backlog-status-drift.ts:269 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T07:01:50Z):

P1: The cwd-independent behavior is now implemented only through `main()` and `detectRepoRoot()`, but neither is exported or exercised by the existing test suite. The linked test file covers parsing and candidate filtering, so this regression (invoking from a repo subdirectory and getting the same results as repo root) can slip again without a smoke/unit test that runs the CLI from a subdirectory.

### Thread 2: tools/hygiene/audit-backlog-status-drift.ts:50 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T07:01:51Z):

P2: This current-state tool comment embeds PR-review provenance (`Copilot P1 on PR #3758`) in source code. The repository guidance keeps historical attribution in backlog/PR-history surfaces and asks reusable code comments to describe the current invariant instead; the B-0557 reference is enough context without the reviewer attribution.

### Thread 3: tools/hygiene/audit-backlog-status-drift.ts:56 (unresolved)

**@chatgpt-codex-connector** (2026-05-16T07:22:48Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Silence git stderr in repo-root detection fallback**

When this tool is invoked from a directory that is not a Git worktree, `execFileSync("git", ["rev-parse", "--show-toplevel"])` throws as expected, but Git’s fatal message is still emitted to stderr before the catch fallback runs. That means a successful run can now produce unexpected stderr noise (including in `--json` mode), which can break automation that treats any stderr output as a failed check. This behavior is introduced by the new root-detection path and should be suppressed when the fallback path is intentional.

Useful? React with 👍 / 👎.
