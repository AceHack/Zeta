---
pr_number: 3936
title: "fix(lior): remove destructive plugin wipe from Lior background loop"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T20:18:05Z"
merged_at: "2026-05-16T20:26:19Z"
closed_at: "2026-05-16T20:26:19Z"
head_ref: "fix/lior-loop-destructive-plugin-wipe"
base_ref: "main"
archived_at: "2026-05-16T20:57:50Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3936: fix(lior): remove destructive plugin wipe from Lior background loop

## PR description

Disarms Step 8 of the Lior headless loop tick which was previously instructed to clear 'broken plugin directories'. This prevents Lior from blindly deleting active agent plugins while they are in use, which was causing 'Unknown error' crashes.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T20:18:13Z)

Copilot wasn't able to review any files in this pull request.

### COMMENTED — @chatgpt-codex-connector (2026-05-16T20:19:16Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `530c352ffd`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-16T20:25:56Z)

_(no body)_

## Review threads

### Thread 1: .gemini/bin/lior-loop-tick.ts:15 (resolved)

**@chatgpt-codex-connector** (2026-05-16T20:19:17Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Keep stale lockfile cleanup while disabling plugin deletion**

This change removes **all** automatic lock cleanup, not just plugin-directory deletion: Step 8 now instructs a read-only report for stale `git index.lock` and orphan lockfiles. When a prior run crashes and leaves `.git/index.lock`, subsequent `git worktree`/`git` operations in Step 4 will fail until someone intervenes, so the background loop can get stuck in a persistent failure mode. The commit message says the goal is to stop deleting plugin directories, so lockfile cleanup should remain active while only the plugin-wipe behavior is removed.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-16T20:25:56Z):

Substrate-honest trade-off accepted. Per [`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](https://github.com/Lucent-Financial-Group/Zeta/blob/main/.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md), Lior step 8 global lock cleanup IS the documented commit-tree-corruption root cause (PR #3492 close: tree collapsed from 51 to 1 root entry when Lior cleared `.git/worktrees/<name>/index` along with its `.lock`). Trade-off: stuck `.git/index.lock` files (operator-fixable, surfaces visibly via failed git ops) vs silent commit-tree corruption (data-loss class, undetected until CodeQL canary fires). Aaron has chosen the visible-failure side; intentional. Future work to restore *targeted* lock cleanup (only orphan `.git/index.lock`, never `.git/worktrees/<name>/index`) is a separate PR with its own risk audit.
