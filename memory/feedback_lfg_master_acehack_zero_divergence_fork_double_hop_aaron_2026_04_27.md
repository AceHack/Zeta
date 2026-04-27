---
name: LFG=master, AceHack=0-divergence fork, double-hop AceHack→LFG (Aaron 2026-04-27 strategic reframe)
description: Aaron 2026-04-27 strategic reframe of AceHack-LFG topology — bidirectional content-sync (53 files / 6065 lines) is too hard; instead make LFG the master and AceHack a pure fork with 0 commits ahead AND 0 commits behind. After every PR cycle, AceHack main is hard-reset to LFG main. Going forward: "double hop" workflow = work lands on AceHack first, syncs to LFG, AceHack absorbs LFG's squash-SHA. This is what "starting" actually means. Replaces Option C's "parallel-SHA-history-accepted" framing from task #284.
type: feedback
---

# LFG=master, AceHack=0-divergence fork, double-hop AceHack→LFG

## Verbatim quotes (Aaron 2026-04-27)

After Otto reported AceHack-LFG state as 76 ahead / 492 behind / 53 file content-diff / 6065 lines:

> "that's we we can finally 'start'
> we are kind of hobbling along unitl then"

> "Content-diff (53 files / 6065 lines) is too hard to keep in sync, we need to get to the point where lfg is the main master and acehack is just a fork with 0 divergence 0 commits ahead or behind. This is our 'starting' point. then everything goes double hop acehack>lfg"

## Strategic reframe — what changed

**Before (Option C, task #284):** parallel-SHA-history-accepted. Both forks had unique commits via squash-merge-different-SHA pattern. Bidirectional sync was the model. Commit-count divergence was structural and never zero. Content-diff was the only metric that mattered.

**After (Aaron 2026-04-27):** AceHack is a pure fork. After every PR cycle, AceHack main = LFG main. Both **commit-count divergence (0 ahead, 0 behind) AND content-diff (0 files differ)** are zero. There is no parallel SHA history — AceHack absorbs LFG's squash-SHA after each round.

This is a **stricter invariant**: 0 ahead AND 0 behind, not just "few content drifts rigorously accounted for."

## Operational model — "double hop"

The double-hop workflow:

1. **Work lands on AceHack first** (homebase: feature-branch → PR → squash-merge to AceHack main → AceHack main now has commit X-ace).
2. **Forward-sync to LFG** (sibling PR cherry-picking the content → squash-merge to LFG main → LFG main now has commit X-lfg).
3. **AceHack absorbs LFG's SHA** (hard-reset AceHack main to LFG main → AceHack main now has X-lfg, dropping X-ace).

Net effect: AceHack and LFG main always share identical SHAs. There is no AceHack-unique commit history. Force-push to AceHack main is part of the protocol (force-push to LFG main is forbidden).

## Why this works

LFG is the published canonical surface — external consumers (NuGet, README links, etc.) point at LFG. Making LFG the source of truth + ensuring AceHack matches eliminates the "which fork has the canonical X" ambiguity that surfaced today (e.g., Graph.fs Gershgorin shift fix existed on AceHack but not LFG; resume-diff.yml had AceHack-only improvements; today's 6065-line drift).

AceHack as 0-divergence fork serves only one purpose: **a place to land in-flight feature branches before they sync to LFG**. AceHack main itself is just LFG main + maybe one in-flight feature.

## Path from current state to "start"

1. **Audit AceHack's 76 unique commits**: verify their CONTENT is already on LFG (likely yes — most via prior Option C cherry-pick-syncs that produced different SHAs but same content).
2. **For any genuine AceHack-only content**: forward-sync to LFG first (paired PR, normal flow).
3. **Hard-reset AceHack main = LFG main**: drops AceHack-unique SHAs. Any genuine new content already exists on LFG via step 2. Force-push to AceHack main.
4. **Verify**: `git diff acehack/main..origin/main` returns empty AND `git rev-list --count acehack/main..origin/main` returns 0 AND `git rev-list --count origin/main..acehack/main` returns 0.
5. **From this point: factory has "started."** Future work uses double-hop strictly.

## Composes with

- `memory/feedback_zero_diff_is_start_line_until_then_hobbling_aaron_2026_04_27.md` — earlier substrate from same conversation; this one extends with the LFG-as-master + double-hop topology.
- Task #284 Option C (now superseded — parallel-SHA-history is no longer accepted; we collapse to 0).
- Task #302 UPSTREAM-RHYTHM bidirectional drift — now resolved by the new model: drift can't accumulate because AceHack main = LFG main is the after-every-round invariant.
- Otto-340 substrate-IS-identity — LFG IS the canonical published identity; AceHack is just dev surface.
- Otto-238 retractability — force-push to AceHack is retractable (rollback to prior LFG snapshot); force-push to LFG is forbidden.

## Done criterion

`git diff acehack/main..origin/main` returns empty.
`git rev-list --count acehack/main...origin/main` returns 0 in both directions.

Once both are zero, factory has "started." Any subsequent divergence is a violation of the invariant and gets corrected immediately.

## What this does NOT change

- Aaron's `/btw` non-interrupting aside protocol still applies.
- Otto-357 NO DIRECTIVES still applies (Aaron's input here is observation/reframe, not directive — Otto's judgment update is "shift priority and topology accordingly").
- The `0-diff is start line` framing from the earlier 2026-04-27 memory is reinforced, not replaced — this memory describes HOW to operationalize that line.
