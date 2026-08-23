---
id: 081M0QTRVVQ087G0R0039J89W4
type: task
state: backlog
priority: P2
slug: arc-rung-k-the-tas-on-tas-off-controlled-pair-the-delta-is-t
title: "ARC rung K - the TAS-on/TAS-off controlled pair: the delta IS the measured value of the assistance, and the closest thing we can build to measuring Chollet's priors"
created: 2026-08-23T17:30:25.015Z
depends_on: ["081M0QTRVSH087G0R000H5XSFW"]
composes_with: []
---

# ARC rung K - the TAS-on/TAS-off controlled pair: the delta IS the measured value of the assistance, and the closest thing we can build to measuring Chollet's priors

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QTRVVQ087G0R0039J89W4-*.md` glob. -->

**Register: `proposed`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §12.2.

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
