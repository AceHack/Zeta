# PR-preservation drain-log — AceHack #101

**PR:** AceHack/Zeta#101
**Title:** ops(0-0-0): post-reset cleanup — stale-prose fixes + protection-config memory
**Opened:** 2026-04-29T14:18Z
**Merged:** 2026-04-29T14:19:41Z (squash; merge commit `5485772e87d74f3b96cdac4f39063cb0e82d7839`)
**Branch:** post-0-0-0-cleanup-2026-04-29 → main
**Status checks:** 17 ran; AceHack has no required-status-checks rule, so auto-merge fired ~2 min after open

## Threads (4 unresolved Copilot threads at merge — filed 14:24:11Z, AFTER auto-merge fired at 14:19:41Z)

The threads landed AFTER the merge because AceHack has no required-conversation-resolution rule and no required-status-checks rule — auto-merge didn't wait for Copilot's review. Copilot's findings still apply to the merged content; corrected in the post-#101 follow-up double-hop cycle.

### Thread 1 — Copilot P1 — broken xref to user-scope memory file

**Path:** memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md
**Filed:** 2026-04-29T14:24:11Z
**Outcome class:** FIX (real broken-xref)

> P1: This file references `memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`, but that file does not exist in-repo (the path 404s). This leaves a broken cross-reference in the new memory. Either add the missing memory file in this PR, or update the reference to the correct existing in-repo memory that captures the same rule.

**Resolution path (post-#101 follow-up cycle):** The visibility-constraint memory exists in user-scope memory only (`~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`), not in-repo. The xref was therefore broken from an in-repo file pointing at a user-scope-only file. Replaced with a generic prose pointer to the underlying principle + a note that the existing `MEMORY.md` index entry has the same broken-pointer issue (pre-existing) and should be either backfilled to in-repo or removed in a future audit pass.

### Thread 2 — Copilot P1 — internal consistency on legacy DELETE response

**Path:** memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md
**Filed:** 2026-04-29T14:24:12Z
**Outcome class:** FIX (already-applied — was duplicate of LFG #844 Thread 3)

> P1: The "Delete legacy branch protection" example is confusing/internally inconsistent: the comment says legacy protection was deleted, but the shown DELETE call returns "Branch not protected" (404), which indicates there was nothing to delete at that moment. Consider clarifying the sequence (e.g., DELETE returns 204 when protection exists; 404 means it was already removed) or adjusting the narrative so readers don't infer that 404 = successful deletion.

**Resolution path:** Already addressed by the carried-forward fix from LFG #844 Thread 3 (in commit `19f8f0b` on the LFG forward-sync side). The post-fix memory file shows DELETE returned rc=0 (success / 204 No Content) with the 404 coming from a separate verification GET. AceHack #101 merged BEFORE this fix landed, so the merged AceHack/main has the pre-fix text. The post-#101 follow-up cycle carries the fix to AceHack via the next AceHack-first PR.

### Thread 3 — Copilot P2 — wording "the only rulesets ruleset"

**Filed:** 2026-04-29T14:24:12Z
**Outcome class:** FIX (already-applied — same path as Thread 2)

> P2: Minor wording issue: "the only rulesets ruleset" reads like a duplicated word and is easy to misread. Consider simplifying to "the only ruleset" (or "the only repository ruleset").

**Resolution path:** Same as Thread 2 — already fixed in LFG #845 (carried forward in commit on the LFG-side branch); AceHack/main currently has the pre-fix text; carried into post-#101 follow-up cycle.

### Thread 4 — Copilot P2 — MEMORY.md index entry too long

**Path:** memory/MEMORY.md
**Filed:** 2026-04-29T14:24:12Z
**Outcome class:** FIX

> P2: `MEMORY.md` index entries are expected to be terse (memory/README.md notes the index is capped at ~200 lines and should stay short). This new entry is very long for a single-line index item; consider trimming the summary here and leaving the detailed narrative inside the linked memory file.

**Resolution path (post-#101 follow-up cycle):** Trimmed the index entry from a 4-line dense paragraph to a single concise line per `memory/README.md` discipline. Detail stays in the linked memory file.

## Issue-level comments

(none — auto-merged before any landed)

## Reviews

- **Copilot — COMMENTED at 14:24:13Z**: PR-overview review enumerating the 4 review-thread findings (consolidated review summary).

## Outcome class summary

- 4 threads total: ALL UNRESOLVED at merge time (because auto-merge fired before review landed)
- Outcome classes: 1 P1 broken-xref (FIX), 1 P1 internal-consistency (FIX, already-applied), 1 P2 wording (FIX, already-applied), 1 P2 MEMORY.md verbose (FIX)
- All 4 fixes carry into the post-#101 follow-up double-hop cycle

## Lessons for future PRs

1. **AceHack auto-merge races Copilot review** — without required-conversation-resolution + required-status-checks on AceHack, auto-merge can fire BEFORE reviewers land their threads. The threads still apply to the merged content; just need a follow-up cycle to land fixes. Worth flagging that AceHack's review surface is "best effort, post-hoc" while LFG's is "pre-merge gating."

2. **The double-hop captures BOTH waves of review** — even when AceHack auto-merges fast, the LFG forward-sync PR re-runs review and catches the same findings (LFG #844 caught the same internal-consistency + wording issues). The double-hop is also a *redundancy mechanism* against fast-merge-on-AceHack.

3. **`gh repo view` doesn't accept `GH_REPO` env var override** — the existing `tools/pr-preservation/archive-pr.sh` uses `gh repo view --json owner,name` which resolves to current-clone origin. To archive cross-fork PRs, either run from a clone with the right origin, run `gh repo set-default <fork>/<repo>` first, or write the archive manually with fork-prefixed filename. Captured here as a tool-improvement candidate.

4. **Cross-fork archive filename collision** — if AceHack and LFG both have a PR #101, single-namespace `PR-0101-<slug>.md` filenames collide. Use fork-prefixed naming for cross-fork: `PR-acehack-0101-<slug>.md` / `PR-lfg-0101-<slug>.md`. Until tool supports `--repo` arg, manual archive with fork-prefixed name is the workaround.

## Relationship to other PRs in this round

- LFG #844 — opened LFG-first by mistake, closed; threads documented at `lfg-844-drain-log.md`. Most threads' fixes carried into LFG #845.
- LFG #845 — forward-sync of AceHack #101 + LFG #844 fixes + this drain-log; merged 14:27:35Z (squash → `3785124...`).
- This PR (AceHack #101) — first canonical hop; merged 14:19:41Z. The 4 Copilot threads landed AFTER merge and are corrected in the post-#101 follow-up double-hop.
- Pending — AceHack absorbs LFG squash-SHA `3785124...` to restore 0/0/0 (gates on Aaron's `EXECUTE`).
