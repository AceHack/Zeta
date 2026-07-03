---
pr_number: 3274
title: "fix(shard-2146Z): convert inline grep to fenced code block + add file operands"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T21:55:35Z"
merged_at: "2026-05-14T21:56:52Z"
closed_at: "2026-05-14T21:56:52Z"
head_ref: "fix/shard-2146Z-grep-rendering-and-operands-otto-cli-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T22:07:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3274: fix(shard-2146Z): convert inline grep to fenced code block + add file operands

## PR description

## Summary

Post-merge cleanup of [#3271](https://github.com/Lucent-Financial-Group/Zeta/pull/3271). Copilot caught two real issues in the 2146Z shard's grep command:

1. **P1 rendering** — single-backtick inline code span contained literal backticks inside the regex (`` `? ``); Markdown terminated the span at the first inner backtick, rendering the rest as broken markup.
2. **P2 reproducibility** — the command was missing file/path operands; as written, `grep` reads stdin instead of scanning shard files.

## Changes

```bash
grep -nE '\[`?[^]]*`?\]\(\.claude/|\[[^]]*\]\(docs/hygiene' \
  docs/hygiene-history/ticks/2026/05/14/2*.md
```

- Fenced code block resolves the rendering issue (no inner-backtick conflict)
- Single-quoted regex prevents shell interpretation of `$`, `\`, etc.
- File operand makes the command actually reproducible

## Verified

Running the corrected command on `origin/main` returns exit code 1 (no matches) — matches the shard's claimed "zero other instances" result.

## Test plan

- [x] Corrected command runs cleanly + produces the claimed result
- [x] `markdownlint-cli2` clean
- [x] Composite branch-guard + `gh pr create --head` used
- [ ] CI clears
- [ ] Auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T21:57:07Z)

## Pull request overview

This PR fixes a documentation/rendering issue in the 2146Z hygiene tick by converting a problematic inline `grep` command into a fenced shell block and making the command reproducible with an explicit file operand.

**Changes:**

- Replaces the inline command span with a fenced `bash` code block.
- Uses single-quoted regex syntax and adds the shard file glob operand.
