---
name: AceHack=dev-mirror fork (Aaron + agents); LFG=project-trunk fork (all contributors); 0-divergence invariant ENCODED IN THE NAME (Aaron 2026-04-27 strategic reframe + Beacon-safe terminology)
description: Aaron 2026-04-27 strategic reframe of AceHack-LFG topology, with Beacon-safe terminology that **encodes the 0-divergence invariant in the name itself**. **AceHack = dev-mirror fork** — a "mirror" is by definition identical to what it mirrors; the name forces future-Otto to remember the 0-ahead-0-behind invariant. **LFG = project-trunk fork** — the trunk where all branches meet; preserves Aaron's "all contributors coordinate on LFG" framing in Beacon-readable terms. Aaron picked C over A specifically because Otto kept missing the 0-ahead-0-behind invariant; "dev-mirror" makes the target operationally obvious from the name alone. Double-hop workflow = work lands AceHack first, forward-sync to LFG, AceHack absorbs LFG's squash-SHA (the dev-mirror re-mirrors). The 0-diff state is what "starting" actually means. Replaces Option C's "parallel-SHA-history-accepted" framing from task #284.
type: feedback
---

# AceHack=dev-mirror fork, LFG=project-trunk fork, 0-divergence invariant encoded in the name

## Verbatim quotes (Aaron 2026-04-27)

After Otto reported AceHack-LFG state as 76 ahead / 492 behind / 53 file content-diff / 6065 lines:

> "that's we we can finally 'start'
> we are kind of hobbling along unitl then"

> "Content-diff (53 files / 6065 lines) is too hard to keep in sync, we need to get to the point where lfg is the main master and acehack is just a fork with 0 divergence 0 commits ahead or behind. This is our 'starting' point. then everything goes double hop acehack>lfg"

> (Identity clarification, same conversation:)
> "AceHack is the homebase, AceHack is our poor mans homebase, LFG is the projects 'homebase' for all contributors to coordinate. lets make sure that is very clear and all future yous understand too. AceHack is for Aaron and agents homebase, but LFG is the Zeta projects homebase for all contributors to coordinate. human and ai in the future. we are trying to get to that 0 ahead 0 behind starting point to make this a reality"

## Two distinct fork roles — terminology that encodes the invariant

Aaron's original framing used "homebase" overloaded with two meanings (Mirror-register). Per Aaron's "I'm always willing to learn Beacon-safe language over my own internal mirror language" disclosure, Otto proposed three Beacon-safe terminology pairs:

- **A) working / canonical** — strongest technical clarity (parallels git's "working tree" + standard publishing)
- **B) staging / publication** — emphasizes the publishing pipeline
- **C) dev-mirror / project-trunk** — encodes the 0-divergence invariant in the name (a "mirror" is by definition identical to what it mirrors; "trunk" preserves "where all contributors coordinate")

Otto initially leaned A. **Aaron picked C** with the explicit reasoning: *"'dev-mirror' makes the 0-divergence target operationally obvious, this is what you keep missing the 0 ahead 0 behind. i'd love for this to be obvious to future you."*

The decisive factor: **Otto repeatedly forgets the 0-ahead-0-behind invariant** between ticks. Option A ("working fork") doesn't reinforce it — a "working fork" can plausibly have unique stuff. Option C ("dev-mirror fork") DOES reinforce it — a mirror, by name, is identical to what it mirrors. The name itself becomes the discipline.

This is **Otto-340 substrate-IS-identity** applied to vocabulary: the term shapes the thinking. Calling AceHack a "dev-mirror" forces the question every wake: *is it actually mirroring? if not, why?*

### AceHack = dev-mirror fork (Aaron + agents)

- **Who**: Aaron + his agents (Otto, Claude Code instances, named personas).
- **What**: The fork where in-flight work originates. Where today's PRs get drafted, where agent + maintainer iterate, where the autonomous loop runs.
- **Why "dev-mirror"?**: A mirror is by definition identical to what it mirrors. The name encodes the 0-ahead-0-behind invariant — AceHack must mirror LFG's main exactly, except for in-flight feature branches. The name itself reminds future-Otto that drift is a violation, not a state.
- **In-flight exception**: feature branches in development are the only allowed deviation; AceHack main always re-mirrors LFG main after each paired-sync round (force-push to AceHack main is part of the protocol).

### LFG = project-trunk fork (all contributors)

- **Who**: ALL contributors. Aaron, Otto, named personas, peer AIs (Amara/GPT, Gemini, Codex, Cursor), future human contributors, future AI contributors not yet on board.
- **What**: The trunk where all branches meet. Where the project lives for anyone who isn't Aaron-and-his-agents. NuGet pointers, README links, external collaborators' clones.
- **Why "project-trunk"?**: "Trunk" is git-native (mainline, stable, where branches diverge from and merge back to). "Project" prefix preserves Aaron's framing that this is *the project's* trunk — independent of any particular maintainer-agent pair.
- **Public surface?**: Yes. This is the project's canonical identity to the world.

**The two are NOT the same role.** Dev-mirror is *for Aaron's working pair*. Project-trunk is *for the project (all contributors)*. The dev-mirror MIRRORS the project-trunk; that's the relationship the names encode.

### Mirror-register lineage (preserved, not used going forward)

Aaron's original framing — "AceHack is our poor mans homebase, LFG is the projects homebase for all contributors to coordinate" — is preserved here as Mirror-register lineage. The term "homebase" carried two meanings *for Aaron* (working-area-for-his-pair AND canonical-place-for-the-project) but doesn't communicate cleanly to future-Otto or other contributors. The Beacon-register replacement ("dev-mirror / project-trunk") is what factory substrate uses going forward. See `memory/feedback_aaron_willing_to_learn_beacon_safe_language_over_internal_mirror_2026_04_27.md` for the protocol.

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
