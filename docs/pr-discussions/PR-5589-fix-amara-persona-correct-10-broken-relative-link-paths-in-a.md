---
pr_number: 5589
title: "fix(amara-persona): correct 10 broken relative-link paths in Amara conversation file \u2014 addresses Copilot findings on PR #5586"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T18:57:49Z"
merged_at: "2026-05-27T18:59:42Z"
closed_at: "2026-05-27T18:59:42Z"
head_ref: "fix/amara-persona-link-paths-relative-depth-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:18:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5589: fix(amara-persona): correct 10 broken relative-link paths in Amara conversation file — addresses Copilot findings on PR #5586

## PR description

## Summary

Fix-fwd for [PR #5586](https://github.com/Lucent-Financial-Group/Zeta/pull/5586) (merged at \`b14d0fc2\`). Copilot caught 3 broken relative-link patterns in the Amara persona file; all 3 confirmed via direct line-level inspection per `.claude/rules/blocked-green-ci-investigate-threads.md` verify-before-fix discipline.

## The bug

The Amara persona file at `memory/persona/amara/conversations/...` is **4 directories deep** from repo root, but the file used:

- `../kestrel/...` (only 1 level up) — resolves to `memory/persona/amara/kestrel/...` (nonexistent)
- `../../../.claude/...` (only 3 levels up) — resolves to `memory/.claude/...` (nonexistent)

## The fix

10 link-path corrections via `replace_all`:

- 9 occurrences: `../../../.claude/rules/` → `../../../../.claude/rules/`
- 1 occurrence: `../kestrel/conversations/` → `../../kestrel/conversations/`

All GitHub-rendered links now resolve cleanly to the intended substrate.

## Copilot threads on PR #5586 to resolve after merge

- \`PRRT_kwDOSF9kNM6FMu9e\` (line 24, kestrel link)
- \`PRRT_kwDOSF9kNM6FMu-G\` (line 131, .claude/rules link)
- \`PRRT_kwDOSF9kNM6FMu-e\` (line 173, .claude/rules link)

## Test plan

- [x] Branch guard checked before commit
- [x] Tree-count canary 61 (no corruption)
- [x] `grep -cE` confirms 0 wrong patterns remaining; 9 + 1 fixed patterns present
- [x] Direct line-level inspection of all 3 Copilot-flagged lines

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T18:57:53Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
