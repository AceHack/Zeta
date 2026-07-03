---
pr_number: 4711
title: "fix(rules): supersede #4710 with md004 fix on top (Copilot P0)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-23T02:35:52Z"
merged_at: "2026-05-23T02:37:51Z"
closed_at: "2026-05-23T02:37:51Z"
head_ref: "fix/pr-4710-md004-continuation-line-2026-05-23"
base_ref: "main"
archived_at: "2026-05-23T15:57:07Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4711: fix(rules): supersede #4710 with md004 fix on top (Copilot P0)

## PR description

Supersedes [#4710](https://github.com/Lucent-Financial-Group/Zeta/pull/4710) — carries its commit + an md004 fix on top.

Copilot P0 review on PR #4710 flagged that the new \"Narrow exception\" paragraph in `.claude/rules/claim-acquire-before-worktree-work.md:402` had a continuation line beginning with \`+ \\\`git branch -D <branch>\\\`\`. Per markdownlint MD004/ul-style guidance, \`+\` at line start inside an indented paragraph parses as a nested unordered list item and can fail CI.

## What this PR contains

- Commit `608d775f7` from #4710 (sub-case 4 retry policy reconciliation; default ABANDON + narrow forced-#6 exception)
- Commit `8e4123038` on top — rewords the parenthetical from \`(rm -rf <wt-path> + git branch -D <branch>)\` to \`(run rm -rf <wt-path> then git branch -D <branch>)\` to avoid MD004 trigger; semantics preserved (still a sequenced two-command cleanup)

## Closing #4710

#4710 will be closed once this PR lands — it's not redundant in terms of policy intent (this PR contains its commit), only in terms of the PR-as-mergeable-unit.

## Test plan

- [x] Commit canary: parent=54 child=54 on top of #4710's commit
- [x] Authored in isolated worktree per zeta-expected-branch race-window-caveat
- [x] Branch pushed via explicit refspec (defensive against local-ref contamination)
- [ ] markdownlint passes on this branch (was the failing check class)
- [ ] Copilot thread on #4710 resolves implicitly when #4710 closes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-23T02:37:36Z)

## Pull request overview

Updates `.claude/rules/claim-acquire-before-worktree-work.md` to reconcile the documented retry/abandon policy for saturation “sub-case 4” while also addressing a markdownlint MD004 (ul-style) failure mode caused by a continuation line starting with `+`.

**Changes:**

- Reframes sub-case 4 mitigation as “default = ABANDON” with a clearly scoped forced-#6-only single-retry exception.
- Rewords the orphan-cleanup parenthetical to use “then …” instead of `+ …` at line start, avoiding MD004 nested-list parsing.
