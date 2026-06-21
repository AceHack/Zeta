---
pr_number: 6190
title: "fix(daemon): Enforce worktree isolation hygiene under ~/.zeta/agents/lior/"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-31T03:07:48Z"
merged_at: "2026-05-31T03:10:44Z"
closed_at: "2026-05-31T03:10:44Z"
head_ref: "lior/mechanize-worktree-hygiene"
base_ref: "main"
archived_at: "2026-05-31T03:35:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #6190: fix(daemon): Enforce worktree isolation hygiene under ~/.zeta/agents/lior/

## PR description

Lior: Mechanizing the 081KSNY2Z0008QG0R001RWF499 worktree hygiene discipline inside Lior's background loop runner. This structurally forces all Lior git worktrees to be created inside ~/.zeta/agents/lior/ instead of ~/Documents/src/repos/Zeta/ and mandates clean git worktree remove cleanup after merge.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-31T03:07:57Z)

Copilot wasn't able to review any files in this pull request.
