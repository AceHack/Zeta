---
pr_number: 844
title: "ops(0-0-0): post-reset cleanup \u2014 stale-prose fixes + protection-config memory"
author: "AceHack"
state: "CLOSED"
created_at: "2026-04-29T14:14:41Z"
closed_at: "2026-04-29T14:18:52Z"
head_ref: "post-0-0-0-cleanup-2026-04-29"
base_ref: "main"
archived_at: "2026-04-29T14:30:11Z"
archive_tool: "tools/pr-preservation/archive-pr.sh"
---

# PR #844: ops(0-0-0): post-reset cleanup — stale-prose fixes + protection-config memory

## PR description

## Summary

The small in-lane cleanup PR Amara prescribed after 0/0/0 was reached. Two scoped changes:

1. **Stale-prose fixes in `docs/active-trajectory.md`** — flip post-reset contradicting language to in-force 0/0/0-achieved language
2. **Protection-config memory** — document the dual-layer surprise + Aaron's "delete legacy, rulesets canonical" decision

## 🎯 0/0/0 ACHIEVED 2026-04-29T14:04:50Z

```
AceHack/main = LFG/main = 621aae082d70fcbf36931718ecf1b6d9e149295f
Topology:    0 ahead, 0 behind, 0 file content diff
Archive ref: archive/acehack-main-pre-000-reset-2026-04-29 → 6755081... (preserved)
Layers:      legacy DELETED (per Aaron); rulesets re-enabled
```

## Stale-prose fixes (Amara substrate-pass catch)

Two paragraphs flipped from pre-reset state to in-force post-reset state:
- Line 221: *"Currently NOT signoff-eligible"* → *"0/0/0 ACHIEVED 2026-04-29T14:04:50Z..."*
- Line 413: *"Hard-reset is NOT YET signoff-eligible"* → *"Hard-reset complete (2026-04-29T14:04:50Z)..."*

This is **Derived-Rollup Drift** class — primary state changed, downstream prose still claims old state. Caught pre-commit by Amara's substrate pass; not a Codex/Copilot retry.

## Protection-config memory

`memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md`:

- AceHack/Zeta had BOTH legacy branch protection AND repository rulesets on `main`
- Both layers enforced independently; GitHub UI doesn't surface dual-layer state
- Aaron: *"I knew there were two but I was confused why."*
- Maintainer call: legacy DELETED, rulesets canonical going forward
- Error-code mapping: `GH013` = rulesets surface, `GH006` = legacy surface
- Diagnostic script (`gh api` commands) for future audits
- Future-protocol note: rulesets `non_fast_forward` rule still doesn't match CLAUDE.md's *"force-push to AceHack main is part of protocol"* — task #305 home for that decision

`MEMORY.md` index updated with one-line pointer.

## Tick shard 1410Z

Records the entire 0/0/0 hard-reset arc:
- Triple-check buddy review (Amara approved meaningful-content-loss-free)
- Verify-only gate packet (5/5 PASS at 13:39Z)
- Aaron's explicit EXECUTE at 13:58Z
- Steps A/B/C with the dual-layer surprise + recovery
- Path 1 v3 success at 14:04:50Z

## What this PR does NOT do (per Amara's lane discipline)

- ❌ Does NOT start the recovery lane (inventory parked at `/tmp/recovery-inventory-2026-04-29.tsv`, awaits Amara's classification framework which just landed)
- ❌ Does NOT consolidate the 8 deferred-queue rule candidates (P1 work, post-0/0/0-success-trigger satisfied but lane discipline says one cleanup PR first)
- ❌ Does NOT touch Aurora extension (P2)
- ❌ Does NOT mutate any branches/worktrees/stashes (Aaron's authority for irreversible)

## Authority boundary going forward (per Amara post-reset packet)

```
Reversible + in-lane + PR-reviewed → proceed autonomously
Irreversible / deletion / force-push / authority config / identity canon → ask Aaron
Unclear → stop, report exact uncertainty, propose one safe action
```

## Test plan

- [x] Stale "Currently NOT signoff-eligible" → in-force 0/0/0-achieved language
- [x] Stale "Hard-reset is NOT YET signoff-eligible" → "Hard-reset complete" language
- [x] Memory file written + MEMORY.md index updated
- [x] Tick shard 1410Z appended
- [x] No new ledger headline introduced (273/0/0 doesn't need to flip — it's the final state)
- [ ] CI green
- [ ] Codex / Copilot reviews resolved if any threads land

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-04-29T14:16:32Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `8630c28e57`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-04-29T14:19:29Z)

## Pull request overview

Post-0/0/0 cleanup to align durable docs/memory with the now-in-force hard-reset state and to capture the branch-protection dual-layer incident for future debugging.

**Changes:**
- Updates `docs/active-trajectory.md` to reflect that the 0/0/0 hard-reset is complete (replacing stale “not signoff-eligible” prose).
- Adds a new memory entry documenting the dual-layer (rulesets + legacy branch protection) enforcement surprise and the chosen canonical surface going forward.
- Updates the memory index and appends a tick shard recording the reset arc and this cleanup PR.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| `memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md` | New memory capturing the GH013/GH006 dual-layer behavior, decision, and diagnostics. |
| `memory/MEMORY.md` | Adds an index entry pointing to the new protection-config memory. |
| `docs/hygiene-history/ticks/2026/04/29/1410Z.md` | New tick shard recording the 0/0/0 achievement and follow-on cleanup PR. |
| `docs/active-trajectory.md` | Flips two stale paragraphs to reflect the achieved post-reset state. |

## Review threads

### Thread 1: memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md:40 (resolved)

**@chatgpt-codex-connector** (2026-04-29T14:16:33Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Use supported gh api request-body syntax**

The `Executed` commands document `gh api ... --input '{"enforcement": "disabled"}'`, but `gh api` treats `--input` as a file argument (manual: `--input <file>`, use `-` for stdin), so this form is interpreted as a filename and is not reproducible as written. Because this memory file is positioned as an operational reference for future protection toggles, the current command text can cause failed retries during incident handling; use a real file/stdin body or field flags instead.

Useful? React with 👍 / 👎.

### Thread 2: memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md:42 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-29T14:19:27Z):

The `gh api ... --input '{"enforcement": ...}'` invocations won’t work as written: `gh api --input` expects a file path (or stdin via `--input -`), not an inline JSON string. Use `-f enforcement=...`/`-F enforcement=...`, or pass JSON via stdin (e.g., `--input -`) so this is copy/paste-correct for future audits.

### Thread 3: memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md:43 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-29T14:19:28Z):

The step list appears internally inconsistent: the earlier GH006 rejection indicates legacy branch protection was active, but the subsequent `gh api -X DELETE .../branches/main/protection` line claims a 404 "Branch not protected" response (which typically means there was no classic protection to delete). To keep this memory reliable, please reconcile this (e.g., clarify an intermediate UI/API change, confirm the endpoint/repo/branch used, or update the recorded responses).
```suggestion
# Delete legacy branch protection (this removed the GH006 blocker)
gh api -X DELETE repos/AceHack/Zeta/branches/main/protection
# → 204 No Content
```

### Thread 4: memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md:82 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-29T14:19:28Z):

References to “Task #305” here are ambiguous in-repo (this repo already has a PR #305, and backlog rows use `B-####` IDs under `docs/backlog/**`). Consider replacing “Task #305”/“#305-adjacent” with the actual backlog-row ID (if any) or a direct URL so readers don’t chase the wrong artifact.

### Thread 5: memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md:18 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-29T14:19:28Z):

Minor wording nit: “the only rulesets ruleset” reads like a duplication. Consider rephrasing to “the only ruleset” / “the only rulesets entry” for clarity.
```suggestion
After disabling the only ruleset (id=15524390 "Default", `enforcement: disabled`) and retrying, the push was rejected AGAIN with a **different error code**:
```

## General comments

### @AceHack (2026-04-29T14:17:34Z)

Codex P2 (14:16Z) addressed in f6d6a94. Fixed memory-file documentation: `gh api --input '{json}'` was wrong syntax (gh treats --input value as a file path). Replaced with the actual heredoc-from-stdin pattern that was used live: `gh api ... --input - <<'EOF'` + JSON body + `EOF`. Added clarifying note about gh CLI flag semantics for future readers.

### @AceHack (2026-04-29T14:18:51Z)

Closing per Aaron's correction: this PR went LFG-first, but the canonical pattern is AceHack-first → LFG forward-sync → AceHack absorbs LFG squash-SHA. *"Without the double-hop in a few hours we'll be right back to where we started — that's load-bearing to get right."* Branch `post-0-0-0-cleanup-2026-04-29` is being repushed to AceHack remote and opened there as the canonical first PR. Codex P2 review feedback (gh api --input syntax fix) is preserved as commit `f6d6a94` on the branch + carried into the AceHack PR.
