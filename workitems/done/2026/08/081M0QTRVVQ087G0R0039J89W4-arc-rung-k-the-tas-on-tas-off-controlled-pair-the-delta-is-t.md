---
id: 081M0QTRVVQ087G0R0039J89W4
type: task
state: done
priority: P2
slug: arc-rung-k-the-tas-on-tas-off-controlled-pair-the-delta-is-t
title: "ARC rung K - the TAS-on/TAS-off controlled pair: the delta IS the measured value of the assistance, and the closest thing we can build to measuring Chollet's priors"
created: 2026-08-23T17:30:25.015Z
completed: 2026-08-27T21:58:00Z
depends_on: ["081M0QTRVSH087G0R000H5XSFW"]
composes_with: []
---

# ARC rung K - the TAS-on/TAS-off controlled pair: the delta IS the measured value of the assistance, and the closest thing we can build to measuring Chollet's priors

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QTRVVQ087G0R0039J89W4-*.md` glob. -->

**Register: `implemented`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §12.2.

The measurement value is not the assisted run — it is the **pair**: same agent, same ROM, same seed,
same budget, TAS-off vs TAS-on. **Δ is the measured value of the assistance.** That is an experiment,
not a caveat.

It is the same instrument design the repo has already run successfully:
`docs/research/2026-08-19-the-first-rung-is-a-conservative-extension-and-the-second-is-not-a-morphism-at-all.md`
held everything fixed, destroyed one named axis at a time, and reported a clean 4/16 diagonal as
**calibration evidence** that the instrument was neither blind nor blunt. Toggle one channel at a time
and the diagonal is the same shape.

**Why this is the strongest reason to build the meter:** §5.2(b) established that a time-only
denominator omits Chollet's priors `P` — the exact failure his formula was built to close. **TAS is
priors delivered mid-run** (a frozen health address is information about the solution the agent did not
have to acquire). So a metered TAS channel is the closest thing this substrate can build to measuring
`P` separately from `E`.

**Guard, from §12.7:** the toolkit's `COMPETITION` mode enforces strict leaderboard rules and any TAS
channel is presumably disqualifying there. TAS-on runs are **ours** — internal measurement, reported
with channel labels, never submitted as a benchmark score. I have not read their competition rules;
that is a stated gap, and the conservative reading is the one to hold.

Also note their scorer counts **agent actions**, so a read-only TAS channel is **invisible to their
denominator**. An assisted run that looks efficient on `h/a` while consuming 10^4 metered read
crossings is not efficient — it is _informed_, and only our meter can say so.

## Evidence

- `src/Core.TypeScript/chip8/tas-controlled-pair.ts` runs the clean leg without a grant and the
  assisted leg with a harness-issued `ChannelGrant`. The assisted key is derived from the clean key
  by changing only its channel label; subject identity and the validated action/step budget are
  shared immutable inputs.
- `src/Core/TasControlledPair.fs` provides the independent F# implementation over the immutable
  `ChannelMeter`. Both surfaces return typed feedback for invalid scores, budget overruns, refused
  legs, and rejected async executors.
- Five TypeScript tests and four F# tests pin fixed-condition identity, typed refusal, budget
  enforcement, read/write totals, and no-assisted-leg-after-clean-refusal.
- The TypeScript suite includes a real CHIP-8 pair: the same two-byte ROM executes normally as
  `V0 = 1`; the assisted leg injects `V0 = 2`; the report measures a `0.1` normalized-score delta and
  exactly two RAM-write crossings.

## Honest boundary

The harness controls the contexts it hands to the executor and freezes the TypeScript run key and
budget, but an in-process executor can still ignore that context or mutate emulator memory directly.
This result is a deterministic comparison harness over the typed path, not process isolation. The
stronger non-bypass claim still requires the separate process/WASM boundary named by rung I.

Assisted runs remain internal measurements. Nothing here submits them to an external leaderboard or
claims compliance with competition rules that have not been audited.
