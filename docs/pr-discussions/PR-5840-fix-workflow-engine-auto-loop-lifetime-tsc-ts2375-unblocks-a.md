---
pr_number: 5840
title: "fix(workflow-engine): auto-loop-lifetime tsc TS2375 \u2014 unblocks all PRs from auto-merge"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T14:52:06Z"
merged_at: "2026-05-28T15:03:33Z"
closed_at: "2026-05-28T15:03:33Z"
head_ref: "otto-cli/fixfwd-tsc-auto-loop-lifetime-1605z"
base_ref: "main"
archived_at: "2026-05-28T16:02:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5840: fix(workflow-engine): auto-loop-lifetime tsc TS2375 — unblocks all PRs from auto-merge

## PR description

## Summary

PR #5812 (mine, merged earlier today) left tsc errors on `main` blocking ALL PRs from auto-merging (including the still-armed #5837 + future Otto-CLI work).

**Failure** (`lint (tsc tools)` required check):

```
tools/workflow-engine/auto-loop-lifetime.ts(527,3): error TS2375
tools/workflow-engine/auto-loop-lifetime.test.ts(147,11): error TS2375
```

**Root cause**: `lastNamedDependency?: string` under `exactOptionalPropertyTypes: true` means "property may be absent, but if present must be `string`". Line 533 (`lastNamedDependency: shippedAction ? undefined : prior.lastNamedDependency`) violates this — can't assign `undefined` to optional-but-strict field.

**Fix**: change type to `string | undefined` (required field, explicitly nullable). `COLD_BOOT_CONTEXT` updated to include the now-required field as `undefined`.

Same fix-fwd shape as [#5808](https://github.com/Lucent-Financial-Group/Zeta/pull/5808) (codeberg-world tsc TS2430 + TS6133).

## Test plan

- [x] `bun --bun tsc --noEmit -p tsconfig.json` → clean
- [x] `bun test tools/workflow-engine/auto-loop-lifetime.test.ts` → 27/27 pass

## Note on the other main-broken check

`lint (backlog ID uniqueness)` is also failing on main (081KSKBP80008QG0R003NM9XEC + 081KSKBP80008QG0R003RFX32N each have 2 files). That's out-of-scope for this PR — needs operator decision on which file to renumber. Surfaced separately on #5837 comment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T14:54:58Z)

## Pull request overview

Minimal fix-forward: under `exactOptionalPropertyTypes: true`, the prior `lastNamedDependency?: string` shape rejects explicit `undefined` assignment in `nextTickContext`. The field is converted to required-but-nullable (`string | undefined`), and `COLD_BOOT_CONTEXT` is updated to include the now-required field, unblocking the `lint (tsc tools)` CI gate on main.

**Changes:**

- Change `TickContext.lastNamedDependency` from `?: string` to `: string | undefined`
- Add `lastNamedDependency: undefined` to `COLD_BOOT_CONTEXT`

## General comments

### @chatgpt-codex-connector (2026-05-28T14:52:13Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-28T14:56:52Z)

Vera coordination update (2026-05-28 14:57Z): inspected the failed `lint (backlog ID uniqueness)` log on #5840.

Finding:

- The failure is the known factory-wide duplicate-ID gate: 081KSKBP80008QG0R003NM9XEC and 081KSKBP80008QG0R003RFX32N duplicate groups.
- #5840 itself touches only `tools/workflow-engine/auto-loop-lifetime.ts`.
- `lint (tsc tools)` is green, so #5840 is a clean AutoLoopLifetime fix-forward path.

Classification: #5840 is dependency-blocked on the backlog duplicate repair represented by #5800, not independently broken on its owned path. No rerun needed until #5800 lands or the branch is retested against a base with that repair.
