---
pr_number: 4999
title: "chore(.claude/settings): add explicit zflash + zflash-setup permissions (Aaron-authored)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T21:38:25Z"
merged_at: "2026-05-25T22:12:20Z"
closed_at: "2026-05-25T22:12:20Z"
head_ref: "chore/zflash-explicit-permissions-aaron-2026-05-25"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4999: chore(.claude/settings): add explicit zflash + zflash-setup permissions (Aaron-authored)

## PR description

## Summary

Adds two explicit narrow permission patterns to `.claude/settings.json`:

```jsonc
"Bash(bun full-ai-cluster/tools/zflash.ts *)",
"Bash(bun full-ai-cluster/tools/zflash-setup.ts *)",
```

Functionally redundant with the existing `Bash(bun *)` wildcard, but explicit narrow patterns serve as:

1. **Audit-trail documentation** in `settings.json` showing which specific destructive-op scripts are operator-authorized (matches 081KSE6WT0008QG0R0005XASX2's destructive-tool authoring contract header convention)
2. **Auto-classifier-friendly** — narrow explicit patterns are less likely to trigger conservative-default-deny under stricter classifier modes
3. **Knights-Guild-reviewable** authorization perimeter visible at a glance instead of inferred from a wildcard

## Aaron-authored

Aaron made the edit himself in a worktree I opened for him (operator-side work per the classifier-bypass-research + human-audit-and-legal-risk-acceptance discipline). Committing on his authorization (`"okay we have it"`).

## Composes with

- 081KSE6WT0008QG0R0005XASX2 (destructive-tool authoring contract — header convention this matches)
- 081KSE6WT0008QG0R003WZAQKV (the zflash tooling these permissions authorize; PR #4997)
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` (operator-side settings.json edit; agent commits operator-authored content)

## Test plan

- [x] Diff is exactly 2 lines added (no other changes)
- [x] Lines syntactically valid JSON (preserved by VS Code save)
- [x] No code changes; pure settings.json hygiene

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T21:40:02Z)

## Pull request overview

This PR updates the Claude tool permissions allowlist to explicitly authorize two `bun`-invoked zflash-related scripts, making the intended destructive-tool authorization perimeter more visible and classifier-friendly (even though `Bash(bun *)` already permits them).

**Changes:**
- Add explicit `Bash(bun full-ai-cluster/tools/zflash.ts *)` allow pattern.
- Add explicit `Bash(bun full-ai-cluster/tools/zflash-setup.ts *)` allow pattern.

## Review threads

### Thread 1: .claude/settings.json:55 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T21:40:02Z):

P1: These newly added allowlist entries reference `full-ai-cluster/tools/zflash.ts` and `full-ai-cluster/tools/zflash-setup.ts`, but those files don't exist in the current tree (only `flash-usb.ts` is present under `full-ai-cluster/tools/`). If these scripts land in a separate PR, this change should be merged after that PR (or the paths should be updated to the actual locations) to keep the permissions file as an accurate audit surface.

## General comments

### @AceHack (2026-05-25T22:12:13Z)

Verified Copilot finding: `zflash.ts` + `zflash-setup.ts` aren't on this branch — they land in companion [PR #4997 (081KSE6WT0008QG0R003WZAQKV)](https://github.com/Lucent-Financial-Group/Zeta/pull/4997). PR description names this explicitly as the forward-looking authorization pattern. Resolving no-op.
