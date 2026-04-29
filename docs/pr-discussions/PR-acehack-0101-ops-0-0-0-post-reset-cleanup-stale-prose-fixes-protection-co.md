---
pr_number: 101
title: "ops(0-0-0): post-reset cleanup \u2014 stale-prose fixes + protection-config memory"
author: "AceHack"
state: "MERGED"
created_at: "2026-04-29T14:19:35Z"
merged_at: "2026-04-29T14:19:41Z"
closed_at: "2026-04-29T14:19:42Z"
head_ref: "post-0-0-0-cleanup-2026-04-29"
base_ref: "main"
archived_at: "2026-04-29T14:34:12Z"
archive_tool: "tools/pr-preservation/archive-pr.sh"
---

# PR #101: ops(0-0-0): post-reset cleanup — stale-prose fixes + protection-config memory

## PR description

## Summary

Canonical AceHack-first PR: post-reset cleanup after the 0/0/0 hard-reset achieved 2026-04-29T14:04:50Z. Two scoped changes:

1. **Stale-prose fixes in `docs/active-trajectory.md`** — flip post-reset contradicting language to in-force 0/0/0-achieved language
2. **Protection-config memory** — document the dual-layer surprise + Aaron's "delete legacy, rulesets canonical" decision

## Lineage

This PR was originally opened on LFG-side (Lucent-Financial-Group/Zeta#844) by mistake — Aaron correctly flagged that the canonical flow is AceHack-first → LFG forward-sync → AceHack absorbs LFG squash-SHA. *"Without the double-hop in a few hours we'll be right back to where we started — that's load-bearing to get right."* + the high-signal-data-multiplier framing: 2× review-agent passes per PR = 2× signal for the training corpus.

LFG #844 closed; branch repushed to AceHack as the canonical first stop. Includes Codex P2 review feedback from the LFG side (gh api --input syntax fix at commit `f6d6a94`) preserved as part of the branch history.

## 🎯 0/0/0 ACHIEVED 2026-04-29T14:04:50Z

```
AceHack/main = LFG/main = 621aae082d70fcbf36931718ecf1b6d9e149295f
Topology:    0 ahead, 0 behind, 0 file content diff
Archive ref: archive/acehack-main-pre-000-reset-2026-04-29 → 6755081... (preserved)
Layers:      legacy DELETED (per Aaron); rulesets canonical
```

## Stale-prose fixes (Amara substrate-pass catch)

Two paragraphs flipped from pre-reset state to in-force post-reset state:
- *"Currently NOT signoff-eligible"* → *"0/0/0 ACHIEVED 2026-04-29T14:04:50Z..."*
- *"Hard-reset is NOT YET signoff-eligible"* → *"Hard-reset complete (2026-04-29T14:04:50Z)..."*

Derived-Rollup Drift class — primary state changed, downstream prose still claimed old state.

## Protection-config memory

`memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md`:

- AceHack/Zeta had BOTH legacy branch protection AND repository rulesets on `main`
- Both layers enforced independently; GitHub UI doesn't surface dual-layer state
- Aaron: *"I knew there were two but I was confused why."*
- Maintainer call: legacy DELETED, rulesets canonical going forward
- Error-code mapping: `GH013` = rulesets surface, `GH006` = legacy surface
- Diagnostic script (`gh api` commands, with correct heredoc-stdin syntax per Codex's feedback) for future audits
- Future-protocol note: rulesets `non_fast_forward` rule still doesn't match CLAUDE.md *"force-push to AceHack main is part of protocol"* — task #305 home for that decision

`MEMORY.md` index updated with one-line pointer.

## Tick shard 1410Z

Records the entire 0/0/0 hard-reset arc.

## Sequence after this PR merges

1. AceHack/main advances by 1 (this content)
2. Open forward-sync PR on LFG/Zeta with this content
3. After LFG forward-sync merges, force-push AceHack/main to LFG's squash-SHA (absorbs the LFG squash, restoring AceHack/main = LFG/main exactly)
4. AceHack/main = LFG/main again — 0/0/0 holds

## Authority boundary going forward (per Amara post-reset packet)

```
Reversible + in-lane + PR-reviewed → proceed autonomously
Irreversible / deletion / force-push / authority config / identity canon → ask Aaron
Unclear → stop, report exact uncertainty, propose one safe action
```

## Test plan

- [x] Stale "Currently NOT signoff-eligible" → in-force 0/0/0-achieved language
- [x] Stale "Hard-reset is NOT YET signoff-eligible" → "Hard-reset complete" language
- [x] Memory file written with corrected gh CLI syntax + MEMORY.md index updated
- [x] Tick shard 1410Z appended
- [x] Branch opened AceHack-first per double-hop discipline
- [ ] CI green
- [ ] Codex / Copilot reviews resolved if any threads land
- [ ] LFG forward-sync PR opened after merge
- [ ] AceHack absorbs LFG squash-SHA after forward-sync merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-04-29T14:24:13Z)

## Pull request overview

Post-0/0/0 hard-reset cleanup PR that updates current-state docs/memory to reflect the achieved 0/0/0 status and captures a durable debugging note about GitHub’s dual-layer protection enforcement (legacy branch protection + rulesets) on AceHack/Zeta.

**Changes:**
- Add a new protection-config memory documenting GH013 vs GH006 and a `gh api` audit/diagnostic sequence.
- Update `docs/active-trajectory.md` prose to reflect that the 0/0/0 hard-reset has completed.
- Append a tick shard row and add a new `MEMORY.md` index entry pointing to the new memory.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md | New memory documenting dual-layer protection enforcement + commands/error-code mapping. |
| memory/MEMORY.md | Adds newest-first index entry pointing to the new protection-config memory. |
| docs/hygiene-history/ticks/2026/04/29/1410Z.md | New tick shard entry recording the 0/0/0 reset arc + follow-up PR. |
| docs/active-trajectory.md | Flips stale “not signoff-eligible” / “not yet” language to post-reset “complete/achieved” state. |

## Review threads

### Thread 1: memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md:101 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-29T14:24:11Z):

P1: This file references `memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`, but that file does not exist in-repo (the path 404s). This leaves a broken cross-reference in the new memory. Either add the missing memory file in this PR, or update the reference to the correct existing in-repo memory that captures the same rule.

### Thread 2: memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md:41 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-29T14:24:12Z):

P1: The “Delete legacy branch protection” example is confusing/internally inconsistent: the comment says legacy protection was deleted, but the shown DELETE call returns “Branch not protected” (404), which indicates there was nothing to delete at that moment. Consider clarifying the sequence (e.g., DELETE returns 204 when protection exists; 404 means it was already removed) or adjusting the narrative so readers don’t infer that 404 = successful deletion.

### Thread 3: memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md:18 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-29T14:24:12Z):

P2: Minor wording issue: “the only rulesets ruleset” reads like a duplicated word and is easy to misread. Consider simplifying to “the only ruleset” (or “the only repository ruleset”).

### Thread 4: memory/MEMORY.md:5 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-29T14:24:12Z):

P2: `MEMORY.md` index entries are expected to be terse (memory/README.md notes the index is capped at ~200 lines and should stay short). This new entry is very long for a single-line index item; consider trimming the summary here and leaving the detailed narrative inside the linked memory file.
