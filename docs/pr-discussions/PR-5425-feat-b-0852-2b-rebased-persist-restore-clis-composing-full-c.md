---
pr_number: 5425
title: "feat(081KSKBP80008QG0R003AX2A69.2b rebased): persist + restore CLIs composing full cred-persistence stack (19 integration tests; replaces conflict-dirty #5422)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T08:01:13Z"
merged_at: "2026-05-27T08:04:01Z"
closed_at: "2026-05-27T08:04:01Z"
head_ref: "feat/b-0852-2b-cli-rebased-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5425: feat(081KSKBP80008QG0R003AX2A69.2b rebased): persist + restore CLIs composing full cred-persistence stack (19 integration tests; replaces conflict-dirty #5422)

## PR description

## Summary

Re-land of PR #5422 substrate after parent PR #5421 (081KSKBP80008QG0R003AX2A69.2a envelope) squash-merged. Rebased onto origin/main; same 2 commits (feat + 14-finding fix-pass), conflict resolved by dropping the now-redundant .2a commit.

## Why a fresh PR instead of force-push

PR #5422 went DIRTY post-#5421 merge (chain-PR rebase requirement). Force-pushing the rebased commits onto #5422 was blocked by auto-mode classifier (destructive remote-history rewrite without explicit operator authorization). The substrate-honest non-destructive alternative is a fresh branch + fresh PR; #5422 will be closed substrate-honestly with cross-link to this PR.

## Changes (same as #5422)

- \`tools/installer/zeta-creds-persist.ts\` — persist CLI; composes crypto + manifest + handlers + envelope
- \`tools/installer/zeta-creds-restore.ts\` — restore CLI; single-decrypt RestorePlan + apply
- \`tools/installer/zeta-creds-persist-restore.test.ts\` — 19 integration tests covering full round-trip + error paths

All 14 Copilot review findings from #5422 already addressed in commit \`2a7371b3d\`:

- P0: CodeQL clear-text-logging fix (omit env-var name from error strings)
- P1: applyPlan double-decrypt eliminated (RestorePlan carries Buffer values)
- 5 error-handling bugs (readFileSync/writeFileSync try/catch wrapping; new exit code 4)
- MIN_BLOB_LEN off-by-one (AES-GCM permits 0-byte ciphertext)
- Doc corrections + unused import removal

## Test plan

- [x] All 36 tests pass (19 persist/restore + 17 envelope)
- [x] Per .claude/rules/agent-worktree-hygiene-never-hold-main-...: isolated worktree at /private/tmp/zeta-b0852-2b-clis-0744Z; never touched operator's primary checkout
- [x] Per .claude/rules/non-coercion-invariant.md HC-8: operator authority over own creds; passphrase NEVER logged
- [x] Per .claude/rules/methodology-hard-limits.md: clinical/security floor stays operative; no live-USB workarounds; substrate batches into next ISO cycle
- [x] Per .claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md: classifier correctly blocked force-push; non-destructive alternative used instead

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T08:01:18Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
