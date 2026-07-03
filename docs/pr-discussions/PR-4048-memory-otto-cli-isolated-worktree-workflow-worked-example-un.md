---
pr_number: 4048
title: "memory(otto-cli): isolated-worktree workflow worked example under zeta-expected-branch race-window caveat"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T08:21:33Z"
merged_at: "2026-05-17T08:29:00Z"
closed_at: "2026-05-17T08:29:00Z"
head_ref: "otto/worked-example-isolated-worktree-workflow-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T10:19:25Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4048: memory(otto-cli): isolated-worktree workflow worked example under zeta-expected-branch race-window caveat

## PR description

## Summary

Ships the worked-example memo for the new `zeta-expected-branch.md` race-window-caveat section that landed mid-task during the PR #4046 session arc.

The memo was authored at 2026-05-17T07:50Z but did not make PR #4046's commit batch (chronological gap — PR #4046 had been opened earlier; isolated worktree was already in commit state). Ships now as a 1-file follow-up.

## What's inside

Worked-example documentation of Steps 0-6:

0. Switch primary back (off the new branch I'd attempted to use)
1. Create isolated worktree at `/private/tmp/zeta-b0611-substrate-0740z`
2. Copy 10 substrate files from primary
3. Regenerate `docs/BACKLOG.md`
4. Single-Bash-call: add explicit-paths + branch-guard + commit + ls-tree-verify
5. Push (background) + verify remote
6. PR creation deferred under pure-git tier (rate-limit exhausted) → executed in subsequent tick

Empirical anchors captured:

- Worktree-add succeeded first try; 081KRMEXM0008QG0R000X1PPGC race did not fire
- ls-tree count 53 post-commit matches `origin/main` — no canary corruption per `codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`
- Branch-guard passed in same Bash call as commit (race window minimized to within one Bash subprocess)
- This PR is itself a second iteration of the workflow — proves the pattern is repeatable

## Test plan

- [ ] No file content changes outside the single memory file
- [ ] markdownlint passes (memo follows MD format conventions)
- [ ] No broken relative paths (memo cites rules + PRs without depth issues)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-17T08:22:49Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `4048c9c04a`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T08:24:08Z)

## Pull request overview

Adds a single memory memo documenting a worked example of the isolated-worktree commit workflow after the `zeta-expected-branch` race-window caveat.

**Changes:**

- Adds a feedback memory file with YAML frontmatter.
- Documents Steps 0–6 of the isolated-worktree workflow.
- Captures empirical anchors and related rule links.

## Review threads

### Thread 1: memory/feedback_otto_cli_isolated_worktree_workflow_worked_example_zeta_expected_branch_race_window_caveat_aaron_authorized_commit_2026_05_17.md:84 (resolved)

**@chatgpt-codex-connector** (2026-05-17T08:22:49Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace quoted wildcards in cp example**

The worked-example command uses quoted globs (`cp "$PRIMARY/docs/backlog/P2/081KRSKQ20008QG0R0014PPGZM-*.md" ...` and `cp "$PRIMARY/memory/feedback_otto_cli_lior_active_*.md" ...`), which prevents shell expansion and makes `cp` look for literal `*` filenames. In a normal Bash environment this causes the copy step to fail, so anyone replaying this memo cannot reproduce the documented “10 files copied” outcome unless they manually rewrite the command.

Useful? React with 👍 / 👎.

### Thread 2: memory/feedback_otto_cli_isolated_worktree_workflow_worked_example_zeta_expected_branch_race_window_caveat_aaron_authorized_commit_2026_05_17.md:85 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T08:24:07Z):

P1: This worked-example snippet is not executable as written: the `*` is inside double quotes, so the shell passes it literally to `cp` instead of expanding it. It also contradicts the surrounding “explicit cp per file (no glob)” claim. Replace these with the actual literal file paths, or mark the commands as abbreviated placeholders rather than a runnable copy recipe.

### Thread 3: memory/feedback_otto_cli_isolated_worktree_workflow_worked_example_zeta_expected_branch_race_window_caveat_aaron_authorized_commit_2026_05_17.md:115 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T08:24:08Z):

P1: The placeholder comment breaks the shell command chain if this snippet is copied: `#` comments out the trailing `&& \`, so `git status`, the branch guard, and the commit no longer depend on `git add` succeeding. Since this section documents the single-Bash-call guard discipline, use literal paths here or move the abbreviation outside the runnable command block.
