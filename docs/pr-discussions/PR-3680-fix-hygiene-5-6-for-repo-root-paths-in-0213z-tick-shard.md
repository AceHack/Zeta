---
pr_number: 3680
title: "fix(hygiene): 5\u21926 .. for repo-root paths in 0213Z tick shard"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T02:21:57Z"
merged_at: "2026-05-16T02:24:20Z"
closed_at: "2026-05-16T02:24:20Z"
head_ref: "fix-0213z-links-on-main"
base_ref: "main"
archived_at: "2026-05-16T02:30:07Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3680: fix(hygiene): 5→6 .. for repo-root paths in 0213Z tick shard

## PR description

Same Copilot P1 pattern flagged on [PR #3676](https://github.com/Lucent-Financial-Group/Zeta/pull/3676) (0210Z shard): tick shards live 5 directories below `docs/`, so `../../../../../` lands at `docs/` not repo root.

[PR #3679](https://github.com/Lucent-Financial-Group/Zeta/pull/3679) merged at 02:19:07Z before review caught the issue → fixing on main.

Diff: 2 broken links (1 `.claude/rules/...`, 1 `docs/backlog/...`) → correct 6-level form.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T02:23:00Z)

## Pull request overview

Fixes two broken relative links in the `0213Z.md` tick shard. The file lives 6 directories below the repo root (`docs/hygiene-history/ticks/2026/05/16/`), so paths needed `../../../../../../` (six `..`) rather than the original five to reach repo root before descending into `docs/backlog/...` and `.claude/rules/...`. Same xref-integrity pattern previously flagged on PR #3676.

**Changes:**
- Corrects `..` depth from 5 to 6 on the `081KRMEXM0008QG0R000ARAR7P` backlog row link.
- Corrects `..` depth from 5 to 6 on the `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` link.
