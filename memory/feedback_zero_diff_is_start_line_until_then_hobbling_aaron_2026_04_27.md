---
name: 0-diff is "start" line — until then we're hobbling (Aaron 2026-04-27)
description: Aaron's reframe of the AceHack-LFG content-divergence work — until AceHack and LFG main reach 0-diff (53 files / 6065 lines as of 2026-04-27 16:33Z), the factory is "kind of hobbling along." 0-diff isn't polish; it's the gate to "starting." High-priority work, not optional cleanup.
type: feedback
---

# 0-diff is "start" line — until then we're hobbling

## Verbatim quote (Aaron 2026-04-27)

After Otto reported the AceHack-LFG divergence as 53 files / 6065 lines / 76+492 commit-count split:

> "that's we we can finally 'start'
> we are kind of hobbling along unitl then"

## What this means

The AceHack-LFG content divergence isn't a polish/hygiene concern — it's the **gate to factory operational status**. Until 0-diff, the factory is in pre-start mode; everything else (substrate landings, sync rounds, review cycles) is "hobbling."

This composes with #43's diff-minimization invariant: that invariant DEFINES "started." Without it, no claim that the factory has actually started carries weight — there's hidden divergence, ambiguous canonical truth, fixes that exist on one fork but not the other (e.g., Graph.fs Gershgorin spectral shift correction).

## Why: high-priority reframe, not "polish"

Before this input, Otto framed the reverse-sync work as a multi-week long-running project — "easy wins this week, source code next week, big substrate the week after." That framing was wrong. Aaron's "we can finally start" reframe makes it:

- **Not optional**: until 0-diff, every claim about factory operability has a hidden caveat ("but only on one fork").
- **Not polish**: it's the gate, not the trim.
- **Not deferrable**: every sync round that doesn't reduce content-diff is a sync round that perpetuates pre-start.

## How to apply: priority signal for reverse-sync work

When triaging work, the reverse-sync project (LFG→AceHack content closure) goes near the top of the priority stack, not the bottom. Concrete:

1. **Workflow drift first** (~80 lines, 1-2h, easy wins on AceHack-side): close 4 remaining workflow file diffs (`gate.yml` 4 lines, `backlog-index-integrity.yml` 17 lines, `memory-index-integrity.yml` 8 lines, `resume-diff.yml` 53 lines).
2. **Source code reconcile** (~250 lines, 2-4h, real correctness): Graph.fs Gershgorin shift, TemporalCoordinationDetection.fs helper extraction, RobustStats.fs NaN guard — make sure both forks have all the algorithm fixes.
3. **LFG-only substrate** (~5500 lines, 4-8h, biggest chunk): docs/BACKLOG.md per-row restructure (4113 lines), docs/GLOSSARY.md (292), docs/marketing/*, history docs, tools/hygiene/validate-agencysignature*.sh, tools/peer-call/grok.sh. This is the LFG→AceHack reverse-sync proper.
4. **Memory file diffs** (~35 lines, 30min): the laptop-only-source-integration entry mostly.
5. **0-diff verification check under `tools/sync/`** per #43's spec — automate the diff measurement so we never lose track of where we are.

## SUPERSEDED — see `feedback_zero_diff_means_both_content_and_commits_cognitive_load_for_future_changes_2026_04_27.md`

The original framing here said "commit-count NEVER zero, structural; content-diff is the only metric." Aaron 2026-04-27 reinforcement updated that: **0-diff means BOTH axes** (content AND commit-count) zero, with documented exceptions. The dev-mirror / project-trunk topology + double-hop workflow makes this achievable: AceHack absorbs LFG's squash-SHA via hard-reset, so commit-count returns to 0/0 after every paired-sync round.

Done criterion (refined):

- `git diff acehack/main..origin/main` empty
- `git rev-list --left-right --count origin/main...acehack/main` returns `0  0`

The cognitive-load justification: when both axes are 0/0/0, every diff a reviewer sees is real change since the last sync round, not noise from accumulated parallel-SHA-history.

## Composes with

- `memory/feedback_natural_home_of_memories_is_in_repo_now_all_types_glass_halo_full_git_native_2026_04_24.md` — Glass Halo full git-native invariant. AceHack-LFG drift IS Glass Halo violation in flight.
- Task #284 Option C decision (AceHack catches up via UPSTREAM-RHYTHM going forward).
- Task #302 (UPSTREAM-RHYTHM bidirectional drift; this entry refines that task's framing — drift-closure is the "start" gate, not just routine hygiene).
- Otto-357 NO DIRECTIVES — Aaron's input here is framing/observation, not directive. The judgment-update is mine: priority shifts based on Aaron's "start" framing.

## Forward-action

Today's tick (2026-04-27 16:35Z): kick off Batch 1 (workflow drift, ~80 lines, 1-2h) immediately rather than defer. Concrete progress on the gate.
