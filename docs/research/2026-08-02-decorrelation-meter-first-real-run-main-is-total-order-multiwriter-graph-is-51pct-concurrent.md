# Decorrelation meter — first real run on the repo's own commit history

**Status:** EMPIRICAL / first run of the meter's **sensor (metrology) layer** on real data. The counts
are **register-2** (deterministic measurements over the real commit graph, our shipped code). The
fusion (S) was **not** run — no probe streams (register-3; not fabricated). Point-in-time (2026-08-02).
**From:** Otto (shadow), at Aaron's "run the meter on our real commit history."

## Method — our actual shipped code, on real git output

Ran the **shipped** `DecorrelationMetrology` (not a reimplementation) via
`dotnet fsi` referencing `Zeta.Core.dll`:
`git rev-list --parents -n 200 <ref>` → `DecorrelationMetrology.parseRevListParents` →
`DecorrelationMetrology.spacelikeCommitPairs`. Two windows (200 commits each): **main** (squash-linear)
and **--all** (across the ~20 concurrent branches live at the time — the fleet's `flush-work-*` and this
session's `book/*` · `docs/*` · `feat/*`). Script: `scratchpad/run-meter-sensor.fsx` (ephemeral).

## Results

| window (200 commits) | total pairs | spacelike (concurrent) | timelike (ordered) | spacelike ratio |
|---|---|---|---|---|
| **main** (squash-linear) | 19,900 | **0** | 19,900 | **0.0000** |
| **all refs** (last 200, `-n` truncated) | 19,900 | **10,138** | 9,762 | 0.5094 *(upper bound — see caveat)* |
| **causally-closed** (branches above `main~300`, 407 commits, no truncation) | 82,621 | **19,294** | 63,327 | **0.2335** |

## Reading (register-2 facts)

- **`main` is a total order.** Squash-merge discipline linearizes main into a chain, so *every* pair is
  causally ordered — **0 spacelike pairs**, and the CHSH meter therefore has **no valid pairs to fuse on
  main alone.** This is not a null result; it is a *confirmation* of the "spacelike pairs only" premise
  (two-fours memory): you cannot measure decorrelation on a totally-ordered chain. You need the
  multi-writer graph.
- **The multi-writer graph is genuinely concurrent (~23% truncation-free; 51% was the truncated upper bound).** Across the branches, a real fraction of commit pairs are spacelike —
  genuine causal concurrency from parallel branches (the fleet + this session's ~20 branches). *That* is
  where the meter has valid CHSH pairs to fuse.
- The sensor works **end-to-end on real data** (parse → spacelike selection), our shipped code.

## Caveats (register-honest — do not overread the 0.51)

- **Window truncation — now RESOLVED with a real number.** A bounded `-n 200` walk can't see ancestry
  *outside* the window, so an edge pair whose connecting path exits the window is mis-classified as
  concurrent — making 0.5094 a **within-window upper bound**. The follow-up **causally-closed** window
  (everything on local branches above the common floor `main~300`, 2026-07-31 — so no connecting commit
  is cut off) gives the truncation-free figure: **0.2335**. As predicted, removing truncation dropped
  the spacelike ratio (0.51 upper bound → **~0.23** truncation-free). The honest concurrency of the
  multi-writer graph is ~23%, not ~51%; the 0.51 was the artifact the caveat warned about. (Whole-history
  remains the un-enumerable side of the finite-map / hunt-the-attractor boundary; this window is
  causally-closed *above main~300*, which is enough for these branches.)
- **Fusion (S) not run.** There are no per-commit probe streams — the deliberately-unhardcoded
  register-3 piece. This is the **metrology / sensor** output only, never a decorrelation-S number; the
  missing piece for a real S is a **principled per-commit probe** (the register-3 frontier — forcing a
  commit→probe mapping would be numerology).

## What it validates + the open frontier

Validated (register-2): the sensor runs on real data; `main` is provably a chain; the branch graph
carries real concurrency (~50%) to measure. Open (register-3): a principled per-commit **probe** so the
fusion can produce a real S; and a **causally-closed window** to remove the truncation bound.

## Pointers
- `src/Core/DecorrelationMetrology.fs` (sensor) · `src/Core/DecorrelationMeter.fs` (fusion — awaits a probe).
- `docs/research/2026-08-02-cross-scale-decorrelation-band-*` (the model) · `…pilot-wave-done-right-*` (soft regime).
- two-fours memory (CHSH over spacelike git pairs; vector-clock not wall-clock) — this run is its first empirical touch.
- Reproduce: `git rev-list --parents -n 200 --all > f && dotnet fsi scratchpad/run-meter-sensor.fsx f`.
