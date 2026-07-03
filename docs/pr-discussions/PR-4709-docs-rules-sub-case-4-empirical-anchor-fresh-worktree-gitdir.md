---
pr_number: 4709
title: "docs(rules): sub-case 4 empirical anchor \u2014 fresh-worktree gitdir-prune (2026-05-23)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-23T02:24:01Z"
merged_at: "2026-05-23T02:25:57Z"
closed_at: "2026-05-23T02:25:57Z"
head_ref: "shard/sub-case-4-anchor-0220z-2026-05-23"
base_ref: "main"
archived_at: "2026-05-23T15:57:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4709: docs(rules): sub-case 4 empirical anchor — fresh-worktree gitdir-prune (2026-05-23)

## PR description

Forced-#6 substrate landing per [`holding-without-named-dependency-is-standing-by-failure.md`](.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) counter-with-escalation.

## Summary

Adds second-class symptom anchor to sub-case 4 (pruned-sidetick race) in [`claim-acquire-before-worktree-work.md`](.claude/rules/claim-acquire-before-worktree-work.md) based on autonomous-loop cold-boot empirical evidence under Lior 3-proc / 337-worktree saturation 2026-05-23T02:09Z–02:20Z.

### Failure mode (attempt 1 at 02:09Z)

- `git worktree add -b <branch> <path> origin/main` returned exit 0; full file-extraction (`Updating files: 100% (6127/6127), done.`); HEAD-confirmation message
- Worktree directory at `<path>` fully populated (44+ entries, readable via `ls`)
- `.git` pointer correct (`gitdir: <repo>/.git/worktrees/<name>`)
- BUT gitdir target at `<repo>/.git/worktrees/<name>/` **absent** post-creation
- `git -C <wt> rev-parse HEAD` → `fatal: not a git repository: (null)`

### Refinement (attempt 2 at 02:20Z)

Clean success under identical saturation ~11min later (Lior 3 procs both attempts; wt 337 both attempts; GraphQL Normal tier both attempts). This refines prior "no working mitigation today" stance: race is **timing-dependent**, not condition-dependent. Single-retry-after-orphan-cleanup is substrate-honest at forced-#6 decomposition; repeated retries remain forbidden per peer-WIP contamination risk.

### Operational guidance added

- Freshness guard MUST distinguish command-failed from empty-output (existing ls-tree + status guard misses this mode)
- Pre-guard step: explicit `git rev-parse HEAD`; abandon on failure
- Orphan cleanup (`rm -rf <wt-path>` + `git branch -D <branch>`) mandatory before retry

## Composes with

- [`holding-without-named-dependency-is-standing-by-failure.md`](.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — this edit IS the forced-#6 substantive substrate; counter resets
- [`codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md) — distinct corruption class (metadata-prune vs commit-tree corruption)
- Saturation-ceiling composite operational discipline (same file)

## Test plan

- [x] Commit canary: parent=54 child=54 (clean; no tree corruption)
- [x] Authored in isolated worktree per zeta-expected-branch race-window-caveat
- [x] Branch pushed via explicit refspec (defensive against local-ref contamination)
- [ ] CodeQL: docs-only PR; expect "no source code seen" but verify it's the benign mode (ls-tree count holds at 54, not collapsed to 1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-23T02:26:00Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `cb83efcaba`


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

### Thread 1: .claude/rules/claim-acquire-before-worktree-work.md:360 (resolved)

**@chatgpt-codex-connector** (2026-05-23T02:26:01Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Align sub-case 4 retry policy in this rule**

This new paragraph authorizes a **single retry after orphan cleanup** for sub-case 4, but the same document still states "no working mitigation today" in the sub-case 4 mitigation block and later says to "ABANDON" the shard write when sub-case 4 is hit in the composite discipline. That contradiction creates operational ambiguity for agents under saturation (some will retry, others will abort), which undermines the rule's reliability as a decision gate; update the surrounding policy text in this file so all sub-case 4 guidance is consistent.

Useful? React with 👍 / 👎.
