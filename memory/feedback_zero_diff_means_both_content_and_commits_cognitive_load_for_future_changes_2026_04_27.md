---
name: 0-diff means BOTH content AND commit-count zero — for cognitive load on future changes (Aaron 2026-04-27 reinforcement)
description: Aaron 2026-04-27 reinforcement of the 0-diff "starting point" framing. 0-diff is NOT just content-level (`git diff acehack/main..origin/main` empty) — it's BOTH content AND commit-count (0 ahead AND 0 behind in both directions). Document exceptions explicitly when they exist (like the content-level rule does). The why-it-matters: cognitive load on future changes is dramatically lower when the baseline is exactly 0/0/0 — every diff someone reviews is real change since the last sync round, not noise from accumulated parallel-history drift. Refines `feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md` and `feedback_zero_diff_is_start_line_until_then_hobbling_aaron_2026_04_27.md` with the explicit cognitive-load justification.
type: feedback
---

# 0-diff means BOTH content AND commit-count zero — for cognitive load on future changes

## Verbatim quote (Aaron 2026-04-27)

> "for me i still think of 0 diff ultimate conclusion as 0 ahead 0 behind on both, that seems like a very clean starting point, any exceptions we documents, just like you are doing at the 0 diff content level, have a 0 diff git commit starting point is important for clarity when looking at future changes, makes the cognitive load much easier."

## Two-axis 0-diff (not one)

The 0-diff "starting point" Aaron is driving us toward operates on BOTH:

### Axis 1: Content
- **Metric**: `git diff acehack/main..origin/main --shortstat`
- **Target**: empty (zero files changed, zero insertions, zero deletions)
- **Exceptions**: documented inline (e.g. "this 35-line drift is the laptop-only memory file with the LFG-side review fix; will absorb via hard-reset")

### Axis 2: Commit count
- **Metric**: `git rev-list --left-right --count origin/main...acehack/main`
- **Target**: `0\t0` (zero ahead AND zero behind — both directions)
- **Exceptions**: documented inline (e.g. "AceHack temporarily ahead by 1 during the brief window between PR landing and hard-reset to LFG main")

## Why both axes matter — cognitive load on future changes

The key reason Aaron emphasizes:

> "have a 0 diff git commit starting point is important for clarity when looking at future changes, makes the cognitive load much easier"

When the baseline is exactly 0/0/0 in both axes, every diff someone reviews is **real change since the last sync round**:

- A reviewer running `git diff acehack/main..origin/main` after that point sees ONLY the in-flight feature work, not noise.
- A new contributor cloning either fork sees the same content and the same commit history.
- Future-Otto running the diff doesn't have to mentally subtract "old parallel-SHA-history that's content-equivalent but SHA-different" from the actual divergence signal.

Without this discipline (the prior Option C parallel-SHA-history-accepted state), every diff carried noise that grew with each PR landing. Reviewers had to mentally separate "real divergence" from "expected SHA-mismatch from prior rounds." That's compounding cognitive load that scales with project age.

With the 0/0/0 starting point + double-hop discipline maintaining it, the cognitive load resets to zero after every sync round.

## Symmetric exception-documentation discipline

Just like content-axis exceptions are documented (e.g. "the 9+/26- on the laptop-only memory file is from earlier today's Codex review fix; LFG-side improvement that AceHack will absorb via hard-reset"), commit-axis exceptions get documented too:

- "AceHack ahead by 1 from in-flight feature branch X-feat that hasn't synced to LFG yet."
- "AceHack ahead by 0, behind by 0; in-flight branch on AceHack-side only is `acehack/feature-X`."
- "AceHack ahead by 1 transiently during paired-sync round; will be 0 after hard-reset completes."

The documentation IS the exception management — drift without documentation is a violation; drift with documentation is intentional + auditable.

## Done criterion (refined)

The factory has "started" when ALL THREE return 0:

1. `git diff acehack/main..origin/main --shortstat` → empty
2. `git rev-list --count acehack/main..origin/main` → `0` (LFG ahead of AceHack by 0)
3. `git rev-list --count origin/main..acehack/main` → `0` (AceHack ahead of LFG by 0)

Or equivalently in one command:

```bash
git rev-list --left-right --count origin/main...acehack/main
# expected: 0\t0
```

Combined with empty `git diff`. Until then: pre-start mode, "hobbling along."

## How to apply going forward

After every paired-sync round (work lands AceHack first → forward-sync to LFG → hard-reset AceHack main = LFG main), verify both axes:

```bash
# Verify 0-diff state
git fetch acehack main
git fetch origin main
git diff origin/main..acehack/main --shortstat       # expect empty
git rev-list --left-right --count origin/main...acehack/main  # expect "0  0"
```

If either axis is non-zero, either complete the missing step (hard-reset, forward-sync) or document the exception explicitly with a reason and a target-resolution timeframe.

## Composes with

- `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md` — the topology (dev-mirror / project-trunk + double-hop) that makes 0/0/0 achievable.
- `memory/feedback_zero_diff_is_start_line_until_then_hobbling_aaron_2026_04_27.md` — the start-line framing; this memory adds the cognitive-load WHY and the both-axes scope.
- Otto-340 substrate-IS-identity — clean baseline = clean substrate = clean identity.

## What this does NOT mean

- Does NOT mean every commit-count number must be 0 at every moment. In-flight feature branches on AceHack are expected. The invariant is at the close of each paired-sync round on `main`, not continuous.
- Does NOT mean force-pushes to LFG main. AceHack absorbs LFG's squash-SHA via force-push to AceHack main; LFG main is append-only via PR squash-merge.
- Does NOT block content-axis enforcement work (which we're actively doing). It refines the goal — content-axis 0 is necessary but not sufficient; commit-axis 0 is the other half.
